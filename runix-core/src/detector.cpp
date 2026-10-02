#include "runix/detector.hpp"
#include "runix/common.hpp"
#include <filesystem>

namespace runix {

JsonValue DetectionResult::to_json() const {
    JsonValue j = JsonValue::object();
    j["filename"] = filename;
    j["fileType"] = fileType;
    j["languageId"] = languageId;
    j["languageName"] = languageName;
    j["editorLanguage"] = editorLanguage;
    j["runtimeId"] = runtimeId;
    j["compilerId"] = compilerId;
    j["interpreterId"] = interpreterId;
    j["builderId"] = builderId;
    j["packageManagerId"] = packageManagerId;
    j["mimeType"] = mimeType;
    j["projectType"] = projectType;
    j["category"] = category;
    j["confidence"] = confidence;
    j["isSpecialFilename"] = isSpecialFilename;

    JsonValue caps = JsonValue::object();
    caps["build"] = buildCapability;
    caps["run"] = runCapability;
    caps["debug"] = debugCapability;
    caps["test"] = testCapability;
    caps["multiFile"] = multiFileCapability;
    caps["package"] = packageCapability;
    caps["stdin"] = stdinCapability;
    caps["stdout"] = stdoutCapability;
    caps["stderr"] = stderrCapability;
    j["capabilities"] = caps;

    j["defaultBuildCommand"] = defaultBuildCommand;
    j["defaultRunCommand"] = defaultRunCommand;
    j["defaultTestCommand"] = defaultTestCommand;
    return j;
}

std::string RunixFileDetector::detect_project_type(const std::vector<std::string>& files) {
    for (const auto& f : files) {
        std::string lower = to_lower(f);
        if (lower == "package.json") return "node-project";
        if (lower == "cargo.toml") return "rust-project";
        if (lower == "go.mod") return "go-module";
        if (lower == "pom.xml") return "maven-project";
        if (lower == "build.gradle" || lower == "build.gradle.kts") return "gradle-project";
        if (lower == "cmakelists.txt") return "cmake-project";
        if (lower == "makefile") return "make-project";
        if (lower == "requirements.txt" || lower == "pyproject.toml") return "python-project";
    }
    return "single-file";
}

DetectionResult RunixFileDetector::detect(
    std::string_view filename,
    std::string_view logicalPath,
    const std::vector<std::string>& workspaceFiles
) {
    DetectionResult res;
    res.filename = std::string(filename);

    fs::path p(filename);
    std::string baseName = p.filename().string();
    std::string ext = to_lower(p.extension().string());

    const auto& reg = RunixRegistry::instance();
    const LanguageDef* lang = nullptr;

    // 1. Check special filename
    lang = reg.find_language_by_filename(baseName);
    if (lang) {
        res.isSpecialFilename = true;
    } else if (!ext.empty()) {
        // 2. Check extension
        lang = reg.find_language_by_extension(ext);
    }

    res.projectType = detect_project_type(workspaceFiles);

    if (lang) {
        res.fileType = lang->type;
        res.languageId = lang->languageId;
        res.languageName = lang->displayName;
        res.editorLanguage = lang->editorLanguage;
        res.runtimeId = lang->runtimeId;
        res.compilerId = lang->compilerId;
        res.interpreterId = lang->interpreterId;
        res.builderId = lang->builderId;
        res.packageManagerId = lang->packageManagerId;
        res.mimeType = lang->mimeType;
        res.category = lang->category;
        res.confidence = 1.0;

        res.buildCapability = lang->buildCapability;
        res.runCapability = lang->runCapability;
        res.debugCapability = lang->debugCapability;
        res.testCapability = lang->testCapability;
        res.multiFileCapability = lang->multiFileCapability;
        res.packageCapability = lang->packageCapability;
        res.stdinCapability = lang->stdinCapability;
        res.stdoutCapability = lang->stdoutCapability;
        res.stderrCapability = lang->stderrCapability;

        res.defaultBuildCommand = lang->defaultBuildCommand;
        res.defaultRunCommand = lang->defaultRunCommand;
        res.defaultTestCommand = lang->defaultTestCommand;
    } else {
        res.fileType = "unknown";
        res.languageId = "plaintext";
        res.languageName = "Plain Text";
        res.editorLanguage = "plaintext";
        res.mimeType = "text/plain";
        res.category = "document";
        res.confidence = 0.5;
    }

    return res;
}

} // namespace runix
