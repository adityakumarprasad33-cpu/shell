/**
 * RUNIX LANGUAGE DETECTION SERVICE (CENTRAL SOURCE OF TRUTH)
 * 
 * Strict architectural rule:
 * Every subsystem (Editor, CLI, Builder, Resolver, Execution, Explorer)
 * MUST consume this identical detection service.
 * 
 * No frontend-only, CLI-only, or build-only language detection allowed.
 */

import { RUNIX_LANGUAGE_REGISTRY, LanguageDefinition, identifyLanguage } from './language-registry';
import { RUNTIME_REGISTRY, RuntimeDefinition } from './registry';

export interface LanguageDetectionResult {
  filename: string;
  cleanPath: string;
  fileType: string;
  languageId: string;
  displayName: string;
  editorMode: string;
  runtimeId?: string;
  runtime?: RuntimeDefinition;
  isSpecialManifest: boolean;
  canExecute: boolean;
  category: 'code' | 'config' | 'markup' | 'data' | 'document' | 'binary';
  detectionSource: 'explicit_override' | 'special_filename' | 'extension' | 'fallback_unknown';
  confidence: 'exact' | 'high' | 'fallback';
  capabilities: {
    run: boolean;
    build: boolean;
    debug: boolean;
    test: boolean;
    stdin: boolean;
  };
}

export class LanguageDetectionService {
  /**
   * Cleans quotes, whitespace, and path prefixes from filename
   */
  public static cleanFilename(raw: string): string {
    if (!raw) return '';
    let cleaned = raw.trim();
    // Strip leading/trailing double or single quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
    // Normalize slashes
    cleaned = cleaned.replace(/\\/g, '/');
    // Strip leading ./
    cleaned = cleaned.replace(/^\.\//, '');
    return cleaned;
  }

  /**
   * Authoritative language detection method
   */
  public static detect(
    filenameOrPath: string,
    options?: {
      mimeType?: string;
      explicitOverride?: string;
    }
  ): LanguageDetectionResult {
    const cleanPath = this.cleanFilename(filenameOrPath);
    const basename = cleanPath.split('/').pop() || cleanPath;

    // 1. Explicit override (if provided by user settings)
    if (options?.explicitOverride && RUNIX_LANGUAGE_REGISTRY[options.explicitOverride]) {
      const def = RUNIX_LANGUAGE_REGISTRY[options.explicitOverride];
      const runtime = def.runtimeId ? RUNTIME_REGISTRY[def.runtimeId] : undefined;
      return {
        filename: basename,
        cleanPath,
        fileType: def.type,
        languageId: def.languageId,
        displayName: def.displayName,
        editorMode: def.editorLanguage,
        runtimeId: def.runtimeId,
        runtime,
        isSpecialManifest: Boolean(def.isSpecialManifest),
        canExecute: def.runCapability,
        category: def.category,
        detectionSource: 'explicit_override',
        confidence: 'exact',
        capabilities: {
          run: def.runCapability,
          build: def.buildCapability,
          debug: def.debugCapability,
          test: def.testCapability,
          stdin: def.stdinCapability,
        },
      };
    }

    // 2. Query Central Runix Language Registry
    const def = identifyLanguage(basename);
    const runtime = def.runtimeId ? RUNTIME_REGISTRY[def.runtimeId] : undefined;

    const isSpecial = Boolean(def.isSpecialManifest || def.category === 'config');
    const isUnknown = def.languageId === 'unknown';

    return {
      filename: basename,
      cleanPath,
      fileType: def.type,
      languageId: def.languageId,
      displayName: def.displayName,
      editorMode: def.editorLanguage,
      runtimeId: def.runtimeId,
      runtime,
      isSpecialManifest: isSpecial,
      canExecute: def.runCapability,
      category: def.category,
      detectionSource: isSpecial
        ? 'special_filename'
        : isUnknown
        ? 'fallback_unknown'
        : 'extension',
      confidence: isUnknown ? 'fallback' : 'high',
      capabilities: {
        run: def.runCapability,
        build: def.buildCapability,
        debug: def.debugCapability,
        test: def.testCapability,
        stdin: def.stdinCapability,
      },
    };
  }
}

// Convenience export matching the legacy function signature
export function detectFileLanguage(filenameOrPath: string): LanguageDetectionResult {
  return LanguageDetectionService.detect(filenameOrPath);
}
