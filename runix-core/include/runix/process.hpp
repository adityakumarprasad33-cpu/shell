#pragma once

#include "protocol.hpp"
#include <string>
#include <vector>
#include <map>
#include <functional>
#include <atomic>
#include <chrono>

namespace runix {

struct ProcessConfig {
    std::string command;
    std::vector<std::string> args;
    std::string workingDirectory;
    std::map<std::string, std::string> environment;
    std::string stdinInput;
    int64_t timeoutMs = 30000;
    int64_t maxOutputBytes = 5 * 1024 * 1024;
    std::string executionId;
};

struct ProcessResult {
    int exitCode = -1;
    int64_t durationMs = 0;
    bool timedOut = false;
    bool cancelled = false;
    std::string stdoutData;
    std::string stderrData;
    std::string errorReason;
};

class RunixProcessEngine {
public:
    static RunixProcessEngine& instance();

    ProcessResult execute(
        const ProcessConfig& config,
        std::function<void(const StreamEvent&)> on_event = nullptr
    );

    void cancel(std::string_view executionId);

private:
    RunixProcessEngine() = default;
    std::map<std::string, uint32_t> active_pids_;
};

} // namespace runix
