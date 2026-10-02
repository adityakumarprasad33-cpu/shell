#include "runix/builder.hpp"
#include "runix/sandbox.hpp"
#include "runix/common.hpp"
#include <iostream>

namespace runix {

JsonValue BuildResult::to_json() const {
    JsonValue j = JsonValue::object();
    j["success"] = success;
    j["exitCode"] = exitCode;
    j["durationMs"] = durationMs;
    j["tool"] = tool;
    if (!stdoutData.empty()) j["stdout"] = stdoutData;
    if (!stderrData.empty()) j["stderr"] = stderrData;
    if (!errorCode.empty()) j["errorCode"] = errorCode;
    if (!errorMessage.empty()) j["errorMessage"] = errorMessage;
    return j;
}

BuildResult RunixBuildEngine::build(
    const BuildPlan& plan,
    std::string_view runnerRoot,
    std::function<void(const StreamEvent&)> on_event
) {
    BuildResult res;
    res.tool = plan.tool;

    if (!plan.isAvailable || plan.toolPath.empty()) {
        res.success = false;
        res.exitCode = 1;
        res.errorCode = "COMPILER_UNAVAILABLE";
        res.errorMessage = plan.unavailableReason.empty()
            ? "Required compiler tool '" + plan.tool + "' is unavailable in current execution environment."
            : plan.unavailableReason;

        if (on_event) {
            StreamEvent ev;
            ev.type = "error";
            ev.phase = "build";
            ev.tool = plan.tool;
            ev.errorCode = res.errorCode;
            ev.message = res.errorMessage;
            on_event(ev);

            StreamEvent exitEv;
            exitEv.type = "exit";
            exitEv.exitCode = 1;
            exitEv.durationMs = 0;
            on_event(exitEv);
        }
        return res;
    }

    if (on_event) {
        StreamEvent ev;
        ev.type = "status";
        ev.status = "building";
        ev.phase = "build";
        ev.tool = plan.tool;
        ev.message = "Compiling with " + plan.tool + "...";
        on_event(ev);
    }

    // Ensure build output directories exist
    RunixSandbox::ensure_build_directories(runnerRoot);

    ProcessConfig pcfg;
    pcfg.command = plan.get_command_string();
    pcfg.workingDirectory = std::string(runnerRoot);
    pcfg.timeoutMs = plan.timeoutMs;

    ProcessResult pres = RunixProcessEngine::instance().execute(pcfg, on_event);

    res.exitCode = pres.exitCode;
    res.durationMs = pres.durationMs;
    res.stdoutData = pres.stdoutData;
    res.stderrData = pres.stderrData;
    res.success = (pres.exitCode == 0);

    if (!res.success) {
        res.errorCode = "BUILD_FAILED";
        res.errorMessage = "Compilation failed with exit code " + std::to_string(res.exitCode);
    }

    return res;
}

} // namespace runix
