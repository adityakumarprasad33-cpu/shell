/**
 * Runix Universal File & Folder Icon Registry
 * Single authoritative source of truth for file & folder icon visual metadata.
 * Consumes central LanguageDetectionService without duplicating language mapping rules.
 */

import React from 'react';
import {
  FileCode2,
  FileText,
  FileJson,
  FileArchive,
  FileImage,
  FileAudio,
  FileVideo,
  FileCog,
  FileSpreadsheet,
  File,
  Folder,
  FolderOpen,
  FolderGit2,
  FolderCode,
  FolderCheck,
  FolderCog,
  FolderArchive,
  Box,
  Terminal,
  Cpu,
  Coffee,
  Database,
  Globe,
  Palette,
  Shield,
  Layers,
  Settings,
  Flame,
  Binary,
  Workflow,
  Component,
  LucideIcon,
} from 'lucide-react';
import { LanguageDetectionService } from '../runtimes/language-detection-service';

export interface FileIconDescriptor {
  iconId: string;
  label: string;
  category: 'code' | 'config' | 'manifest' | 'doc' | 'media' | 'archive' | 'data' | 'generic';
  color: string;
  badge?: string;
  IconComponent: LucideIcon;
}

export interface FolderIconDescriptor {
  iconId: string;
  label: string;
  isOpen: boolean;
  color: string;
  IconComponent: LucideIcon;
}

// 1. Exact Special Filenames
const SPECIAL_FILENAMES: Record<string, Omit<FileIconDescriptor, 'IconComponent'> & { IconComponent: LucideIcon }> = {
  dockerfile: {
    iconId: 'docker',
    label: 'Dockerfile',
    category: 'manifest',
    color: '#2496ED',
    badge: '🐳',
    IconComponent: Box,
  },
  makefile: {
    iconId: 'makefile',
    label: 'Makefile',
    category: 'manifest',
    color: '#E06C75',
    badge: '⚙',
    IconComponent: FileCog,
  },
  'cmakelists.txt': {
    iconId: 'cmake',
    label: 'CMakeLists',
    category: 'manifest',
    color: '#064F8C',
    badge: '⚙',
    IconComponent: FileCog,
  },
  jenkinsfile: {
    iconId: 'jenkins',
    label: 'Jenkinsfile',
    category: 'manifest',
    color: '#D33833',
    IconComponent: Workflow,
  },
  gemfile: {
    iconId: 'gemfile',
    label: 'Gemfile',
    category: 'manifest',
    color: '#CC342D',
    IconComponent: Flame,
  },
  rakefile: {
    iconId: 'rakefile',
    label: 'Rakefile',
    category: 'manifest',
    color: '#CC342D',
    IconComponent: Flame,
  },
  procfile: {
    iconId: 'procfile',
    label: 'Procfile',
    category: 'manifest',
    color: '#7B42BC',
    IconComponent: FileCog,
  },
  vagrantfile: {
    iconId: 'vagrantfile',
    label: 'Vagrantfile',
    category: 'manifest',
    color: '#1868F2',
    IconComponent: Box,
  },
  brewfile: {
    iconId: 'brewfile',
    label: 'Brewfile',
    category: 'manifest',
    color: '#D47E20',
    IconComponent: Box,
  },
  justfile: {
    iconId: 'justfile',
    label: 'Justfile',
    category: 'manifest',
    color: '#555555',
    IconComponent: FileCog,
  },
};

