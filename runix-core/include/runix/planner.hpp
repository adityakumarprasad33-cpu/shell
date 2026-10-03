#pragma once

#include "json.hpp"
#include <string>
#include <vector>
#include <map>
#include <optional>

namespace runix {

struct BuildPlan {
    std::string id;
    std::string languageId;
    std::string tool;
    std::string toolPath;
    std::vector<std::string> arguments;
    std::string workingDirectory;
    std::string outputDirectory;
    std::vector<std::string> inputFiles;
    std::vector<std::string> outputFiles;
    std::map<std::string, std::string> environment;
    int64_t timeoutMs = 30000;
    bool isAvailable = true;
    std::string unavailableReason;

    std::string get_command_string() const;
    JsonValue to_json() const;
};

struct ExecutionPlan {
    std::string id;
    std::string languageId;
    std::string runtimeExecutable;
    std::string runtimePath;
    std::vector<std::string> arguments;
    std::string workingDirectory;
    std::string classpath;
    std::string mainClass;
    std::map<std::string, std::string> environment;
    int64_t timeoutMs = 30000;
    bool isAvailable = true;
    std::string unavailableReason;

    std::string get_command_string() const;
    JsonValue to_json() const;
};

struct JavaSourceInfo {
    std::string packageName;
    std::string publicClassName;
    std::string mainClassName;
    std::string fullyQualifiedMainClass;
    bool hasMainMethod = false;
};

class RunixPlanner {
public:
    static BuildPlan create_build_plan(
        std::string_view filename,
        std::string_view workingDirectory,
        const std::vector<std::string>& workspaceFiles = {},
        std::string_view explicitLanguageId = ""
    );

    static ExecutionPlan create_execution_plan(
        std::string_view filename,
        std::string_view workingDirectory,
        const std::vector<std::string>& workspaceFiles = {},
        std::string_view explicitLanguageId = ""
    );

    static JavaSourceInfo inspect_java_source(std::string_view sourceCode, std::string_view filename);
};

} // namespace runix
