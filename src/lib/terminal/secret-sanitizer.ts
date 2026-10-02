/**
 * Runix Terminal - Secret-Aware Command Sanitizer
 * Automatically detects and redacts passwords, tokens, API keys, and sensitive flags
 * before persisting command history to the database or telemetry.
 */

const SECRET_PATTERNS = [
  // AWS Access Key ID & Secret Access Key
  /(?:AKIA[0-9A-Z]{16})/g,
  /(?:aws_secret_access_key|aws_session_token)\s*=\s*([^\s]+)/gi,

  // OpenAI API Key pattern (sk-...)
  /\b(?:sk-[a-zA-Z0-9]{20,T3BlbkFJ[a-zA-Z0-9]{20,}|sk-proj-[a-zA-Z0-9_-]{30,})\b/g,

  // GitHub Personal Access Token (ghp_..., gho_..., ghu_..., ghs_..., ghr_...)
  /\b(?:gh[pousr]_[A-Za-z0-9_]{36,255})\b/g,

  // Slack tokens (xox[baprs]-...)
  /\b(?:xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24,32})\b/g,

  // Google API keys (AIzaSy...)
  /\b(?:AIzaSy[a-zA-Z0-9_-]{33})\b/g,

  // Private keys
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/gi,
];

export interface SanitizeResult {
  sanitizedCommand: string;
  secretDetected: boolean;
}

export function sanitizeCommand(command: string): SanitizeResult {
  if (!command || typeof command !== 'string') {
    return { sanitizedCommand: '', secretDetected: false };
  }

  let sanitized = command;
  let secretDetected = false;

  // 1. Redact Authorization headers first
  if (/(-H|--header)\s+["']Authorization:\s*([^"']+)["']/gi.test(sanitized)) {
    secretDetected = true;
    sanitized = sanitized.replace(
      /(-H|--header)\s+["']Authorization:\s*([^"']+)["']/gi,
      '$1 "Authorization: [REDACTED_AUTH_HEADER]"'
    );
  }

  // 2. Redact explicit flag patterns like --password secret123
  if (/(?:-p|--password|--pass|--token|--secret|--api-key|--apikey|--key|--auth|--auth-token)[=\s]+(["']?[^\s"']+["']?)/gi.test(sanitized)) {
    secretDetected = true;
    sanitized = sanitized.replace(
      /(?:-p|--password|--pass|--token|--secret|--api-key|--apikey|--key|--auth|--auth-token)[=\s]+(["']?[^\s"']+["']?)/gi,
      (match) => {
        const delimiter = match.includes('=') ? '=' : ' ';
        const flag = match.split(/[=\s]/)[0];
        return `${flag}${delimiter}[REDACTED_SECRET]`;
      }
    );
  }

  // 3. Redact export SECRET_VAR=value
  if (/export\s+([A-Za-z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD|PASS|AUTH|CREDENTIAL|PRIVATE)[A-Za-z0-9_]*)=(?:["']([^"']*)["']|([^\s]*))/gi.test(sanitized)) {
    secretDetected = true;
    sanitized = sanitized.replace(
      /export\s+([A-Za-z0-9_]*(?:SECRET|KEY|TOKEN|PASSWORD|PASS|AUTH|CREDENTIAL|PRIVATE)[A-Za-z0-9_]*)=(?:["']([^"']*)["']|([^\s]*))/gi,
      'export $1="[REDACTED_SECRET]"'
    );
  }

  // 4. URL and Database user:pass embedded in protocols
  if (/(https?|git|ssh|ftp|mongodb(?:\+srv)?|postgres|postgresql|mysql|redis):\/\/([^:]+):([^@]+)@/gi.test(sanitized)) {
    secretDetected = true;
    sanitized = sanitized.replace(
      /(https?|git|ssh|ftp|mongodb(?:\+srv)?|postgres|postgresql|mysql|redis):\/\/([^:]+):([^@]+)@/gi,
      '$1://$2:[REDACTED_PASSWORD]@'
    );
  }

  // 5. Pattern-based redactions (API keys, GitHub tokens, Google keys, etc.)
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(sanitized)) {
      secretDetected = true;
      sanitized = sanitized.replace(pattern, '[REDACTED_KEY]');
    }
  }

  return {
    sanitizedCommand: sanitized,
    secretDetected,
  };
}
