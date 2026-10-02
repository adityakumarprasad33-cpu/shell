export type ExecutionMode = 'local' | 'remote';
export type ShellType = 'bash' | 'zsh' | 'sh' | 'powershell' | 'cmd';
export type SessionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'terminated';

export interface TerminalAccount {
  accountId: string;
  firebaseUserId: string;
  email: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  status: 'active' | 'suspended';
  preferences: TerminalSettings;
}

export interface TerminalSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  theme: 'runix-dark' | 'runix-matrix' | 'runix-amber' | 'runix-cyber' | 'runix-titanium';
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  copyOnSelect: boolean;
  defaultShell: ShellType;
  defaultExecutionMode: ExecutionMode;
  bellSound: boolean;
}

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
  fontSize: 14,
  lineHeight: 1.25,
  theme: 'runix-dark',
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10000,
  copyOnSelect: true,
  defaultShell: 'bash',
  defaultExecutionMode: 'remote',
  bellSound: false,
};

export interface TerminalSession {
  sessionId: string;
  accountId: string;
  title: string;
  shell: ShellType;
  workingDirectory: string;
  executionMode: ExecutionMode;
  status: SessionStatus;
  createdAt: string;
  lastActiveAt: string;
  pid?: number;
  environment?: Record<string, string>;
}

export interface TerminalCommandRecord {
  id: string;
  command: string;
  sessionId: string;
  accountId: string;
  timestamp: string;
  executionMode: ExecutionMode;
  workingDirectory: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  exitCode: number | null;
  durationMs: number;
  secretDetected: boolean;
}

export interface TerminalWorkspace {
  workspaceId: string;
  accountId: string;
  name: string;
  description?: string;
  rootPath: string;
  fileCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceFile {
  fileId?: string;
  folderId?: string;
  workspaceId?: string;
  projectId?: string;
  parentFolderId?: string;
  path: string; // sanitized relative path
  name: string;
  type: 'file' | 'directory';
  size: number;
  createdAt?: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  version?: number;
  contentReference?: string;
  content?: string;
  languageId?: string;
  mimeType?: string;
  fileType?: string;
  isRunnable?: boolean;
}

export interface ReleaseItem {
  releaseId: string;
  version: string;
  platform: 'windows' | 'linux' | 'macos' | 'cli' | 'android';
  architecture: string;
  downloadUrl: string;
  filename: string;
  checksum: string;
  fileSize: string;
  releaseNotes: string;
  publishedAt: string;
  installCommand?: string;
  isAvailable?: boolean;
  status?: 'available' | 'comingSoon' | 'unavailable';
  artifactType?: 'portable' | 'installer' | 'package' | 'script';
}

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  interval: number;
  status: 'pending' | 'authorized' | 'expired';
  accountId?: string;
  token?: string;
}
