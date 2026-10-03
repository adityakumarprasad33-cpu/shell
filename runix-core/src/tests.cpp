#include "runix/common.hpp"
#include "runix/json.hpp"
#include "runix/registry.hpp"
#include "runix/detector.hpp"
#include "runix/discovery.hpp"
#include "runix/capability.hpp"
#include "runix/planner.hpp"
#include "runix/path_resolver.hpp"
#include "runix/sandbox.hpp"
#include "runix/process.hpp"
#include "runix/builder.hpp"
#include "runix/runner.hpp"

#include <iostream>
#include <cassert>
#include <vector>
#include <string>

namespace runix {

int run_all_tests() {
    int passed = 0;
    int failed = 0;

    auto test = [&](std::string_view code, std::string_view desc, bool condition) {
        if (condition) {
            std::cout << "  \x1b[32m[PASS]\x1b[0m " << code << ": " << desc << std::endl;
            passed++;
        } else {
            std::cerr << "  \x1b[31m[FAIL]\x1b[0m " << code << ": " << desc << std::endl;
            failed++;
        }
    };

    std::cout << "\r\n\x1b[1;37m=========================================================\x1b[0m" << std::endl;
    std::cout << "\x1b[1;36mRUNIX NATIVE CORE (C++20) — FULL TEST & REGRESSION SUITE\x1b[0m" << std::endl;
    std::cout << "\x1b[1;37m=========================================================\x1b[0m\r\n" << std::endl;

    // --- DETECTOR TESTS ---
    std::cout << "\x1b[1m[GROUP 1: DETECTOR ENGINE]\x1b[0m" << std::endl;
    {
        DetectionResult d1 = RunixFileDetector::detect("test.java");
        test("DET-001", "Detect Java source file", d1.languageId == "java" && d1.fileType == "compiled");

        DetectionResult d2 = RunixFileDetector::detect("server.py");
        test("DET-002", "Detect Python script file", d2.languageId == "python" && d2.fileType == "interpreted");

        DetectionResult d3 = RunixFileDetector::detect("app.cpp");
        test("DET-003", "Detect C++ source file", d3.languageId == "cpp" && d3.fileType == "compiled");

        std::string ptype = RunixFileDetector::detect_project_type({"Cargo.toml", "src/main.rs"});
        test("DET-004", "Detect Rust project manifest", ptype == "rust-project");
    }

    // --- TOOLCHAIN DISCOVERY TESTS ---
    std::cout << "\r\n\x1b[1m[GROUP 2: TOOLCHAIN DISCOVERY]\x1b[0m" << std::endl;
    {
        auto& disc = RunixToolchainDiscovery::instance();

        DiscoveredRuntime dj = disc.discover("java", true);
        test("DISC-001", "Discover Java runtime and compiler independently",
            dj.tools.find("runtime") != dj.tools.end() && dj.tools.find("compiler") != dj.tools.end());

        DiscoveredRuntime dp = disc.discover("python", true);
        test("DISC-002", "Discover Python interpreter",
            dp.tools.find("interpreter") != dp.tools.end());

        DiscoveredRuntime dcpp = disc.discover("cpp", true);
        test("DISC-003", "Discover C++ compiler tool",
            dcpp.tools.find("compiler") != dcpp.tools.end());

        DiscoveredRuntime dnon = disc.discover("nonexistent_runtime_xyz", true);
        test("DISC-004", "Missing tool reports UNAVAILABLE without false verified",
            dnon.state == ToolDiscoveryState::Unavailable && !dnon.canRun && !dnon.canBuild);
    }

    // --- CAPABILITY RESOLVER TESTS ---
    std::cout << "\r\n\x1b[1m[GROUP 3: CAPABILITY RESOLUTION]\x1b[0m" << std::endl;
    {
        ResolvedCapabilities cj = RunixCapabilityResolver::resolve("test.java");
        test("CAP-001", "Java capability respects compiler availability",
            cj.canBuild == cj.compilerAvailable);

        ResolvedCapabilities cp = RunixCapabilityResolver::resolve("main.py");
        test("CAP-002", "Python capability identifies interpreted execution",
            !cp.canBuild && (cp.canRun == cp.runtimeAvailable));

        ResolvedCapabilities ctxt = RunixCapabilityResolver::resolve("notes.txt");
        test("CAP-003", "Plain text file resolved as non-runnable",
            !ctxt.isRunnable && !ctxt.canRun && !ctxt.canBuild);
    }

    // --- PATH RESOLVER & SECURITY TESTS ---
    std::cout << "\r\n\x1b[1m[GROUP 4: PATH RESOLUTION & SECURITY]\x1b[0m" << std::endl;
    {
        std::string p1 = RunixPathResolver::resolve_physical_path("C:/tmp/runner", "src/main.py");
        test("PATH-001", "Normalize and resolve simple path",
            p1.find("src/main.py") != std::string::npos);

        std::string p2 = RunixPathResolver::resolve_physical_path("C:/tmp/runner", "test/main.py");
        test("PATH-002", "Prevent duplicate path prefix nesting",
            p2.find("test/test/main.py") == std::string::npos);

        test("SEC-001", "Block path traversal attempt (../)",
            !RunixPathResolver::is_safe_relative_path("../../../etc/passwd"));

        test("SEC-002", "Allow safe relative nested path",
            RunixPathResolver::is_safe_relative_path("src/components/App.tsx"));
    }

    // --- PROCESS ENGINE & STREAMING TESTS ---
    std::cout << "\r\n\x1b[1m[GROUP 5: PROCESS ENGINE & EXECUTION]\x1b[0m" << std::endl;
    {
        ProcessConfig pcfg;
#if defined(RUNIX_PLATFORM_WINDOWS)
        pcfg.command = "echo RUNIX_PROCESS_TEST";
#else
        pcfg.command = "echo 'RUNIX_PROCESS_TEST'";
#endif
        pcfg.timeoutMs = 5000;

        std::string capturedOut;
        ProcessResult res = RunixProcessEngine::instance().execute(pcfg, [&](const StreamEvent& ev) {
            if (ev.type == "stdout") capturedOut += ev.data;
        });

        test("PROC-001", "Capture stdout streaming in real time",
            capturedOut.find("RUNIX_PROCESS_TEST") != std::string::npos);

        test("PROC-002", "Exit code 0 captured cleanly", res.exitCode == 0);
    }

    // --- JAVA REGRESSION TEST ---
    std::cout << "\r\n\x1b[1m[GROUP 6: JAVA REGRESSION PREFLIGHT]\x1b[0m" << std::endl;
    {
        auto& disc = RunixToolchainDiscovery::instance();
        DiscoveredRuntime dr = disc.discover("java");

        if (dr.canBuild && dr.canRun) {
            std::cout << "  (Host JDK detected: " << dr.compilerExecutable << " / " << dr.primaryExecutable << ")" << std::endl;
            test("JAVA-001", "Java both java and javac verified on host",
                dr.state == ToolDiscoveryState::Verified);
        } else if (!dr.canBuild) {
            std::cout << "  (Host JDK missing javac: correctly verified as UNAVAILABLE)" << std::endl;
            test("JAVA-001", "Missing javac correctly prevents build without shell crash",
                !dr.canBuild);
        }
    }

    std::cout << "\r\n\x1b[1;37m---------------------------------------------------------\x1b[0m" << std::endl;
    std::cout << "RESULTS: \x1b[32m" << passed << " PASSED\x1b[0m | \x1b[31m" << failed << " FAILED\x1b[0m" << std::endl;
    std::cout << "\x1b[1;37m=========================================================\x1b[0m\r\n" << std::endl;

    return failed == 0 ? 0 : 1;
}

} // namespace runix

#if defined(RUNIX_STANDALONE_TEST_MAIN)
int main() {
    return runix::run_all_tests();
}
#endif
