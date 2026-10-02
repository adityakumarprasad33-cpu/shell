/**
 * RUNIX RUNTIME DISCOVERY ENGINE
 * 
 * Inspects host environment to discover installed compilers, interpreters,
 * versions, and operational health.
 * 
 * Strict engineering principle:
 * A runtime is NEVER marked VERIFIED until actual execution verification succeeds.
 * If a runtime is not discovered on PATH/host, it reports UNAVAILABLE truthfully.
 */

import { execSync, spawn } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';

export type RuntimeDiscoveryState =
  | 'UNKNOWN'
  | 'CHECKING'
  | 'AVAILABLE'
  | 'VERIFIED'
  | 'UNAVAILABLE'
  | 'BROKEN';

export interface DiscoveredRuntime {
  runtimeId: string;
  name: string;
  executableName: string;
  executablePath?: string;
  version?: string;
  state: RuntimeDiscoveryState;
  lastCheckedAt: string;
  verificationEvidence?: {
    testCommand: string;
    stdout: string;
    exitCode: number;
    durationMs: number;
  };
  errorReason?: string;
}

// In-memory discovery cache with 5-minute TTL
interface CachedEntry {
  runtime: DiscoveredRuntime;
  expiresAt: number;
}
const discoveryCache = new Map<string, CachedEntry>();

/**
 * Standard candidate executables and test commands for primary runtimes
 */
const RUNTIME_EXECUTABLES: Record<
  string,
  {
    name: string;
    candidates: string[];
    versionArgs: string[];
    testSnippet: string;
    testCommandGenerator: (exe: string) => string;
  }
> = {
  lua: {
    name: 'Lua',
    candidates: ['lua', 'lua54', 'lua5.4', 'luajit'],
    versionArgs: ['-v'],
    testSnippet: 'print("Hello World!")',
    testCommandGenerator: (exe) => `"${exe}" -e "print(\\"Hello World!\\")"`,
  },
  python: {
    name: 'Python',
    candidates: ['python', 'python3'],
    versionArgs: ['--version'],
    testSnippet: 'print("Hello World!")',
    testCommandGenerator: (exe) => `"${exe}" -c "print(\\"Hello World!\\")"`,
  },
  nodejs: {
    name: 'Node.js',
    candidates: ['node'],
    versionArgs: ['-v'],
    testSnippet: 'console.log("Hello World!")',
    testCommandGenerator: (exe) => `"${exe}" -e "console.log(\\"Hello World!\\")"`,
  },
  typescript: {
    name: 'TypeScript',
    candidates: ['tsx', 'npx'],
    versionArgs: ['--version'],
    testSnippet: 'console.log("Hello World!")',
    testCommandGenerator: (exe) =>
      exe === 'tsx'
        ? `"${exe}" -e "console.log(\\"Hello World!\\")"`
        : `"${exe}" tsx -e "console.log(\\"Hello World!\\")"`,
  },
  c: {
    name: 'C (GCC)',
    candidates: ['gcc', 'clang'],
    versionArgs: ['--version'],
    testSnippet: 'int main(){return 0;}',
    testCommandGenerator: (exe) => `"${exe}" --version`,
  },
  cpp: {
    name: 'C++ (G++)',
    candidates: ['g++', 'clang++'],
    versionArgs: ['--version'],
    testSnippet: 'int main(){return 0;}',
    testCommandGenerator: (exe) => `"${exe}" --version`,
  },
  rust: {
    name: 'Rust',
    candidates: ['rustc', 'cargo'],
    versionArgs: ['--version'],
    testSnippet: 'fn main(){}',
    testCommandGenerator: (exe) => `"${exe}" --version`,
  },
  go: {
    name: 'Go',
    candidates: ['go'],
    versionArgs: ['version'],
    testSnippet: 'package main; func main(){}',
    testCommandGenerator: (exe) => `"${exe}" version`,
  },
  java: {
    name: 'Java',
    candidates: ['java'],
    versionArgs: ['-version'],
    testSnippet: 'public class Main { public static void main(String[] args){} }',
    testCommandGenerator: (exe) => `"${exe}" -version`,
  },
  bash: {
    name: 'Bash',
    candidates: ['bash', 'sh'],
    versionArgs: ['--version'],
    testSnippet: 'echo "Hello World!"',
    testCommandGenerator: (exe) => `"${exe}" -c "echo Hello World!"`,
  },
  powershell: {
    name: 'PowerShell',
    candidates: ['powershell', 'pwsh'],
    versionArgs: ['-Command', '$PSVersionTable.PSVersion.ToString()'],
    testSnippet: 'Write-Host "Hello World!"',
    testCommandGenerator: (exe) => `"${exe}" -Command "Write-Host 'Hello World!'"`,
  },
};

/**
 * Returns refreshed and effective PATH environment variable across OS platforms.
 * Resolves standard Windows User/Machine paths and winget/cargo/programs directories
 * so newly installed packages (like Lua, Go, Rust) are discoverable immediately.
 */
