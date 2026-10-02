/**
 * Runix Build & Execution Pipeline Engine
 * Manages compilation, multi-file linking, dependency resolution, and execution workflows.
 * 
 * Strict engineering principle:
 * Supports verified runtime execution with standard lifecycle phases:
 * [RESOLVE] -> [DEPENDENCIES] -> [COMPILE / BUILD] -> [EXECUTE] -> [CLEANUP]
 */

import path from 'path';
import fs from 'fs';
import { RUNTIME_REGISTRY, RuntimeDefinition } from './registry';
import { detectProjectType, resolveFileExecution, ProjectDetection, ExecutionStrategy } from './resolver';
import { detectFileLanguage } from './detector';

export interface PipelineStep {
  id: string;
  name: string;
  phase: 'resolve' | 'deps' | 'build' | 'exec' | 'test';
  command: string;
  cwd: string;
  env?: Record<string, string>;
  isRequired: boolean;
  timeoutMs: number;
}

export interface BuildPipeline {
  projectId: string;
  projectType: string;
  primaryRuntime?: RuntimeDefinition;
  entryFile?: string;
  isVerified: boolean;
  steps: PipelineStep[];
  diagnostics: string[];
}

/**
 * Construct an execution or build pipeline for a workspace directory
 */
export function createWorkspacePipeline(
  workspaceDir: string,
  filenames: string[],
  targetFile?: string,
  mode: 'run' | 'build' | 'test' = 'run'
): BuildPipeline {
  const diagnostics: string[] = [];
  const steps: PipelineStep[] = [];

  // Step 1: Detect project architecture
  const projectInfo = detectProjectType(filenames);

  // If a specific target file was requested for running:
  if (targetFile) {
    const cleanTarget = targetFile.replace(/^["']|["']$/g, '').trim().replace(/^\.\//, '');
    const fileStrategy = resolveFileExecution(cleanTarget, workspaceDir);

    if (!fileStrategy) {
      const detected = detectFileLanguage(cleanTarget);
      return {
        projectId: path.basename(workspaceDir),
        projectType: detected.languageId || 'unknown',
        entryFile: cleanTarget,
        isVerified: false,
        steps: [],
        diagnostics: [
          `No verified runtime available for file '${cleanTarget}' (${detected.displayName}).`,
          `Runtime status in registry: ${detected.runtime?.status || 'unregistered'}.`,
        ],
      };
    }

    // If there is a compilation phase required for this file
    if (fileStrategy.compileCommand) {
      steps.push({
        id: `compile-${fileStrategy.runtimeId}`,
        name: `Compile ${fileStrategy.runtime.name}`,
        phase: 'build',
        command: fileStrategy.compileCommand,
        cwd: workspaceDir,
        isRequired: true,
        timeoutMs: 30000,
      });
    }

    if (mode === 'test' && fileStrategy.testCommand) {
      steps.push({
        id: `test-${fileStrategy.runtimeId}`,
        name: `Test ${fileStrategy.runtime.name}`,
        phase: 'test',
        command: fileStrategy.testCommand.replace(/\{file\}/g, targetFile),
        cwd: workspaceDir,
        isRequired: false,
        timeoutMs: 45000,
      });
    } else if (mode === 'run') {
      steps.push({
        id: `exec-${fileStrategy.runtimeId}`,
        name: `Execute ${fileStrategy.runtime.name}`,
        phase: 'exec',
        command: fileStrategy.runCommand,
        cwd: workspaceDir,
        isRequired: true,
        timeoutMs: 60000,
      });
    }

    return {
      projectId: path.basename(workspaceDir),
      projectType: fileStrategy.runtime.id,
      primaryRuntime: fileStrategy.runtime,
      entryFile: targetFile,
      isVerified: fileStrategy.isVerified,
      steps,
      diagnostics,
    };
  }

  // Step 2: Handle full project pipelines (e.g. package.json, Cargo.toml, Makefile, runix.json)
  const fileSet = new Set(filenames.map((f) => f.toLowerCase()));

  // Dependency phase
  if (fileSet.has('package.json')) {
    if (!fs.existsSync(path.join(workspaceDir, 'node_modules'))) {
      steps.push({
        id: 'npm-install',
        name: 'Install Node.js Dependencies',
        phase: 'deps',
        command: 'npm install --prefer-offline --no-audit',
        cwd: workspaceDir,
        isRequired: false,
        timeoutMs: 120000,
      });
    }
  } else if (fileSet.has('requirements.txt')) {
    steps.push({
      id: 'pip-install',
      name: 'Install Python Requirements',
      phase: 'deps',
      command: 'pip install -r requirements.txt',
      cwd: workspaceDir,
      isRequired: false,
      timeoutMs: 120000,
    });
  }

  // Build / Execution phase based on mode
  if (mode === 'build') {
    if (projectInfo.buildCommand) {
      steps.push({
        id: 'project-build',
        name: `Build ${projectInfo.projectType}`,
        phase: 'build',
        command: projectInfo.buildCommand,
        cwd: workspaceDir,
        isRequired: true,
        timeoutMs: 90000,
      });
    } else {
      diagnostics.push(`No build command registered for project type '${projectInfo.projectType}'.`);
    }
  } else if (mode === 'test') {
    if (projectInfo.testCommand) {
      steps.push({
        id: 'project-test',
        name: `Test ${projectInfo.projectType}`,
        phase: 'test',
        command: projectInfo.testCommand,
        cwd: workspaceDir,
        isRequired: true,
        timeoutMs: 60000,
      });
    } else {
      diagnostics.push(`No test runner registered for project type '${projectInfo.projectType}'.`);
    }
  } else {
    // Mode: run
    if (projectInfo.buildCommand && (projectInfo.projectType === 'native-build' || projectInfo.projectType === 'rust-project')) {
      steps.push({
        id: 'project-prebuild',
        name: `Build ${projectInfo.projectType}`,
        phase: 'build',
        command: projectInfo.buildCommand,
        cwd: workspaceDir,
        isRequired: true,
        timeoutMs: 90000,
      });
    }

    if (projectInfo.runCommand) {
      steps.push({
        id: 'project-run',
        name: `Run ${projectInfo.projectType}`,
        phase: 'exec',
        command: projectInfo.runCommand,
        cwd: workspaceDir,
        isRequired: true,
        timeoutMs: 60000,
      });
    } else if (projectInfo.entryFile) {
      const entryStrategy = resolveFileExecution(projectInfo.entryFile, workspaceDir);
      if (entryStrategy) {
        if (entryStrategy.compileCommand) {
          steps.push({
            id: 'entry-compile',
            name: `Compile ${entryStrategy.runtime.name}`,
            phase: 'build',
            command: entryStrategy.compileCommand,
            cwd: workspaceDir,
            isRequired: true,
            timeoutMs: 30000,
          });
        }
        steps.push({
          id: 'entry-run',
          name: `Execute ${entryStrategy.runtime.name}`,
          phase: 'exec',
          command: entryStrategy.runCommand,
          cwd: workspaceDir,
          isRequired: true,
          timeoutMs: 60000,
        });
      }
    } else {
      diagnostics.push('No executable entrypoint or project manifest detected in workspace.');
    }
  }

  const isVerified = projectInfo.primaryRuntime ? projectInfo.primaryRuntime.verificationStatus === 'PASS' : false;

  return {
    projectId: path.basename(workspaceDir),
    projectType: projectInfo.projectType,
    primaryRuntime: projectInfo.primaryRuntime,
    entryFile: projectInfo.entryFile,
    isVerified,
    steps,
    diagnostics,
  };
}
