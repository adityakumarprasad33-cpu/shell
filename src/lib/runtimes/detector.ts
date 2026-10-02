/**
 * Runix Automatic Language Detection & Extension Registry
 * 
 * Re-exports from the authoritative LanguageDetectionService to guarantee
 * ONE Central Source of Truth across all subsystems.
 */

import { LanguageDetectionService, LanguageDetectionResult } from './language-detection-service';
import { RuntimeDefinition } from './registry';

export type DetectedLanguage = LanguageDetectionResult;

/**
 * Universal file language detector
 */
export function detectFileLanguage(filenameOrPath: string): DetectedLanguage {
  return LanguageDetectionService.detect(filenameOrPath);
}

/**
 * Handle re-detection after a rename (e.g. main.py -> main.js or test.java -> test.lua)
 */
export function reDetectAfterRename(oldPath: string, newPath: string): {
  oldLang: DetectedLanguage;
  newLang: DetectedLanguage;
  hasChanged: boolean;
} {
  const oldLang = detectFileLanguage(oldPath);
  const newLang = detectFileLanguage(newPath);

  return {
    oldLang,
    newLang,
    hasChanged: oldLang.languageId !== newLang.languageId || oldLang.runtimeId !== newLang.runtimeId,
  };
}

export { LanguageDetectionService };
