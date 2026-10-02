#include "runix/sandbox.hpp"
#include "runix/path_resolver.hpp"
#include "runix/common.hpp"
#include <fstream>
#include <iostream>

namespace runix {

std::string RunixSandbox::get_base_temp_directory() {
    fs::path p = fs::temp_directory_path() / "runix_executions";
    try {
        fs::create_directories(p);
    } catch (...) {}
    return p.string();
}

std::string RunixSandbox::materialize(
    std::string_view executionId,
    const std::vector<FilePayload>& files
) {
    fs::path runnerRoot = fs::path(get_base_temp_directory()) / std::string(executionId);
    try {
        fs::create_directories(runnerRoot);
    } catch (...) {}

    for (const auto& file : files) {
        std::string physicalPath = RunixPathResolver::resolve_physical_path(runnerRoot.string(), file.path);
        fs::path p(physicalPath);
        try {
            if (p.has_parent_path()) {
                fs::create_directories(p.parent_path());
            }
            std::ofstream ofs(p, std::ios::binary);
            ofs.write(file.content.data(), file.content.size());
        } catch (const std::exception& e) {
            std::cerr << "Failed to materialize " << file.path << ": " << e.what() << std::endl;
        }
    }

    ensure_build_directories(runnerRoot.string());
    return runnerRoot.string();
}

void RunixSandbox::cleanup(std::string_view runnerRoot) {
    if (runnerRoot.empty()) return;
    try {
        if (fs::exists(runnerRoot)) {
            fs::remove_all(runnerRoot);
        }
    } catch (...) {}
}

void RunixSandbox::ensure_build_directories(std::string_view runnerRoot) {
    fs::path base(runnerRoot);
    try {
        fs::create_directories(base / "build");
        fs::create_directories(base / "build" / "classes");
    } catch (...) {}
}

} // namespace runix
