#include "runix/runner.hpp"
#include "runix/capability.hpp"
#include "runix/planner.hpp"
#include "runix/sandbox.hpp"
#include "runix/process.hpp"
#include "runix/path_resolver.hpp"
#include "runix/common.hpp"
#include <iostream>

namespace runix {

JsonValue RunResult::to_json() const {
    JsonValue j = JsonValue::object();
    j["success"] = success;
    j["exitCode"] = exitCode;
    j["durationMs"] = durationMs;
    j["phase"] = phase;
    if (!stdoutData.empty()) j["stdout"] = stdoutData;
    if (!stderrData.empty()) j["stderr"] = stderrData;
    if (!errorCode.empty()) j["errorCode"] = errorCode;
    if (!errorMessage.empty()) j["errorMessage"] = errorMessage;
    return j;
}

RunResult RunixRunEngine::run(
    const CoreRequest& request,
    std::function<void(const StreamEvent&)> on_event
) {
    RunResult res;
    std::string execId = request.executionId.empty()
        ? ("exec_" + std::to_string(current_timestamp_ms()))
        : request.executionId;

    // 1. Materialize sandbox
    std::string runnerRoot = request.workspaceDir.empty()
        ? RunixSandbox::materialize(execId, request.files)
        : request.workspaceDir;

    std::vector<std::string> fileNames;
    for (const auto& f : request.files) {
        fileNames.push_back(f.path);
    }

    std::string targetFile = request.targetFile.empty() ? request.filename : request.targetFile;
    targetFile = RunixPathResolver::normalize_logical_path(targetFile);

    // 2. Resolve capability & preflight check
    ResolvedCapabilities caps = RunixCapabilityResolver::resolve(targetFile, runnerRoot, fileNames);

    if (caps.fileType == "compiled" || caps.languageId == "java") {
        if (!caps.canBuild) {
            res.success = false;
            res.exitCode = 1;
            res.phase = "preflight";
            res.errorCode = "COMPILER_UNAVAILABLE";
            res.errorMessage = caps.statusReason.empty()
                ? (caps.languageName + " compiler is unavailable in current execution environment.")
                : caps.statusReason;

            if (on_event) {
                StreamEvent ev;
                ev.type = "error";
                ev.phase = "build";
                ev.tool = caps.compilerExecutable;
                ev.errorCode = res.errorCode;
                ev.message = res.errorMessage;
                on_event(ev);

                StreamEvent exitEv;
                exitEv.type = "exit";
                exitEv.exitCode = 1;
                exitEv.durationMs = 0;
                on_event(exitEv);
            }

            if (request.workspaceDir.empty()) RunixSandbox::cleanup(runnerRoot);
            return res;
        }
    }

    if (!caps.canRun) {
        res.success = false;
        res.exitCode = 1;
        res.phase = "preflight";
        res.errorCode = "RUNTIME_UNAVAILABLE";
        res.errorMessage = caps.statusReason.empty()
            ? (caps.languageName + " runtime is unavailable in current execution environment.")
            : caps.statusReason;

        if (on_event) {
            StreamEvent ev;
            ev.type = "error";
            ev.phase = "exec";
            ev.tool = caps.runtimeExecutable;
            ev.errorCode = res.errorCode;
            ev.message = res.errorMessage;
            on_event(ev);

            StreamEvent exitEv;
            exitEv.type = "exit";
            exitEv.exitCode = 1;
            exitEv.durationMs = 0;
            on_event(exitEv);
        }

        if (request.workspaceDir.empty()) RunixSandbox::cleanup(runnerRoot);
        return res;
    }

    // 3. Compile phase if required
    if (caps.fileType == "compiled" || caps.languageId == "java") {
        BuildPlan bplan = RunixPlanner::create_build_plan(targetFile, runnerRoot, fileNames);
        BuildResult bres = RunixBuildEngine::build(bplan, runnerRoot, on_event);
        if (!bres.success) {
            res.success = false;
            res.exitCode = bres.exitCode;
            res.durationMs = bres.durationMs;
            res.phase = "build";
            res.errorCode = bres.errorCode;
            res.errorMessage = bres.errorMessage;
            res.stdoutData = bres.stdoutData;
            res.stderrData = bres.stderrData;

            if (request.workspaceDir.empty()) RunixSandbox::cleanup(runnerRoot);
            return res;
        }
    }

    // 4. Execution phase
    ExecutionPlan eplan = RunixPlanner::create_execution_plan(targetFile, runnerRoot, fileNames);

    if (on_event) {
        StreamEvent ev;
        ev.type = "status";
        ev.status = "running";
        ev.phase = "exec";
        ev.message = "Executing program...";
        on_event(ev);
    }

    ProcessConfig pcfg;
    pcfg.command = eplan.get_command_string();
    pcfg.workingDirectory = runnerRoot;
    pcfg.timeoutMs = request.timeoutMs > 0 ? request.timeoutMs : eplan.timeoutMs;
    pcfg.stdinInput = request.stdinInput;
    pcfg.executionId = execId;

    ProcessResult pres = RunixProcessEngine::instance().execute(pcfg, on_event);

    res.success = (pres.exitCode == 0);
    res.exitCode = pres.exitCode;
    res.durationMs = pres.durationMs;
    res.phase = "exec";
    res.stdoutData = pres.stdoutData;
    res.stderrData = pres.stderrData;

    if (pres.timedOut) {
        res.errorCode = "TIMEOUT";
        res.errorMessage = "Process exceeded maximum timeout";
    }

    // 5. Cleanup sandbox
    if (request.workspaceDir.empty()) {
        RunixSandbox::cleanup(runnerRoot);
    }

    return res;
}

} // namespace runix
