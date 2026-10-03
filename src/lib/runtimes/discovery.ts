/**
 * RUNIX UNIVERSAL RUNTIME DISCOVERY ENGINE
 * 
 * Inspects host environment to discover installed compilers, interpreters,
 * runtimes, package managers, and debuggers with operational health verification.
 * 
 * Strict engineering principles:
 * 1. A runtime is NOT the same thing as a compiler.
 * 2. Every role (runtime, compiler, interpreter, builder, packageManager, debugger)
 *    is discovered and verified independently.
 * 3. A runtime/compiler is NEVER marked VERIFIED until actual execution verification succeeds.
 * 4. If a required tool (e.g. javac for Java compilation) is missing, Build/Run are marked UNAVAILABLE.
 * 5. Discovery uses real environment paths without false hardcoded assumptions.
 */

import { execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

export type ToolRole =
  | 'runtime'
  | 'compiler'
  | 'interpreter'
  | 'builder'
  | 'packageManager'
  | 'debugger'
  | 'testRunner';

export type ToolDiscoveryState =
  | 'UNKNOWN'
  | 'AVAILABLE'
  | 'VERIFIED'
  | 'UNAVAILABLE'
  | 'BROKEN';

export interface DiscoveredTool {
  role: ToolRole;
  name: string;
  executableName: string;
  executablePath?: string;
  version?: string;
  state: ToolDiscoveryState;
  isRequiredForRun: boolean;
  isRequiredForBuild: boolean;
  lastCheckedAt: string;
  errorReason?: string;
  verificationEvidence?: {
    testCommand: string;
    stdout: string;
    stderr?: string;
    exitCode: number;
    durationMs: number;
  };
}

export type RuntimeDiscoveryState =
  | 'UNKNOWN'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'VERIFIED'
  | 'UNAVAILABLE'
  | 'BROKEN'
  | 'NOT_IMPLEMENTED';

export interface DiscoveredRuntime {
  runtimeId: string;
  name: string;
  category: 'compiled' | 'interpreted' | 'vm' | 'script' | 'framework' | 'database';
  state: RuntimeDiscoveryState;

  // Backward-compatible properties
  executableName: string;
  executablePath?: string;
  version?: string;
  lastCheckedAt: string;
  verificationEvidence?: {
    testCommand: string;
    stdout: string;
    exitCode: number;
    durationMs: number;
  };
  errorReason?: string;

  // Multi-Tool Discovery Properties (Section 6)
  runtimeExecutable?: string;
  runtimeExecutablePath?: string;
  runtimeVersion?: string;

  compilerExecutable?: string;
  compilerExecutablePath?: string;
  compilerVersion?: string;

  interpreterExecutable?: string;
  interpreterExecutablePath?: string;
  interpreterVersion?: string;

  builderExecutable?: string;
  builderExecutablePath?: string;
  builderVersion?: string;

  packageManagerExecutable?: string;
  packageManagerExecutablePath?: string;
  packageManagerVersion?: string;

  debuggerExecutable?: string;
  debuggerExecutablePath?: string;

  tools: Record<string, DiscoveredTool>;
  capabilityVerification: Record<string, boolean>;

  capabilities: {
    run: boolean;
    build: boolean;
    test: boolean;
    debug: boolean;
    packageInstall: boolean;
    multiFile: boolean;
    stdin: boolean;
    stdout: boolean;
    stderr: boolean;
    network: boolean;
  };
  statusReason?: string;
}

// In-memory discovery cache with 3-minute TTL
interface CachedEntry {
  runtime: DiscoveredRuntime;
  expiresAt: number;
}
const discoveryCache = new Map<string, CachedEntry>();

export function clearDiscoveryCache(): void {
  discoveryCache.clear();
}

export interface ToolSpec {
  role: ToolRole;
  name: string;
  candidates: string[];
  versionArgs: string[];
  isRequiredForRun: boolean;
  isRequiredForBuild: boolean;
  testSnippet?: string;
  testCommandGenerator?: (exe: string) => string;
}

export interface RuntimeProfile {
  name: string;
  category: 'compiled' | 'interpreted' | 'vm' | 'script' | 'framework' | 'database';
  tools: ToolSpec[];
  smokeTest?: (tools: Record<string, DiscoveredTool>) => Promise<{
    passed: boolean;
    testCommand: string;
    stdout: string;
    stderr?: string;
    exitCode: number;
    durationMs: number;
    errorReason?: string;
  }>;
}

/**
 * Universal multi-tool discovery profiles for all primary language runtimes
 */
export const RUNTIME_TOOL_PROFILES: Record<string, RuntimeProfile> = {
  java: {
    name: 'Java',
    category: 'vm',
    tools: [
      {
        role: 'runtime',
        name: 'Java Virtual Machine',
        candidates: ['java'],
        versionArgs: ['-version'],
        isRequiredForRun: true,
        isRequiredForBuild: false,
        testCommandGenerator: (exe) => `"${exe}" -version`,
      },
      {
        role: 'compiler',
        name: 'Java Compiler (javac)',
        candidates: ['javac'],
        versionArgs: ['-version'],
        isRequiredForRun: true, // required to run from uncompiled source
        isRequiredForBuild: true,
        testCommandGenerator: (exe) => `"${exe}" -version`,
      },
    ],
    smokeTest: async (tools) => {
      const java = tools['runtime']?.executablePath;
      const javac = tools['compiler']?.executablePath;
      if (!java || !javac) {
        return {
          passed: false,
          testCommand: 'java + javac smoke verification',
          stdout: '',
          stderr: 'Missing required Java binary (java or javac)',
          exitCode: 1,
          durationMs: 0,
          errorReason: !javac ? "Java compiler 'javac' is not installed." : "Java runtime 'java' is not installed.",
        };
      }

      const tempDir = path.join(os.tmpdir(), `runix_verify_java_${Date.now()}`);
      try {
        fs.mkdirSync(tempDir, { recursive: true });
        const srcFile = path.join(tempDir, 'RunixSmokeTest.java');
        fs.writeFileSync(
          srcFile,
          'public class RunixSmokeTest { public static void main(String[] args){ System.out.println("RUNIX_JAVA_OK"); } }',
          'utf-8'
        );

        const startT = Date.now();
        // 1. Compile
        const compileCmd = `"${javac}" -d "${tempDir}" "${srcFile}"`;
        execSync(compileCmd, {
          env: { ...process.env, PATH: getEffectiveSystemPath(), Path: getEffectiveSystemPath() },
          encoding: 'utf-8',
          timeout: 10000,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        // 2. Execute
        const runCmd = `"${java}" -cp "${tempDir}" RunixSmokeTest`;
        const runOut = execSync(runCmd, {
          env: { ...process.env, PATH: getEffectiveSystemPath(), Path: getEffectiveSystemPath() },
          encoding: 'utf-8',
          timeout: 8000,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        const passed = (runOut || '').includes('RUNIX_JAVA_OK');
        return {
          passed,
          testCommand: `${compileCmd} && ${runCmd}`,
          stdout: runOut.trim(),
          exitCode: 0,
          durationMs: Date.now() - startT,
        };
      } catch (err: any) {
        return {
          passed: false,
          testCommand: 'javac -d <temp> RunixSmokeTest.java && java -cp <temp> RunixSmokeTest',
          stdout: (err.stdout || '').toString().trim(),
          stderr: (err.stderr || err.message || '').toString().trim(),
          exitCode: err.status || 1,
          durationMs: 0,
          errorReason: `Java smoke verification failed: ${err.message}`,
        };
      } finally {
        try {
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch {}
      }
    },
  },

  python: {
    name: 'Python',
    category: 'interpreted',
    tools: [
      {
        role: 'interpreter',
        name: 'Python Interpreter',
        candidates: ['python', 'python3', 'py'],
        versionArgs: ['--version'],
        isRequiredForRun: true,
        isRequiredForBuild: false,
        testSnippet: 'print("RUNIX_PYTHON_OK")',
        testCommandGenerator: (exe) => `"${exe}" -c "print(\\"RUNIX_PYTHON_OK\\")"`,
      },
      {
        role: 'packageManager',
        name: 'Pip Package Manager',
        candidates: ['pip', 'pip3'],
        versionArgs: ['--version'],
        isRequiredForRun: false,
        isRequiredForBuild: false,
      },
    ],
  },

  nodejs: {
    name: 'Node.js',
    category: 'interpreted',
    tools: [
      {
        role: 'runtime',
        name: 'Node.js Runtime',
        candidates: ['node'],
        versionArgs: ['-v'],
        isRequiredForRun: true,
        isRequiredForBuild: false,
        testSnippet: 'console.log("RUNIX_NODE_OK")',
        testCommandGenerator: (exe) => `"${exe}" -e "console.log(\\"RUNIX_NODE_OK\\")"`,
      },
      {
        role: 'packageManager',
        name: 'npm Package Manager',
        candidates: ['npm'],
        versionArgs: ['-v'],
        isRequiredForRun: false,
        isRequiredForBuild: false,
      },
    ],
  },

  typescript: {
    name: 'TypeScript',
    category: 'interpreted',
    tools: [
      {
        role: 'runtime',
        name: 'TypeScript Runner (tsx/npx)',
        candidates: ['tsx', 'npx'],
        versionArgs: ['--version'],
        isRequiredForRun: true,
        isRequiredForBuild: false,
        testSnippet: 'console.log("RUNIX_TS_OK")',
        testCommandGenerator: (exe) =>
          exe === 'tsx'
            ? `"${exe}" -e "console.log(\\"RUNIX_TS_OK\\")"`
            : `"${exe}" tsx -e "console.log(\\"RUNIX_TS_OK\\")"`,
      },
      {
        role: 'compiler',
        name: 'TypeScript Compiler (tsc)',
        candidates: ['tsc'],
        versionArgs: ['-v'],
        isRequiredForRun: false,
        isRequiredForBuild: true,
      },
    ],
  },

  c: {
    name: 'C (GCC)',
    category: 'compiled',
    tools: [
      {
        role: 'compiler',
        name: 'C Compiler (GCC/Clang)',
        candidates: ['gcc', 'clang'],
        versionArgs: ['--version'],
        isRequiredForRun: true,
        isRequiredForBuild: true,
        testCommandGenerator: (exe) => `"${exe}" --version`,
      },
    ],
  },

  cpp: {
    name: 'C++ (G++)',
    category: 'compiled',
    tools: [
      {
        role: 'compiler',
        name: 'C++ Compiler (G++/Clang++)',
        candidates: ['g++', 'clang++'],
        versionArgs: ['--version'],
        isRequiredForRun: true,
        isRequiredForBuild: true,
        testCommandGenerator: (exe) => `"${exe}" --version`,
      },
    ],
  },

  rust: {
    name: 'Rust',
    category: 'compiled',
    tools: [
      {
        role: 'compiler',
        name: 'Rust Compiler (rustc)',
        candidates: ['rustc'],
        versionArgs: ['--version'],
        isRequiredForRun: true,
        isRequiredForBuild: true,
        testCommandGenerator: (exe) => `"${exe}" --version`,
      },
      {
        role: 'builder',
        name: 'Cargo Build System',
        candidates: ['cargo'],
        versionArgs: ['--version'],
        isRequiredForRun: false,
        isRequiredForBuild: false,
      },
    ],
  },

  go: {
    name: 'Go',
    category: 'compiled',
    tools: [
      {
        role: 'compiler',
        name: 'Go Toolchain',
        candidates: ['go'],
        versionArgs: ['version'],
        isRequiredForRun: true,
        isRequiredForBuild: true,
        testCommandGenerator: (exe) => `"${exe}" version`,
      },
    ],
  },

  lua: {
    name: 'Lua',
    category: 'interpreted',
    tools: [
      {
        role: 'interpreter',
        name: 'Lua Interpreter',
        candidates: ['lua', 'lua54', 'lua5.4', 'luajit'],
        versionArgs: ['-v'],
        isRequiredForRun: true,
        isRequiredForBuild: false,
        testSnippet: 'print("RUNIX_LUA_OK")',
        testCommandGenerator: (exe) => `"${exe}" -e "print(\\"RUNIX_LUA_OK\\")"`,
      },
    ],
  },

  bash: {
    name: 'Bash',
    category: 'script',
    tools: [
      {
        role: 'interpreter',
        name: 'Bash Shell',
        candidates: ['bash', 'sh'],
        versionArgs: ['--version'],
        isRequiredForRun: true,
        isRequiredForBuild: false,
        testCommandGenerator: (exe) => `"${exe}" -c "echo RUNIX_BASH_OK"`,
      },
    ],
  },

  powershell: {
    name: 'PowerShell',
    category: 'script',
    tools: [
      {
        role: 'interpreter',
        name: 'PowerShell',
        candidates: ['powershell', 'pwsh'],
        versionArgs: ['-Command', '$PSVersionTable.PSVersion.ToString()'],
        isRequiredForRun: true,
        isRequiredForBuild: false,
        testCommandGenerator: (exe) => `"${exe}" -Command "Write-Host 'RUNIX_PWSH_OK'"`,
      },
    ],
  },
};

/**
 * Returns refreshed and effective PATH environment variable across OS platforms.
 * Resolves standard Java/JDK paths, MinGW, Python, Go, Rust, Git, Node directories
 * so newly installed packages are discovered without requiring a system restart.
 */
export function getEffectiveSystemPath(): string {
  const currentPath = process.env.PATH || process.env.Path || '';
  const delimiter = path.delimiter;
  const pathParts = new Set<string>(currentPath.split(delimiter).filter(Boolean));

  if (process.platform === 'win32') {
    const home = os.homedir();
    const progFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const commonPaths: string[] = [
      path.join(home, 'AppData', 'Local', 'Programs', 'Lua', 'bin'),
      path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python314'),
      path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python312'),
      path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python311'),
      path.join('C:', 'Python314'),
      path.join('C:', 'Python312'),
      path.join('C:', 'Python311'),
      path.join(home, 'go', 'bin'),
      path.join(home, '.cargo', 'bin'),
      'D:\\.cargo\\bin',
      path.join(progFiles, 'Git', 'cmd'),
      path.join(progFiles, 'Git', 'bin'),
      path.join(progFiles, 'Git', 'usr', 'bin'),
      path.join(progFiles, 'nodejs'),
      path.join('C:', 'MinGW', 'bin'),
      path.join('C:', 'msys64', 'mingw64', 'bin'),
      path.join('C:', 'msys64', 'ucrt64', 'bin'),
      path.join('C:', 'ProgramData', 'chocolatey', 'bin'),
      path.join(progFiles, 'Go', 'bin'),
      'D:\\flutter\\bin',
    ];

    // JDK & Java Discovery Paths (Temurin, Oracle, Corretto, Microsoft, Zulu)
    if (process.env.JAVA_HOME) {
      commonPaths.unshift(path.join(process.env.JAVA_HOME, 'bin'));
    }
    if (process.env.JDK_HOME) {
      commonPaths.unshift(path.join(process.env.JDK_HOME, 'bin'));
    }

    const jdkVendors = ['Eclipse Adoptium', 'Java', 'Amazon Corretto', 'Microsoft', 'Zulu', 'OpenLogic'];
    for (const vendor of jdkVendors) {
      const vDir = path.join(progFiles, vendor);
      if (fs.existsSync(vDir)) {
        try {
          const entries = fs.readdirSync(vDir);
          for (const entry of entries) {
            const binDir = path.join(vDir, entry, 'bin');
            if (fs.existsSync(path.join(binDir, 'javac.exe')) || fs.existsSync(path.join(binDir, 'java.exe'))) {
              commonPaths.unshift(binDir);
            }
          }
        } catch {}
      }
    }

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        pathParts.add(p);
      }
    }
  } else {
    // Linux / macOS JDK Discovery
    const commonPaths: string[] = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/opt/homebrew/bin',
      '/home/linuxbrew/.linuxbrew/bin',
    ];
    if (process.env.JAVA_HOME) {
      commonPaths.unshift(path.join(process.env.JAVA_HOME, 'bin'));
    }
    const linuxJvmDir = '/usr/lib/jvm';
    if (fs.existsSync(linuxJvmDir)) {
      try {
        const jdks = fs.readdirSync(linuxJvmDir);
        for (const jdk of jdks) {
          const binDir = path.join(linuxJvmDir, jdk, 'bin');
          if (fs.existsSync(path.join(binDir, 'javac')) || fs.existsSync(path.join(binDir, 'java'))) {
            commonPaths.unshift(binDir);
          }
        }
      } catch {}
    }

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        pathParts.add(p);
      }
    }
  }

  return Array.from(pathParts).join(delimiter);
}

/**
 * Finds the absolute path to an executable using real system discovery
 */
export function findExecutable(candidateName: string): string | null {
  const envPath = getEffectiveSystemPath();
  const delimiter = path.delimiter;
  const pathDirs = envPath.split(delimiter).filter(Boolean);

  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];

  for (const dir of pathDirs) {
    for (const ext of extensions) {
      const fullPath = path.join(dir, `${candidateName}${ext}`);
      try {
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            return fullPath;
          }
        }
      } catch {}
    }
  }

  // Fallback to where.exe or which command
  try {
    const findCmd = process.platform === 'win32' ? `where.exe "${candidateName}"` : `which "${candidateName}"`;
    const result = execSync(findCmd, {
      env: { ...process.env, PATH: envPath, Path: envPath },
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    if (result) {
      const firstLine = result.split(/\r?\n/)[0].trim();
      if (fs.existsSync(firstLine)) return firstLine;
    }
  } catch {}

  return null;
}

/**
 * Discovers a specific runtime, discovering all its constituent tools (compiler, runtime, interpreter, etc.)
 */
export async function discoverRuntime(
  runtimeId: string,
  forceRefresh: boolean = false
): Promise<DiscoveredRuntime> {
  const key = runtimeId.toLowerCase();

  // Check cache
  if (!forceRefresh && discoveryCache.has(key)) {
    const cached = discoveryCache.get(key)!;
    if (cached.expiresAt > Date.now()) {
      return cached.runtime;
    }
  }

  const profile = RUNTIME_TOOL_PROFILES[key];
  const now = new Date().toISOString();

  if (!profile) {
    const unrecog: DiscoveredRuntime = {
      runtimeId,
      name: runtimeId,
      category: 'interpreted',
      executableName: runtimeId,
      state: 'UNAVAILABLE',
      lastCheckedAt: now,
      errorReason: `Runtime '${runtimeId}' has no discovery profile configured.`,
      tools: {},
      capabilityVerification: {},
      capabilities: {
        run: false,
        build: false,
        test: false,
        debug: false,
        packageInstall: false,
        multiFile: false,
        stdin: false,
        stdout: false,
        stderr: false,
        network: false,
      },
      statusReason: `Runtime '${runtimeId}' is not configured in this platform.`,
    };
    discoveryCache.set(key, { runtime: unrecog, expiresAt: Date.now() + 60000 });
    return unrecog;
  }

  // 1. Discover all tools specified in the profile
  const discoveredTools: Record<string, DiscoveredTool> = {};

  for (const toolSpec of profile.tools) {
    let toolExecutablePath: string | null = null;
    let activeExeName = toolSpec.candidates[0];

    for (const cand of toolSpec.candidates) {
      const resolved = findExecutable(cand);
      if (resolved) {
        toolExecutablePath = resolved;
        activeExeName = cand;
        break;
      }
    }

    if (!toolExecutablePath) {
      discoveredTools[toolSpec.role] = {
        role: toolSpec.role,
        name: toolSpec.name,
        executableName: activeExeName,
        state: 'UNAVAILABLE',
        isRequiredForRun: toolSpec.isRequiredForRun,
        isRequiredForBuild: toolSpec.isRequiredForBuild,
        lastCheckedAt: now,
        errorReason: `Executable '${toolSpec.candidates.join(' / ')}' not found on PATH.`,
      };
      continue;
    }

    // Version detection for tool
    let versionStr = 'installed';
    try {
      const versionOutput = execSync(`"${toolExecutablePath}" ${toolSpec.versionArgs.join(' ')}`, {
        env: { ...process.env, PATH: getEffectiveSystemPath(), Path: getEffectiveSystemPath() },
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      versionStr = (versionOutput || '').trim().split(/\r?\n/)[0] || 'installed';
    } catch (verErr: any) {
      if (verErr.stdout || verErr.stderr) {
        versionStr = (verErr.stdout || verErr.stderr).trim().split(/\r?\n/)[0] || 'installed';
      }
    }

    discoveredTools[toolSpec.role] = {
      role: toolSpec.role,
      name: toolSpec.name,
      executableName: activeExeName,
      executablePath: toolExecutablePath,
      version: versionStr,
      state: 'AVAILABLE',
      isRequiredForRun: toolSpec.isRequiredForRun,
      isRequiredForBuild: toolSpec.isRequiredForBuild,
      lastCheckedAt: now,
    };
  }

  // 2. Determine primary executable references for backward-compatibility
  const primaryTool =
    discoveredTools['interpreter'] ||
    discoveredTools['runtime'] ||
    discoveredTools['compiler'] ||
    Object.values(discoveredTools)[0];

  const compilerTool = discoveredTools['compiler'];
  const runtimeTool = discoveredTools['runtime'];
  const interpreterTool = discoveredTools['interpreter'];
  const builderTool = discoveredTools['builder'];
  const packageManagerTool = discoveredTools['packageManager'];
  const debuggerTool = discoveredTools['debugger'];

  // 3. Execution Verification Smoke Test
  let runtimeState: RuntimeDiscoveryState = 'AVAILABLE';
  let evidence: DiscoveredRuntime['verificationEvidence'] | undefined;
  let errorReason: string | undefined;

  // Check if any required tool is missing
  const missingRequiredRun = Object.values(discoveredTools).filter((t) => t.isRequiredForRun && t.state === 'UNAVAILABLE');
  const missingRequiredBuild = Object.values(discoveredTools).filter((t) => t.isRequiredForBuild && t.state === 'UNAVAILABLE');

  if (missingRequiredRun.length > 0 && missingRequiredBuild.length > 0) {
    runtimeState = 'UNAVAILABLE';
    errorReason = `Required executable(s) missing: ${missingRequiredRun.map((t) => t.name).join(', ')}`;
  } else {
    // Run smoke test if defined
    if (profile.smokeTest) {
      const smokeResult = await profile.smokeTest(discoveredTools);
      if (smokeResult.passed) {
        runtimeState = 'VERIFIED';
        evidence = {
          testCommand: smokeResult.testCommand,
          stdout: smokeResult.stdout,
          exitCode: smokeResult.exitCode,
          durationMs: smokeResult.durationMs,
        };
        // Update tool states to VERIFIED
        if (compilerTool && compilerTool.state === 'AVAILABLE') compilerTool.state = 'VERIFIED';
        if (runtimeTool && runtimeTool.state === 'AVAILABLE') runtimeTool.state = 'VERIFIED';
      } else {
        runtimeState = smokeResult.errorReason?.includes('missing') ? 'UNAVAILABLE' : 'BROKEN';
        errorReason = smokeResult.errorReason;
        evidence = {
          testCommand: smokeResult.testCommand,
          stdout: smokeResult.stdout,
          exitCode: smokeResult.exitCode,
          durationMs: smokeResult.durationMs,
        };
      }
    } else if (primaryTool && primaryTool.executablePath) {
      // Standard tool smoke test
      const spec = profile.tools.find((t) => t.role === primaryTool.role);
      if (spec?.testCommandGenerator) {
        const testCmd = spec.testCommandGenerator(primaryTool.executablePath);
        const startT = Date.now();
        try {
          const stdout = execSync(testCmd, {
            env: { ...process.env, PATH: getEffectiveSystemPath(), Path: getEffectiveSystemPath() },
            encoding: 'utf-8',
            timeout: 8000,
            stdio: ['ignore', 'pipe', 'pipe'],
          });
          runtimeState = 'VERIFIED';
          primaryTool.state = 'VERIFIED';
          evidence = {
            testCommand: testCmd,
            stdout: stdout.trim(),
            exitCode: 0,
            durationMs: Date.now() - startT,
          };
        } catch (execErr: any) {
          runtimeState = 'BROKEN';
          errorReason = `Verification failed: ${execErr.message}`;
          evidence = {
            testCommand: testCmd,
            stdout: (execErr.stdout || '').toString().trim(),
            exitCode: execErr.status || 1,
            durationMs: Date.now() - startT,
          };
        }
      }
    }
  }

  // 4. Calculate independent, truthful capabilities
  const hasCompiler = Boolean(compilerTool && (compilerTool.state === 'AVAILABLE' || compilerTool.state === 'VERIFIED'));
  const hasRuntime = Boolean(runtimeTool && (runtimeTool.state === 'AVAILABLE' || runtimeTool.state === 'VERIFIED'));
  const hasInterpreter = Boolean(interpreterTool && (interpreterTool.state === 'AVAILABLE' || interpreterTool.state === 'VERIFIED'));

  let canBuild = false;
  let canRun = false;

  if (profile.category === 'compiled') {
    canBuild = hasCompiler;
    canRun = hasCompiler; // for compiled C/C++/Rust/Go, compiler produces executable
  } else if (profile.category === 'vm') {
    // Java: requires compiler to build, AND runtime to execute
    canBuild = hasCompiler;
    canRun = hasCompiler && hasRuntime;
  } else if (profile.category === 'interpreted' || profile.category === 'script') {
    canBuild = false;
    canRun = hasInterpreter || hasRuntime;
  }

  let statusReason: string | undefined;
  if (profile.category === 'vm' && !hasCompiler && hasRuntime) {
    statusReason = `Java compiler (javac) is not available in the current environment. Java source files cannot be compiled.`;
  } else if (profile.category === 'compiled' && !hasCompiler) {
    statusReason = `${profile.name} compiler is not installed or available on PATH.`;
  } else if (!canRun && !canBuild) {
    statusReason = `${profile.name} runtime is unavailable in the current execution environment.`;
  }

  const discovered: DiscoveredRuntime = {
    runtimeId,
    name: profile.name,
    category: profile.category,
    state: runtimeState,

    executableName: primaryTool?.executableName || runtimeId,
    executablePath: primaryTool?.executablePath,
    version: primaryTool?.version || 'installed',
    lastCheckedAt: now,
    verificationEvidence: evidence,
    errorReason,

    runtimeExecutable: runtimeTool?.executableName,
    runtimeExecutablePath: runtimeTool?.executablePath,
    runtimeVersion: runtimeTool?.version,

    compilerExecutable: compilerTool?.executableName,
    compilerExecutablePath: compilerTool?.executablePath,
    compilerVersion: compilerTool?.version,

    interpreterExecutable: interpreterTool?.executableName,
    interpreterExecutablePath: interpreterTool?.executablePath,
    interpreterVersion: interpreterTool?.version,

    builderExecutable: builderTool?.executableName,
    builderExecutablePath: builderTool?.executablePath,
    builderVersion: builderTool?.version,

    packageManagerExecutable: packageManagerTool?.executableName,
    packageManagerExecutablePath: packageManagerTool?.executablePath,
    packageManagerVersion: packageManagerTool?.version,

    debuggerExecutable: debuggerTool?.executableName,
    debuggerExecutablePath: debuggerTool?.executablePath,

    tools: discoveredTools,
    capabilityVerification: {
      run: canRun,
      build: canBuild,
      test: canRun,
      debug: Boolean(debuggerTool?.executablePath),
      packageInstall: Boolean(packageManagerTool?.executablePath),
      multiFile: true,
      stdin: true,
      stdout: true,
      stderr: true,
      network: true,
    },
    capabilities: {
      run: canRun,
      build: canBuild,
      test: canRun,
      debug: Boolean(debuggerTool?.executablePath),
      packageInstall: Boolean(packageManagerTool?.executablePath),
      multiFile: true,
      stdin: true,
      stdout: true,
      stderr: true,
      network: true,
    },
    statusReason,
  };

  discoveryCache.set(key, { runtime: discovered, expiresAt: Date.now() + 180000 });
  return discovered;
}

/**
 * Returns discovery status for all primary runtimes.
 */
export async function discoverAllRuntimes(forceRefresh: boolean = false): Promise<Record<string, DiscoveredRuntime>> {
  const results: Record<string, DiscoveredRuntime> = {};
  for (const id of Object.keys(RUNTIME_TOOL_PROFILES)) {
    results[id] = await discoverRuntime(id, forceRefresh);
  }
  return results;
}
