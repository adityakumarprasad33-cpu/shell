/**
 * Runix Runtime Resolver
 * Resolves files and projects to their correct runtime, build, and execution strategy.
 * 
 * File/Project → Language Detection → Runtime Lookup → Execution Strategy
 */

import { RUNTIME_REGISTRY, RuntimeDefinition } from './registry';
import { detectFileLanguage, DetectedLanguage } from './detector';

export interface ExecutionStrategy {
  runtimeId: string;
  runtime: RuntimeDefinition;
  compileCommand?: string;
  runCommand: string;
  testCommand?: string;
  debugCommand?: string;
  packageInstallCommand?: string;
  workingDirectory?: string;
  env?: Record<string, string>;
  isVerified: boolean;
}

export interface ProjectDetection {
  projectType: string;
  primaryRuntime?: RuntimeDefinition;
  manifests: string[];
  entryFile?: string;
  buildCommand?: string;
  runCommand?: string;
  testCommand?: string;
  packageManager?: string;
}

import { getEffectiveSystemPath } from './discovery';
import { LanguageDetectionService } from './language-detection-service';
import path from 'path';

/**
 * Resolve the execution strategy for a single file
 */
export function resolveFileExecution(
  filename: string,
  workingDirectory: string
): ExecutionStrategy | null {
  const cleanName = LanguageDetectionService.cleanFilename(filename);
  const detected = detectFileLanguage(cleanName);

  if (!detected.runtimeId || !detected.runtime) {
    return null;
  }

  const runtime = detected.runtime;

  if (runtime.verificationStatus !== 'PASS') {
    return null;
  }

  const className = path.basename(cleanName).replace(/\.[^.]+$/, '');

  // Build the run command with file and class substitution
  let runCommand = runtime.runCommand || '';
  runCommand = runCommand.replace(/\{className\}/g, className);
  runCommand = runCommand.replace(/\{file\}/g, cleanName);
  runCommand = runCommand.replace(/\{output\}/g, cleanName.replace(/\.[^.]+$/, ''));

  let compileCommand: string | undefined;
  if (runtime.buildCommand) {
    compileCommand = runtime.buildCommand
      .replace(/\{className\}/g, className)
      .replace(/\{file\}/g, cleanName)
      .replace(/\{output\}/g, cleanName.replace(/\.[^.]+$/, ''));
  }

  return {
    runtimeId: runtime.id,
    runtime,
    compileCommand,
    runCommand,
    testCommand: runtime.testCommand,
    debugCommand: runtime.debugCommand,
    packageInstallCommand: runtime.packageManager
      ? `${runtime.packageManager} install`
      : undefined,
    workingDirectory,
    env: {
      PATH: getEffectiveSystemPath(),
      Path: getEffectiveSystemPath(),
    },
    isVerified: runtime.verificationStatus === 'PASS',
  };
}

/**
 * Detect project type from a list of filenames in a workspace
 */