// 2. Special Manifests / Configs
const MANIFEST_FILENAMES: Record<string, Omit<FileIconDescriptor, 'IconComponent'> & { IconComponent: LucideIcon }> = {
  'package.json': {
    iconId: 'npm',
    label: 'NPM Package',
    category: 'manifest',
    color: '#CB3837',
    badge: '📦',
    IconComponent: FileJson,
  },
  'package-lock.json': {
    iconId: 'npm-lock',
    label: 'NPM Lock',
    category: 'manifest',
    color: '#888888',
    IconComponent: FileJson,
  },
  'pnpm-lock.yaml': {
    iconId: 'pnpm-lock',
    label: 'PNPM Lock',
    category: 'manifest',
    color: '#F69220',
    IconComponent: FileCog,
  },
  'yarn.lock': {
    iconId: 'yarn-lock',
    label: 'Yarn Lock',
    category: 'manifest',
    color: '#2C8EBB',
    IconComponent: FileCog,
  },
  'cargo.toml': {
    iconId: 'cargo',
    label: 'Cargo Manifest',
    category: 'manifest',
    color: '#DEA584',
    badge: '🦀',
    IconComponent: FileCog,
  },
  'go.mod': {
    iconId: 'go-mod',
    label: 'Go Module',
    category: 'manifest',
    color: '#00ADD8',
    IconComponent: FileCode2,
  },
  'go.sum': {
    iconId: 'go-sum',
    label: 'Go Sum',
    category: 'manifest',
    color: '#777777',
    IconComponent: FileCode2,
  },
  'pom.xml': {
    iconId: 'maven',
    label: 'Maven POM',
    category: 'manifest',
    color: '#C71A36',
    IconComponent: FileCode2,
  },
  'build.gradle': {
    iconId: 'gradle',
    label: 'Gradle Build',
    category: 'manifest',
    color: '#02303A',
    IconComponent: FileCog,
  },
  'requirements.txt': {
    iconId: 'pip',
    label: 'Python Requirements',
    category: 'manifest',
    color: '#3776AB',
    IconComponent: FileText,
  },
  'pyproject.toml': {
    iconId: 'poetry',
    label: 'Python Project',
    category: 'manifest',
    color: '#3776AB',
    IconComponent: FileCog,
  },
  'pubspec.yaml': {
    iconId: 'pubspec',
    label: 'Dart Pubspec',
    category: 'manifest',
    color: '#0175C2',
    IconComponent: FileCog,
  },
  'tsconfig.json': {
    iconId: 'tsconfig',
    label: 'TypeScript Config',
    category: 'config',
    color: '#3178C6',
    badge: 'TS',
    IconComponent: FileJson,
  },
  'runix-command.txt': {
    iconId: 'runix-command',
    label: 'Runix Command Reference',
    category: 'doc',
    color: '#10B981',
    badge: '⚡',
    IconComponent: Terminal,
  },
};

