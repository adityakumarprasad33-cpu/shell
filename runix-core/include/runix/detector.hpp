#pragma once

#include "registry.hpp"
#include "json.hpp"
#include <string>
#include <vector>
#include <optional>

namespace runix {

struct DetectionResult {
    std::string filename;
    std::string fileType;
    std::string languageId;
    std::string languageName;
    std::string editorLanguage;
    std::string runtimeId;
    std::string compilerId;
    std::string interpreterId;
    std::string builderId;
    std::string packageManagerId;
    std::string mimeType;
    std::string projectType;
    std::string category;
    double confidence = 1.0;
    bool isSpecialFilename = false;

    bool buildCapability = false;
    bool runCapability = false;
    bool debugCapability = false;
    bool testCapability = false;
    bool multiFileCapability = false;
    bool packageCapability = false;
    bool stdinCapability = true;
    bool stdoutCapability = true;
    bool stderrCapability = true;

    std::string defaultBuildCommand;
    std::string defaultRunCommand;
    std::string defaultTestCommand;

    JsonValue to_json() const;
};

class RunixFileDetector {
public:
    static DetectionResult detect(
        std::string_view filename,
        std::string_view logicalPath = "",
        const std::vector<std::string>& workspaceFiles = {}
    );

    static std::string detect_project_type(const std::vector<std::string>& files);
};

} // namespace runix
