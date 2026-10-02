#include "runix/planner.hpp"
#include "runix/detector.hpp"
#include "runix/discovery.hpp"
#include "runix/common.hpp"
#include "runix/path_resolver.hpp"
#include <regex>
#include <filesystem>
#include <fstream>

namespace runix {

std::string BuildPlan::get_command_string() const {
    std::string cmd = "\"" + toolPath + "\"";
    for (const auto& a : arguments) {
        cmd += " " + a;
    }
    return cmd;
}

JsonValue BuildPlan::to_json() const {
    JsonValue j = JsonValue::object();
    j["id"] = id;
    j["languageId"] = languageId;
    j["tool"] = tool;
    j["toolPath"] = toolPath;
    j["workingDirectory"] = workingDirectory;
    j["outputDirectory"] = outputDirectory;
    j["isAvailable"] = isAvailable;
    if (!unavailableReason.empty()) j["unavailableReason"] = unavailableReason;
    j["timeoutMs"] = timeoutMs;
    j["commandString"] = get_command_string();

    JsonValue args = JsonValue::array();
    for (const auto& a : arguments) args.push_back(a);
    j["arguments"] = args;

    JsonValue inFiles = JsonValue::array();
    for (const auto& f : inputFiles) inFiles.push_back(f);
    j["inputFiles"] = inFiles;

    return j;
}

std::string ExecutionPlan::get_command_string() const {
    std::string cmd = "\"" + runtimePath + "\"";
    for (const auto& a : arguments) {
        cmd += " " + a;
    }
    return cmd;
}

JsonValue ExecutionPlan::to_json() const {
    JsonValue j = JsonValue::object();
    j["id"] = id;
    j["languageId"] = languageId;
    j["runtimeExecutable"] = runtimeExecutable;
    j["runtimePath"] = runtimePath;
    j["workingDirectory"] = workingDirectory;
    j["classpath"] = classpath;
    j["mainClass"] = mainClass;
    j["isAvailable"] = isAvailable;
    if (!unavailableReason.empty()) j["unavailableReason"] = unavailableReason;
    j["timeoutMs"] = timeoutMs;
    j["commandString"] = get_command_string();

    JsonValue args = JsonValue::array();
    for (const auto& a : arguments) args.push_back(a);
    j["arguments"] = args;

    return j;
}

JavaSourceInfo RunixPlanner::inspect_java_source(std::string_view sourceCode, std::string_view filename) {
    JavaSourceInfo info;
    std::string code(sourceCode);

    // Strip comments
    static const std::regex blockComment("/\\*[\\s\\S]*?\\*/");
    static const std::regex lineComment("//.*");
    code = std::regex_replace(code, blockComment, "");
    code = std::regex_replace(code, lineComment, "");

    // 1. Package: package com.example;
    std::smatch m;
    static const std::regex pkgRegex("package\\s+([a-zA-Z0-9_.]+)\\s*;");
    if (std::regex_search(code, m, pkgRegex)) {
        info.packageName = m[1].str();
    }

    // 2. Public class: public class Foo
    static const std::regex pubRegex("public\\s+(?:final\\s+|abstract\\s+)?class\\s+([a-zA-Z0-9_]+)");
    if (std::regex_search(code, m, pubRegex)) {
        info.publicClassName = m[1].str();
    }

    // 3. Classes declared
    std::vector<std::string> classes;
    static const std::regex classRegex("(?:public\\s+)?(?:final\\s+|abstract\\s+)?class\\s+([a-zA-Z0-9_]+)");
    auto words_begin = std::sregex_iterator(code.begin(), code.end(), classRegex);
    auto words_end = std::sregex_iterator();
    for (std::sregex_iterator i = words_begin; i != words_end; ++i) {
        classes.push_back((*i)[1].str());
    }

    // 4. Main method
    static const std::regex mainRegex("public\\s+static\\s+void\\s+main\\s*\\(");
    info.hasMainMethod = std::regex_search(code, mainRegex);

    fs::path fp(filename);
    std::string base = fp.stem().string();

    if (!info.publicClassName.empty()) {
        info.mainClassName = info.publicClassName;
    } else if (!classes.empty()) {
        auto it = std::find(classes.begin(), classes.end(), base);
        info.mainClassName = (it != classes.end()) ? *it : classes[0];
    } else {
        info.mainClassName = base;
    }

    if (!info.packageName.empty() && !info.mainClassName.empty()) {
        info.fullyQualifiedMainClass = info.packageName + "." + info.mainClassName;
    } else {
        info.fullyQualifiedMainClass = info.mainClassName;
    }

    return info;
}

BuildPlan RunixPlanner::create_build_plan(
    std::string_view filename,
    std::string_view workingDirectory,
    const std::vector<std::string>& workspaceFiles
) {
    DetectionResult det = RunixFileDetector::detect(filename, "", workspaceFiles);
    auto& disc = RunixToolchainDiscovery::instance();
    DiscoveredRuntime dr = disc.discover(det.runtimeId);

    BuildPlan plan;
    plan.id = "build-" + det.languageId;
    plan.languageId = det.languageId;
    plan.workingDirectory = std::string(workingDirectory);

    if (det.languageId == "java") {
        plan.tool = "javac";
        plan.toolPath = dr.compilerExecutablePath;
        plan.outputDirectory = "build/classes";

        if (plan.toolPath.empty()) {
            plan.isAvailable = false;
            plan.unavailableReason = "Java compiler (javac) is unavailable in current execution environment.";
            return plan;
        }

        // Collect all .java sources in workspace or target
        std::vector<std::string> javaSources;
        for (const auto& f : workspaceFiles) {
            if (ends_with(to_lower(f), ".java")) {
                javaSources.push_back(RunixPathResolver::normalize_logical_path(f));
            }
        }
        std::string normTarget = RunixPathResolver::normalize_logical_path(filename);
        if (std::find(javaSources.begin(), javaSources.end(), normTarget) == javaSources.end()) {
            javaSources.push_back(normTarget);
        }

        plan.inputFiles = javaSources;
        plan.arguments.push_back("-d");
        plan.arguments.push_back("\"build/classes\"");
        for (const auto& src : javaSources) {
            plan.arguments.push_back("\"" + src + "\"");
        }
    } else if (det.languageId == "cpp" || det.languageId == "c") {
        bool isCpp = (det.languageId == "cpp");
        plan.tool = isCpp ? "g++" : "gcc";
        plan.toolPath = dr.compilerExecutablePath;
        plan.outputDirectory = "build";

        if (plan.toolPath.empty()) {
            plan.isAvailable = false;
            plan.unavailableReason = (isCpp ? "C++" : "C") + std::string(" compiler is unavailable on PATH.");
            return plan;
        }

        std::string normTarget = RunixPathResolver::normalize_logical_path(filename);
        fs::path p(normTarget);
        std::string outBin = "build/" + p.stem().string();
#if defined(RUNIX_PLATFORM_WINDOWS)
        outBin += ".exe";
#endif

        plan.inputFiles.push_back(normTarget);
        plan.outputFiles.push_back(outBin);

        plan.arguments.push_back("-O2");
        if (isCpp) plan.arguments.push_back("-std=c++20");
        plan.arguments.push_back("-Wall");
        plan.arguments.push_back("\"" + normTarget + "\"");
        plan.arguments.push_back("-o");
        plan.arguments.push_back("\"" + outBin + "\"");
    } else if (det.languageId == "rust") {
        plan.tool = "rustc";
        plan.toolPath = dr.compilerExecutablePath;
        plan.outputDirectory = "build";

        if (plan.toolPath.empty()) {
            plan.isAvailable = false;
            plan.unavailableReason = "Rust compiler (rustc) is unavailable on PATH.";
            return plan;
        }

        std::string normTarget = RunixPathResolver::normalize_logical_path(filename);
        fs::path p(normTarget);
        std::string outBin = "build/" + p.stem().string();
#if defined(RUNIX_PLATFORM_WINDOWS)
        outBin += ".exe";
#endif
        plan.inputFiles.push_back(normTarget);
        plan.outputFiles.push_back(outBin);
        plan.arguments.push_back("\"" + normTarget + "\"");
        plan.arguments.push_back("-o");
        plan.arguments.push_back("\"" + outBin + "\"");
    } else if (det.languageId == "go") {
        plan.tool = "go";
        plan.toolPath = dr.compilerExecutablePath;
        plan.outputDirectory = "build";

        if (plan.toolPath.empty()) {
            plan.isAvailable = false;
            plan.unavailableReason = "Go compiler is unavailable on PATH.";
            return plan;
        }

        std::string normTarget = RunixPathResolver::normalize_logical_path(filename);
        fs::path p(normTarget);
        std::string outBin = "build/" + p.stem().string();
#if defined(RUNIX_PLATFORM_WINDOWS)
        outBin += ".exe";
#endif
        plan.arguments.push_back("build");
        plan.arguments.push_back("-o");
        plan.arguments.push_back("\"" + outBin + "\"");
        plan.arguments.push_back("\"" + normTarget + "\"");
    } else {
        // Non-compiled languages don't require build plan
        plan.isAvailable = false;
        plan.unavailableReason = "Language '" + det.languageName + "' does not require a compilation build step.";
    }

    return plan;
}

ExecutionPlan RunixPlanner::create_execution_plan(
    std::string_view filename,
    std::string_view workingDirectory,
    const std::vector<std::string>& workspaceFiles
) {
    DetectionResult det = RunixFileDetector::detect(filename, "", workspaceFiles);
    auto& disc = RunixToolchainDiscovery::instance();
    DiscoveredRuntime dr = disc.discover(det.runtimeId);

    ExecutionPlan plan;
    plan.id = "run-" + det.languageId;
    plan.languageId = det.languageId;
    plan.workingDirectory = std::string(workingDirectory);

    std::string normTarget = RunixPathResolver::normalize_logical_path(filename);

    if (det.languageId == "java") {
        plan.runtimeExecutable = "java";
        plan.runtimePath = dr.primaryExecutablePath;
        plan.classpath = "build/classes";

        if (plan.runtimePath.empty()) {
            plan.isAvailable = false;
            plan.unavailableReason = "Java Virtual Machine (java) is unavailable in current execution environment.";
            return plan;
        }

        // Read source if available to inspect class/package
        std::string sourceContent;
        fs::path localSrc = fs::path(workingDirectory) / normTarget;
        try {
            if (fs::exists(localSrc)) {
                std::ifstream ifs(localSrc);
                std::stringstream buffer;
                buffer << ifs.rdbuf();
                sourceContent = buffer.str();
            }
        } catch (...) {}

        JavaSourceInfo jsi = inspect_java_source(sourceContent, normTarget);
        plan.mainClass = jsi.fullyQualifiedMainClass;

        plan.arguments.push_back("-cp");
        plan.arguments.push_back("\"build/classes\"");
        plan.arguments.push_back(plan.mainClass);
    } else if (det.languageId == "cpp" || det.languageId == "c" || det.languageId == "rust" || det.languageId == "go") {
        fs::path p(normTarget);
        std::string outBin = "build/" + p.stem().string();
#if defined(RUNIX_PLATFORM_WINDOWS)
        outBin += ".exe";
#endif
        plan.runtimeExecutable = outBin;
        plan.runtimePath = (fs::path(workingDirectory) / outBin).string();
    } else if (det.languageId == "python") {
        plan.runtimeExecutable = "python";
        plan.runtimePath = dr.primaryExecutablePath;
        if (plan.runtimePath.empty()) {
            plan.isAvailable = false;
            plan.unavailableReason = "Python interpreter is unavailable on PATH.";
            return plan;
        }
        plan.arguments.push_back("\"" + normTarget + "\"");
    } else if (det.languageId == "lua") {
        plan.runtimeExecutable = "lua";
        plan.runtimePath = dr.primaryExecutablePath;
        if (plan.runtimePath.empty()) {
            plan.isAvailable = false;
            plan.unavailableReason = "Lua interpreter is unavailable on PATH.";
            return plan;
        }
        plan.arguments.push_back("\"" + normTarget + "\"");
    } else if (det.languageId == "javascript") {
        plan.runtimeExecutable = "node";
        plan.runtimePath = dr.primaryExecutablePath;
        if (plan.runtimePath.empty()) {
            plan.isAvailable = false;
            plan.unavailableReason = "Node.js runtime is unavailable on PATH.";
            return plan;
        }
        plan.arguments.push_back("\"" + normTarget + "\"");
    } else if (det.languageId == "typescript") {
        plan.runtimeExecutable = "npx";
        std::string npx = disc.find_executable("npx");
        plan.runtimePath = !npx.empty() ? npx : "npx";
        plan.arguments.push_back("tsx");
        plan.arguments.push_back("\"" + normTarget + "\"");
    } else if (det.languageId == "bash") {
        plan.runtimeExecutable = "bash";
        plan.runtimePath = dr.primaryExecutablePath;
        plan.arguments.push_back("\"" + normTarget + "\"");
    } else {
        plan.runtimeExecutable = dr.primaryExecutable;
        plan.runtimePath = dr.primaryExecutablePath;
        plan.arguments.push_back("\"" + normTarget + "\"");
    }

    return plan;
}

} // namespace runix