// 3. Central File Extension Registry
const EXTENSION_ICONS: Record<string, Omit<FileIconDescriptor, 'IconComponent'> & { IconComponent: LucideIcon }> = {
  // Programming languages
  py: { iconId: 'python', label: 'Python', category: 'code', color: '#3776AB', IconComponent: FileCode2 },
  pyw: { iconId: 'python', label: 'Python', category: 'code', color: '#3776AB', IconComponent: FileCode2 },
  c: { iconId: 'c', label: 'C Source', category: 'code', color: '#555555', IconComponent: Cpu },
  h: { iconId: 'c-header', label: 'C/C++ Header', category: 'code', color: '#A8B9CC', IconComponent: Cpu },
  cpp: { iconId: 'cpp', label: 'C++', category: 'code', color: '#00599C', IconComponent: Cpu },
  cc: { iconId: 'cpp', label: 'C++', category: 'code', color: '#00599C', IconComponent: Cpu },
  cxx: { iconId: 'cpp', label: 'C++', category: 'code', color: '#00599C', IconComponent: Cpu },
  hpp: { iconId: 'cpp-header', label: 'C++ Header', category: 'code', color: '#00599C', IconComponent: Cpu },
  java: { iconId: 'java', label: 'Java', category: 'code', color: '#ED8B00', IconComponent: Coffee },
  class: { iconId: 'java-class', label: 'Java Bytecode', category: 'code', color: '#777777', IconComponent: Binary },
  jar: { iconId: 'java-jar', label: 'Java Archive', category: 'archive', color: '#ED8B00', IconComponent: FileArchive },
  lua: { iconId: 'lua', label: 'Lua', category: 'code', color: '#000080', IconComponent: FileCode2 },
  rs: { iconId: 'rust', label: 'Rust', category: 'code', color: '#DEA584', IconComponent: FileCode2 },
  go: { iconId: 'go', label: 'Go', category: 'code', color: '#00ADD8', IconComponent: FileCode2 },
  js: { iconId: 'javascript', label: 'JavaScript', category: 'code', color: '#F7DF1E', IconComponent: FileCode2 },
  mjs: { iconId: 'javascript', label: 'JavaScript Module', category: 'code', color: '#F7DF1E', IconComponent: FileCode2 },
  cjs: { iconId: 'javascript', label: 'JavaScript CommonJS', category: 'code', color: '#F7DF1E', IconComponent: FileCode2 },
  jsx: { iconId: 'react-js', label: 'React JSX', category: 'code', color: '#61DAFB', IconComponent: FileCode2 },
  ts: { iconId: 'typescript', label: 'TypeScript', category: 'code', color: '#3178C6', IconComponent: FileCode2 },
  tsx: { iconId: 'react-ts', label: 'React TSX', category: 'code', color: '#61DAFB', IconComponent: FileCode2 },
  kt: { iconId: 'kotlin', label: 'Kotlin', category: 'code', color: '#7F52FF', IconComponent: FileCode2 },
  kts: { iconId: 'kotlin-script', label: 'Kotlin Script', category: 'code', color: '#7F52FF', IconComponent: FileCode2 },
  swift: { iconId: 'swift', label: 'Swift', category: 'code', color: '#F05138', IconComponent: FileCode2 },
  dart: { iconId: 'dart', label: 'Dart', category: 'code', color: '#0175C2', IconComponent: FileCode2 },
  cs: { iconId: 'csharp', label: 'C#', category: 'code', color: '#239120', IconComponent: FileCode2 },
  php: { iconId: 'php', label: 'PHP', category: 'code', color: '#777BB4', IconComponent: FileCode2 },
  rb: { iconId: 'ruby', label: 'Ruby', category: 'code', color: '#CC342D', IconComponent: Flame },
  sh: { iconId: 'bash', label: 'Shell Script', category: 'code', color: '#4EAA25', IconComponent: Terminal },
  bash: { iconId: 'bash', label: 'Bash Script', category: 'code', color: '#4EAA25', IconComponent: Terminal },
  zsh: { iconId: 'bash', label: 'Zsh Script', category: 'code', color: '#4EAA25', IconComponent: Terminal },
  ps1: { iconId: 'powershell', label: 'PowerShell', category: 'code', color: '#5391FE', IconComponent: Terminal },
  sql: { iconId: 'sql', label: 'SQL Query', category: 'data', color: '#E38C00', IconComponent: Database },

  // Web & Styles
  html: { iconId: 'html', label: 'HTML', category: 'code', color: '#E34F26', IconComponent: Globe },
  htm: { iconId: 'html', label: 'HTML', category: 'code', color: '#E34F26', IconComponent: Globe },
  css: { iconId: 'css', label: 'CSS', category: 'code', color: '#1572B6', IconComponent: Palette },
  scss: { iconId: 'sass', label: 'SCSS', category: 'code', color: '#CC6699', IconComponent: Palette },
  sass: { iconId: 'sass', label: 'SASS', category: 'code', color: '#CC6699', IconComponent: Palette },
  less: { iconId: 'less', label: 'LESS', category: 'code', color: '#1D365D', IconComponent: Palette },

  // Data & Config
  json: { iconId: 'json', label: 'JSON', category: 'data', color: '#CBCB41', IconComponent: FileJson },
  yaml: { iconId: 'yaml', label: 'YAML', category: 'config', color: '#CB171E', IconComponent: FileCog },
  yml: { iconId: 'yaml', label: 'YAML', category: 'config', color: '#CB171E', IconComponent: FileCog },
  toml: { iconId: 'toml', label: 'TOML', category: 'config', color: '#9C4221', IconComponent: FileCog },
  xml: { iconId: 'xml', label: 'XML', category: 'data', color: '#E34F26', IconComponent: FileCode2 },
  ini: { iconId: 'ini', label: 'INI Config', category: 'config', color: '#6D8086', IconComponent: FileCog },
  conf: { iconId: 'config', label: 'Config', category: 'config', color: '#6D8086', IconComponent: FileCog },
  env: { iconId: 'env', label: 'Environment', category: 'config', color: '#ECD53F', IconComponent: Shield },

  // Docs
  md: { iconId: 'markdown', label: 'Markdown', category: 'doc', color: '#083FA1', IconComponent: FileText },
  markdown: { iconId: 'markdown', label: 'Markdown', category: 'doc', color: '#083FA1', IconComponent: FileText },
  txt: { iconId: 'plaintext', label: 'Plain Text', category: 'doc', color: '#888888', IconComponent: FileText },
  csv: { iconId: 'csv', label: 'CSV Data', category: 'data', color: '#217346', IconComponent: FileSpreadsheet },
  tsv: { iconId: 'tsv', label: 'TSV Data', category: 'data', color: '#217346', IconComponent: FileSpreadsheet },

  // Media
  png: { iconId: 'image', label: 'PNG Image', category: 'media', color: '#29B6F6', IconComponent: FileImage },
  jpg: { iconId: 'image', label: 'JPEG Image', category: 'media', color: '#29B6F6', IconComponent: FileImage },
  jpeg: { iconId: 'image', label: 'JPEG Image', category: 'media', color: '#29B6F6', IconComponent: FileImage },
  gif: { iconId: 'image', label: 'GIF Image', category: 'media', color: '#29B6F6', IconComponent: FileImage },
  webp: { iconId: 'image', label: 'WEBP Image', category: 'media', color: '#29B6F6', IconComponent: FileImage },
  svg: { iconId: 'image-vector', label: 'SVG Vector', category: 'media', color: '#FFB300', IconComponent: FileImage },
  ico: { iconId: 'image', label: 'Icon', category: 'media', color: '#29B6F6', IconComponent: FileImage },

  // Audio / Video
  mp3: { iconId: 'audio', label: 'MP3 Audio', category: 'media', color: '#E91E63', IconComponent: FileAudio },
  wav: { iconId: 'audio', label: 'WAV Audio', category: 'media', color: '#E91E63', IconComponent: FileAudio },
  mp4: { iconId: 'video', label: 'MP4 Video', category: 'media', color: '#9C27B0', IconComponent: FileVideo },
  webm: { iconId: 'video', label: 'WEBM Video', category: 'media', color: '#9C27B0', IconComponent: FileVideo },
  mov: { iconId: 'video', label: 'QuickTime Video', category: 'media', color: '#9C27B0', IconComponent: FileVideo },

  // Archives
  zip: { iconId: 'archive', label: 'ZIP Archive', category: 'archive', color: '#FFCA28', IconComponent: FileArchive },
  tar: { iconId: 'archive', label: 'TAR Archive', category: 'archive', color: '#FFCA28', IconComponent: FileArchive },
  gz: { iconId: 'archive', label: 'GZip Archive', category: 'archive', color: '#FFCA28', IconComponent: FileArchive },
  rar: { iconId: 'archive', label: 'RAR Archive', category: 'archive', color: '#FFCA28', IconComponent: FileArchive },
  '7z': { iconId: 'archive', label: '7-Zip Archive', category: 'archive', color: '#FFCA28', IconComponent: FileArchive },
};

