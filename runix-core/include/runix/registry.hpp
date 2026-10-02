#pragma once

#include "json.hpp"
#include <string>
#include <vector>
#include <map>
#include <optional>

namespace runix {

struct LanguageDef {
    std::string languageId;
    std::string displayName;
    std::vector<std::string> extensions;
    std::vector<std::string> filenames;
    std::string mimeType;
    std::string type; // "compiled", "interpreted", "hybrid", "script", "config", "data", "markup"
    std::string runtimeId;
    std::string editorLanguage;
    std::string compilerId;
    std::string interpreterId;
    std::string builderId;
    std::string packageManagerId;
    std::string debuggerId;

    bool buildCapability = false;
    bool runCapability = false;
    bool debugCapability = false;
    bool testCapability = false;
    bool stdinCapability = true;
    bool stdoutCapability = true;
    bool stderrCapability = true;
    bool multiFileCapability = true;
    bool packageCapability = false;
    bool networkCapability = true;

    std::string defaultBuildCommand;
    std::string defaultRunCommand;
    std::string defaultTestCommand;
    std::string defaultDebugCommand;
    std::string category = "code";

    JsonValue to_json() const;
};

class RunixRegistry {
public:
    static const RunixRegistry& instance();

    const LanguageDef* find_language_by_id(std::string_view id) const;
    const LanguageDef* find_language_by_extension(std::string_view ext) const;
    const LanguageDef* find_language_by_filename(std::string_view filename) const;
    const std::map<std::string, LanguageDef>& get_all_languages() const { return languages_; }

private:
    RunixRegistry();
    void init();

    std::map<std::string, LanguageDef> languages_;
    std::map<std::string, std::string> ext_map_;
    std::map<std::string, std::string> filename_map_;
};

} // namespace runix
