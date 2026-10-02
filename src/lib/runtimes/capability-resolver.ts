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

  // Check host runtime discovery
  const discovery = await discoverRuntime(runtimeId);
  const runtimeDef = RUNTIME_REGISTRY[runtimeId];

  const isVerified = discovery.state === 'VERIFIED';
  const isAvailable = discovery.state === 'AVAILABLE' || discovery.state === 'VERIFIED';

  // Format execution commands
  let runCommand = language.defaultRunCommand || runtimeDef?.runCommand || `${discovery.executableName} "{file}"`;
  runCommand = runCommand.replace(/\{file\}/g, filename);
  runCommand = runCommand.replace(/\{output\}/g, filename.replace(/\.[^.]+$/, ''));

  let compileCommand: string | undefined;
  if (language.defaultBuildCommand || runtimeDef?.buildCommand) {
    const rawBuild = language.defaultBuildCommand || runtimeDef?.buildCommand || '';
    compileCommand = rawBuild
      .replace(/\{file\}/g, filename)
      .replace(/\{output\}/g, filename.replace(/\.[^.]+$/, ''));
  }

  let testCommand: string | undefined;
  if (language.defaultTestCommand || runtimeDef?.testCommand) {
    testCommand = (language.defaultTestCommand || runtimeDef?.testCommand || '').replace(/\{file\}/g, filename);
  }

  let debugCommand: string | undefined;
  if (language.defaultDebugCommand || runtimeDef?.debugCommand) {
    debugCommand = (language.defaultDebugCommand || runtimeDef?.debugCommand || '').replace(/\{file\}/g, filename);
  }

  // Capabilities are strictly derived from language design + real discovery state
  const canRun = language.runCapability && isVerified;
  const canBuild = language.buildCapability && isAvailable;
  const canDebug = language.debugCapability && isVerified && Boolean(debugCommand);
  const canTest = language.testCapability && isVerified && Boolean(testCommand);

  let statusReason: string | undefined;
  if (!isAvailable) {
    statusReason = `Runtime '${discovery.name}' is not installed in the execution environment.`;
  } else if (!isVerified) {
    statusReason = `Runtime '${discovery.name}' is available but pending execution verification.`;
  }

  return {
    filename,
    fileType: language.type,
    languageId: language.languageId,
    languageName: language.displayName,
    editorLanguage: language.editorLanguage,
    category: language.category,
    runtimeId,
    runtimeName: discovery.name,
    runtimeVersion: discovery.version,
    runtimeExecutable: discovery.executablePath,
    runtimeAvailable: isAvailable,
    verificationStatus: discovery.state,
    statusReason,
    capabilities: {
      run: canRun,
      build: canBuild,
      debug: canDebug,
      test: canTest,
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
