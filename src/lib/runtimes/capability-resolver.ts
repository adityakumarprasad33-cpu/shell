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
 * Resolves full capability state for a file within a workspace.
 * Real host discovery determines capability — never static registry data.
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

  // Check real host runtime and compiler discovery
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