// Generic File Fallback
const GENERIC_FILE: FileIconDescriptor = {
  iconId: 'unknown',
  label: 'File',
  category: 'generic',
  color: '#8A99A8',
  IconComponent: File,
};

/**
 * RunixFileIconRegistry
 * Resolves file icons with strict priority:
 * 1. Special filename (Dockerfile, Makefile, etc.)
 * 2. Special manifest/config (package.json, Cargo.toml, etc.)
 * 3. Environment files (.env*)
 * 4. Extension-based mapping (LanguageDetectionService integration)
 * 5. Generic fallback
 */
export class RunixFileIconRegistry {
  public static resolve(filename: string): FileIconDescriptor {
    if (!filename) return GENERIC_FILE;
    const lower = filename.trim().toLowerCase();
    const baseName = lower.includes('/') ? lower.substring(lower.lastIndexOf('/') + 1) : lower;

    // 1. Exact Special Files
    if (SPECIAL_FILENAMES[baseName]) {
      return SPECIAL_FILENAMES[baseName];
    }

    // 2. Special Manifests
    if (MANIFEST_FILENAMES[baseName]) {
      return MANIFEST_FILENAMES[baseName];
    }

    // 3. Dotfiles (.env, .gitignore, etc.)
    if (baseName === '.env' || baseName.startsWith('.env.')) {
      return EXTENSION_ICONS['env'];
    }
    if (baseName === '.gitignore' || baseName === '.gitattributes') {
      return {
        iconId: 'git',
        label: 'Git Config',
        category: 'config',
        color: '#F05032',
        IconComponent: FileCog,
      };
    }

    // 4. File Extension Resolution
    const ext = baseName.includes('.') ? baseName.substring(baseName.lastIndexOf('.') + 1) : '';
    if (ext && EXTENSION_ICONS[ext]) {
      return EXTENSION_ICONS[ext];
    }

    // 5. Central Language Detection Fallback
    const detected = LanguageDetectionService.detect(filename);
    if (detected.languageId && detected.languageId !== 'unknown' && detected.languageId !== 'plaintext') {
      // Map detected languageId to extension icon if available
      const langToExt: Record<string, string> = {
        python: 'py',
        cpp: 'cpp',
        c: 'c',
        java: 'java',
        lua: 'lua',
        rust: 'rs',
        go: 'go',
        javascript: 'js',
        typescript: 'ts',
        kotlin: 'kt',
        swift: 'swift',
        dart: 'dart',
        csharp: 'cs',
        php: 'php',
        ruby: 'rb',
        bash: 'sh',
        sql: 'sql',
        html: 'html',
        css: 'css',
        markdown: 'md',
        json: 'json',
        yaml: 'yaml',
      };
      const mapped = langToExt[detected.languageId];
      if (mapped && EXTENSION_ICONS[mapped]) {
        return EXTENSION_ICONS[mapped];
      }
    }

    return GENERIC_FILE;
  }
}

