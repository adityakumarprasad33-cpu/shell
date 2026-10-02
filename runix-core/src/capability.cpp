#include "runix/capability.hpp"
#include "runix/planner.hpp"
#include "runix/common.hpp"

namespace runix {

JsonValue ResolvedCapabilities::to_json() const {
    JsonValue j = JsonValue::object();
    j["filename"] = filename;
    j["fileType"] = fileType;
    j["languageId"] = languageId;
    j["languageName"] = languageName;
    j["editorLanguage"] = editorLanguage;
    j["category"] = category;
    j["runtimeId"] = runtimeId;
    j["runtimeName"] = runtimeName;
    j["runtimeVersion"] = runtimeVersion;
    j["runtimeExecutable"] = runtimeExecutable;
    if (!compilerExecutable.empty()) j["compilerExecutable"] = compilerExecutable;
    if (!compilerVersion.empty()) j["compilerVersion"] = compilerVersion;
    j["compilerAvailable"] = compilerAvailable;
    j["runtimeAvailable"] = runtimeAvailable;
    j["verificationStatus"] = verificationStatus;
    if (!statusReason.empty()) j["statusReason"] = statusReason;

    JsonValue caps = JsonValue::object();
    caps["run"] = canRun;
    caps["build"] = canBuild;
    caps["debug"] = canDebug;
    caps["test"] = canTest;
    caps["stdin"] = canStdin;
    caps["stdout"] = canStdout;
    caps["stderr"] = canStderr;
    caps["multiFile"] = canMultiFile;
    caps["packages"] = canPackages;
    caps["network"] = canNetwork;
    j["capabilities"] = caps;

    JsonValue execCfg = JsonValue::object();
    if (!compileCommand.empty()) execCfg["compileCommand"] = compileCommand;
    if (!runCommand.empty()) execCfg["runCommand"] = runCommand;
    if (!testCommand.empty()) execCfg["testCommand"] = testCommand;
    if (!debugCommand.empty()) execCfg["debugCommand"] = debugCommand;
    execCfg["timeoutMs"] = 30000;
    j["executionConfig"] = execCfg;

    j["isRunnable"] = isRunnable;
    return j;
}

ResolvedCapabilities RunixCapabilityResolver::resolve(
    std::string_view filename,
    std::string_view workspaceDir,
    const std::vector<std::string>& workspaceFiles
) {
    DetectionResult det = RunixFileDetector::detect(filename, "", workspaceFiles);
    auto& disc = RunixToolchainDiscovery::instance();
    DiscoveredRuntime dr = disc.discover(det.runtimeId);

    ResolvedCapabilities rc;
    rc.filename = std::string(filename);
    rc.fileType = det.fileType;
    rc.languageId = det.languageId;
    rc.languageName = det.languageName;
    rc.editorLanguage = det.editorLanguage;
    rc.category = det.category;
    rc.runtimeId = det.runtimeId;
    rc.runtimeName = dr.name.empty() ? det.languageName : dr.name;
    rc.runtimeVersion = dr.primaryVersion;
    rc.runtimeExecutable = dr.primaryExecutablePath;
    rc.compilerExecutable = dr.compilerExecutablePath;
    rc.compilerVersion = dr.compilerVersion;

    rc.isRunnable = det.runCapability;
    rc.canStdin = det.stdinCapability;
    rc.canStdout = det.stdoutCapability;
    rc.canStderr = det.stderrCapability;
    rc.canMultiFile = det.multiFileCapability;
    rc.canPackages = det.packageCapability;

    const auto* compTool = dr.tools.find("compiler") != dr.tools.end() ? &dr.tools.at("compiler") : nullptr;
    const auto* rtTool = dr.tools.find("runtime") != dr.tools.end() ? &dr.tools.at("runtime") : nullptr;
    const auto* interpTool = dr.tools.find("interpreter") != dr.tools.end() ? &dr.tools.at("interpreter") : nullptr;

    bool hasCompiler = compTool && (compTool->state == ToolDiscoveryState::Available || compTool->state == ToolDiscoveryState::Verified);
    bool hasRuntime = rtTool && (rtTool->state == ToolDiscoveryState::Available || rtTool->state == ToolDiscoveryState::Verified);
    bool hasInterp = interpTool && (interpTool->state == ToolDiscoveryState::Available || interpTool->state == ToolDiscoveryState::Verified);

    rc.compilerAvailable = hasCompiler;

    if (det.languageId == "java") {
        rc.canBuild = hasCompiler;
        rc.canRun = hasCompiler && hasRuntime;

        if (!hasCompiler && !hasRuntime) {
            rc.statusReason = "Java Development Kit (JDK) is unavailable in current execution environment. Both java and javac are missing.";
        } else if (!hasCompiler) {
            rc.statusReason = "Java compiler (javac) is unavailable in current execution environment. Java source files cannot be compiled.";
        } else if (!hasRuntime) {
            rc.statusReason = "Java runtime (java) is unavailable in current execution environment.";
        }
    } else if (det.fileType == "compiled" || dr.category == "compiled") {
        rc.canBuild = hasCompiler;
        rc.canRun = hasCompiler;
        if (!hasCompiler) {
            rc.statusReason = det.languageName + " compiler (" + (compTool ? compTool->executableName : "compiler") + ") is unavailable in current execution environment.";
        }
    } else if (det.fileType == "hybrid" || det.languageId == "typescript") {
        rc.canRun = hasRuntime || hasInterp;
        rc.canBuild = hasCompiler;
        if (!rc.canRun && !rc.canBuild) {
            rc.statusReason = "TypeScript runner (tsx/tsc) is unavailable in current execution environment.";
        }
    } else {
        rc.canBuild = false;
        rc.canRun = hasInterp || hasRuntime;
        if (!rc.canRun) {
            rc.statusReason = det.languageName + " interpreter is unavailable in current execution environment.";
        }
    }

    rc.runtimeAvailable = rc.canRun || rc.canBuild || dr.state == ToolDiscoveryState::Available || dr.state == ToolDiscoveryState::Verified;

    if (dr.state == ToolDiscoveryState::Verified) {
        rc.verificationStatus = "VERIFIED";
    } else if (dr.state == ToolDiscoveryState::Available) {
        rc.verificationStatus = (rc.canRun || rc.canBuild) ? "AVAILABLE" : "UNAVAILABLE";
    } else if (dr.state == ToolDiscoveryState::Broken) {
        rc.verificationStatus = "BROKEN";
    } else {
        rc.verificationStatus = "UNAVAILABLE";
    }

    // Build & Execution commands from planner
    BuildPlan bp = RunixPlanner::create_build_plan(filename, workspaceDir, workspaceFiles);
    ExecutionPlan ep = RunixPlanner::create_execution_plan(filename, workspaceDir, workspaceFiles);

    if (rc.canBuild) {
        rc.compileCommand = bp.get_command_string();
    }
    if (rc.canRun) {
        rc.runCommand = ep.get_command_string();
    }

    return rc;
}

} // namespace runix
