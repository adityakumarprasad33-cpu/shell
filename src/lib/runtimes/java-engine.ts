/**
 * Runix Core — Universal Java Engine
 * 
 * Strict engineering implementation for Java compilation and execution:
 * - Package-aware compilation and fully-qualified class execution
 * - Multi-file compilation support (compiles all dependent .java files in project/package)
 * - Isolated build output directory (<runnerRoot>/build/classes)
 * - Safe source parsing for main class and package declarations
 * - Independent verification of both java (runtime) and javac (compiler)
 * - Zero silent renaming or false path assumptions
 */

import path from 'path';
import fs from 'fs';
import { discoverRuntime, DiscoveredRuntime } from './discovery';

export interface JavaSourceMetadata {
  filename: string;
  packageName?: string;
  declaredClasses: string[];
  publicClassName?: string;
  mainClassName?: string;
  fullyQualifiedMainClass: string;
  hasMainMethod: boolean;
}

export interface JavaExecutionPlan {
  targetFile: string;
  sourceFilesToCompile: string[];
  buildClassesDir: string;
  fullyQualifiedMainClass: string;
  compileCommand: string;
  runCommand: string;
  isMultiFile: boolean;
  metadata: JavaSourceMetadata;
}

export interface JavaPreflightResult {
  canCompile: boolean;
  canExecute: boolean;
  javaVersion?: string;
  javacVersion?: string;
  compilerStatus: 'AVAILABLE' | 'VERIFIED' | 'UNAVAILABLE' | 'BROKEN' | 'UNKNOWN';
  runtimeStatus: 'AVAILABLE' | 'VERIFIED' | 'UNAVAILABLE' | 'BROKEN' | 'UNKNOWN';
  diagnostic?: string;
  suggestedAction?: string;
}

export class JavaEngine {
  /**
   * Inspects Java source code to extract package, classes, and main entrypoint.
   */
  public static inspectSource(sourceCode: string, filename: string): JavaSourceMetadata {
    // Strip comments to prevent false positive matches
    const cleanCode = sourceCode
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    // 1. Package detection: package com.example.app;
    let packageName: string | undefined;
    const packageMatch = cleanCode.match(/package\s+([a-zA-Z0-9_.]+)\s*;/);
    if (packageMatch) {
      packageName = packageMatch[1].trim();
    }

    // 2. Class declarations
    const declaredClasses: string[] = [];
    const classRegex = /(?:public\s+)?(?:final\s+|abstract\s+)?class\s+([a-zA-Z0-9_]+)/g;
    let match: RegExpExecArray | null;
    while ((match = classRegex.exec(cleanCode)) !== null) {
      declaredClasses.push(match[1]);
    }

    // 3. Public class detection
    let publicClassName: string | undefined;
    const publicMatch = cleanCode.match(/public\s+(?:final\s+|abstract\s+)?class\s+([a-zA-Z0-9_]+)/);
    if (publicMatch) {
      publicClassName = publicMatch[1];
    }

    // 4. Main method detection: public static void main(String[] args)
    const hasMainMethod = /public\s+static\s+void\s+main\s*\(\s*String(?:\s*\[\s*\]\s+|\s+\[\s*\]\s*|\s+\.\.\.\s*)([a-zA-Z0-9_]+)\s*\)/.test(cleanCode);

    // 5. Determine main class name
    let mainClassName: string | undefined;
    if (hasMainMethod) {
      // Find which class wraps the main method if multiple classes exist
      if (declaredClasses.length === 1) {
        mainClassName = declaredClasses[0];
      } else if (publicClassName) {
        mainClassName = publicClassName;
      } else {
        // Fallback to class matching filename or first declared
        const base = path.basename(filename, '.java');
        mainClassName = declaredClasses.find((c) => c.toLowerCase() === base.toLowerCase()) || declaredClasses[0];
      }
    } else {
      mainClassName = publicClassName || declaredClasses[0] || path.basename(filename, '.java');
    }

    const fullyQualifiedMainClass = packageName && mainClassName
      ? `${packageName}.${mainClassName}`
      : (mainClassName || path.basename(filename, '.java'));

    return {
      filename,
      packageName,
      declaredClasses,
      publicClassName,
      mainClassName,
      fullyQualifiedMainClass,
      hasMainMethod,
    };
  }

