#pragma once

#include "protocol.hpp"
#include "planner.hpp"
#include "builder.hpp"
#include <string>
#include <functional>

namespace runix {

struct RunResult {
    bool success = false;
    int exitCode = -1;
    int64_t durationMs = 0;
    std::string phase; // "preflight", "build", "exec"
    std::string stdoutData;
    std::string stderrData;
    std::string errorCode;
    std::string errorMessage;

    JsonValue to_json() const;
};

class RunixRunEngine {
public:
    static RunResult run(
        const CoreRequest& request,
        std::function<void(const StreamEvent&)> on_event = nullptr
    );
};

} // namespace runix