// Special Folder Names Registry
const SPECIAL_FOLDERS: Record<string, { iconId: string; label: string; color: string; IconComponent: LucideIcon }> = {
  src: { iconId: 'folder-src', label: 'Source', color: '#315EF7', IconComponent: FolderCode },
  app: { iconId: 'folder-app', label: 'Application', color: '#10B981', IconComponent: Layers },
  components: { iconId: 'folder-components', label: 'Components', color: '#8B5CF6', IconComponent: Component },
  assets: { iconId: 'folder-assets', label: 'Assets', color: '#F59E0B', IconComponent: Box },
  public: { iconId: 'folder-public', label: 'Public Assets', color: '#06B6D4', IconComponent: Globe },
  tests: { iconId: 'folder-tests', label: 'Tests', color: '#EC4899', IconComponent: FolderCheck },
  test: { iconId: 'folder-tests', label: 'Tests', color: '#EC4899', IconComponent: FolderCheck },
  docs: { iconId: 'folder-docs', label: 'Documentation', color: '#3B82F6', IconComponent: FileText },
  scripts: { iconId: 'folder-scripts', label: 'Automation Scripts', color: '#F97316', IconComponent: FolderCog },
  config: { iconId: 'folder-config', label: 'Configuration', color: '#64748B', IconComponent: Settings },
  build: { iconId: 'folder-build', label: 'Build Output', color: '#EF4444', IconComponent: FolderArchive },
  dist: { iconId: 'folder-build', label: 'Distribution', color: '#EF4444', IconComponent: FolderArchive },
  out: { iconId: 'folder-build', label: 'Output', color: '#EF4444', IconComponent: FolderArchive },
  target: { iconId: 'folder-build', label: 'Target', color: '#EF4444', IconComponent: FolderArchive },
  node_modules: { iconId: 'folder-node_modules', label: 'Dependencies', color: '#71717A', IconComponent: Box },
  '.git': { iconId: 'folder-git', label: 'Git Directory', color: '#F05032', IconComponent: FolderGit2 },
  '.github': { iconId: 'folder-github', label: 'GitHub Workflows', color: '#A855F7', IconComponent: Workflow },
  '.vscode': { iconId: 'folder-vscode', label: 'VS Code Config', color: '#007ACC', IconComponent: Settings },
  '.idea': { iconId: 'folder-idea', label: 'IDE Config', color: '#000000', IconComponent: Settings },
};

/**
 * RunixFolderIconRegistry
 * Resolves folder visual state (Open vs Closed) and specialized folder identities.
 */
export class RunixFolderIconRegistry {
  public static resolve(folderName: string, isOpen: boolean = false): FolderIconDescriptor {
    if (!folderName) {
      return {
        iconId: 'folder-default',
        label: 'Folder',
        isOpen,
        color: '#60A5FA',
        IconComponent: isOpen ? FolderOpen : Folder,
      };
    }

    const lower = folderName.trim().toLowerCase();
    const baseName = lower.includes('/') ? lower.substring(lower.lastIndexOf('/') + 1) : lower;

    if (SPECIAL_FOLDERS[baseName]) {
      const spec = SPECIAL_FOLDERS[baseName];
      return {
        iconId: spec.iconId,
        label: spec.label,
        isOpen,
        color: spec.color,
        IconComponent: isOpen ? FolderOpen : spec.IconComponent,
      };
    }

    return {
      iconId: 'folder-default',
      label: 'Folder',
      isOpen,
      color: '#60A5FA',
      IconComponent: isOpen ? FolderOpen : Folder,
    };
  }
}
