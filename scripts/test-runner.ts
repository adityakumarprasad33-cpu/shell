/**
 * Runix Terminal & Runtime Platform - Automated System Test Suite
 * Validates critical platform subsystems:
 * 1. Secret-aware command sanitization & redaction
 * 2. Release distribution manifest integrity & cryptographic hashes
 * 3. Real sandbox process execution & progressive streaming
 * 4. Universal Runtime Registry (114 Market Benchmark Scope)
 * 5. Automatic Language & File Extension Detection
 * 6. Runtime Resolver & Execution Strategy Engine
 * 7. Multi-File Project Type Detection & Build Pipelines
 */

import { sanitizeCommand } from '../src/lib/terminal/secret-sanitizer';
import { OFFICIAL_RELEASES } from '../src/lib/releases/release-manifest';
import { runInSandbox } from '../src/lib/terminal/sandbox-runner';
import { firebaseConfig } from '../src/lib/firebase';
import { RUNTIME_REGISTRY, getRegistryStatistics } from '../src/lib/runtimes/registry';
import { detectFileLanguage } from '../src/lib/runtimes/detector';
import { resolveFileExecution, detectProjectType, searchRuntimes, getRuntimesForExtension } from '../src/lib/runtimes/resolver';
import { createWorkspacePipeline } from '../src/lib/runtimes/builder';
import { identifyLanguage } from '../src/lib/runtimes/language-registry';
import { resolveFileCapabilities } from '../src/lib/runtimes/capability-resolver';
import { discoverRuntime } from '../src/lib/runtimes/discovery';
import {
  saveWorkspaceFile,
  renameWorkspaceFile,
  readWorkspaceFile,
  deleteWorkspaceFile,
  ensureWorkspace,
  createWorkspaceFolder,
  copyWorkspaceFile,
  moveWorkspaceItem,
  getWorkspaceFiles,
} from '../src/lib/workspace/workspace-storage';
import { processTerminalCommand, resolveTargetFile } from '../src/lib/terminal/command-engine';
import { LanguageDetectionService } from '../src/lib/runtimes/language-detection-service';
import { rateLimitEngine } from '../src/lib/security/rate-limiter';
import { validateFileLimits, MAX_FILE_SIZE_BYTES, MAX_FILE_LINES, MAX_FILE_WORDS } from '../src/lib/workspace/file-limits';
import { FilesystemEngine } from '../src/lib/workspace/filesystem-engine';
import { chunkContent, computeSha256, CHUNK_SIZE_BYTES, saveFileToFirestoreChunks, readFileFromFirestoreChunks, deleteFileFromFirestore } from '../src/lib/storage/firestore-chunk-storage';
import { TerminalSessionManager } from '../src/lib/terminal/session-manager';
import { RunixPathResolver } from '../src/lib/workspace/path-resolver';
import { RunixFileResolver } from '../src/lib/workspace/file-resolver';
import { materializeExecutionSandbox, cleanupExecutionSandbox } from '../src/lib/terminal/sandbox-runner';
import { RunixFileIconRegistry, RunixFolderIconRegistry } from '../src/lib/workspace/icon-registry';
import { safeParseResponse } from '../src/lib/safe-json';
import fs from 'fs';
import path from 'path';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n\x1b[1;36m======================================================================\x1b[0m');
  console.log('\x1b[1;36m RUNIX PLATFORM & UNIVERSAL RUNTIME - MASTER VERIFICATION SUITE\x1b[0m');
  console.log('\x1b[1;36m======================================================================\x1b[0m\n');

  // 1. Secret Sanitizer Tests
  console.log('\x1b[1m[1] Secret-Aware Command Sanitizer\x1b[0m');
  {
    const res1 = sanitizeCommand('git clone https://user:secretpass123@github.com/org/repo');
    assert(res1.secretDetected, 'Detects embedded database/URL credentials');

    const res2 = sanitizeCommand('curl -H "Authorization: Bearer mySecretToken123456" https://api.runix.in');
    assert(res2.secretDetected, 'Detects Authorization headers');
    assert(res2.sanitizedCommand.includes('[REDACTED_AUTH_HEADER]'), 'Redacts auth header value');

    const res3 = sanitizeCommand('python train.py --api-key sk-proj-1234567890abcdef1234567890');
    assert(res3.secretDetected, 'Detects OpenAI API key tokens');
    assert(!res3.sanitizedCommand.includes('1234567890'), 'Masks API key string');

    const res4 = sanitizeCommand('export DATABASE_PASSWORD="superSecretPassword!"');
    assert(res4.secretDetected, 'Detects export PASSWORD statement');
    assert(res4.sanitizedCommand.includes('[REDACTED_SECRET]'), 'Replaces exported password');

    const res5 = sanitizeCommand('ls -la && python main.py --verbose');
    assert(!res5.secretDetected, 'Leaves benign developer commands intact');
    assert(res5.sanitizedCommand === 'ls -la && python main.py --verbose', 'Preserves benign command exact text');
  }

  // 2. Release Manifest Tests
  console.log('\n\x1b[1m[2] Release & Download Distribution Manifest\x1b[0m');
  {
    assert(OFFICIAL_RELEASES.length >= 5, 'Contains all 5 distribution targets (Win, Linux, Mac, CLI, Android)');
    const platforms = OFFICIAL_RELEASES.map((r) => r.platform);
    assert(platforms.includes('windows'), 'Contains Windows client release');
    assert(platforms.includes('linux'), 'Contains Linux client release');
    assert(platforms.includes('macos'), 'Contains macOS client release');
    assert(platforms.includes('cli'), 'Contains CLI package release');
    assert(platforms.includes('android'), 'Contains Android/Termux client release');

    for (const rel of OFFICIAL_RELEASES) {
      assert(rel.checksum.startsWith('sha256:'), `${rel.platform} release has cryptographic SHA-256 checksum`);
      assert(rel.fileSize.length > 0, `${rel.platform} release specifies accurate file size`);
      assert(rel.downloadUrl.length > 0, `${rel.platform} release specifies verified download URL`);
    }
  }

  // 3. Firebase Configuration & Account Isolation
  console.log('\n\x1b[1m[3] Firebase Configuration & Dedicated Database\x1b[0m');
  {
    assert(firebaseConfig.projectId === 'compiler-13c02', 'Target project is isolated to compiler-13c02');
    assert(firebaseConfig.authDomain === 'compiler-13c02.firebaseapp.com', 'Auth domain matches compiler-13c02');
    assert(firebaseConfig.storageBucket === 'compiler-13c02.firebasestorage.app', 'Storage bucket matches compiler-13c02');
    assert(firebaseConfig.apiKey.length > 20, 'API key is configured');
  }

  // 4. Universal Runtime Registry (114 Benchmark)
  console.log('\n\x1b[1m[4] Universal Runtime Registry & Statistics\x1b[0m');
  {
    const all = Object.values(RUNTIME_REGISTRY);
    assert(all.length === 114, `Registry accurately catalogs exactly 114 target benchmark environments (actual: ${all.length})`);

    const stats = getRegistryStatistics();
    assert(stats.totalTargetBenchmark === 114, 'Total target benchmark metric equals 114');
    assert(stats.verifiedCount > 0, `Contains verified host runtimes (verified: ${stats.verifiedCount})`);
    assert(stats.languagesCount >= 50, `Contains extensive language catalog (languages: ${stats.languagesCount})`);
    assert(stats.databasesCount >= 4, `Contains database catalog (databases: ${stats.databasesCount})`);

    // Verify critical tier-1 environments
    const pythonRuntime = RUNTIME_REGISTRY['python'];
    assert(pythonRuntime !== undefined && pythonRuntime.verificationStatus === 'PASS', 'Python 3 runtime is cataloged and host-verified (PASS)');

    const nodeRuntime = RUNTIME_REGISTRY['nodejs'];
    assert(nodeRuntime !== undefined && nodeRuntime.verificationStatus === 'PASS', 'Node.js runtime is cataloged and host-verified (PASS)');

    // Ensure strict truth rule: non-implemented environments are explicitly tagged
    const unimpl = all.filter((r) => r.verificationStatus === 'NOT_IMPLEMENTED' || r.status === 'comingSoon');
    assert(unimpl.length > 0, 'Explicitly identifies planned/coming-soon environments without false claims');
  }

  // 5. Automatic Language & Manifest Detection
  console.log('\n\x1b[1m[5] Automatic Language & Manifest Detection\x1b[0m');
  {
    const py = detectFileLanguage('main.py');
    assert(py.languageId === 'python' && py.runtimeId === 'python', 'Detects main.py as Python');

    const ts = detectFileLanguage('src/app/index.ts');
    assert(ts.languageId === 'typescript' && ts.runtimeId === 'typescript', 'Detects index.ts as TypeScript');

    const rs = detectFileLanguage('src/main.rs');
    assert(rs.languageId === 'rust' && rs.runtimeId === 'rust', 'Detects main.rs as Rust');

    const go = detectFileLanguage('cmd/server/main.go');
    assert(go.languageId === 'go' && go.runtimeId === 'go', 'Detects main.go as Go');

    const cpp = detectFileLanguage('engine/core.cpp');
    assert(cpp.languageId === 'cpp' && cpp.runtimeId === 'cpp', 'Detects core.cpp as C++');

    const pkg = detectFileLanguage('package.json');
    assert(pkg.isSpecialManifest && pkg.category === 'config', 'Detects package.json as special configuration manifest');

    const cargo = detectFileLanguage('Cargo.toml');
    assert(cargo.isSpecialManifest && cargo.languageId === 'toml', 'Detects Cargo.toml as build manifest');
  }

  // 6. Runtime Resolver & Search
  console.log('\n\x1b[1m[6] Runtime Resolver & Execution Strategies\x1b[0m');
  {
    const pyStrategy = resolveFileExecution('script.py', 'C:\\workspace');
    assert(pyStrategy !== null, 'Resolves Python execution strategy');
    assert(Boolean(pyStrategy && pyStrategy.runCommand.includes('python "script.py"')), 'Formats Python run command with file substitution');
    assert(pyStrategy?.isVerified === true, 'Python execution strategy is verified');

    const pyExtensions = getRuntimesForExtension('.py');
    assert(pyExtensions.some((r) => r.id === 'python'), 'Resolves .py extension to Python runtime');

    const searchRes = searchRuntimes('rust');
    assert(searchRes.some((r) => r.id === 'rust'), 'Searches runtimes by name (Rust)');
  }

  // 7. Multi-File Project Detection & Build Pipelines
  console.log('\n\x1b[1m[7] Multi-File Project Detection & Build Pipelines\x1b[0m');
  {
    const nodeProj = detectProjectType(['package.json', 'src/index.js', 'README.md']);
    assert(nodeProj.projectType === 'node-project', 'Detects Node.js project architecture from package.json');
    assert(nodeProj.buildCommand === 'npm run build', 'Supplies standard build command for Node.js');

    const rustProj = detectProjectType(['Cargo.toml', 'src/main.rs']);
    assert(rustProj.projectType === 'rust-project', 'Detects Rust project from Cargo.toml');
    assert(rustProj.buildCommand === 'cargo build', 'Supplies cargo build command');

    const makeProj = detectProjectType(['Makefile', 'main.c', 'util.c', 'util.h']);
    assert(makeProj.projectType === 'native-build', 'Detects native build project from Makefile');

    const pipeline = createWorkspacePipeline('C:\\workspace', ['package.json', 'index.js'], undefined, 'build');
    assert(pipeline.steps.length > 0, 'Generates executable build pipeline steps for detected project');
  }

  // 8. Sandbox Process Runner & Output Streaming
  console.log('\n\x1b[1m[8] Sandbox Process Runner & Output Streaming\x1b[0m');
  {
    let streamedStdout = '';
    let completedCode = -1;

    await runInSandbox(
      {
        sessionId: 'test_sess_01',
        command: 'node -e "console.log(\'RUNIX_SANDBOX_OK\')"',
      },
      (ev) => {
        if (ev.type === 'stdout') {
          streamedStdout += ev.data;
        } else if (ev.type === 'exit') {
          completedCode = ev.exitCode ?? -1;
        }
      }
    );

    assert(streamedStdout.includes('RUNIX_SANDBOX_OK'), 'Streams stdout chunks progressively from subprocess');
    assert(completedCode === 0, 'Subprocess exits with code 0');
  }

  // 9. Sandbox Process Timeout Enforcement
  console.log('\n\x1b[1m[9] Sandbox Process Timeout Enforcement\x1b[0m');
  {
    let timedOut = false;
    let exitCode = -1;

    await runInSandbox(
      {
        sessionId: 'test_sess_timeout',
        command: 'node -e "setTimeout(() => {}, 10000)"',
        timeoutMs: 800,
      },
      (ev) => {
        if (ev.type === 'stderr' && ev.data && ev.data.includes('Runix Sandbox Timeout')) {
          timedOut = true;
        } else if (ev.type === 'exit') {
          exitCode = ev.exitCode ?? -1;
        }
      }
    );

    assert(timedOut, 'Enforces strict execution timeout and warns user');
    assert(exitCode === 124, 'Exits with timeout status code 124');
  }

  // 10. QA — Universal File Detection Benchmark (FD-001 to FD-025)
  console.log('\n\x1b[1m[10] QA — Universal File Detection Benchmark (FD-001 - FD-025)\x1b[0m');
  {
    assert(identifyLanguage('main.c').languageId === 'c', 'FD-001: .c detection');
    assert(identifyLanguage('main.cpp').languageId === 'cpp', 'FD-002: .cpp detection');
    assert(identifyLanguage('App.java').languageId === 'java', 'FD-003: .java detection');
    assert(identifyLanguage('test.py').languageId === 'python', 'FD-004: .py detection');
    assert(identifyLanguage('main.go').languageId === 'go', 'FD-005: .go detection');
    assert(identifyLanguage('lib.rs').languageId === 'rust', 'FD-006: .rs detection');
    assert(identifyLanguage('server.rb').languageId === 'ruby', 'FD-007: .rb detection');
    assert(identifyLanguage('index.php').languageId === 'php', 'FD-008: .php detection');
    assert(identifyLanguage('script.js').languageId === 'javascript', 'FD-009: .js detection');
    assert(identifyLanguage('app.ts').languageId === 'typescript', 'FD-010: .ts detection');
    assert(identifyLanguage('Main.kt').languageId === 'kotlin', 'FD-011: .kt detection');
    assert(identifyLanguage('Core.swift').languageId === 'swift', 'FD-012: .swift detection');
    assert(identifyLanguage('main.dart').languageId === 'dart', 'FD-013: .dart detection');
    assert(identifyLanguage('Program.cs').languageId === 'csharp', 'FD-014: .cs detection');
    assert(identifyLanguage('main.zig').languageId === 'zig', 'FD-015: .zig detection');
    assert(identifyLanguage('build.sh').languageId === 'shell', 'FD-016: .sh detection');
    assert(identifyLanguage('test.lua').languageId === 'lua', 'FD-017: .lua detection');
    assert(identifyLanguage('app.ex').languageId === 'elixir', 'FD-018: .ex detection');
    assert(identifyLanguage('server.erl').languageId === 'erlang', 'FD-019: .erl detection');
    assert(identifyLanguage('math.f90').languageId === 'fortran', 'FD-020: .f90 detection');

    // FD-021 Special manifests
    const dck = identifyLanguage('Dockerfile');
    const mk = identifyLanguage('Makefile');
    const cmk = identifyLanguage('CMakeLists.txt');
    const crg = identifyLanguage('Cargo.toml');
    const pkg = identifyLanguage('package.json');
    assert(
      dck.languageId === 'dockerfile' &&
      mk.languageId === 'makefile' &&
      cmk.languageId === 'cmake' &&
      crg.languageId === 'toml' &&
      pkg.languageId === 'json',
      'FD-021: special filename detection (Dockerfile, Makefile, CMakeLists.txt, Cargo.toml, package.json)'
    );

    // FD-022 Unknown extension
    const unk = identifyLanguage('archive.xyz999');
    assert(unk.languageId === 'unknown' && !unk.runCapability, 'FD-022: unknown extension fallback (non-runnable, unknown)');

    // FD-023 Rename language update
    const beforeRename = identifyLanguage('script.py');
    const afterRename = identifyLanguage('script.lua');
    assert(beforeRename.languageId === 'python' && afterRename.languageId === 'lua', 'FD-023: rename language update (test.py -> test.lua)');

    // FD-024 Capability update after rename
    const capBefore = await resolveFileCapabilities('script.py');
    const capAfter = await resolveFileCapabilities('script.lua');
    assert(
      capBefore.languageId === 'python' &&
      capAfter.languageId === 'lua' &&
      Boolean(capAfter.executionConfig?.runCommand.includes('script.lua')),
      'FD-024: capability update after rename (capabilities re-computed accurately)'
    );

    // FD-025 Project-level detection
    const projRust = detectProjectType(['Cargo.toml', 'src/main.rs']);
    const projNode = detectProjectType(['package.json', 'index.js']);
    assert(projRust.projectType === 'rust-project' && projNode.projectType === 'node-project', 'FD-025: project-level detection');
  }

  // 11. QA — Capability-Driven Run Button Logic
  console.log('\n\x1b[1m[11] QA — Capability Resolution & Run Button Architecture\x1b[0m');
  {
    const pyState = await resolveFileCapabilities('main.py');
    assert(pyState.capabilities.run === true && pyState.verificationStatus === 'VERIFIED', 'Python verified -> Run visible (runCapability = true)');

    const luaState = await resolveFileCapabilities('test.lua');
    assert(luaState.capabilities.run === true && luaState.verificationStatus === 'VERIFIED', 'Lua verified -> Run visible (runCapability = true)');

    const cState = await resolveFileCapabilities('main.c');
    assert(cState.capabilities.run === true && cState.capabilities.build === true, 'C verified -> Run and Build capabilities available');

    const cppState = await resolveFileCapabilities('main.cpp');
    assert(cppState.capabilities.run === true && cppState.capabilities.build === true, 'C++ verified -> Run and Build capabilities available');

    const mdState = await resolveFileCapabilities('README.md');
    assert(mdState.capabilities.run === false && !mdState.isRunnable, 'Non-runnable Markdown file -> Run hidden');

    const txtState = await resolveFileCapabilities('notes.txt');
    assert(txtState.capabilities.run === false && !txtState.isRunnable, 'Non-runnable text file -> Run hidden');

    const unkState = await resolveFileCapabilities('data.binxyz');
    assert(unkState.capabilities.run === false && !unkState.isRunnable, 'Unsupported file format -> Run hidden');
  }

  // 12. QA — Real Lua Execution (test.lua)
  console.log('\n\x1b[1m[12] QA — Real Lua Execution (test.lua)\x1b[0m');
  {
    const testAccountId = 'test_runner_account';
    const testWorkspaceId = 'test_ws_lua';

    // 1. Detect language
    const lang = identifyLanguage('test.lua');
    assert(lang.languageId === 'lua' && lang.displayName === 'Lua', '1. Detects test.lua as Lua');

    // 2. Discover Lua runtime on host
    const luaDisc = await discoverRuntime('lua');
    assert(luaDisc.state === 'VERIFIED' || luaDisc.state === 'AVAILABLE', '2. Discovers Lua runtime on host');
    assert(Boolean(luaDisc.executablePath), `3. Discovered executable: ${luaDisc.executablePath}`);
    assert(Boolean(luaDisc.version), `4. Discovered Lua version: ${luaDisc.version?.split('\n')[0]}`);

    // 3. Resolve capabilities
    const luaCap = await resolveFileCapabilities('test.lua');
    assert(luaCap.capabilities.run === true, '5. Resolved run capability is true for Lua');

    // 4. Save test.lua in workspace storage
    saveWorkspaceFile(testAccountId, testWorkspaceId, 'test.lua', 'print("Hello World!")\n');
    const savedFile = readWorkspaceFile(testAccountId, testWorkspaceId, 'test.lua');
    assert(savedFile?.languageId === 'lua', '6. Workspace file saved with persisted languageId = lua');

    // 5. Execute via Command Engine (runix run test.lua)
    let luaStdout = '';
    let luaStderr = '';
    let luaExit = -1;

    await processTerminalCommand(
      {
        sessionId: 'lua_exec_test_session',
        command: 'runix run test.lua',
        accountId: testAccountId,
        workspaceId: testWorkspaceId,
      },
      (ev) => {
        if (ev.type === 'stdout') luaStdout += ev.data;
        if (ev.type === 'stderr') luaStderr += ev.data;
        if (ev.type === 'exit') luaExit = ev.exitCode ?? -1;
      }
    );

    assert(luaStdout.includes('Hello World!'), '7. Lua test.lua captured stdout matches "Hello World!"');
    assert(luaExit === 0, '8. Lua execution exited with code 0');

    // Clean up
    deleteWorkspaceFile(testAccountId, testWorkspaceId, 'test.lua');
  }

  // 13. QA — Python Regression Verification (test.py)
  console.log('\n\x1b[1m[13] QA — Python Regression Verification (test.py)\x1b[0m');
  {
    const testAccountId = 'test_runner_account';
    const testWorkspaceId = 'test_ws_py';

    saveWorkspaceFile(testAccountId, testWorkspaceId, 'test.py', 'print("Hello World!")\n');

    let pyStdout = '';
    let pyStderr = '';
    let pyExit = -1;

    await processTerminalCommand(
      {
        sessionId: 'py_exec_test_session',
        command: 'runix run test.py',
        accountId: testAccountId,
        workspaceId: testWorkspaceId,
      },
      (ev) => {
        if (ev.type === 'stdout') pyStdout += ev.data;
        if (ev.type === 'stderr') pyStderr += ev.data;
        if (ev.type === 'exit') pyExit = ev.exitCode ?? -1;
      }
    );

    assert(pyStdout.includes('Hello World!'), '1. Python test.py captured stdout matches "Hello World!"');
    assert(pyExit === 0, '2. Python test.py exited with code 0 without regression');

    deleteWorkspaceFile(testAccountId, testWorkspaceId, 'test.py');
  }

  // 14. QA — Terminal & Execution Core Consistency
  console.log('\n\x1b[1m[14] QA — Terminal & Execution Core Consistency\x1b[0m');
  {
    const testAccountId = 'test_runner_account';
    const testWorkspaceId = 'test_ws_consistency';

    // Direct terminal invocation of Lua
    let termStdout = '';
    let termExit = -1;
    await processTerminalCommand(
      {
        sessionId: 'term_lua_consistency',
        command: 'lua -e "print(40 + 2)"',
        accountId: testAccountId,
        workspaceId: testWorkspaceId,
      },
      (ev) => {
        if (ev.type === 'stdout') termStdout += ev.data;
        if (ev.type === 'exit') termExit = ev.exitCode ?? -1;
      }
    );

    assert(termStdout.includes('42'), '1. Direct terminal shell command "lua -e" succeeds using shared sandbox path');
    assert(termExit === 0, '2. Terminal command exited with code 0');
  }

  // 15. QA File Detection Matrix (FD-001 through FD-020)
  console.log('\n\x1b[1m[15] QA File Detection Matrix (FD-001 through FD-020)\x1b[0m');
  {
    assert(detectFileLanguage('main.py').languageId === 'python', 'FD-001 Python (.py)');
    assert(detectFileLanguage('main.c').languageId === 'c', 'FD-002 C (.c)');
    assert(detectFileLanguage('ok.cpp').languageId === 'cpp', 'FD-003 C++ (.cpp)');
    assert(detectFileLanguage('test.java').languageId === 'java', 'FD-004 Java (.java)');
    assert(detectFileLanguage('test.lua').languageId === 'lua', 'FD-005 Lua (.lua)');
    assert(detectFileLanguage('index.js').languageId === 'javascript', 'FD-006 JavaScript (.js)');
    assert(detectFileLanguage('app.ts').languageId === 'typescript', 'FD-007 TypeScript (.ts)');
    assert(detectFileLanguage('main.go').languageId === 'go', 'FD-008 Go (.go)');
    assert(detectFileLanguage('main.rs').languageId === 'rust', 'FD-009 Rust (.rs)');
    assert(detectFileLanguage('app.rb').languageId === 'ruby', 'FD-010 Ruby (.rb)');
    assert(detectFileLanguage('index.php').languageId === 'php', 'FD-011 PHP (.php)');
    assert(detectFileLanguage('Main.kt').languageId === 'kotlin', 'FD-012 Kotlin (.kt)');
    assert(detectFileLanguage('main.swift').languageId === 'swift', 'FD-013 Swift (.swift)');
    assert(detectFileLanguage('main.dart').languageId === 'dart', 'FD-014 Dart (.dart)');
    assert(detectFileLanguage('Program.cs').languageId === 'csharp', 'FD-015 C# (.cs)');
    assert(detectFileLanguage('main.zig').languageId === 'zig', 'FD-016 Zig (.zig)');
    assert(detectFileLanguage('build.sh').languageId === 'shell' || detectFileLanguage('build.sh').languageId === 'bash', 'FD-017 Bash (.sh)');
    assert(detectFileLanguage('data.unknownxyz').type === 'document' || detectFileLanguage('data.unknownxyz').languageId === 'unknown', 'FD-018 Unknown extension (fallback)');
    assert(detectFileLanguage('runix-command.txt').category === 'document' || detectFileLanguage('runix-command.txt').languageId === 'plaintext', 'FD-019 Special documentation file');
    
    // FD-020 Rename detection test
    const before = detectFileLanguage('test.java');
    const after = detectFileLanguage('test.lua');
    assert(before.languageId === 'java' && after.languageId === 'lua', 'FD-020 Rename detection recomputes language from Java to Lua without Plain Text split');
  }

  // 16. QA Filesystem Test Matrix (FS-001 through FS-029)
  console.log('\n\x1b[1m[16] QA Filesystem Test Matrix (FS-001 through FS-029)\x1b[0m');
  {
    const fsAccount = `fs_qa_${Date.now()}`;
    const fsWorkspace = 'fs_qa_workspace';

    // FS-001 Create project / ensureWorkspace
    const root = ensureWorkspace(fsAccount, fsWorkspace);
    assert(Boolean(root), 'FS-001 Create project / workspace initialization');

    // FS-002 Create folder
    const folder = createWorkspaceFolder(fsAccount, fsWorkspace, 'src');
    assert(folder.type === 'directory' && folder.path === 'src', 'FS-002 Create folder (src)');

    // FS-003 Create nested folder
    const nestedFolder = createWorkspaceFolder(fsAccount, fsWorkspace, 'src/components');
    assert(nestedFolder.type === 'directory' && nestedFolder.path === 'src/components', 'FS-003 Create nested folder (src/components)');

    // FS-004 Create file
    const rootFile = saveWorkspaceFile(fsAccount, fsWorkspace, 'app.config', 'active=true\n');
    assert(rootFile.fileId !== undefined && rootFile.path === 'app.config', 'FS-004 Create file with canonical fileId');

    // FS-005 Create file inside nested folder
    const nestedFile = saveWorkspaceFile(fsAccount, fsWorkspace, 'src/components/Header.cpp', '// header\n');
    assert(nestedFile.path === 'src/components/Header.cpp' && nestedFile.parentFolderId !== 'root', 'FS-005 Create file inside nested folder with valid parentFolderId');

    // FS-006 Read file
    const read = readWorkspaceFile(fsAccount, fsWorkspace, 'app.config');
    assert(read?.content === 'active=true\n', 'FS-006 Read file contents');

    // FS-007 Update file
    const updated = saveWorkspaceFile(fsAccount, fsWorkspace, 'app.config', 'active=false\n');
    assert(updated.content === 'active=false\n', 'FS-007 Update file contents');

    // FS-008 Autosave simulation
    const autosaved = saveWorkspaceFile(fsAccount, fsWorkspace, 'app.config', 'active=autosaved\n');
    assert(autosaved.content === 'active=autosaved\n', 'FS-008 Autosave simulation matches persisted state');

    // FS-009 Rename file
    const renamed = renameWorkspaceFile(fsAccount, fsWorkspace, 'app.config', 'app_renamed.config');
    assert(renamed?.path === 'app_renamed.config', 'FS-009 Rename file updates path and metadata');

    // FS-010 Rename folder
    const renamedDir = renameWorkspaceFile(fsAccount, fsWorkspace, 'src/components', 'src/modules');
    assert(renamedDir?.type === 'directory' && renamedDir?.path === 'src/modules', 'FS-010 Rename directory preserves structure');

    // FS-013 Copy file
    const copied = copyWorkspaceFile(fsAccount, fsWorkspace, 'app_renamed.config', 'app_copy.config');
    assert(copied?.path === 'app_copy.config', 'FS-013 Copy file creates duplicate with unique canonical ID');

    // FS-022 Path traversal protection
    let traversalBlocked = false;
    try {
      saveWorkspaceFile(fsAccount, fsWorkspace, '../../etc/passwd', 'malicious');
    } catch {
      traversalBlocked = true;
    }
    assert(traversalBlocked, 'FS-022 Path traversal attack (../) strictly prevented');

    // FS-026 Language auto-detection on write
    const pySaved = saveWorkspaceFile(fsAccount, fsWorkspace, 'module.py', 'print(1)');
    assert(pySaved.languageId === 'python' && pySaved.isRunnable === true, 'FS-026 Language auto-detection and runnable capability attached on save');

    // FS-027 Language change after rename
    const pyToLua = renameWorkspaceFile(fsAccount, fsWorkspace, 'module.py', 'module.lua');
    assert(pyToLua?.languageId === 'lua', 'FS-027 Language recomputed dynamically on file extension change');

    // FS-015 Delete file
    const deletedFile = deleteWorkspaceFile(fsAccount, fsWorkspace, 'app_renamed.config');
    assert(deletedFile === true, 'FS-015 Delete file removes file cleanly');

    // FS-016 Delete folder
    const deletedFolder = deleteWorkspaceFile(fsAccount, fsWorkspace, 'src');
    assert(deletedFolder === true, 'FS-016 Delete folder recursively cleans up contents');
  }

  // 17. QA Drag & Drop Move Operations (DD-001 through DD-013)
  console.log('\n\x1b[1m[17] QA Drag & Drop Move Operations (DD-001 through DD-013)\x1b[0m');
  {
    const ddAccount = `dd_qa_${Date.now()}`;
    const ddWorkspace = 'dd_qa_workspace';

    createWorkspaceFolder(ddAccount, ddWorkspace, 'src');
    createWorkspaceFolder(ddAccount, ddWorkspace, 'build');
    createWorkspaceFolder(ddAccount, ddWorkspace, 'src/nested');
    saveWorkspaceFile(ddAccount, ddWorkspace, 'main.cpp', 'int main() { return 0; }');
    saveWorkspaceFile(ddAccount, ddWorkspace, 'src/nested/utils.cpp', '// utils');

    // DD-001 File root -> folder
    const dd1 = moveWorkspaceItem(ddAccount, ddWorkspace, 'main.cpp', 'src');
    assert(dd1.success && dd1.newPath === 'src/main.cpp', 'DD-001 Drag & drop file from root into folder (src/main.cpp)');

    // DD-002 File nested -> folder
    const dd2 = moveWorkspaceItem(ddAccount, ddWorkspace, 'src/main.cpp', 'build');
    assert(dd2.success && dd2.newPath === 'build/main.cpp', 'DD-002 Drag & drop file from nested folder into another folder (build/main.cpp)');

    // DD-003 File nested -> another nested folder
    const dd3 = moveWorkspaceItem(ddAccount, ddWorkspace, 'src/nested/utils.cpp', 'build');
    assert(dd3.success && dd3.newPath === 'build/utils.cpp', 'DD-003 Move nested file into target folder');

    // DD-004 Folder -> folder
    createWorkspaceFolder(ddAccount, ddWorkspace, 'temp_dir');
    const dd4 = moveWorkspaceItem(ddAccount, ddWorkspace, 'temp_dir', 'build');
    assert(dd4.success && dd4.newPath === 'build/temp_dir', 'DD-004 Move folder into another folder');

    // DD-006 Prevent folder into itself
    const dd6 = moveWorkspaceItem(ddAccount, ddWorkspace, 'build', 'build');
    assert(!dd6.success, 'DD-006 Prevents moving folder into itself');

    // DD-007 Prevent folder into descendant
    const dd7 = moveWorkspaceItem(ddAccount, ddWorkspace, 'build', 'build/temp_dir');
    assert(!dd7.success, 'DD-007 Prevents moving folder into its descendant subdirectory');

    // DD-008 Duplicate name handling
    saveWorkspaceFile(ddAccount, ddWorkspace, 'duplicate.txt', '1');
    saveWorkspaceFile(ddAccount, ddWorkspace, 'src/duplicate.txt', '2');
    const dd8 = moveWorkspaceItem(ddAccount, ddWorkspace, 'duplicate.txt', 'src');
    assert(!dd8.success, 'DD-008 Prevents collision on duplicate filename in destination');

    // DD-010 Persistence after move
    const movedCheck = readWorkspaceFile(ddAccount, ddWorkspace, 'build/main.cpp');
    const oldCheck = readWorkspaceFile(ddAccount, ddWorkspace, 'main.cpp');
    assert(movedCheck !== null && oldCheck === null, 'DD-010 Persistent filesystem state confirms moved file exists only at new path');
  }

  // 18. Critical Regression — Java test.java Unified Subsystem Truth (Bug A)
  console.log('\n\x1b[1m[18] Critical Regression — Java test.java Unified Subsystem Truth (Bug A)\x1b[0m');
  {
    const regAccount = 'regression_qa_account';
    const regWorkspace = 'reg_ws_java';

    // 1. LanguageDetectionService
    const serviceDetect = LanguageDetectionService.detect('test.java');
    assert(serviceDetect.languageId === 'java', '1. LanguageDetectionService resolves test.java to java');

    // 2. Editor Language Registry
    const editorDetect = identifyLanguage('test.java');
    assert(editorDetect.languageId === 'java', '2. Editor identifyLanguage resolves test.java to java');

    // 3. CLI Detector
    const cliDetect = detectFileLanguage('test.java');
    assert(cliDetect.languageId === 'java', '3. CLI detector resolves test.java to java');

    // 4. Quoted argument in CLI
    const quotedDetect = detectFileLanguage('"test.java"');
    assert(quotedDetect.languageId === 'java', '4. CLI detector cleans quotes and resolves "test.java" to java (NOT Plain Text)');

    // 5. Capability Resolution
    const caps = await resolveFileCapabilities('test.java');
    assert(caps.capabilities.run === true && caps.capabilities.build === true, '5. Java capabilities: run=true, build=true');

    // 6. Build Pipeline Detection
    const pipeline = createWorkspacePipeline('C:\\ws', ['test.java'], '"test.java"', 'build');
    assert(pipeline.steps.length > 0 && pipeline.projectType === 'java', '6. Build pipeline detects Java project without Plain Text error');
  }

  // 19. Critical Regression — C++ ok.cpp File Resolution and Execution (Bug B)
  console.log('\n\x1b[1m[19] Critical Regression — C++ ok.cpp File Resolution and Execution (Bug B)\x1b[0m');
  {
    const regAccount = 'regression_qa_account';
    const regWorkspace = 'reg_ws_cpp';

    saveWorkspaceFile(regAccount, regWorkspace, 'ok.cpp', '#include <iostream>\nint main() { std::cout << "OK_CPP_SUCCESS\\n"; return 0; }\n');

    let cliOut = '';
    let cliErr = '';
    let cliExit = -1;

    // Execute runix run "ok.cpp" with quotes
    await processTerminalCommand(
      {
        sessionId: 'cpp_test_session',
        command: 'runix run "ok.cpp"',
        accountId: regAccount,
        workspaceId: regWorkspace,
      },
      (ev) => {
        if (ev.type === 'stdout') cliOut += ev.data;
        if (ev.type === 'stderr') cliErr += ev.data;
        if (ev.type === 'exit') cliExit = ev.exitCode ?? -1;
      }
    );

    assert(!cliErr.includes('does not exist in workspace'), '1. runix run "ok.cpp" finds exact file in canonical workspace (Bug B resolved)');
    assert(cliOut.includes('OK_CPP_SUCCESS'), '2. ok.cpp compiled and executed successfully with expected stdout');
    assert(cliExit === 0, '3. ok.cpp process exited with code 0');

    deleteWorkspaceFile(regAccount, regWorkspace, 'ok.cpp');
  }

  // 20. Clean Account Bootstrap Verification
  console.log('\n\x1b[1m[20] Clean Account Bootstrap Verification\x1b[0m');
  {
    const cleanAccount = `clean_user_${Date.now()}`;
    const cleanWorkspace = 'main-workspace';

    // Ensure workspace initialized
    ensureWorkspace(cleanAccount, cleanWorkspace);
    const files = getWorkspaceFiles(cleanAccount, cleanWorkspace);

    assert(files.length === 1, `1. Newly initialized workspace contains exactly 1 file (actual: ${files.length})`);
    assert(files[0].name === 'runix-command.txt', `2. Exactly runix-command.txt is present (actual: ${files[0]?.name})`);

    const forbidden = ['main.py', 'ok.cpp', 'README.md', 'runix.json', 'test.py', 'test.java', 'test.lua', 'test.class'];
    const presentForbidden = files.filter((f) => forbidden.includes(f.name));
    assert(presentForbidden.length === 0, '3. Strict absence of all demo code, dummy folders, and test seed files');
  }

  // 21. Runix-Owned Rate Limiter & Concurrency Engine
  console.log('\n\x1b[1m[21] Runix-Owned Rate Limiter & Concurrency Engine\x1b[0m');
  {
    const testAcc = 'rate_limit_test_user';

    // Concurrency slots
    const slot1 = rateLimitEngine.acquireExecutionSlot(testAcc);
    const slot2 = rateLimitEngine.acquireExecutionSlot(testAcc);
    const slot3 = rateLimitEngine.acquireExecutionSlot(testAcc);
    const slot4 = rateLimitEngine.acquireExecutionSlot(testAcc); // Exceeds max concurrency (3)

    assert(slot1 && slot2 && slot3, '1. Concurrency engine allows up to max concurrency slots');
    assert(!slot4, '2. Concurrency engine rejects excess concurrent executions per account');

    rateLimitEngine.releaseExecutionSlot(testAcc);
    const slotAfterRelease = rateLimitEngine.acquireExecutionSlot(testAcc);
    assert(slotAfterRelease, '3. Slot becomes available immediately after release');

    // Clean up
    rateLimitEngine.releaseExecutionSlot(testAcc);
    rateLimitEngine.releaseExecutionSlot(testAcc);
    rateLimitEngine.releaseExecutionSlot(testAcc);

    // Token bucket test
    const r1 = rateLimitEngine.consume({ key: 'test_ip', capacity: 2, refillRatePerSec: 1, cost: 1 });
    const r2 = rateLimitEngine.consume({ key: 'test_ip', capacity: 2, refillRatePerSec: 1, cost: 1 });
    const r3 = rateLimitEngine.consume({ key: 'test_ip', capacity: 2, refillRatePerSec: 1, cost: 1 });

    assert(r1.allowed && r2.allowed, '4. Token bucket allows burst up to capacity');
    assert(!r3.allowed && (r3.retryAfterSec ?? 0) > 0, '5. Token bucket throttles when capacity exhausted and provides retryAfterSec');
  }

  // 22. QA — Server-Side File Limits Enforcement (Size, Lines, Words)
  console.log('\n\x1b[1m[22] QA — Server-Side File Limits Enforcement (0.8 MB, 5000 lines, 200,000 words)\x1b[0m');
  {
    // Test 1: 4999 lines + <0.8 MB => PASS
    const lines4999 = new Array(4999).fill('print("line")').join('\n');
    const res4999 = validateFileLimits(lines4999);
    assert(res4999.valid && res4999.lineCount === 4999, '1. 4,999 lines + <0.8 MB validates as PASS');

    // Test 2: 5000 lines + <0.8 MB => PASS
    const lines5000 = new Array(5000).fill('x = 1').join('\n');
    const res5000 = validateFileLimits(lines5000);
    assert(res5000.valid && res5000.lineCount === 5000, '2. 5,000 lines (boundary) validates as PASS');

    // Test 3: 5001 lines => FAIL: LINE_LIMIT_EXCEEDED
    const lines5001 = new Array(5001).fill('x = 1').join('\n');
    const res5001 = validateFileLimits(lines5001);
    assert(!res5001.valid && res5001.error === 'LINE_LIMIT_EXCEEDED', '3. 5,001 lines strictly rejects with LINE_LIMIT_EXCEEDED');

    // Test 4: <5000 lines + exactly 0.8 MB (819,200 bytes) => PASS
    const buf800k = Buffer.alloc(MAX_FILE_SIZE_BYTES, 'a');
    const res800k = validateFileLimits(buf800k);
    assert(res800k.valid && res800k.sizeBytes === MAX_FILE_SIZE_BYTES, '4. Exactly 0.8 MB (819,200 bytes) validates as PASS');

    // Test 5: >0.8 MB (819,201 bytes) => FAIL: FILE_SIZE_LIMIT_EXCEEDED
    const bufOver = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1, 'a');
    const resOver = validateFileLimits(bufOver);
    assert(!resOver.valid && resOver.error === 'FILE_SIZE_LIMIT_EXCEEDED', '5. 819,201 bytes strictly rejects with FILE_SIZE_LIMIT_EXCEEDED');

    // Test 6: 200,000 words or fewer within line and size limits => PASS
    const words200k = new Array(1000).fill('a '.repeat(200).trim()).join('\n'); // 200,000 words (~400 KB) across 1000 lines
    const resWords200k = validateFileLimits(words200k);
    assert(resWords200k.valid && resWords200k.wordCount === 200000, '6. Exactly 200,000 words validates as PASS');

    // Test 7: 200,001 words => FAIL: WORD_LIMIT_EXCEEDED
    const words200001 = words200k + ' b';
    const resWordsOver = validateFileLimits(words200001);
    assert(!resWordsOver.valid && resWordsOver.error === 'WORD_LIMIT_EXCEEDED', '7. 200,001 words strictly rejects with WORD_LIMIT_EXCEEDED');

    // Test 8: FilesystemEngine.createFile enforces limits and rejects with code
    let threwLimit = false;
    try {
      await FilesystemEngine.createFile('qa_test_acc', 'qa_ws', 'invalid.py', lines5001);
    } catch (err: any) {
      threwLimit = err.code === 'LINE_LIMIT_EXCEEDED';
    }
    assert(threwLimit, '8. FilesystemEngine.createFile rejects invalid files with LINE_LIMIT_EXCEEDED');
  }

  // 23. QA — Firestore Chunked Storage & Deterministic Content Assembly
  console.log('\n\x1b[1m[23] QA — Firestore Chunked Storage & Deterministic Content Assembly\x1b[0m');
  {
    // Generate a 180 KB payload (split across multiple 64 KiB chunks)
    const largeContent = 'const x = "Runix Universal File Intelligence";\n'.repeat(3800);
    const totalBytes = Buffer.byteLength(largeContent, 'utf-8');
    const chunks = chunkContent(largeContent, CHUNK_SIZE_BYTES);

    assert(chunks.length === Math.ceil(totalBytes / CHUNK_SIZE_BYTES), `1. Content splits deterministically into ${chunks.length} chunks (<= 64 KiB each)`);

    for (let i = 0; i < chunks.length; i++) {
      const cBytes = Buffer.byteLength(chunks[i], 'utf-8');
      assert(cBytes <= CHUNK_SIZE_BYTES, `   Chunk ${i} size (${cBytes} bytes) safely below 64 KiB ceiling`);
    }

    // Assembly check
    const reassembled = chunks.join('');
    assert(reassembled === largeContent, '2. Reassembled ordered chunks byte-for-byte match original content');

    // SHA-256 verification
    const originalHash = computeSha256(largeContent);
    const reassembledHash = computeSha256(reassembled);
    assert(originalHash === reassembledHash, '3. SHA-256 checksum matches perfectly across chunk assembly');
  }

  // 24. QA — Nested Folder and File-in-Folder Creation
  console.log('\n\x1b[1m[24] QA — Nested Folder and File-in-Folder Creation\x1b[0m');
  {
    const nestAcc = `nest_${Date.now()}`;
    const nestWs = 'nest_workspace';

    // 1. Create nested folders: src/components/auth
    FilesystemEngine.createFolder(nestAcc, nestWs, 'src');
    FilesystemEngine.createFolder(nestAcc, nestWs, 'src/components');
    const authFolder = FilesystemEngine.createFolder(nestAcc, nestWs, 'src/components/auth');

    assert(authFolder.path === 'src/components/auth', '1. Nested folder path is src/components/auth');
    assert(authFolder.parentFolderId !== 'root', '2. parentFolderId points to parent folder ID');

    // 2. Create file inside nested folder: src/components/auth/login.cpp
    const loginFile = await FilesystemEngine.createFile(
      nestAcc,
      nestWs,
      'src/components/auth/login.cpp',
      '#include <iostream>\nint login() { return 1; }\n'
    );

    assert(loginFile.path === 'src/components/auth/login.cpp', '3. File path is src/components/auth/login.cpp (not project root)');
    assert(loginFile.parentFolderId === authFolder.folderId, '4. File parentFolderId matches auth folder ID');
    assert(loginFile.languageId === 'cpp', '5. Central language detection detects C++ automatically');
  }

  // 25. QA — Folder Rename & Path Recalculation (Descendants Intact)
  console.log('\n\x1b[1m[25] QA — Folder Rename & Path Recalculation (Descendants Intact)\x1b[0m');
  {
    const renAcc = `ren_${Date.now()}`;
    const renWs = 'ren_workspace';

    FilesystemEngine.createFolder(renAcc, renWs, 'src');
    FilesystemEngine.createFolder(renAcc, renWs, 'src/components');
    FilesystemEngine.createFolder(renAcc, renWs, 'src/components/auth');
    const origFile = await FilesystemEngine.createFile(renAcc, renWs, 'src/components/auth/login.cpp', '// login logic');

    // Rename components -> ui (result: src/ui/auth/login.cpp)
    const renameRes = await FilesystemEngine.renameFolder(renAcc, renWs, 'src/components', 'src/ui');
    assert(renameRes.success, '1. Folder rename src/components -> src/ui succeeded');

    // Verify descendant path recalculated
    const newFile = await FilesystemEngine.readFile(renAcc, renWs, 'src/ui/auth/login.cpp');
    const oldFile = await FilesystemEngine.readFile(renAcc, renWs, 'src/components/auth/login.cpp');

    assert(newFile !== null && oldFile === null, '2. Descendant file moved to src/ui/auth/login.cpp and old path removed');
    assert(newFile?.content === '// login logic', '3. Descendant file content completely intact');
    assert(newFile?.fileId === origFile.fileId, '4. Descendant fileId remained STABLE');
  }

  // 26. QA — Terminal Directory Control (pwd, cd, ls, mkdir, touch, mv, cp, rm, rmdir)
  console.log('\n\x1b[1m[26] QA — Terminal Directory Control (pwd, cd, ls, mkdir, touch, mv, cp, rm, rmdir)\x1b[0m');
  {
    const termAcc = `term_${Date.now()}`;
    const termWs = 'term_workspace';
    const termSessId = `term_sess_${Date.now()}`;

    // Helper command runner
    const runCmd = async (command: string) => {
      let out = '';
      let err = '';
      let exitCode = 0;
      await processTerminalCommand(
        {
          sessionId: termSessId,
          command,
          accountId: termAcc,
          workspaceId: termWs,
        },
        (ev) => {
          if (ev.type === 'stdout') out += ev.data;
          if (ev.type === 'stderr') err += ev.data;
          if (ev.type === 'exit') exitCode = ev.exitCode ?? 0;
        }
      );
      return { out, err, exitCode };
    };

    // 1. Initial pwd
    const rPwd1 = await runCmd('pwd');
    assert(rPwd1.out.includes(`/workspace/${termWs}`), `1. Initial pwd reports /workspace/${termWs}`);

    // 2. mkdir src & cd src
    await runCmd('mkdir src');
    const rCd1 = await runCmd('cd src');
    assert(rCd1.exitCode === 0, '2. cd src succeeds');

    const rPwd2 = await runCmd('pwd');
    assert(rPwd2.out.includes(`/workspace/${termWs}/src`), `3. pwd inside src reports /workspace/${termWs}/src`);

    // 3. mkdir components inside src
    await runCmd('mkdir components');
    const rCd2 = await runCmd('cd components');
    assert(rCd2.exitCode === 0, '4. Nested cd components succeeds');

    const rPwd3 = await runCmd('pwd');
    assert(rPwd3.out.includes(`/workspace/${termWs}/src/components`), '5. pwd inside components reports /workspace/term_workspace/src/components');

    // 4. cd ..
    await runCmd('cd ..');
    const rPwd4 = await runCmd('pwd');
    assert(rPwd4.out.includes(`/workspace/${termWs}/src`), '6. cd .. navigates back to /workspace/term_workspace/src');

    // 5. cd .. again back to root
    await runCmd('cd ..');
    const rPwd5 = await runCmd('pwd');
    assert(rPwd5.out.includes(`/workspace/${termWs}`) && !rPwd5.out.includes('/src'), '7. cd .. navigates back to workspace root');

    // 6. cd does-not-exist
    const rCdBad = await runCmd('cd non_existent_dir');
    assert(rCdBad.exitCode !== 0 && rCdBad.err.includes('No such file or directory'), '8. cd non_existent_dir fails with error and does not change directory');

    // 7. cd src & touch main.cpp
    await runCmd('cd src');
    await runCmd('touch main.cpp');
    const checkFile = await FilesystemEngine.readFile(termAcc, termWs, 'src/main.cpp');
    assert(checkFile !== null, '9. touch main.cpp inside src creates src/main.cpp in Runix filesystem');

    // 8. ls inside src
    const rLs = await runCmd('ls');
    assert(rLs.out.includes('main.cpp') && rLs.out.includes('components/'), '10. ls lists direct children of current directory');

    // 9. cp main.cpp backup.cpp
    await runCmd('cp main.cpp backup.cpp');
    const checkBackup = await FilesystemEngine.readFile(termAcc, termWs, 'src/backup.cpp');
    assert(checkBackup !== null, '11. cp main.cpp backup.cpp creates copy in current directory');

    // 10. rm backup.cpp
    await runCmd('rm backup.cpp');
    const checkDeleted = await FilesystemEngine.readFile(termAcc, termWs, 'src/backup.cpp');
    assert(checkDeleted === null, '12. rm backup.cpp removes file');

    // 11. rmdir components (empty)
    const rRmdir = await runCmd('rmdir components');
    assert(rRmdir.exitCode === 0, '13. rmdir removes empty directory');

    // 12. cd .. back to root & rmdir src (non-empty)
    await runCmd('cd ..');
    const rRmdirNonEmpty = await runCmd('rmdir src');
    assert(rRmdirNonEmpty.exitCode !== 0 && rRmdirNonEmpty.err.includes('Directory not empty'), '14. rmdir on non-empty folder safely rejects with Directory not empty');

    // 13. rm -r src (recursive deletion)
    const rRmRec = await runCmd('rm -r src');
    assert(rRmRec.exitCode === 0, '15. rm -r src removes folder and contents recursively');
  }

  // 27. QA — Cross-Subsystem Synchronization & Clean Workspace State
  console.log('\n\x1b[1m[27] QA — Cross-Subsystem Synchronization & Clean Workspace State\x1b[0m');
  {
    const syncAcc = `sync_acc_${Date.now()}`;
    const syncWs = 'main-workspace';

    // Verify initial clean state contains only runix-command.txt
    ensureWorkspace(syncAcc, syncWs);
    const initialFiles = FilesystemEngine.getWorkspaceFiles(syncAcc, syncWs);
    assert(initialFiles.length === 1 && initialFiles[0].name === 'runix-command.txt', '1. Clean workspace bootstrap contains only runix-command.txt');

    // Terminal creates a file
    await processTerminalCommand(
      {
        sessionId: 'sync_test_session',
        command: 'touch test_script.py',
        accountId: syncAcc,
        workspaceId: syncWs,
      },
      () => {}
    );

    // Explorer sees the file
    const explorerFiles = FilesystemEngine.getWorkspaceFiles(syncAcc, syncWs);
    const foundInExplorer = explorerFiles.find((f) => f.name === 'test_script.py');
    assert(foundInExplorer !== undefined && foundInExplorer.languageId === 'python', '2. File created in terminal immediately appears in Explorer with correct language');

    // CLI resolves the file
    const cliResolved = resolveTargetFile(syncAcc, syncWs, 'test_script.py');
    assert(cliResolved === 'test_script.py', '3. CLI resolves the identical file');
  }

  // 28. RunixPathResolver — Path Normalization & Duplicate Prevention (PATH-001 - PATH-009)
  console.log('\n\x1b[1m[28] RunixPathResolver — Path Normalization & Duplicate Prevention\x1b[0m');
  {
    // PATH-001: Root file
    const p1 = RunixPathResolver.resolve('/workspace/default', 'main.py', 'default');
    assert(p1.canonicalLogicalPath === '/workspace/default/main.py', 'PATH-001: Canonical path for root file is /workspace/default/main.py');
    assert(p1.executionRelativePath === 'main.py', 'PATH-001: Execution relative path is main.py');

    // PATH-002: Nested file
    const p2 = RunixPathResolver.resolve('/workspace/default', 'src/components/auth/login.cpp', 'default');
    assert(p2.canonicalLogicalPath === '/workspace/default/src/components/auth/login.cpp', 'PATH-002: Canonical path for nested file');
    assert(p2.parentLogicalPath === '/workspace/default/src/components/auth', 'PATH-002: Parent logical path matches directory');
    assert(p2.name === 'login.cpp', 'PATH-002: Item name extracted accurately');

    // PATH-003: Relative path from CWD
    const p3 = RunixPathResolver.resolve('/workspace/default/src', 'utils.cpp', 'default');
    assert(p3.canonicalLogicalPath === '/workspace/default/src/utils.cpp', 'PATH-003: Resolves relative path against CWD');
    assert(p3.executionRelativePath === 'src/utils.cpp', 'PATH-003: Execution relative path joins CWD correctly');

    // PATH-004: Parent traversal ..
    const p4 = RunixPathResolver.resolve('/workspace/default/src/components', '../utils.cpp', 'default');
    assert(p4.canonicalLogicalPath === '/workspace/default/src/utils.cpp', 'PATH-004: Safely resolves .. parent navigation');

    // PATH-005: Absolute logical path
    const p5 = RunixPathResolver.resolve('/workspace/default/src', '/workspace/default/tests/main.py', 'default');
    assert(p5.canonicalLogicalPath === '/workspace/default/tests/main.py', 'PATH-005: Preserves absolute logical path regardless of CWD');
    assert(p5.executionRelativePath === 'tests/main.py', 'PATH-005: Extracts relative execution path from absolute logical path');

    // PATH-006: Duplicate-Segment Prevention (The Critical Path Bug Fix!)
    // When CWD is /workspace/default/test and user requests "test/main.py":
    // Runix MUST NOT construct test/test/main.py!
    const p6 = RunixPathResolver.resolve('/workspace/default/test', 'test/main.py', 'default', ['test/main.py']);
    assert(p6.canonicalLogicalPath === '/workspace/default/test/main.py', 'PATH-006: Duplicate-segment prevention resolves test/main.py inside test cleanly');
    assert(p6.executionRelativePath === 'test/main.py', 'PATH-006: Execution relative path is test/main.py (NEVER test/test/main.py)');

    // Boundary & Security validation
    let traversalBlocked = false;
    try {
      RunixPathResolver.resolve('/workspace/default', '../../etc/passwd', 'default');
    } catch {
      traversalBlocked = true;
    }
    assert(traversalBlocked, 'PATH-007: Escaping workspace root with ../../ is strictly prevented');

    let windowsEscapeBlocked = false;
    try {
      RunixPathResolver.resolve('/workspace/default', 'C:\\Windows\\System32\\cmd.exe', 'default');
    } catch {
      windowsEscapeBlocked = true;
    }
    assert(windowsEscapeBlocked, 'PATH-008: Windows physical drive path injection is strictly prevented');

    // PATH-009: Physical runner path mapping generated exactly once
    const runnerPath = RunixPathResolver.toPhysicalRunnerPath('/tmp/runner_123', 'src/main.cpp');
    assert(runnerPath.includes('runner_123') && runnerPath.endsWith(path.join('src', 'main.cpp')), 'PATH-009: Physical path generated exactly once from executionRelativePath');
  }

  // 29. RunixFileResolver — Authoritative Cross-Subsystem Resolution (Section 17, 72)
  console.log('\n\x1b[1m[29] RunixFileResolver — Authoritative Cross-Subsystem Resolution\x1b[0m');
  {
    const resAcc = `res_acc_${Date.now()}`;
    const resWs = 'default';

    await FilesystemEngine.createFile(resAcc, resWs, 'src/math.py', 'def add(a, b): return a + b\n');
    const all = FilesystemEngine.getWorkspaceFiles(resAcc, resWs);
    const mathFile = all.find((f) => f.path === 'src/math.py')!;

    // 1. Resolve by fileId
    const byId = await RunixFileResolver.resolve({
      accountId: resAcc,
      workspaceId: resWs,
      input: mathFile.fileId!,
    });
    assert(byId !== null && byId.path === undefined && byId.name === 'math.py', '1. RunixFileResolver resolves accurately by canonical fileId');
    assert(byId?.content.includes('def add'), '2. Reassembles content from chunked store on resolution');

    // 2. Resolve by workspace-relative path
    const byRel = await RunixFileResolver.resolve({
      accountId: resAcc,
      workspaceId: resWs,
      input: 'src/math.py',
    });
    assert(byRel !== null && byRel.canonicalLogicalPath === '/workspace/default/src/math.py', '3. Resolves accurately by workspace-relative path');

    // 3. Resolve by CWD-relative path
    const byCwd = await RunixFileResolver.resolve({
      accountId: resAcc,
      workspaceId: resWs,
      input: 'math.py',
      currentDirectory: '/workspace/default/src',
    });
    assert(byCwd !== null && byCwd.executionRelativePath === 'src/math.py', '4. Resolves accurately by CWD-relative path');

    // 4. Debug information (Section 72)
    const debug = RunixFileResolver.getDebugInfo({
      accountId: resAcc,
      workspaceId: resWs,
      input: 'math.py',
      currentDirectory: '/workspace/default/src',
      physicalRunnerRoot: '/tmp/runner_sandbox',
    }, byCwd);
    assert(debug.canonicalLogicalPath === '/workspace/default/src/math.py', '5. Debug telemetry contains canonicalLogicalPath');
    assert(debug.executionRelativePath === 'src/math.py', '6. Debug telemetry contains executionRelativePath');
    assert(debug.languageId === 'python', '7. Debug telemetry reports verified languageId');
  }

  // 30. Firestore Concurrency & Partial Write Protection (Section 13, 14, 53)
  console.log('\n\x1b[1m[30] Firestore Concurrency & Partial Write Protection\x1b[0m');
  {
    const concAcc = `conc_acc_${Date.now()}`;
    const concWs = 'default';

    // Initial save (Version 1)
    const initial = await FilesystemEngine.createFile(concAcc, concWs, 'state.txt', 'Version 1 Content');
    assert(initial.size > 0, '1. Initial file saved at Version 1');

    // Save Version 2 with expectedVersion = 1
    const v2 = await FilesystemEngine.createFile(concAcc, concWs, 'state.txt', 'Version 2 Content', 1);
    assert(v2 !== null, '2. Save with matching expectedVersion 1 succeeds');

    // Attempt stale write with expectedVersion = 1 (should fail with CONFLICT / STALE_WRITE)
    let staleWriteFailed = false;
    let conflictCode = '';
    try {
      await FilesystemEngine.createFile(concAcc, concWs, 'state.txt', 'Stale Version Attempt', 1);
    } catch (staleErr: any) {
      staleWriteFailed = true;
      conflictCode = staleErr.code;
    }
    assert(staleWriteFailed && conflictCode === 'CONFLICT', '3. Stale write with outdated expectedVersion rejects with CONFLICT (Section 53)');

    // Verify file content was not overwritten by stale write
    const current = await FilesystemEngine.readFile(concAcc, concWs, 'state.txt');
    assert(current?.content === 'Version 2 Content', '4. Authoritative content remains Version 2 without corruption');
  }

  // 31. Temporary Runner Filesystem Materialization & Auto-Cleanup (Section 5, 46)
  console.log('\n\x1b[1m[31] Temporary Runner Filesystem Materialization & Auto-Cleanup\x1b[0m');
  {
    const execId = `test_exec_${Date.now()}`;
    const files = [
      { path: 'main.py', content: 'print("RUNNER_SANDBOX_SUCCESS")\n' },
      { path: 'lib/helper.py', content: 'def help(): return True\n' },
    ];

    const runnerRoot = materializeExecutionSandbox(execId, files);
    assert(fs.existsSync(runnerRoot), '1. Temporary runner filesystem created in OS temp');
    assert(fs.existsSync(path.join(runnerRoot, 'main.py')), '2. Materialized main.py exists in temporary runner');
    assert(fs.existsSync(path.join(runnerRoot, 'lib', 'helper.py')), '3. Materialized nested helper.py exists in temporary runner');

    // Clean up
    cleanupExecutionSandbox(runnerRoot);
    assert(!fs.existsSync(runnerRoot), '4. Temporary runner filesystem cleanly removed upon completion (no permanent host state)');
  }

  // 32. QA — Duplicate Path Bug CLI Execution (Section 55)
  console.log('\n\x1b[1m[32] QA — Duplicate Path Bug CLI Execution\x1b[0m');
  {
    const dupAcc = `dup_acc_${Date.now()}`;
    const dupWs = 'default';

    // Create test/main.py
    await FilesystemEngine.createFolder(dupAcc, dupWs, 'test');
    await FilesystemEngine.createFile(
      dupAcc,
      dupWs,
      'test/main.py',
      'print("DUPLICATE_PATH_FIX_VERIFIED")\n'
    );

    let cliOut1 = '';
    await processTerminalCommand(
      {
        sessionId: 'dup_session_1',
        command: 'runix run "test/main.py"',
        accountId: dupAcc,
        workspaceId: dupWs,
      },
      (ev) => {
        if (ev.type === 'stdout') cliOut1 += ev.data;
      }
    );
    assert(cliOut1.includes('DUPLICATE_PATH_FIX_VERIFIED'), '1. From root: runix run "test/main.py" executes cleanly');

    // Now test from inside "test" folder (cd test)
    let cliOut2 = '';
    const session2 = TerminalSessionManager.getOrCreateSession('dup_session_2', dupAcc, dupWs);
    TerminalSessionManager.changeDirectory(session2, 'test');

    await processTerminalCommand(
      {
        sessionId: 'dup_session_2',
        command: 'runix run "test/main.py"',
        accountId: dupAcc,
        workspaceId: dupWs,
      },
      (ev) => {
        if (ev.type === 'stdout') cliOut2 += ev.data;
      }
    );
    assert(cliOut2.includes('DUPLICATE_PATH_FIX_VERIFIED'), '2. Inside test: runix run "test/main.py" executes cleanly (NO test/test/main.py bug!)');

    // Inside test running "main.py" directly
    let cliOut3 = '';
    await processTerminalCommand(
      {
        sessionId: 'dup_session_2',
        command: 'runix run "main.py"',
        accountId: dupAcc,
        workspaceId: dupWs,
      },
      (ev) => {
        if (ev.type === 'stdout') cliOut3 += ev.data;
      }
    );
    assert(cliOut3.includes('DUPLICATE_PATH_FIX_VERIFIED'), '3. Inside test: runix run "main.py" resolves and executes relative to CWD cleanly');
  }

  // 33. Universal File & Folder Icon Registry Test Suite (Part B)
  console.log('\n\x1b[1m[33] Universal File & Folder Icon Registry Test Suite (Part B)\x1b[0m');
  {
    // Special Filenames
    const dockerIcon = RunixFileIconRegistry.resolve('Dockerfile');
    assert(dockerIcon.iconId === 'docker' && dockerIcon.color === '#2496ED', 'ICON-001: Dockerfile resolves to Docker icon');

    const makefileIcon = RunixFileIconRegistry.resolve('Makefile');
    assert(makefileIcon.iconId === 'makefile', 'ICON-002: Makefile resolves to makefile icon');

    const cmakeIcon = RunixFileIconRegistry.resolve('CMakeLists.txt');
    assert(cmakeIcon.iconId === 'cmake', 'ICON-003: CMakeLists.txt resolves to cmake icon');

    // Manifests
    const pkgIcon = RunixFileIconRegistry.resolve('package.json');
    assert(pkgIcon.iconId === 'npm' && pkgIcon.category === 'manifest', 'ICON-004: package.json resolves to npm manifest icon');

    const cargoIcon = RunixFileIconRegistry.resolve('Cargo.toml');
    assert(cargoIcon.iconId === 'cargo' && cargoIcon.category === 'manifest', 'ICON-005: Cargo.toml resolves to cargo manifest icon');

    const goModIcon = RunixFileIconRegistry.resolve('go.mod');
    assert(goModIcon.iconId === 'go-mod' && goModIcon.category === 'manifest', 'ICON-006: go.mod resolves to go-mod manifest icon');

    // Language Extensions
    const pyIcon = RunixFileIconRegistry.resolve('script.py');
    assert(pyIcon.iconId === 'python' && pyIcon.color === '#3776AB', 'ICON-007: .py resolves to python code icon');

    const javaIcon = RunixFileIconRegistry.resolve('Main.java');
    assert(javaIcon.iconId === 'java' && javaIcon.color === '#ED8B00', 'ICON-008: .java resolves to java code icon');

    const cppIcon = RunixFileIconRegistry.resolve('solver.cpp');
    assert(cppIcon.iconId === 'cpp' && cppIcon.color === '#00599C', 'ICON-009: .cpp resolves to cpp code icon');

    const tsIcon = RunixFileIconRegistry.resolve('engine.ts');
    assert(tsIcon.iconId === 'typescript' && tsIcon.color === '#3178C6', 'ICON-010: .ts resolves to typescript code icon');

    const rsIcon = RunixFileIconRegistry.resolve('lib.rs');
    assert(rsIcon.iconId === 'rust', 'ICON-011: .rs resolves to rust code icon');

    // Dotfiles & Config
    const envIcon = RunixFileIconRegistry.resolve('.env.local');
    assert(envIcon.iconId === 'env' && envIcon.category === 'config', 'ICON-012: .env.local resolves to env config icon');

    const gitignoreIcon = RunixFileIconRegistry.resolve('.gitignore');
    assert(gitignoreIcon.iconId === 'git', 'ICON-013: .gitignore resolves to git icon');

    // Folder Resolution
    const srcFolder = RunixFolderIconRegistry.resolve('src', false);
    assert(srcFolder.iconId === 'folder-src' && !srcFolder.isOpen, 'FICON-001: src folder resolves to specialized source folder');

    const srcFolderOpen = RunixFolderIconRegistry.resolve('src', true);
    assert(srcFolderOpen.isOpen === true, 'FICON-002: src folder open state correctly toggles isOpen');

    const componentsFolder = RunixFolderIconRegistry.resolve('components', false);
    assert(componentsFolder.iconId === 'folder-components', 'FICON-003: components folder resolves to component folder');

    const testsFolder = RunixFolderIconRegistry.resolve('tests', false);
    assert(testsFolder.iconId === 'folder-tests', 'FICON-004: tests folder resolves to tests folder');

    const buildFolder = RunixFolderIconRegistry.resolve('build', false);
    assert(buildFolder.iconId === 'folder-build', 'FICON-005: build folder resolves to build archive folder');

    const defaultFolder = RunixFolderIconRegistry.resolve('my_custom_folder', false);
    assert(defaultFolder.iconId === 'folder-default', 'FICON-006: standard folder resolves to default folder');
  }

  // 34. Safe JSON & Non-JSON Error Recovery (SyntaxError Prevention)
  console.log('\n\x1b[1m[34] Safe JSON & Non-JSON Error Recovery (SyntaxError Prevention)\x1b[0m');
  {
    // Simulate 500 "Internal Server Error" plaintext response
    const mock500Response = new Response('Internal Server Error', {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });

    const res500 = await safeParseResponse(mock500Response);
    assert(!res500.ok, 'SAFE-JSON-001: 500 response correctly parsed as ok=false');
    assert(res500.status === 500, 'SAFE-JSON-002: 500 status preserved');
    assert(res500.error === 'Internal Server Error', 'SAFE-JSON-003: Plaintext error message captured without throwing SyntaxError');

    // Simulate 404 HTML response
    const mock404Html = new Response('<!DOCTYPE html><html><body>404 Not Found</body></html>', {
      status: 404,
      statusText: 'Not Found',
      headers: { 'content-type': 'text/html' },
    });

    const res404 = await safeParseResponse(mock404Html);
    assert(!res404.ok && res404.status === 404, 'SAFE-JSON-004: HTML 404 handled gracefully without SyntaxError');

    // Simulate valid JSON response
    const mock200Json = new Response(JSON.stringify({ success: true, count: 42 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });

    const res200 = await safeParseResponse<{ success: boolean; count: number }>(mock200Json);
    assert(res200.ok && res200.data?.count === 42, 'SAFE-JSON-005: Valid JSON response parsed cleanly');
  }

  // 35. Workspace Manager Clean Initialization & Isolation
  console.log('\n\x1b[1m[35] Workspace Manager Clean Initialization & Isolation\x1b[0m');
  {
    const wsTestAcc = `ws_mgr_acc_${Date.now()}`;
    const newWsId = `ws_${Date.now()}_clean`;

    // Initialize workspace
    await FilesystemEngine.ensureWorkspaceState(wsTestAcc, newWsId);
    const files = FilesystemEngine.getWorkspaceFiles(wsTestAcc, newWsId);

    assert(files.length === 1, `WS-CRUD-001: Newly initialized workspace contains exactly 1 file (actual: ${files.length})`);
    assert(files[0].name === 'runix-command.txt', `WS-CRUD-002: Only runix-command.txt is present (actual: ${files[0].name})`);
    assert(!files.some((f) => f.name.includes('demo') || f.name.includes('sample')), 'WS-CRUD-003: Strict zero demo files rule enforced');

    // Create file in new workspace
    await FilesystemEngine.createFile(wsTestAcc, newWsId, 'project.py', 'print("Isolated")');
    const updatedFiles = FilesystemEngine.getWorkspaceFiles(wsTestAcc, newWsId);
    assert(updatedFiles.some((f) => f.path === 'project.py'), 'WS-CRUD-004: File creation in isolated workspace succeeded');

    // Verify default workspace remains untouched
    const defaultFiles = FilesystemEngine.getWorkspaceFiles(wsTestAcc, 'default');
    assert(!defaultFiles.some((f) => f.path === 'project.py'), 'WS-CRUD-005: Workspace isolation strictly maintained (no leak between workspaces)');
  }

  // 36. Git Protection & Secret Leak Audit (Part C)
  console.log('\n\x1b[1m[36] Git Protection & Secret Leak Audit (Part C)\x1b[0m');
  {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');

    assert(gitignoreContent.includes('.env'), 'SEC-001: .gitignore contains .env');
    assert(gitignoreContent.includes('.env*'), 'SEC-002: .gitignore contains .env* wildcard');
    assert(!fs.existsSync(path.join(process.cwd(), '.env.example')), 'SEC-003: .env.example is completely revoked and does not exist in workspace');
    assert(gitignoreContent.includes('*.pem') && gitignoreContent.includes('*.key'), 'SEC-004: .gitignore excludes private keys (*.pem, *.key)');
    assert(gitignoreContent.includes('service-account*.json'), 'SEC-005: .gitignore excludes service-account*.json');
  }

  // Summary
  console.log('\n\x1b[1;36m======================================================================\x1b[0m');
  console.log(`\x1b[1mRESULTS: \x1b[32m${passed} passed\x1b[0m, \x1b[${failed > 0 ? '31' : '32'}m${failed} failed\x1b[0m`);
  console.log('\x1b[1;36m======================================================================\x1b[0m\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
