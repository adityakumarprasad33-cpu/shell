#pragma once

#include <string>
#include <filesystem>
#include <vector>

namespace runix {

namespace fs = std::filesystem;

class RunixPathResolver {
public:
    static std::string normalize_logical_path(std::string_view path);

    static std::string resolve_physical_path(
        std::string_view runnerRoot,
        std::string_view logicalPath
    );

    static bool is_safe_relative_path(std::string_view path);

    static std::string get_execution_relative_path(
        std::string_view targetPath,
        std::string_view currentDirectory
    );
};

} // namespace runix
