#pragma once

#include "detector.hpp"
#include "discovery.hpp"
#include "json.hpp"
#include <string>
#include <vector>
#include <optional>

namespace runix {

struct ResolvedCapabilities {
    std::string filename;
    std::string fileType;
    std::string languageId;
    std::string languageName;
    std::string editorLanguage;
    std::string category;
    std::string runtimeId;
    std::string runtimeName;
    std::string runtimeVersion;
    std::string runtimeExecutable;
    std::string compilerExecutable;
    std::string compilerVersion;

    bool compilerAvailable = false;
    bool runtimeAvailable = false;
    std::string verificationStatus = "UNAVAILABLE"; // "VERIFIED", "AVAILABLE", "UNAVAILABLE", "BROKEN", "NOT_IMPLEMENTED"
    std::string statusReason;

    bool canRun = false;
    bool canBuild = false;
    bool canDebug = false;
    bool canTest = false;
    bool canStdin = true;
    bool canStdout = true;
    bool canStderr = true;
    bool canMultiFile = true;
    bool canPackages = false;
    bool canNetwork = true;

    std::string compileCommand;
    std::string runCommand;
    std::string testCommand;
    std::string debugCommand;

    bool isRunnable = false;

    JsonValue to_json() const;
};

class RunixCapabilityResolver {
public:
    static ResolvedCapabilities resolve(
        std::string_view filename,
        std::string_view workspaceDir = "",
        const std::vector<std::string>& workspaceFiles = {}
    );
};

} // namespace runix