  /**
   * Pre-flight verification check for Java tools (java and javac).
   */
  public static async preflightCheck(): Promise<JavaPreflightResult> {
    const discovery = await discoverRuntime('java');
    const javaTool = discovery.tools['runtime'];
    const javacTool = discovery.tools['compiler'];

    const canCompile = javacTool?.state === 'AVAILABLE' || javacTool?.state === 'VERIFIED';
    const canExecute = javaTool?.state === 'AVAILABLE' || javaTool?.state === 'VERIFIED';

    let diagnostic: string | undefined;
    let suggestedAction: string | undefined;

    if (!canCompile && !canExecute) {
      diagnostic = `Java Development Kit (JDK) is not installed in the execution environment. Both 'java' (runtime) and 'javac' (compiler) are missing.`;
      suggestedAction = `Install a standard JDK 17+ (e.g., Eclipse Adoptium Temurin or OpenJDK) and ensure both 'java' and 'javac' are on PATH.`;
    } else if (!canCompile) {
      diagnostic = `Java runtime 'java' (${javaTool?.version || 'detected'}) is present, but Java compiler 'javac' is missing. Java source files cannot be compiled.`;
      suggestedAction = `Install a full JDK rather than a JRE-only package so that 'javac' is available in your PATH.`;
    } else if (!canExecute) {
      diagnostic = `Java compiler 'javac' (${javacTool?.version || 'detected'}) is present, but Java runtime 'java' is missing.`;
      suggestedAction = `Ensure 'java' executable is available on PATH.`;
    }

    return {
      canCompile,
      canExecute,
      javaVersion: javaTool?.version,
      javacVersion: javacTool?.version,
      compilerStatus: javacTool?.state || 'UNAVAILABLE',
      runtimeStatus: javaTool?.state || 'UNAVAILABLE',
      diagnostic,
      suggestedAction,
    };
  }

  /**
   * Resolves the complete execution plan for a Java target within a workspace directory.
   */
  public static resolveExecutionPlan(
    targetFile: string,
    allFiles: { path: string; content?: string }[],
    workingDirectory: string
  ): JavaExecutionPlan {
    const cleanTarget = targetFile.replace(/^["']|["']$/g, '').replace(/\\/g, '/').replace(/^\.\//, '');
    const targetFileObj = allFiles.find(
      (f) => f.path.replace(/\\/g, '/').toLowerCase() === cleanTarget.toLowerCase()
    );

    let sourceCode = targetFileObj?.content || '';
    if (!sourceCode && fs.existsSync(path.join(workingDirectory, cleanTarget))) {
      try {
        sourceCode = fs.readFileSync(path.join(workingDirectory, cleanTarget), 'utf-8');
      } catch {}
    }

    const metadata = this.inspectSource(sourceCode, cleanTarget);

    // Collect all .java source files in workspace
    const javaFiles = allFiles
      .map((f) => f.path.replace(/\\/g, '/'))
      .filter((p) => p.endsWith('.java') && !p.startsWith('.'));

    // If target is not in javaFiles list (e.g. new file), add it
    if (!javaFiles.some((f) => f.toLowerCase() === cleanTarget.toLowerCase())) {
      javaFiles.unshift(cleanTarget);
    }

    // Determine sources to compile
    // If files share packages or dependencies, compile all relevant .java files
    const sourceFilesToCompile = javaFiles.length > 0 ? javaFiles : [cleanTarget];
    const isMultiFile = sourceFilesToCompile.length > 1;

    // Isolated build directory
    const buildClassesDir = path.posix.join('build', 'classes');

    // Quoting compiler arguments safely
    const quotedSources = sourceFilesToCompile.map((f) => `"${f.replace(/\\/g, '/')}"`).join(' ');

    const compileCommand = `javac -d "${buildClassesDir}" ${quotedSources}`;
    const runCommand = `java -cp "${buildClassesDir}" ${metadata.fullyQualifiedMainClass}`;

    return {
      targetFile: cleanTarget,
      sourceFilesToCompile,
      buildClassesDir,
      fullyQualifiedMainClass: metadata.fullyQualifiedMainClass,
      compileCommand,
      runCommand,
      isMultiFile,
      metadata,
    };
  }
}
