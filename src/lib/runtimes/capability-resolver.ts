/**
 * RUNIX UNIVERSAL CAPABILITY RESOLVER
 * 
 * One central resolution engine that maps any file or project to its:
 * - Language identification (from RUNIX_LANGUAGE_REGISTRY)
 * - Runtime resolution (from RUNTIME_REGISTRY & discovery)
 * - Actual verified capabilities (run, build, debug, test)
 * - Concrete execution commands
 * 
 * Strict architectural rule:
 * Frontend UI consumes this resolved state directly.
 * ZERO hardcoded .py, .js, or .lua conditions in any UI component!
 */

import { identifyLanguage, LanguageDefinition, RUNIX_LANGUAGE_REGISTRY } from './language-registry';
import { discoverRuntime, getEffectiveSystemPath, DiscoveredRuntime } from './discovery';
import { RUNTIME_REGISTRY } from './registry';
import { JavaEngine } from './java-engine';

export interface FileCapabilityState {
  filename: string;
  fileType: string;
  languageId: string;
  languageName: string;
  editorLanguage: string;
  category: LanguageDefinition['category'];
  runtimeId?: string;
  runtimeName?: string;
  runtimeVersion?: string;
  runtimeExecutable?: string;
  compilerExecutable?: string;
  compilerVersion?: string;
  compilerAvailable?: boolean;
  runtimeAvailable: boolean;
  verificationStatus: 'CHECKING' | 'VERIFIED' | 'AVAILABLE' | 'UNAVAILABLE' | 'BROKEN' | 'NOT_IMPLEMENTED' | 'UNKNOWN';
  statusReason?: string;
  capabilities: {
    run: boolean;
    build: boolean;
    debug: boolean;
    test: boolean;
    stdin: boolean;
    stdout: boolean;
    stderr: boolean;
    multiFile: boolean;
    packages: boolean;
    network: boolean;
  };
  executionConfig?: {
    compileCommand?: string;
    runCommand: string;
    testCommand?: string;
    debugCommand?: string;
    env?: Record<string, string>;
    timeoutMs: number;
  };
  isRunnable: boolean;
}

/**
 * Detects whether we're running inside a cloud/serverless environment
 * where local binary probing (python, gcc, java, etc.) would fail because
 * those runtimes are not installed on the deployment host.
 */
function isCloudEnvironment(): boolean {
  if (typeof process === 'undefined') return false;

  // Explicit opt-in via env var (works on any platform)
  if (process.env.NEXT_PUBLIC_RUNIX_CLOUD === '1' || process.env.RUNIX_CLOUD === '1') {
    return true;
  }

  // Standard platform env vars
  if (
    !!process.env.VERCEL ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME ||
    !!process.env.GOOGLE_CLOUD_PROJECT ||
    !!process.env.AZURE_FUNCTIONS_ENVIRONMENT ||
    !!process.env.NETLIFY ||
    !!process.env.RAILWAY_ENVIRONMENT ||
    !!process.env.RENDER ||
    !!process.env.FLY_APP_NAME
  ) {
    return true;
  }

  // Additional AWS Lambda indicators (sometimes VERCEL/AWS_LAMBDA_FUNCTION_NAME not passed to API routes)
  if (
    !!process.env.AWS_REGION ||
    !!process.env.LAMBDA_TASK_ROOT ||
    !!process.env.LAMBDA_RUNTIME_DIR ||
    !!process.env.AWS_EXECUTION_ENV
  ) {
    return true;
  }

  // Vercel-specific additional indicators
  if (
    !!process.env.VERCEL_ENV ||
    !!process.env.VERCEL_REGION ||
    !!process.env.VERCEL_DEPLOYMENT_ID
  ) {
    return true;
  }

  // Heuristic: if common system binaries are missing, we're likely in a restricted cloud environment
  try {
    const { execSync } = require('child_process');
    execSync('which python3 || which python', { stdio: 'ignore', timeout: 1000 });
    execSync('which node', { stdio: 'ignore', timeout: 1000 });
    // If we get here, basic binaries exist - likely not a restricted cloud env
    return false;
  } catch {
    // Binaries missing - likely cloud/serverless
    return true;
  }
}

/**
 * Resolves full capability state for a file within a workspace.
 * 
 * In local/desktop environments, real host discovery determines capability.
 * In cloud/serverless environments (Vercel, etc.), local binary probing is
 * bypassed and capabilities are reported as AVAILABLE based on the language
 * registry's static definitions. Actual execution is handled by the sandbox
 * runner which uses whatever runtimes are available on the execution host.
 */