export function detectProjectType(files: string[]): ProjectDetection {
  const fileSet = new Set(files.map((f) => f.toLowerCase()));
  const manifests: string[] = [];

  // Check for project manifests in priority order
  if (fileSet.has('package.json')) {
    manifests.push('package.json');

    // Determine if it's a React/Vue/Express project
    // For now, classify as Node.js
    const runtime = RUNTIME_REGISTRY['nodejs'];
    return {
      projectType: 'node-project',
      primaryRuntime: runtime,
      manifests,
      buildCommand: 'npm run build',
      runCommand: 'npm start',
      testCommand: 'npm test',
      packageManager: 'npm',
    };
  }

  if (fileSet.has('cargo.toml')) {
    manifests.push('Cargo.toml');
    return {
      projectType: 'rust-project',
      primaryRuntime: RUNTIME_REGISTRY['rust'],
      manifests,
      buildCommand: 'cargo build',
      runCommand: 'cargo run',
      testCommand: 'cargo test',
      packageManager: 'cargo',
    };
  }

  if (fileSet.has('go.mod')) {
    manifests.push('go.mod');
    return {
      projectType: 'go-module',
      primaryRuntime: RUNTIME_REGISTRY['go'],
      manifests,
      buildCommand: 'go build ./...',
      runCommand: 'go run .',
      testCommand: 'go test ./...',
      packageManager: 'go get',
    };
  }

  if (fileSet.has('pom.xml')) {
    manifests.push('pom.xml');
    return {
      projectType: 'maven-project',
      primaryRuntime: RUNTIME_REGISTRY['java'],
      manifests,
      buildCommand: 'mvn compile',
      runCommand: 'mvn exec:java',
      testCommand: 'mvn test',
      packageManager: 'maven',
    };
  }

  if (fileSet.has('build.gradle') || fileSet.has('build.gradle.kts')) {
    manifests.push(fileSet.has('build.gradle.kts') ? 'build.gradle.kts' : 'build.gradle');
    return {
      projectType: 'gradle-project',
      primaryRuntime: RUNTIME_REGISTRY['java'],
      manifests,
      buildCommand: './gradlew build',
      runCommand: './gradlew run',
      testCommand: './gradlew test',
      packageManager: 'gradle',
    };
  }

  if (fileSet.has('pyproject.toml') || fileSet.has('requirements.txt')) {
    manifests.push(fileSet.has('pyproject.toml') ? 'pyproject.toml' : 'requirements.txt');
    return {
      projectType: 'python-project',
      primaryRuntime: RUNTIME_REGISTRY['python'],
      manifests,
      runCommand: 'python main.py',
      testCommand: 'python -m pytest',
      packageManager: 'pip',
    };
  }

  if (fileSet.has('pubspec.yaml')) {
    manifests.push('pubspec.yaml');
    return {
      projectType: 'dart-project',
      primaryRuntime: RUNTIME_REGISTRY['dart'],
      manifests,
      buildCommand: 'dart compile exe',
      runCommand: 'dart run',
      testCommand: 'dart test',
      packageManager: 'pub',
    };
  }

  if (fileSet.has('composer.json')) {
    manifests.push('composer.json');
    return {
      projectType: 'php-project',
      primaryRuntime: RUNTIME_REGISTRY['php'],
      manifests,
      runCommand: 'php index.php',
      packageManager: 'composer',
    };
  }

  if (fileSet.has('runix.json')) {
    manifests.push('runix.json');
    return {
      projectType: 'runix-project',
      primaryRuntime: RUNTIME_REGISTRY['python'],
      manifests,
      runCommand: 'python main.py',
    };
  }

  if (fileSet.has('makefile') || fileSet.has('cmakelists.txt')) {
    manifests.push(fileSet.has('cmakelists.txt') ? 'CMakeLists.txt' : 'Makefile');
    return {
      projectType: 'native-build',
      primaryRuntime: RUNTIME_REGISTRY['cpp'] || RUNTIME_REGISTRY['c'],
      manifests,
      buildCommand: fileSet.has('cmakelists.txt') ? 'cmake . && make' : 'make',
      runCommand: './a.out',
      testCommand: 'make test',
    };
  }

  // Fallback: detect from first source file
  for (const file of files) {
    const detected = detectFileLanguage(file);
    if (detected.runtimeId && detected.runtime) {
      return {
        projectType: `${detected.runtime.type}-single`,
        primaryRuntime: detected.runtime,
        manifests: [],
        entryFile: file,
      };
    }
  }

  return {
    projectType: 'unknown',
    manifests: [],
  };
}

/**
 * Get all runtimes that can execute a given file extension
 */
export function getRuntimesForExtension(ext: string): RuntimeDefinition[] {
  const normalizedExt = ext.startsWith('.') ? ext : `.${ext}`;
  return Object.values(RUNTIME_REGISTRY).filter(
    (r) =>
      r.extensions.includes(normalizedExt) &&
      r.verificationStatus === 'PASS'
  );
}

/**
 * Search runtimes by name, id, type, or extension
 */
export function searchRuntimes(query: string): RuntimeDefinition[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return Object.values(RUNTIME_REGISTRY).filter((r) => {
    return (
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.extensions.some((e) => e.toLowerCase().includes(q)) ||
      r.description.toLowerCase().includes(q)
    );
  });
}