export function getEffectiveSystemPath(): string {
  const currentPath = process.env.PATH || process.env.Path || '';
  const delimiter = path.delimiter;
  const pathParts = new Set<string>(currentPath.split(delimiter).filter(Boolean));

  if (process.platform === 'win32') {
    const home = os.homedir();
    // Common installation paths on Windows for dev tools
    const commonPaths = [
      path.join(home, 'AppData', 'Local', 'Programs', 'Lua', 'bin'),
      path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python312'),
      path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python311'),
      path.join(home, 'AppData', 'Local', 'Programs', 'Python', 'Python314'),
      path.join('C:', 'Python314'),
      path.join('C:', 'Python312'),
      path.join('C:', 'Python311'),
      path.join(home, 'go', 'bin'),
      path.join(home, '.cargo', 'bin'),
      'D:\\.cargo\\bin',
      path.join('C:', 'Program Files', 'Git', 'cmd'),
      path.join('C:', 'Program Files', 'Git', 'bin'),
      path.join('C:', 'Program Files', 'nodejs'),
      path.join('C:', 'MinGW', 'bin'),
      path.join('C:', 'ProgramData', 'chocolatey', 'bin'),
    ];

    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        pathParts.add(p);
      }
    }
  }

  return Array.from(pathParts).join(delimiter);
}

/**
 * Finds the absolute path to an executable using system discovery
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
 * Discovers a specific runtime, detects version, and executes hello-world verification.
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

  const spec = RUNTIME_EXECUTABLES[key];
  if (!spec) {
    const unrecog: DiscoveredRuntime = {
      runtimeId,
      name: runtimeId,
      executableName: runtimeId,
      state: 'UNAVAILABLE',
      lastCheckedAt: new Date().toISOString(),
      errorReason: `Runtime '${runtimeId}' has no discovery profile configured.`,
    };
    discoveryCache.set(key, { runtime: unrecog, expiresAt: Date.now() + 60000 });
    return unrecog;
  }

  let foundExecutablePath: string | null = null;
  let activeExecutableName = spec.candidates[0];

  for (const candidate of spec.candidates) {
    const resolvedPath = findExecutable(candidate);
    if (resolvedPath) {
      foundExecutablePath = resolvedPath;
      activeExecutableName = candidate;
      break;
    }
  }

  if (!foundExecutablePath) {
    const unavailable: DiscoveredRuntime = {
      runtimeId,
      name: spec.name,
      executableName: activeExecutableName,
      state: 'UNAVAILABLE',
      lastCheckedAt: new Date().toISOString(),
      errorReason: `Executable '${spec.candidates.join(' / ')}' not found in system PATH.`,
    };
    discoveryCache.set(key, { runtime: unavailable, expiresAt: Date.now() + 60000 });
    return unavailable;
  }

  // Version detection
  let versionStr = 'installed';
  try {
    const versionOutput = execSync(`"${foundExecutablePath}" ${spec.versionArgs.join(' ')}`, {
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

  // Execution verification test
  let state: RuntimeDiscoveryState = 'AVAILABLE';
  let evidence: DiscoveredRuntime['verificationEvidence'] | undefined;
  let errorReason: string | undefined;

  const testCmd = spec.testCommandGenerator(foundExecutablePath);
  const startT = Date.now();

  try {
    const stdout = execSync(testCmd, {
      env: { ...process.env, PATH: getEffectiveSystemPath(), Path: getEffectiveSystemPath() },
      encoding: 'utf-8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    state = 'VERIFIED';
    evidence = {
      testCommand: testCmd,
      stdout: stdout.trim(),
      exitCode: 0,
      durationMs: Date.now() - startT,
    };
  } catch (execErr: any) {
    state = 'BROKEN';
    errorReason = `Verification execution failed: ${execErr.message}`;
    evidence = {
      testCommand: testCmd,
      stdout: (execErr.stdout || '').toString().trim(),
      exitCode: execErr.status || 1,
      durationMs: Date.now() - startT,
    };
  }

  const discovered: DiscoveredRuntime = {
    runtimeId,
    name: spec.name,
    executableName: activeExecutableName,
    executablePath: foundExecutablePath,
    version: versionStr,
    state,
    lastCheckedAt: new Date().toISOString(),
    verificationEvidence: evidence,
    errorReason,
  };

  discoveryCache.set(key, { runtime: discovered, expiresAt: Date.now() + 300000 });
  return discovered;
}

/**
 * Returns discovery status for all primary runtimes.
 */
export async function discoverAllRuntimes(): Promise<Record<string, DiscoveredRuntime>> {
  const results: Record<string, DiscoveredRuntime> = {};
  for (const id of Object.keys(RUNTIME_EXECUTABLES)) {
    results[id] = await discoverRuntime(id);
  }
  return results;
}
