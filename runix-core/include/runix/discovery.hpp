#pragma once

#include "json.hpp"
#include <string>
#include <vector>
#include <map>
#include <optional>

namespace runix {

enum class ToolDiscoveryState {
    Unknown,
    Available,
    Verified,
    Unavailable,
    Broken
};

inline std::string tool_state_to_string(ToolDiscoveryState s) {
    switch (s) {
        case ToolDiscoveryState::Available: return "AVAILABLE";
        case ToolDiscoveryState::Verified: return "VERIFIED";
        case ToolDiscoveryState::Unavailable: return "UNAVAILABLE";
        case ToolDiscoveryState::Broken: return "BROKEN";
        default: return "UNKNOWN";
    }
}

struct DiscoveredTool {
    std::string role; // "runtime", "compiler", "interpreter", "builder", "packageManager"
    std::string name;
    std::string executableName;
    std::string executablePath;
    std::string version;
    ToolDiscoveryState state = ToolDiscoveryState::Unavailable;
    bool isRequiredForRun = false;
    bool isRequiredForBuild = false;
    std::string errorReason;

    JsonValue to_json() const;
};

struct DiscoveredRuntime {
    std::string runtimeId;
    std::string name;
    std::string category;
    ToolDiscoveryState state = ToolDiscoveryState::Unavailable;

    std::string primaryExecutable;
    std::string primaryExecutablePath;
    std::string primaryVersion;

    std::string compilerExecutable;
    std::string compilerExecutablePath;
    std::string compilerVersion;

    std::string interpreterExecutable;
    std::string interpreterExecutablePath;
    std::string interpreterVersion;

    std::string builderExecutable;
    std::string builderExecutablePath;

    std::string packageManagerExecutable;
    std::string packageManagerExecutablePath;

    std::map<std::string, DiscoveredTool> tools;

    bool canRun = false;
    bool canBuild = false;
    std::string statusReason;
    int64_t lastCheckedMs = 0;

    JsonValue to_json() const;
};

class RunixToolchainDiscovery {
public:
    static RunixToolchainDiscovery& instance();

    DiscoveredRuntime discover(std::string_view runtimeId, bool forceRefresh = false);
    std::map<std::string, DiscoveredRuntime> discover_all(bool forceRefresh = false);

    std::string find_executable(std::string_view candidateName);
    std::string get_effective_system_path();

    void clear_cache();

private:
    RunixToolchainDiscovery();
    std::map<std::string, DiscoveredRuntime> cache_;
    std::string cached_system_path_;

    std::string probe_version(const std::string& exePath, const std::vector<std::string>& args);
    bool smoke_test_java(const std::string& javaPath, const std::string& javacPath, std::string& outMsg);
};

} // namespace runix
