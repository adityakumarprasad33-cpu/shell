#include "runix/common.hpp"
#include "runix/json.hpp"
#include "runix/protocol.hpp"
#include "runix/detector.hpp"
#include "runix/discovery.hpp"
#include "runix/capability.hpp"
#include "runix/planner.hpp"
#include "runix/builder.hpp"
#include "runix/runner.hpp"

#include <iostream>
#include <string>

namespace runix {
    int run_all_tests();
}

using namespace runix;

static void handle_ipc_request(const std::string& line) {
    if (line.empty()) return;
    JsonValue jreq = JsonValue::parse(line);
    CoreRequest req = CoreRequest::from_json(jreq);

    auto emit_event = [](const StreamEvent& ev) {
        std::cout << ev.to_jsonl() << std::flush;
    };

    if (req.operation == "detect") {
        DetectionResult det = RunixFileDetector::detect(req.filename);
        JsonValue res = JsonValue::object();
        res["type"] = "detect";
        res["result"] = det.to_json();
        std::cout << res.serialize() << std::endl;
    } else if (req.operation == "capabilities") {
        ResolvedCapabilities caps = RunixCapabilityResolver::resolve(req.filename, req.workspaceDir);
        JsonValue res = JsonValue::object();
        res["type"] = "capabilities";
        res["result"] = caps.to_json();
        std::cout << res.serialize() << std::endl;
    } else if (req.operation == "doctor") {
        auto& disc = RunixToolchainDiscovery::instance();
        auto all = disc.discover_all(req.forceRefresh);
        JsonValue res = JsonValue::object();
        res["type"] = "doctor";
        JsonValue list = JsonValue::object();
        for (const auto& [k, v] : all) {
            list[k] = v.to_json();
        }
        res["runtimes"] = list;
        std::cout << res.serialize() << std::endl;
    } else if (req.operation == "preflight") {
        auto& disc = RunixToolchainDiscovery::instance();
        DiscoveredRuntime dr = disc.discover(req.languageId, req.forceRefresh);
        JsonValue res = JsonValue::object();
        res["type"] = "preflight";
        res["runtime"] = dr.to_json();
        std::cout << res.serialize() << std::endl;
    } else if (req.operation == "build") {
        BuildPlan plan = RunixPlanner::create_build_plan(req.targetFile, req.workspaceDir);
        BuildResult bres = RunixBuildEngine::build(plan, req.workspaceDir, emit_event);
        JsonValue res = JsonValue::object();
        res["type"] = "build_result";
        res["result"] = bres.to_json();
        std::cout << res.serialize() << std::endl;
    } else if (req.operation == "run") {
        RunResult rres = RunixRunEngine::run(req, emit_event);
        JsonValue res = JsonValue::object();
        res["type"] = "run_result";
        res["result"] = rres.to_json();
        std::cout << res.serialize() << std::endl;
    } else if (req.operation == "cancel") {
        RunixProcessEngine::instance().cancel(req.executionId);
        JsonValue res = JsonValue::object();
        res["type"] = "cancelled";
        res["executionId"] = req.executionId;
        std::cout << res.serialize() << std::endl;
    } else {
        JsonValue res = JsonValue::object();
        res["type"] = "error";
        res["message"] = "Unknown operation: " + req.operation;
        std::cout << res.serialize() << std::endl;
    }
}

int main(int argc, char* argv[]) {
    // Check CLI subcommands
    if (argc > 1) {
        std::string sub = argv[1];
        if (sub == "test" || sub == "test-suite" || sub == "--test") {
            return run_all_tests();
        }
        if (sub == "detect" && argc > 2) {
            DetectionResult det = RunixFileDetector::detect(argv[2]);
            std::cout << det.to_json().serialize() << std::endl;
            return 0;
        }
        if (sub == "capabilities" && argc > 2) {
            ResolvedCapabilities caps = RunixCapabilityResolver::resolve(argv[2]);
            std::cout << caps.to_json().serialize() << std::endl;
            return 0;
        }
        if (sub == "doctor") {
            auto& disc = RunixToolchainDiscovery::instance();
            auto all = disc.discover_all(true);
            JsonValue j = JsonValue::object();
            for (const auto& [k, v] : all) {
                j[k] = v.to_json();
            }
            std::cout << j.serialize() << std::endl;
            return 0;
        }
        if (sub == "version" || sub == "--version" || sub == "-v") {
            std::cout << "Runix Core Native C++20 v1.0.0" << std::endl;
            return 0;
        }
    }

    // Default or "ipc" mode: Read JSONL line by line from stdin
    std::string line;
    while (std::getline(std::cin, line)) {
        line = trim(line);
        if (!line.empty()) {
            handle_ipc_request(line);
        }
    }

    return 0;
}
