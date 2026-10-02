#pragma once

#include "protocol.hpp"
#include <string>
#include <vector>
#include <filesystem>

namespace runix {

namespace fs = std::filesystem;

class RunixSandbox {
public:
    static std::string get_base_temp_directory();

    static std::string materialize(
        std::string_view executionId,
        const std::vector<FilePayload>& files
    );

    static void cleanup(std::string_view runnerRoot);

    static void ensure_build_directories(std::string_view runnerRoot);
};

} // namespace runix
