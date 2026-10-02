#include "runix/registry.hpp"

namespace runix {

JsonValue LanguageDef::to_json() const {
    JsonValue j = JsonValue::object();
    j["languageId"] = languageId;
    j["displayName"] = displayName;
    j["mimeType"] = mimeType;
    j["type"] = type;
    j["runtimeId"] = runtimeId;
    j["editorLanguage"] = editorLanguage;
    j["compilerId"] = compilerId;
    j["interpreterId"] = interpreterId;
    j["builderId"] = builderId;
    j["packageManagerId"] = packageManagerId;
    j["debuggerId"] = debuggerId;
    j["category"] = category;

    j["buildCapability"] = buildCapability;
    j["runCapability"] = runCapability;
    j["debugCapability"] = debugCapability;
    j["testCapability"] = testCapability;
    j["stdinCapability"] = stdinCapability;
    j["stdoutCapability"] = stdoutCapability;
    j["stderrCapability"] = stderrCapability;
    j["multiFileCapability"] = multiFileCapability;
    j["packageCapability"] = packageCapability;
    j["networkCapability"] = networkCapability;

    j["defaultBuildCommand"] = defaultBuildCommand;
    j["defaultRunCommand"] = defaultRunCommand;
    j["defaultTestCommand"] = defaultTestCommand;
    j["defaultDebugCommand"] = defaultDebugCommand;

    JsonValue exts = JsonValue::array();
    for (const auto& e : extensions) exts.push_back(e);
    j["extensions"] = exts;

    JsonValue fnames = JsonValue::array();
    for (const auto& f : filenames) fnames.push_back(f);
    j["filenames"] = fnames;

    return j;
}

const RunixRegistry& RunixRegistry::instance() {
    static RunixRegistry reg;
    return reg;
}

RunixRegistry::RunixRegistry() {
    init();
}

void RunixRegistry::init() {
    auto add_lang = [this](LanguageDef def) {
        std::string id = def.languageId;
        for (const auto& ext : def.extensions) {
            ext_map_[to_lower(ext)] = id;
        }
        for (const auto& fn : def.filenames) {
            filename_map_[to_lower(fn)] = id;
        }
        languages_[id] = std::move(def);
    };

    // 1. Java
    {
        LanguageDef l;
        l.languageId = "java";
        l.displayName = "Java";
        l.extensions = {".java", ".class", ".jar"};
        l.filenames = {"pom.xml", "build.gradle", "build.gradle.kts"};
        l.mimeType = "text/x-java-source";
        l.type = "compiled";
        l.runtimeId = "java";
        l.editorLanguage = "java";
        l.compilerId = "javac";
        l.interpreterId = "";
        l.builderId = "maven";
        l.packageManagerId = "maven";
        l.debuggerId = "jdb";
        l.buildCapability = true;
        l.runCapability = true;
        l.testCapability = true;
        l.debugCapability = true;
        l.multiFileCapability = true;
        l.packageCapability = true;
        l.defaultBuildCommand = "javac -d build/classes {file}";
        l.defaultRunCommand = "java -cp build/classes {className}";
        l.defaultTestCommand = "mvn test";
        l.category = "code";
        add_lang(l);
    }

    // 2. Python
    {
        LanguageDef l;
        l.languageId = "python";
        l.displayName = "Python";
        l.extensions = {".py", ".pyw", ".pyi"};
        l.filenames = {"requirements.txt", "pyproject.toml", "Pipfile"};
        l.mimeType = "text/x-python";
        l.type = "interpreted";
        l.runtimeId = "python";
        l.editorLanguage = "python";
        l.compilerId = "";
        l.interpreterId = "python";
        l.builderId = "";
        l.packageManagerId = "pip";
        l.debuggerId = "pdb";
        l.buildCapability = false;
        l.runCapability = true;
        l.testCapability = true;
        l.debugCapability = true;
        l.multiFileCapability = true;
        l.packageCapability = true;
        l.defaultRunCommand = "python \"{file}\"";
        l.defaultTestCommand = "pytest";
        l.category = "code";
        add_lang(l);
    }

    // 3. C++
    {
        LanguageDef l;
        l.languageId = "cpp";
        l.displayName = "C++";
        l.extensions = {".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".hh"};
        l.filenames = {"CMakeLists.txt", "Makefile"};
        l.mimeType = "text/x-c++src";
        l.type = "compiled";
        l.runtimeId = "cpp";
        l.editorLanguage = "cpp";
        l.compilerId = "g++";
        l.interpreterId = "";
        l.builderId = "cmake";
        l.packageManagerId = "vcpkg";
        l.debuggerId = "gdb";
        l.buildCapability = true;
        l.runCapability = true;
        l.testCapability = true;
        l.debugCapability = true;
        l.multiFileCapability = true;
        l.defaultBuildCommand = "g++ -O2 -std=c++20 -Wall \"{file}\" -o \"{output}\"";
        l.defaultRunCommand = "\"{output}\"";
        l.defaultTestCommand = "make test";
        l.category = "code";
        add_lang(l);
    }

    // 4. C
    {
        LanguageDef l;
        l.languageId = "c";
        l.displayName = "C";
        l.extensions = {".c", ".h"};
        l.filenames = {"Makefile"};
        l.mimeType = "text/x-c";
        l.type = "compiled";
        l.runtimeId = "c";
        l.editorLanguage = "c";
        l.compilerId = "gcc";
        l.interpreterId = "";
        l.builderId = "make";
        l.debuggerId = "gdb";
        l.buildCapability = true;
        l.runCapability = true;
        l.testCapability = true;
        l.debugCapability = true;
        l.multiFileCapability = true;
        l.defaultBuildCommand = "gcc -O2 -Wall \"{file}\" -o \"{output}\"";
        l.defaultRunCommand = "\"{output}\"";
        l.category = "code";
        add_lang(l);
    }

    // 5. Rust
    {
        LanguageDef l;
        l.languageId = "rust";
        l.displayName = "Rust";
        l.extensions = {".rs"};
        l.filenames = {"Cargo.toml", "Cargo.lock"};
        l.mimeType = "text/rust";
        l.type = "compiled";
        l.runtimeId = "rust";
        l.editorLanguage = "rust";
        l.compilerId = "rustc";
        l.builderId = "cargo";
        l.packageManagerId = "cargo";
        l.debuggerId = "rust-gdb";
        l.buildCapability = true;
        l.runCapability = true;
        l.testCapability = true;
        l.debugCapability = true;
        l.multiFileCapability = true;
        l.packageCapability = true;
        l.defaultBuildCommand = "rustc \"{file}\" -o \"{output}\"";
        l.defaultRunCommand = "\"{output}\"";
        l.defaultTestCommand = "cargo test";
        l.category = "code";
        add_lang(l);
    }

    // 6. Go
    {
        LanguageDef l;
        l.languageId = "go";
        l.displayName = "Go";
        l.extensions = {".go"};
        l.filenames = {"go.mod", "go.sum"};
        l.mimeType = "text/x-go";
        l.type = "compiled";
        l.runtimeId = "go";
        l.editorLanguage = "go";
        l.compilerId = "go";
        l.builderId = "go";
        l.packageManagerId = "go";
        l.debuggerId = "dlv";
        l.buildCapability = true;
        l.runCapability = true;
        l.testCapability = true;
        l.debugCapability = true;
        l.multiFileCapability = true;
        l.packageCapability = true;
        l.defaultBuildCommand = "go build -o \"{output}\" \"{file}\"";
        l.defaultRunCommand = "go run \"{file}\"";
        l.defaultTestCommand = "go test ./...";
        l.category = "code";
        add_lang(l);
    }

    // 7. Lua
    {
        LanguageDef l;
        l.languageId = "lua";
        l.displayName = "Lua";
        l.extensions = {".lua"};
        l.mimeType = "text/x-lua";
        l.type = "interpreted";
        l.runtimeId = "lua";
        l.editorLanguage = "lua";
        l.interpreterId = "lua";
        l.packageManagerId = "luarocks";
        l.buildCapability = false;
        l.runCapability = true;
        l.testCapability = true;
        l.multiFileCapability = true;
        l.defaultRunCommand = "lua \"{file}\"";
        l.category = "code";
        add_lang(l);
    }

    // 8. JavaScript
    {
        LanguageDef l;
        l.languageId = "javascript";
        l.displayName = "JavaScript";
        l.extensions = {".js", ".mjs", ".cjs"};
        l.filenames = {"package.json"};
        l.mimeType = "text/javascript";
        l.type = "interpreted";
        l.runtimeId = "nodejs";
        l.editorLanguage = "javascript";
        l.interpreterId = "node";
        l.packageManagerId = "npm";
        l.buildCapability = false;
        l.runCapability = true;
        l.testCapability = true;
        l.multiFileCapability = true;
        l.packageCapability = true;
        l.defaultRunCommand = "node \"{file}\"";
        l.defaultTestCommand = "npm test";
        l.category = "code";
        add_lang(l);
    }

    // 9. TypeScript
    {
        LanguageDef l;
        l.languageId = "typescript";
        l.displayName = "TypeScript";
        l.extensions = {".ts", ".mts", ".cts"};
        l.filenames = {"tsconfig.json"};
        l.mimeType = "text/typescript";
        l.type = "hybrid";
        l.runtimeId = "typescript";
        l.editorLanguage = "typescript";
        l.compilerId = "tsc";
        l.interpreterId = "tsx";
        l.packageManagerId = "npm";
        l.buildCapability = true;
        l.runCapability = true;
        l.testCapability = true;
        l.multiFileCapability = true;
        l.packageCapability = true;
        l.defaultBuildCommand = "npx tsc --noEmit";
        l.defaultRunCommand = "npx tsx \"{file}\"";
        l.defaultTestCommand = "npm test";
        l.category = "code";
        add_lang(l);
    }

    // 10. Bash / Shell
    {
        LanguageDef l;
        l.languageId = "bash";
        l.displayName = "Bash";
        l.extensions = {".sh", ".bash"};
        l.mimeType = "application/x-sh";
        l.type = "script";
        l.runtimeId = "bash";
        l.editorLanguage = "shell";
        l.interpreterId = "bash";
        l.buildCapability = false;
        l.runCapability = true;
        l.defaultRunCommand = "bash \"{file}\"";
        l.category = "code";
        add_lang(l);
    }

    // 11. PowerShell
    {
        LanguageDef l;
        l.languageId = "powershell";
        l.displayName = "PowerShell";
        l.extensions = {".ps1", ".psm1"};
        l.mimeType = "text/plain";
        l.type = "script";
        l.runtimeId = "powershell";
        l.editorLanguage = "powershell";
        l.interpreterId = "powershell";
        l.buildCapability = false;
        l.runCapability = true;
        l.defaultRunCommand = "powershell -ExecutionPolicy Bypass -File \"{file}\"";
        l.category = "code";
        add_lang(l);
    }
}

const LanguageDef* RunixRegistry::find_language_by_id(std::string_view id) const {
    auto it = languages_.find(to_lower(id));
    return it != languages_.end() ? &it->second : nullptr;
}

const LanguageDef* RunixRegistry::find_language_by_extension(std::string_view ext) const {
    auto it = ext_map_.find(to_lower(ext));
    if (it != ext_map_.end()) {
        return find_language_by_id(it->second);
    }
    return nullptr;
}

const LanguageDef* RunixRegistry::find_language_by_filename(std::string_view filename) const {
    auto it = filename_map_.find(to_lower(filename));
    if (it != filename_map_.end()) {
        return find_language_by_id(it->second);
    }
    return nullptr;
}

} // namespace runix
