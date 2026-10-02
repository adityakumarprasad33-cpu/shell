#include "runix/path_resolver.hpp"
#include "runix/common.hpp"
#include <filesystem>
#include <algorithm>

namespace runix {

std::string RunixPathResolver::normalize_logical_path(std::string_view path) {
    std::string s = replace_all(std::string(path), "\\", "/");
    s = trim(s);
    while (starts_with(s, "./")) {
        s = s.substr(2);
    }
    while (starts_with(s, "/")) {
        s = s.substr(1);
    }
    while (ends_with(s, "/")) {
        s = s.substr(0, s.size() - 1);
    }
    return s;
}

bool RunixPathResolver::is_safe_relative_path(std::string_view path) {
    std::string norm = normalize_logical_path(path);
    if (starts_with(norm, "../") || norm == ".." || norm.find("/../") != std::string::npos) {
        return false;
    }
#if defined(RUNIX_PLATFORM_WINDOWS)
    if (norm.size() >= 2 && norm[1] == ':') return false; // Drive letter
#endif
    return true;
}

std::string RunixPathResolver::resolve_physical_path(
    std::string_view runnerRoot,
    std::string_view logicalPath
) {
    std::string cleanLogical = normalize_logical_path(logicalPath);
    if (!is_safe_relative_path(cleanLogical)) {
        // Fallback to basename for safety
        fs::path p(cleanLogical);
        cleanLogical = p.filename().string();
    }

    fs::path base(runnerRoot);
    fs::path combined = base / cleanLogical;

    // Prevent duplicate nested path e.g. <runnerRoot>/test/test/main.py
    std::string combinedStr = replace_all(combined.lexically_normal().string(), "\\", "/");
    return combinedStr;
}

std::string RunixPathResolver::get_execution_relative_path(
    std::string_view targetPath,
    std::string_view currentDirectory
) {
    std::string normTarget = normalize_logical_path(targetPath);
    std::string normCwd = normalize_logical_path(currentDirectory);

    if (normCwd.empty() || normCwd == ".") {
        return normTarget;
    }

    if (starts_with(normTarget, normCwd + "/")) {
        return normTarget.substr(normCwd.size() + 1);
    }

    return normTarget;
}

} // namespace runix