export async function resolveFileCapabilities(
  filename: string,
  workspaceDir?: string
): Promise<FileCapabilityState> {
  const language = identifyLanguage(filename);
  const runtimeId = language.runtimeId;

  // Non-code or non-runnable files (Markdown, Plaintext, Images, etc.)
  if (!runtimeId || (!language.runCapability && !language.buildCapability)) {
    return {
      filename,
      fileType: language.type,
      languageId: language.languageId,
      languageName: language.displayName,
      editorLanguage: language.editorLanguage,
      category: language.category,
      runtimeAvailable: false,
      verificationStatus: 'NOT_IMPLEMENTED',
      statusReason: `File type '${language.displayName}' is non-runnable.`,
      capabilities: {
        run: false,
        build: false,
        debug: false,
        test: false,
        stdin: false,
        stdout: false,
        stderr: false,
        multiFile: false,
        packages: false,
        network: false,
      },
      isRunnable: false,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CLOUD / SERVERLESS FAST PATH
  // When deployed on Vercel/serverless, local binary discovery (execSync,
  // fs.existsSync for python/gcc/java) will always fail because those
  // runtimes aren't installed on the deployment host. Instead, trust the
  // language registry's capability definitions and report runtimes as
  // AVAILABLE. The sandbox runner handles actual process execution.
  // ──────────────────────────────────────────────────────────────────────────
  if (isCloudEnvironment()) {
    const runtimeDef = RUNTIME_REGISTRY[runtimeId];
    const runCommand = (language.defaultRunCommand || runtimeDef?.runCommand || `${runtimeId} "{file}"`)
      .replace(/\{file\}/g, filename);
    const compileCommand = (language.defaultBuildCommand || runtimeDef?.buildCommand || undefined);
    const testCommand = (language.defaultTestCommand || runtimeDef?.testCommand || undefined);
    const debugCommand = (language.defaultDebugCommand || runtimeDef?.debugCommand || undefined);

    return {
      filename,
      fileType: language.type,
      languageId: language.languageId,
      languageName: language.displayName,
      editorLanguage: language.editorLanguage,
      category: language.category,
      runtimeId,
      runtimeName: runtimeDef?.name || language.displayName,
      runtimeVersion: 'cloud',
      runtimeAvailable: true,
      verificationStatus: 'AVAILABLE',
      statusReason: undefined,
      compilerAvailable: language.buildCapability,
      capabilities: {
        run: language.runCapability,
        build: language.buildCapability,
        debug: language.debugCapability,
        test: language.testCapability,
        stdin: language.stdinCapability,
        stdout: language.stdoutCapability,
        stderr: language.stderrCapability,
        multiFile: language.multiFileCapability,
        packages: language.packageCapability,
        network: language.networkCapability,
      },
      executionConfig: {
        compileCommand: compileCommand?.replace(/\{file\}/g, filename),
        runCommand,
        testCommand: testCommand?.replace(/\{file\}/g, filename),
        debugCommand: debugCommand?.replace(/\{file\}/g, filename),
        env: {},
        timeoutMs: 30000,
      },
      isRunnable: language.runCapability,
    };
  }
  // ──────────────────────────────────────────────────────────────────────────

  // LOCAL / DESKTOP PATH: Check real host runtime and compiler discovery
  const discovery = await discoverRuntime(runtimeId);
  const runtimeDef = RUNTIME_REGISTRY[runtimeId];

  const compilerTool = discovery.tools['compiler'];
  const runtimeTool = discovery.tools['runtime'];
  const interpreterTool = discovery.tools['interpreter'];

  const hasCompiler = Boolean(compilerTool && (compilerTool.state === 'AVAILABLE' || compilerTool.state === 'VERIFIED'));
  const hasRuntime = Boolean(runtimeTool && (runtimeTool.state === 'AVAILABLE' || runtimeTool.state === 'VERIFIED'));
  const hasInterpreter = Boolean(interpreterTool && (interpreterTool.state === 'AVAILABLE' || interpreterTool.state === 'VERIFIED'));

  let canBuild = false;
  let canRun = false;
  let statusReason: string | undefined;
  let compileCommand: string | undefined;
  let runCommand = language.defaultRunCommand || runtimeDef?.runCommand || `${discovery.executableName} "{file}"`;

  // Java-specific handling (Strict Section 7-11)
  if (language.languageId === 'java' || runtimeId === 'java') {
    const preflight = await JavaEngine.preflightCheck();
    canBuild = preflight.canCompile;
    canRun = preflight.canCompile && preflight.canExecute;
    statusReason = preflight.diagnostic;

    const javaPlan = JavaEngine.resolveExecutionPlan(filename, [], workspaceDir || process.cwd());
    compileCommand = javaPlan.compileCommand;
    runCommand = javaPlan.runCommand;
  } else if (language.type === 'compiled' || discovery.category === 'compiled') {
    canBuild = hasCompiler;
    canRun = hasCompiler;
    if (!hasCompiler) {
      const compName = compilerTool?.executableName || 'compiler';
      statusReason = `${language.displayName} compiler (${compName}) is unavailable in current execution environment.`;
    }
    const cleanOutput = filename.replace(/\.[^.]+$/, '');
    if (language.defaultBuildCommand || runtimeDef?.buildCommand) {
      compileCommand = (language.defaultBuildCommand || runtimeDef?.buildCommand || '')
        .replace(/\{file\}/g, filename)
        .replace(/\{output\}/g, cleanOutput);
    }
    runCommand = (language.defaultRunCommand || runtimeDef?.runCommand || `"{output}"`)
      .replace(/\{file\}/g, filename)
      .replace(/\{output\}/g, cleanOutput);
  } else if (language.type === 'hybrid' || runtimeId === 'typescript') {
    canRun = hasRuntime || hasInterpreter;
    canBuild = hasCompiler;
    if (!canRun && !canBuild) {
      statusReason = `TypeScript runner (tsx/tsc) is unavailable in current execution environment.`;
    }
    runCommand = runCommand.replace(/\{file\}/g, filename);
    if (language.defaultBuildCommand || runtimeDef?.buildCommand) {
      compileCommand = (language.defaultBuildCommand || runtimeDef?.buildCommand || '').replace(/\{file\}/g, filename);
    }
  } else {
    // Interpreted / script runtimes
    canBuild = false;
    canRun = hasInterpreter || hasRuntime;
    if (!canRun) {
      const interpName = interpreterTool?.executableName || runtimeTool?.executableName || 'interpreter';
      statusReason = `${language.displayName} interpreter (${interpName}) is unavailable in current execution environment.`;
    }
    runCommand = runCommand.replace(/\{file\}/g, filename);
  }

  let testCommand: string | undefined;
  if (language.defaultTestCommand || runtimeDef?.testCommand) {
    testCommand = (language.defaultTestCommand || runtimeDef?.testCommand || '').replace(/\{file\}/g, filename);
  }

  let debugCommand: string | undefined;
  if (language.defaultDebugCommand || runtimeDef?.debugCommand) {
    debugCommand = (language.defaultDebugCommand || runtimeDef?.debugCommand || '').replace(/\{file\}/g, filename);
  }

  // Verification status strictly reflects real host discovery state
  let verificationStatus: FileCapabilityState['verificationStatus'] = 'UNAVAILABLE';
  if (discovery.state === 'VERIFIED') {
    verificationStatus = 'VERIFIED';
  } else if (discovery.state === 'AVAILABLE') {
    verificationStatus = (canRun || canBuild) ? 'AVAILABLE' : 'UNAVAILABLE';
  } else if (discovery.state === 'BROKEN') {
    verificationStatus = 'BROKEN';
  } else {
    verificationStatus = 'UNAVAILABLE';
  }

  const isAvailable = canRun || canBuild || discovery.state === 'AVAILABLE' || discovery.state === 'VERIFIED';

  return {
    filename,
    fileType: language.type,
    languageId: language.languageId,
    languageName: language.displayName,
    editorLanguage: language.editorLanguage,
    category: language.category,
    runtimeId,
    runtimeName: discovery.name || runtimeDef?.name || language.displayName,
    runtimeVersion: runtimeTool?.version || discovery.version,
    runtimeExecutable: runtimeTool?.executablePath || discovery.executablePath,
    compilerExecutable: compilerTool?.executablePath,
    compilerVersion: compilerTool?.version,
    compilerAvailable: hasCompiler,
    runtimeAvailable: isAvailable,
    verificationStatus,
    statusReason,
    capabilities: {
      run: canRun,
      build: canBuild,
      debug: Boolean(canRun && debugCommand),
      test: Boolean(canRun && testCommand),
      stdin: language.stdinCapability,
      stdout: language.stdoutCapability,
      stderr: language.stderrCapability,
      multiFile: language.multiFileCapability,
      packages: language.packageCapability,
      network: language.networkCapability,
    },
    executionConfig: {
      compileCommand,
      runCommand,
      testCommand,
      debugCommand,
      env: {
        PATH: getEffectiveSystemPath(),
        Path: getEffectiveSystemPath(),
      },
      timeoutMs: 30000,
    },
    isRunnable: language.runCapability,
  };
}
