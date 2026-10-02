#pragma once

#include "planner.hpp"
#include "protocol.hpp"
#include "process.hpp"
#include <string>
#include <functional>

namespace runix {

struct BuildResult {
    bool success = false;
    int exitCode = -1;
    int64_t durationMs = 0;
    std::string tool;
    std::string stdoutData;
    std::string stderrData;
    std::string errorCode;
    std::string errorMessage;

    JsonValue to_json() const;
};

class RunixBuildEngine {
public:
    static BuildResult build(
        const BuildPlan& plan,
        std::string_view runnerRoot,
        std::function<void(const StreamEvent&)> on_event = nullptr
    );
};

} // namespace runix
