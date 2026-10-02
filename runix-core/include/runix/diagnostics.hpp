#pragma once

#include "json.hpp"
#include <string>
#include <optional>

namespace runix {

struct ExecutionDiagnostics {
    std::string executionId;
    std::string workspaceId;
    std::string projectId;
    std::string filename;
    std::string runtimeId;
    std::string tool;
    std::string toolVersion;
    std::string phase;
    int64_t durationMs = 0;
    std::optional<int> exitCode;
    bool success = false;
    std::string errorCode;

    JsonValue to_json() const {
        JsonValue j = JsonValue::object();
        j["executionId"] = executionId;
        j["workspaceId"] = workspaceId;
        j["projectId"] = projectId;
        j["filename"] = filename;
        j["runtimeId"] = runtimeId;
        j["tool"] = tool;
        j["toolVersion"] = toolVersion;
        j["phase"] = phase;
        j["durationMs"] = durationMs;
        if (exitCode.has_value()) j["exitCode"] = *exitCode;
        j["success"] = success;
        if (!errorCode.empty()) j["errorCode"] = errorCode;
        return j;
    }
};

} // namespace runix
