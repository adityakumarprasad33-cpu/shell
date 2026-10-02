#include "runix/discovery.hpp"
#include "runix/common.hpp"
#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <fstream>
#include <sstream>

#if defined(RUNIX_PLATFORM_WINDOWS)
#include <windows.h>
#else
#include <unistd.h>
#include <sys/wait.h>
#endif

namespace runix {

JsonValue DiscoveredTool::to_json() const {
    JsonValue j = JsonValue::object();
    j["role"] = role;
    j["name"] = name;
    j["executableName"] = executableName;
    j["executablePath"] = executablePath;
    j["version"] = version;
    j["state"] = tool_state_to_string(state);
    j["isRequiredForRun"] = isRequiredForRun;
    j["isRequiredForBuild"] = isRequiredForBuild;
    if (!errorReason.empty()) j["errorReason"] = errorReason;
    return j;
}

JsonValue DiscoveredRuntime::to_json() const {
    JsonValue j = JsonValue::object();
    j["runtimeId"] = runtimeId;
    j["name"] = name;
    j["category"] = category;
    j["state"] = tool_state_to_string(state);
    j["primaryExecutable"] = primaryExecutable;
    j["primaryExecutablePath"] = primaryExecutablePath;
    j["primaryVersion"] = primaryVersion;

    if (!compilerExecutable.empty()) j["compilerExecutable"] = compilerExecutable;
    if (!compilerExecutablePath.empty()) j["compilerExecutablePath"] = compilerExecutablePath;
    if (!compilerVersion.empty()) j["compilerVersion"] = compilerVersion;

    if (!interpreterExecutable.empty()) j["interpreterExecutable"] = interpreterExecutable;
    if (!interpreterExecutablePath.empty()) j["interpreterExecutablePath"] = interpreterExecutablePath;
    if (!interpreterVersion.empty()) j["interpreterVersion"] = interpreterVersion;

    if (!builderExecutable.empty()) j["builderExecutable"] = builderExecutable;
    if (!builderExecutablePath.empty()) j["builderExecutablePath"] = builderExecutablePath;

    if (!packageManagerExecutable.empty()) j["packageManagerExecutable"] = packageManagerExecutable;
    if (!packageManagerExecutablePath.empty()) j["packageManagerExecutablePath"] = packageManagerExecutablePath;

    j["canRun"] = canRun;
    j["canBuild"] = canBuild;
    if (!statusReason.empty()) j["statusReason"] = statusReason;

    JsonValue tools_obj = JsonValue::object();
    for (const auto& [k, v] : tools) {
        tools_obj[k] = v.to_json();
    }
    j["tools"] = tools_obj;

    return j;
}

RunixToolchainDiscovery& RunixToolchainDiscovery::instance() {
    static RunixToolchainDiscovery disc;
    return disc;
}

RunixToolchainDiscovery::RunixToolchainDiscovery() {
    cached_system_path_ = get_effective_system_path();
}

void RunixToolchainDiscovery::clear_cache() {
    cache_.clear();
    cached_system_path_ = get_effective_system_path();
}

std::string RunixToolchainDiscovery::get_effective_system_path() {
    std::string currentPath;
    const char* envPath = std::getenv("PATH");
    if (!envPath) envPath = std::getenv("Path");
    if (envPath) currentPath = envPath;

    std::vector<std::string> extraPaths;

#if defined(RUNIX_PLATFORM_WINDOWS)
    char delim = ';';
    const char* userProfile = std::getenv("USERPROFILE");
    const char* progFiles = std::getenv("ProgramFiles");
    std::string pf = progFiles ? progFiles : "C:\\Program Files";

    // Java JDK paths
    const char* javaHome = std::getenv("JAVA_HOME");
    if (javaHome) {
        extraPaths.push_back(std::string(javaHome) + "\\bin");
    }
    const char* jdkHome = std::getenv("JDK_HOME");
    if (jdkHome) {
        extraPaths.push_back(std::string(jdkHome) + "\\bin");
    }

    std::vector<std::string> vendors = {"Eclipse Adoptium", "Java", "Amazon Corretto", "Microsoft", "Zulu"};
    for (const auto& vendor : vendors) {
        std::string vDir = pf + "\\" + vendor;
        try {
            if (fs::exists(vDir)) {
                for (const auto& entry : fs::directory_iterator(vDir)) {
                    if (entry.is_directory()) {
                        std::string binDir = entry.path().string() + "\\bin";
                        if (fs::exists(binDir + "\\javac.exe") || fs::exists(binDir + "\\java.exe")) {
                            extraPaths.push_back(binDir);
                        }
                    }
                }
            }
        } catch (...) {}
    }

    // WinLibs / MinGW modern GCC 16
    if (userProfile) {
        std::string wingetDir = std::string(userProfile) + "\\AppData\\Local\\Microsoft\\WinGet\\Packages";
        try {
            if (fs::exists(wingetDir)) {
                for (const auto& entry : fs::directory_iterator(wingetDir)) {
                    if (entry.is_directory() && entry.path().filename().string().find("BrechtSanders.WinLibs") != std::string::npos) {
                        std::string mingwBin = entry.path().string() + "\\mingw64\\bin";
                        if (fs::exists(mingwBin + "\\g++.exe")) {
                            extraPaths.push_back(mingwBin);
                        }
                    }
                }
            }
        } catch (...) {}

        extraPaths.push_back(std::string(userProfile) + "\\AppData\\Local\\Programs\\Python\\Python314");
        extraPaths.push_back(std::string(userProfile) + "\\AppData\\Local\\Programs\\Python\\Python312");
        extraPaths.push_back(std::string(userProfile) + "\\AppData\\Local\\Programs\\Python\\Python311");
        extraPaths.push_back(std::string(userProfile) + "\\AppData\\Local\\Programs\\Lua\\bin");
        extraPaths.push_back(std::string(userProfile) + "\\go\\bin");
        extraPaths.push_back(std::string(userProfile) + "\\.cargo\\bin");
    }

    extraPaths.push_back("C:\\MinGW\\bin");
    extraPaths.push_back("C:\\msys64\\mingw64\\bin");
    extraPaths.push_back(pf + "\\nodejs");
    extraPaths.push_back(pf + "\\Git\\cmd");
    extraPaths.push_back(pf + "\\Git\\bin");
    extraPaths.push_back(pf + "\\Go\\bin");
#else
    char delim = ':';
    const char* javaHome = std::getenv("JAVA_HOME");
    if (javaHome) {
        extraPaths.push_back(std::string(javaHome) + "/bin");
    }
    std::string jvmDir = "/usr/lib/jvm";
    try {
        if (fs::exists(jvmDir)) {
            for (const auto& entry : fs::directory_iterator(jvmDir)) {
                if (entry.is_directory()) {
                    std::string binDir = entry.path().string() + "/bin";
                    if (fs::exists(binDir + "/javac") || fs::exists(binDir + "/java")) {
                        extraPaths.push_back(binDir);
                    }
                }
            }
        }
    } catch (...) {}

    extraPaths.push_back("/usr/local/bin");
    extraPaths.push_back("/usr/bin");
    extraPaths.push_back("/bin");
    extraPaths.push_back("/opt/homebrew/bin");
#endif

    std::ostringstream oss;
    std::vector<std::string> parts = split(currentPath, delim);
    for (auto it = extraPaths.rbegin(); it != extraPaths.rend(); ++it) {
        if (fs::exists(*it)) {
            parts.insert(parts.begin(), *it);
        }
    }

    std::vector<std::string> uniqueParts;
    for (const auto& p : parts) {
        if (std::find(uniqueParts.begin(), uniqueParts.end(), p) == uniqueParts.end()) {
            uniqueParts.push_back(p);
        }
    }

    return join(uniqueParts, std::string(1, delim));
}

std::string RunixToolchainDiscovery::find_executable(std::string_view candidateName) {
    std::string effPath = get_effective_system_path();
#if defined(RUNIX_PLATFORM_WINDOWS)
    char delim = ';';
    std::vector<std::string> exts = {".exe", ".cmd", ".bat", ""};
#else
    char delim = ':';
    std::vector<std::string> exts = {""};
#endif

    std::vector<std::string> dirs = split(effPath, delim);
    for (const auto& dir : dirs) {
        for (const auto& ext : exts) {
            std::string fullPath = dir + (dir.back() == '/' || dir.back() == '\\' ? "" : "/") + std::string(candidateName) + ext;
            try {
                if (fs::exists(fullPath) && !fs::is_directory(fullPath)) {
                    return fs::canonical(fullPath).string();
                }
            } catch (...) {}
        }
    }
    return "";
}

std::string RunixToolchainDiscovery::probe_version(const std::string& exePath, const std::vector<std::string>& args) {
    if (exePath.empty()) return "";
    std::string cmd = "\"" + exePath + "\"";
    for (const auto& a : args) cmd += " " + a;

    std::string out;
#if defined(RUNIX_PLATFORM_WINDOWS)
    std::string sysCmd = "\"" + cmd + " 2>&1\"";
    FILE* pipe = _popen(sysCmd.c_str(), "r");
#else
    std::string sysCmd = cmd + " 2>&1";
    FILE* pipe = popen(sysCmd.c_str(), "r");
#endif
    if (!pipe) return "";

    char buf[256];
    while (fgets(buf, sizeof(buf), pipe)) {
        out += buf;
        if (out.size() > 512) break;
    }
#if defined(RUNIX_PLATFORM_WINDOWS)
    _pclose(pipe);
#else
    pclose(pipe);
#endif

    std::string firstLine = split(trim(out), '\n').empty() ? "installed" : split(trim(out), '\n')[0];
    return trim(firstLine);
}

bool RunixToolchainDiscovery::smoke_test_java(const std::string& javaPath, const std::string& javacPath, std::string& outMsg) {
    if (javaPath.empty() || javacPath.empty()) {
        outMsg = "Java runtime (java) or compiler (javac) missing";
        return false;
    }

    std::string tempDir = (fs::temp_directory_path() / ("runix_smoke_java_" + std::to_string(current_timestamp_ms()))).string();
    try {
        fs::create_directories(tempDir);
        std::string srcFile = (fs::path(tempDir) / "RunixSmokeTest.java").string();
        {
            std::ofstream ofs(srcFile);
            ofs << "public class RunixSmokeTest { public static void main(String[] args){ System.out.println(\"RUNIX_JAVA_OK\"); } }\n";
        }

        // 1. Compile
        std::string compileCmd = "\"" + javacPath + "\" -d \"" + tempDir + "\" \"" + srcFile + "\"";
#if defined(RUNIX_PLATFORM_WINDOWS)
        std::string sysCompileCmd = "\"" + compileCmd + " >nul 2>&1\"";
        int compileRes = std::system(sysCompileCmd.c_str());
#else
        std::string sysCompileCmd = compileCmd + " >/dev/null 2>&1";
        int compileRes = std::system(sysCompileCmd.c_str());
#endif
        if (compileRes != 0) {
            outMsg = "javac compilation failed";
            fs::remove_all(tempDir);
            return false;
        }

        // 2. Run
        std::string runCmd = "\"" + javaPath + "\" -cp \"" + tempDir + "\" RunixSmokeTest";
        std::string runOut;
#if defined(RUNIX_PLATFORM_WINDOWS)
        std::string sysRunCmd = "\"" + runCmd + " 2>&1\"";
        FILE* pipe = _popen(sysRunCmd.c_str(), "r");
#else
        std::string sysRunCmd = runCmd + " 2>&1";
        FILE* pipe = popen(sysRunCmd.c_str(), "r");
#endif
        if (pipe) {
            char buf[128];
            while (fgets(buf, sizeof(buf), pipe)) runOut += buf;
#if defined(RUNIX_PLATFORM_WINDOWS)
            _pclose(pipe);
#else
            pclose(pipe);
#endif
        }

        fs::remove_all(tempDir);

        if (runOut.find("RUNIX_JAVA_OK") != std::string::npos) {
            outMsg = "Java compile and run smoke test succeeded";
            return true;
        } else {
            outMsg = "Java output did not match expected smoke token";
            return false;
        }
    } catch (const std::exception& e) {
        outMsg = e.what();
        try { fs::remove_all(tempDir); } catch (...) {}
        return false;
    }
}

DiscoveredRuntime RunixToolchainDiscovery::discover(std::string_view runtimeId, bool forceRefresh) {
    std::string key = to_lower(runtimeId);
    if (!forceRefresh && cache_.find(key) != cache_.end()) {
        return cache_[key];
    }

    DiscoveredRuntime res;
    res.runtimeId = key;
    res.lastCheckedMs = current_timestamp_ms();

    if (key == "java") {
        res.name = "Java";
        res.category = "vm";

        DiscoveredTool javaTool;
        javaTool.role = "runtime";
        javaTool.name = "Java Virtual Machine (java)";
        javaTool.executableName = "java";
        javaTool.executablePath = find_executable("java");
        javaTool.isRequiredForRun = true;
        javaTool.isRequiredForBuild = false;

        if (!javaTool.executablePath.empty()) {
            javaTool.version = probe_version(javaTool.executablePath, {"-version"});
            javaTool.state = ToolDiscoveryState::Available;
        } else {
            javaTool.state = ToolDiscoveryState::Unavailable;
            javaTool.errorReason = "java executable not found on PATH";
        }
        res.tools["runtime"] = javaTool;

        DiscoveredTool javacTool;
        javacTool.role = "compiler";
        javacTool.name = "Java Compiler (javac)";
        javacTool.executableName = "javac";
        javacTool.executablePath = find_executable("javac");
        javacTool.isRequiredForRun = true;
        javacTool.isRequiredForBuild = true;

        if (!javacTool.executablePath.empty()) {
            javacTool.version = probe_version(javacTool.executablePath, {"-version"});
            javacTool.state = ToolDiscoveryState::Available;
        } else {
            javacTool.state = ToolDiscoveryState::Unavailable;
            javacTool.errorReason = "javac executable not found on PATH";
        }
        res.tools["compiler"] = javacTool;

        res.primaryExecutable = javaTool.executableName;
        res.primaryExecutablePath = javaTool.executablePath;
        res.primaryVersion = javaTool.version;
        res.compilerExecutable = javacTool.executableName;
        res.compilerExecutablePath = javacTool.executablePath;
        res.compilerVersion = javacTool.version;

        bool hasJava = javaTool.state == ToolDiscoveryState::Available;
        bool hasJavac = javacTool.state == ToolDiscoveryState::Available;

        res.canBuild = hasJavac;
        res.canRun = hasJava && hasJavac;

        if (hasJava && hasJavac) {
            std::string smokeMsg;
            if (smoke_test_java(javaTool.executablePath, javacTool.executablePath, smokeMsg)) {
                res.state = ToolDiscoveryState::Verified;
                res.tools["runtime"].state = ToolDiscoveryState::Verified;
                res.tools["compiler"].state = ToolDiscoveryState::Verified;
            } else {
                res.state = ToolDiscoveryState::Broken;
                res.statusReason = smokeMsg;
            }
        } else if (hasJava && !hasJavac) {
            res.state = ToolDiscoveryState::Available;
            res.statusReason = "Java runtime (java) is available, but Java compiler (javac) is missing. Java source files cannot be compiled.";
        } else {
            res.state = ToolDiscoveryState::Unavailable;
            res.statusReason = "Java Development Kit (JDK) is not installed in the execution environment.";
        }
    } else if (key == "python") {
        res.name = "Python";
        res.category = "interpreted";

        DiscoveredTool py;
        py.role = "interpreter";
        py.name = "Python Interpreter";
        py.executableName = "python";
        py.executablePath = find_executable("python");
        if (py.executablePath.empty()) py.executablePath = find_executable("python3");
        if (py.executablePath.empty()) py.executablePath = find_executable("py");

        if (!py.executablePath.empty()) {
            py.version = probe_version(py.executablePath, {"--version"});
            py.state = ToolDiscoveryState::Verified;
            res.state = ToolDiscoveryState::Verified;
            res.canRun = true;
        } else {
            py.state = ToolDiscoveryState::Unavailable;
            res.state = ToolDiscoveryState::Unavailable;
            res.statusReason = "Python interpreter is not installed on PATH.";
        }
        res.primaryExecutable = py.executableName;
        res.primaryExecutablePath = py.executablePath;
        res.primaryVersion = py.version;
        res.interpreterExecutable = py.executableName;
        res.interpreterExecutablePath = py.executablePath;
        res.interpreterVersion = py.version;
        res.tools["interpreter"] = py;
    } else if (key == "cpp" || key == "c") {
        bool isCpp = (key == "cpp");
        res.name = isCpp ? "C++" : "C";
        res.category = "compiled";

        std::string cand = isCpp ? "g++" : "gcc";
        DiscoveredTool comp;
        comp.role = "compiler";
        comp.name = isCpp ? "C++ Compiler (g++)" : "C Compiler (gcc)";
        comp.executableName = cand;
        comp.executablePath = find_executable(cand);
        if (comp.executablePath.empty() && isCpp) comp.executablePath = find_executable("clang++");
        if (comp.executablePath.empty() && !isCpp) comp.executablePath = find_executable("clang");

        if (!comp.executablePath.empty()) {
            comp.version = probe_version(comp.executablePath, {"--version"});
            comp.state = ToolDiscoveryState::Verified;
            res.state = ToolDiscoveryState::Verified;
            res.canBuild = true;
            res.canRun = true;
        } else {
            comp.state = ToolDiscoveryState::Unavailable;
            res.state = ToolDiscoveryState::Unavailable;
            res.statusReason = res.name + " compiler is not installed or available on PATH.";
        }
        res.primaryExecutable = comp.executableName;
        res.primaryExecutablePath = comp.executablePath;
        res.primaryVersion = comp.version;
        res.compilerExecutable = comp.executableName;
        res.compilerExecutablePath = comp.executablePath;
        res.compilerVersion = comp.version;
        res.tools["compiler"] = comp;
    } else if (key == "rust") {
        res.name = "Rust";
        res.category = "compiled";

        DiscoveredTool rustc;
        rustc.role = "compiler";
        rustc.name = "Rust Compiler (rustc)";
        rustc.executableName = "rustc";
        rustc.executablePath = find_executable("rustc");

        if (!rustc.executablePath.empty()) {
            rustc.version = probe_version(rustc.executablePath, {"--version"});
            rustc.state = ToolDiscoveryState::Verified;
            res.state = ToolDiscoveryState::Verified;
            res.canBuild = true;
            res.canRun = true;
        } else {
            rustc.state = ToolDiscoveryState::Unavailable;
            res.state = ToolDiscoveryState::Unavailable;
            res.statusReason = "Rust compiler (rustc) is not installed on PATH.";
        }
        res.primaryExecutable = rustc.executableName;
        res.primaryExecutablePath = rustc.executablePath;
        res.primaryVersion = rustc.version;
        res.compilerExecutable = rustc.executableName;
        res.compilerExecutablePath = rustc.executablePath;
        res.tools["compiler"] = rustc;
    } else if (key == "go") {
        res.name = "Go";
        res.category = "compiled";

        DiscoveredTool goTool;
        goTool.role = "compiler";
        goTool.name = "Go Toolchain";
        goTool.executableName = "go";
        goTool.executablePath = find_executable("go");

        if (!goTool.executablePath.empty()) {
            goTool.version = probe_version(goTool.executablePath, {"version"});
            goTool.state = ToolDiscoveryState::Verified;
            res.state = ToolDiscoveryState::Verified;
            res.canBuild = true;
            res.canRun = true;
        } else {
            goTool.state = ToolDiscoveryState::Unavailable;
            res.state = ToolDiscoveryState::Unavailable;
            res.statusReason = "Go toolchain is not installed on PATH.";
        }
        res.primaryExecutable = goTool.executableName;
        res.primaryExecutablePath = goTool.executablePath;
        res.primaryVersion = goTool.version;
        res.compilerExecutable = goTool.executableName;
        res.compilerExecutablePath = goTool.executablePath;
        res.tools["compiler"] = goTool;
    } else if (key == "lua") {
        res.name = "Lua";
        res.category = "interpreted";

        DiscoveredTool luaTool;
        luaTool.role = "interpreter";
        luaTool.name = "Lua Interpreter";
        luaTool.executableName = "lua";
        luaTool.executablePath = find_executable("lua");
        if (luaTool.executablePath.empty()) luaTool.executablePath = find_executable("lua54");
        if (luaTool.executablePath.empty()) luaTool.executablePath = find_executable("luajit");

        if (!luaTool.executablePath.empty()) {
            luaTool.version = probe_version(luaTool.executablePath, {"-v"});
            luaTool.state = ToolDiscoveryState::Verified;
            res.state = ToolDiscoveryState::Verified;
            res.canRun = true;
        } else {
            luaTool.state = ToolDiscoveryState::Unavailable;
            res.state = ToolDiscoveryState::Unavailable;
            res.statusReason = "Lua interpreter is not installed on PATH.";
        }
        res.primaryExecutable = luaTool.executableName;
        res.primaryExecutablePath = luaTool.executablePath;
        res.primaryVersion = luaTool.version;
        res.interpreterExecutable = luaTool.executableName;
        res.interpreterExecutablePath = luaTool.executablePath;
        res.tools["interpreter"] = luaTool;
    } else if (key == "nodejs" || key == "javascript") {
        res.name = "Node.js";
        res.category = "interpreted";

        DiscoveredTool nodeTool;
        nodeTool.role = "runtime";
        nodeTool.name = "Node.js Runtime";
        nodeTool.executableName = "node";
        nodeTool.executablePath = find_executable("node");

        if (!nodeTool.executablePath.empty()) {
            nodeTool.version = probe_version(nodeTool.executablePath, {"-v"});
            nodeTool.state = ToolDiscoveryState::Verified;
            res.state = ToolDiscoveryState::Verified;
            res.canRun = true;
        } else {
            nodeTool.state = ToolDiscoveryState::Unavailable;
            res.state = ToolDiscoveryState::Unavailable;
            res.statusReason = "Node.js runtime is not installed on PATH.";
        }
        res.primaryExecutable = nodeTool.executableName;
        res.primaryExecutablePath = nodeTool.executablePath;
        res.primaryVersion = nodeTool.version;
        res.tools["runtime"] = nodeTool;
    } else {
        // Fallback for other environments
        DiscoveredTool t;
        t.role = "runtime";
        t.name = key;
        t.executableName = key;
        t.executablePath = find_executable(key);
        if (!t.executablePath.empty()) {
            t.state = ToolDiscoveryState::Available;
            res.state = ToolDiscoveryState::Available;
            res.canRun = true;
        } else {
            t.state = ToolDiscoveryState::Unavailable;
            res.state = ToolDiscoveryState::Unavailable;
            res.statusReason = "Executable '" + key + "' not found on PATH.";
        }
        res.primaryExecutable = t.executableName;
        res.primaryExecutablePath = t.executablePath;
        res.tools["runtime"] = t;
    }

    cache_[key] = res;
    return res;
}

std::map<std::string, DiscoveredRuntime> RunixToolchainDiscovery::discover_all(bool forceRefresh) {
    std::vector<std::string> keys = {"java", "python", "cpp", "c", "rust", "go", "lua", "nodejs"};
    std::map<std::string, DiscoveredRuntime> out;
    for (const auto& k : keys) {
        out[k] = discover(k, forceRefresh);
    }
    return out;
}

} // namespace runix
