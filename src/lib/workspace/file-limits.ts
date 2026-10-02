/**
 * RUNIX FILE LIMITS & VALIDATION ENGINE
 * 
 * Strict architectural rule:
 * Limits are verified server-side before persistence.
 * No silent truncation. Explicit error codes returned.
 * 
 * MAX FILE SIZE: 0.8 MB (819,200 bytes)
 * MAX LINE COUNT: 5,000 lines
 * MAX WORD COUNT: 200,000 words
 */

export const MAX_FILE_SIZE_BYTES = 800 * 1024; // 819,200 bytes (0.8 MB)
export const MAX_FILE_LINES = 5000;
export const MAX_FILE_WORDS = 200000;

export type FileLimitErrorCode = 
  | 'FILE_SIZE_LIMIT_EXCEEDED'
  | 'LINE_LIMIT_EXCEEDED'
  | 'WORD_LIMIT_EXCEEDED';

export interface FileLimitValidationResult {
  valid: boolean;
  error?: FileLimitErrorCode;
  message?: string;
  sizeBytes: number;
  lineCount: number;
  wordCount: number;
}

export function countLines(text: string): number {
  if (!text) return 0;
  // Standard POSIX / cross-platform newline handling
  return text.split(/\r\n|\r|\n/).length;
}

export function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/**
 * Validates text or buffer against all Runix limits.
 * All limits must pass simultaneously.
 */
export function validateFileLimits(content: string | Buffer): FileLimitValidationResult {
  const sizeBytes = typeof content === 'string' ? Buffer.byteLength(content, 'utf-8') : content.length;
  const text = typeof content === 'string' ? content : content.toString('utf-8');
  
  const lineCount = countLines(text);
  const wordCount = countWords(text);

  // Check 1: File Size Limit (0.8 MB)
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'FILE_SIZE_LIMIT_EXCEEDED',
      message: `File size ${sizeBytes} bytes exceeds maximum allowed limit of ${MAX_FILE_SIZE_BYTES} bytes (0.8 MB)`,
      sizeBytes,
      lineCount,
      wordCount,
    };
  }

  // Check 2: Line Count Limit (5,000 lines)
  if (lineCount > MAX_FILE_LINES) {
    return {
      valid: false,
      error: 'LINE_LIMIT_EXCEEDED',
      message: `File contains ${lineCount} lines, which exceeds the maximum limit of ${MAX_FILE_LINES} lines`,
      sizeBytes,
      lineCount,
      wordCount,
    };
  }

  // Check 3: Word Count Limit (200,000 words)
  if (wordCount > MAX_FILE_WORDS) {
    return {
      valid: false,
      error: 'WORD_LIMIT_EXCEEDED',
      message: `File contains ${wordCount} words, which exceeds the maximum limit of ${MAX_FILE_WORDS} words`,
      sizeBytes,
      lineCount,
      wordCount,
    };
  }

  return {
    valid: true,
    sizeBytes,
    lineCount,
    wordCount,
  };
}
