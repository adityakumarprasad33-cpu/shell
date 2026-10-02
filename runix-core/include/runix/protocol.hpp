#pragma once

#include "json.hpp"
#include <string>
#include <vector>
#include <optional>

namespace runix {

struct FilePayload {
    std::string path;
    std::string content;
};

struct CoreRequest {
    std::string operation; // "detect", "preflight", "capabilities", "build", "run", "test", "doctor", "cancel"
    std::string executionId;
    std::string workspaceId;
    std::string projectId;
    std::string filename;
    std::string targetFile;
    std::string workspaceDir;
    std::string languageId;
    std::string stdinInput;
    int64_t timeoutMs = 30000;
    bool forceRefresh = false;
    std::vector<FilePayload> files;

    static CoreRequest from_json(const JsonValue& j) {
        CoreRequest req;
        req.operation = j["operation"].as_string();
        req.executionId = j["executionId"].as_string();
        req.workspaceId = j["workspaceId"].as_string();
        req.projectId = j["projectId"].as_string();
        req.filename = j["filename"].as_string();
        req.targetFile = j["targetFile"].as_string(req.filename);
        req.workspaceDir = j["workspaceDir"].as_string();
        req.languageId = j["languageId"].as_string();
        req.stdinInput = j["stdinInput"].as_string();
        req.timeoutMs = j["timeoutMs"].as_int(30000);
        req.forceRefresh = j["forceRefresh"].as_bool(false);

        if (j["files"].is_array()) {
            for (const auto& item : j["files"].as_array()) {
                FilePayload fp;
                fp.path = item["path"].as_string();
                fp.content = item["content"].as_string();
                req.files.push_back(std::move(fp));
            }
        }
        return req;
    }
};

struct StreamEvent {
    std::string type; // "stdout", "stderr", "status", "exit", "error"
    std::string data;
    std::optional<int> exitCode;
    std::optional<int64_t> durationMs;
    std::string status;
    std::string phase;
    std::string errorCode;
    std::string tool;
    std::string message;

    JsonValue to_json() const {
        JsonValue j = JsonValue::object();
        j["type"] = type;
        if (!data.empty()) j["data"] = data;
        if (exitCode.has_value()) j["exitCode"] = *exitCode;
        if (durationMs.has_value()) j["durationMs"] = *durationMs;
        if (!status.empty()) j["status"] = status;
        if (!phase.empty()) j["phase"] = phase;
        if (!errorCode.empty()) j["errorCode"] = errorCode;
        if (!tool.empty()) j["tool"] = tool;
        if (!message.empty()) j["message"] = message;
        return j;
    }

    std::string to_jsonl() const {
        return to_json().serialize() + "\n";
    }
};

} // namespace runix
