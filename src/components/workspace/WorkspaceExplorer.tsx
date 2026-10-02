'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileJson,
  FilePlus,
  FolderPlus,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  File,
  Paperclip,
  Check,
  AlertCircle,
  Edit3,
  PanelLeftClose,
} from 'lucide-react';
import { WorkspaceFile, TerminalWorkspace } from '@/lib/types/terminal';
import { useAuth } from '@/lib/auth-context';
import { identifyLanguage } from '@/lib/runtimes/language-registry';
import { safeFetchJson } from '@/lib/safe-json';
import { FileIcon } from './FileIcon';
import { FolderIcon } from './FolderIcon';
import { FirestoreClientService } from '@/lib/workspace/firestore-client-service';

interface WorkspaceExplorerProps {
  workspace: TerminalWorkspace;
  onOpenFile: (file: WorkspaceFile) => void;
  activeFilePath?: string;
  refreshTrigger?: number;
  onCollapse?: () => void;
  className?: string;
}

interface TreeNode {
  file: WorkspaceFile;
  depth: number;
  hasChildren: boolean;
}

export function WorkspaceExplorer({
  workspace,
  onOpenFile,
  activeFilePath,
  refreshTrigger,
  onCollapse,
  className = '',
}: WorkspaceExplorerProps) {
  const { user, terminalAccount } = useAuth();
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  const [isCreatingFile, setIsCreatingFile] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState(false);
  const [draggedItem, setDraggedItem] = useState<WorkspaceFile | null>(null);
  const [dropTargetFolder, setDropTargetFolder] = useState<string | null>(null);

  // Inline rename state
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);

  // Fetch files in workspace
  const loadFiles = useCallback(async () => {
    if (!workspace) return;
    setLoading(true);
    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');

      // 1. Authoritative direct Firestore query when user is authenticated
      if (user && accountId !== 'anonymous_dev') {
        try {
          const directFiles = await FirestoreClientService.listWorkspaceItems(
            accountId,
            workspace.workspaceId
          );
          if (directFiles && directFiles.length > 0) {
            setFiles(directFiles);
            setLoading(false);
            return;
          }
        } catch (fErr) {
          console.warn('Direct FirestoreClientService query notice:', fErr);
        }
      }

      // 2. Server API fallback query
      const result = await safeFetchJson<{ files: WorkspaceFile[] }>(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/files?accountId=${encodeURIComponent(accountId)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (result.ok && result.data?.files) {
        setFiles(result.data.files);
      }
    } catch (err) {
      console.error('Failed to load workspace files:', err);
    } finally {
      setLoading(false);
    }
  }, [workspace, user, terminalAccount?.accountId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles, refreshTrigger]);

  // Compute hierarchical tree nodes respecting collapsed state
  const treeNodes = useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.path.localeCompare(b.path);
    });

    const childrenMap = new Map<string, WorkspaceFile[]>();
    for (const f of sorted) {
      const parent = f.path.includes('/')
        ? f.path.substring(0, f.path.lastIndexOf('/'))
        : '';
      if (!childrenMap.has(parent)) {
        childrenMap.set(parent, []);
      }
      childrenMap.get(parent)!.push(f);
    }

    const nodes: TreeNode[] = [];
    function traverse(parentPath: string, depth: number) {
      const children = childrenMap.get(parentPath) || [];
      for (const child of children) {
        const isDir = child.type === 'directory';
        const hasChildren = isDir && (childrenMap.get(child.path)?.length ?? 0) > 0;
        nodes.push({
          file: child,
          depth,
          hasChildren,
        });

        if (isDir && !collapsedFolders.has(child.path)) {
          traverse(child.path, depth + 1);
        }
      }
    }

    traverse('', 0);
    return nodes;
  }, [files, collapsedFolders]);

  // Create new file or folder inside the selected folder
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newItemName.trim();
    if (!name) return;

    const fullPath = selectedFolder ? `${selectedFolder}/${name}` : name;

    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');

      let directCreated: WorkspaceFile | null = null;
      if (user && accountId !== 'anonymous_dev') {
        try {
          if (isCreatingFolder) {
            directCreated = await FirestoreClientService.createFolder(
              accountId,
              workspace.workspaceId,
              fullPath
            );
          } else {
            directCreated = await FirestoreClientService.saveFile(
              accountId,
              workspace.workspaceId,
              fullPath,
              ''
            );
          }
        } catch (fErr) {
          console.warn('Direct Firestore create notice:', fErr);
        }
      }

      const result = await safeFetchJson<{ file?: WorkspaceFile; error?: string; message?: string }>(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/files`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            accountId,
            path: fullPath,
            isDirectory: isCreatingFolder,
            content: '',
          }),
        }
      );

      if (directCreated || (result.ok && result.data)) {
        setNewItemName('');
        setIsCreatingFile(false);
        setIsCreatingFolder(false);

        // Make sure parent folder is expanded
        if (selectedFolder) {
          setCollapsedFolders((prev) => {
            const next = new Set(prev);
            next.delete(selectedFolder);
            return next;
          });
        }

        await loadFiles();

        const fileToOpen = directCreated || result.data?.file;
        if (fileToOpen && fileToOpen.type === 'file') {
          onOpenFile(fileToOpen);
        }
      } else {
        alert(result.error || result.data?.message || 'Failed to create item');
      }
    } catch (err) {
      console.error('Item creation error:', err);
    }
  };

  // Inline rename handler
  const handleRenameItem = async (file: WorkspaceFile, newNameInput: string) => {
    const cleanNewName = newNameInput.trim();
    if (!cleanNewName || cleanNewName === file.name) {
      setRenamingPath(null);
      return;
    }

    const parentDir = file.path.includes('/')
      ? file.path.substring(0, file.path.lastIndexOf('/'))
      : '';
    const newPath = parentDir ? `${parentDir}/${cleanNewName}` : cleanNewName;

    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');

      let directRenamed: WorkspaceFile | null = null;
      if (user && accountId !== 'anonymous_dev') {
        try {
          if (file.type === 'directory') {
            const rRes = await FirestoreClientService.renameFolder(
              accountId,
              workspace.workspaceId,
              file.path,
              newPath
            );
            if (rRes.success && rRes.item) directRenamed = rRes.item;
          } else {
            const rRes = await FirestoreClientService.renameFile(
              accountId,
              workspace.workspaceId,
              file.path,
              newPath
            );
            if (rRes.success && rRes.item) directRenamed = rRes.item;
          }
        } catch (fErr) {
          console.warn('Direct Firestore rename notice:', fErr);
        }
      }

      const result = await safeFetchJson<{ item?: WorkspaceFile; error?: string }>(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/files`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: 'rename',
            accountId,
            oldPath: file.path,
            newPath,
            isDirectory: file.type === 'directory',
          }),
        }
      );

      if (directRenamed || result.ok) {
        await loadFiles();
        const finalItem = directRenamed || result.data?.item;
        if (file.type === 'file' && activeFilePath === file.path && finalItem) {
          onOpenFile(finalItem);
        }
      } else {
        alert(result.error || 'Failed to rename item');
      }
    } catch (err: any) {
      console.error('Rename error:', err);
      alert('Error renaming item');
    } finally {
      setRenamingPath(null);
    }
  };

  // Real VS Code-style Drag & Drop Move with validation
  const handleMoveItem = async (destinationFolder: string) => {
    if (!draggedItem) return;
    const sourcePath = draggedItem.path;

    // Client validation: prevent moving into current parent
    const currentParent = sourcePath.includes('/')
      ? sourcePath.substring(0, sourcePath.lastIndexOf('/'))
      : '';
    if (currentParent === destinationFolder || sourcePath === destinationFolder) {
      setDraggedItem(null);
      setDropTargetFolder(null);
      return;
    }

    // Client validation: prevent moving directory into itself or descendant
    if (draggedItem.type === 'directory') {
      if (destinationFolder === sourcePath || destinationFolder.startsWith(sourcePath + '/')) {
        alert('Cannot move a directory into itself or a descendant subdirectory');
        setDraggedItem(null);
        setDropTargetFolder(null);
        return;
      }
    }

    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');

      let directMoved = false;
      if (user && accountId !== 'anonymous_dev') {
        try {
          const mRes = await FirestoreClientService.moveItem(
            accountId,
            workspace.workspaceId,
            sourcePath,
            destinationFolder
          );
          if (mRes.success) directMoved = true;
        } catch (fErr) {
          console.warn('Direct Firestore move notice:', fErr);
        }
      }

      const result = await safeFetchJson<{ error?: string }>(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/files`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action: 'move',
            accountId,
            sourcePath,
            destinationFolder,
          }),
        }
      );

      if (directMoved || result.ok) {
        // Expand destination folder so moved item is visible
        if (destinationFolder) {
          setCollapsedFolders((prev) => {
            const next = new Set(prev);
            next.delete(destinationFolder);
            return next;
          });
        }
        await loadFiles();
      } else {
        alert(result.error || 'Failed to move item');
      }
    } catch (err: any) {
      console.error('Move error:', err);
      alert('Error moving item');
    } finally {
      setDraggedItem(null);
      setDropTargetFolder(null);
    }
  };

  // Upload attached files
  const handleUploadFiles = async (selectedFiles: FileList | null) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    setIsUploading(true);
    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');
      const formData = new FormData();
      formData.append('accountId', accountId);

      for (let i = 0; i < selectedFiles.length; i++) {
        formData.append('files', selectedFiles[i]);
      }

      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/files`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );

      if (res.ok) {
        await loadFiles();
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Import ZIP archive
  const handleImportZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');
      const formData = new FormData();
      formData.append('file', file);
      formData.append('accountId', accountId);

      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/import?accountId=${encodeURIComponent(accountId)}`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );

      if (res.ok) {
        await loadFiles();
      }
    } catch (err) {
      console.error('ZIP Import error:', err);
    } finally {
      setIsUploading(false);
      if (zipInputRef.current) zipInputRef.current.value = '';
    }
  };

  // Delete file or folder
  const handleDeleteItem = async (filePath: string, isDirectory: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    const typeLabel = isDirectory ? 'directory' : 'file';
    if (!confirm(`Permanently delete ${typeLabel} "${filePath}"?`)) return;

    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');

      if (user && accountId !== 'anonymous_dev') {
        try {
          await FirestoreClientService.deleteItem(
            accountId,
            workspace.workspaceId,
            filePath,
            true
          );
        } catch (fErr) {
          console.warn('Direct Firestore delete notice:', fErr);
        }
      }

      await fetch(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/files?path=${encodeURIComponent(
          filePath
        )}&recursive=true&accountId=${encodeURIComponent(accountId)}`,
        {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      await loadFiles();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Export workspace as ZIP
  const handleExportZip = async () => {
    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');
      const res = await fetch(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/export?accountId=${encodeURIComponent(accountId)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${workspace.name}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  // Download individual file
  const handleDownloadFile = async (file: WorkspaceFile, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = user ? await user.getIdToken() : '';
      const accountId = terminalAccount?.accountId || (user ? user.uid : 'anonymous_dev');
      const result = await safeFetchJson<{ file?: WorkspaceFile }>(
        `/api/workspaces/${encodeURIComponent(workspace.workspaceId)}/files?path=${encodeURIComponent(file.path)}&accountId=${encodeURIComponent(accountId)}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (result.ok && result.data?.file) {
        const content = result.data.file.content || '';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const toggleFolder = (folderPath: string, e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  return (
    <aside
      className={`bg-[#0E1117] border-r border-white/10 flex flex-col select-none shrink-0 h-full transition-colors ${
        dragOver ? 'border-[#315EF7] bg-[#315EF7]/5' : ''
      } ${className || 'w-64'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleUploadFiles(e.dataTransfer.files);
        }
      }}
    >
      {/* Workspace Header & Action toolbar */}
      <div className="h-10 px-3 border-b border-white/10 flex items-center justify-between text-xs text-zinc-300 font-medium bg-[#131722]">
        <div className="flex items-center gap-1.5 truncate">
          <FolderOpen className="w-3.5 h-3.5 text-[#315EF7] shrink-0" />
          <span className="font-mono truncate text-white">{workspace.name}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => {
              setIsCreatingFile(true);
              setIsCreatingFolder(false);
              setNewItemName('');
            }}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title={selectedFolder ? `New File inside /${selectedFolder}` : 'New File in root'}
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => {
              setIsCreatingFolder(true);
              setIsCreatingFile(false);
              setNewItemName('');
            }}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title={selectedFolder ? `New Folder inside /${selectedFolder}` : 'New Folder in root'}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Attach / Upload Files"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => handleUploadFiles(e.target.files)}
            multiple
            className="hidden"
          />
          <button
            onClick={() => zipInputRef.current?.click()}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Import Project Archive (.zip)"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>
          <input
            type="file"
            ref={zipInputRef}
            onChange={handleImportZip}
            accept=".zip"
            className="hidden"
          />
          <button
            onClick={handleExportZip}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Export Workspace (.zip)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={loadFiles}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Refresh Files"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onCollapse && (
            <button
              onClick={onCollapse}
              className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-white transition-colors ml-0.5"
              title="Collapse Files Panel"
              id="collapse-files-panel-btn"
            >
              <PanelLeftClose className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Selected folder destination context badge */}
      {selectedFolder && (
        <div className="px-3 py-1 bg-white/[0.03] border-b border-white/5 flex items-center justify-between text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[#315EF7]">dir:</span>
            <span className="text-white truncate">/{selectedFolder}</span>
          </div>
          <button
            onClick={() => setSelectedFolder('')}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 ml-1 shrink-0"
            title="Switch destination back to workspace root"
          >
            [Root /]
          </button>
        </div>
      )}

      {/* New file or folder input form */}
      {(isCreatingFile || isCreatingFolder) && (
        <form onSubmit={handleCreateItem} className="p-2 border-b border-white/10 bg-[#161B26]">
          <div className="flex items-center justify-between mb-1.5 text-[11px] text-[#315EF7] font-mono">
            <div className="flex items-center gap-1.5">
              {isCreatingFolder ? <FolderPlus className="w-3.5 h-3.5" /> : <FilePlus className="w-3.5 h-3.5" />}
              <span>{isCreatingFolder ? 'New Directory' : 'New File'}</span>
            </div>
            <span className="text-[10px] text-zinc-500">
              in: {selectedFolder ? `/${selectedFolder}` : '/ (root)'}
            </span>
          </div>
          <input
            type="text"
            autoFocus
            placeholder={
              selectedFolder
                ? `${selectedFolder}/${isCreatingFolder ? 'folder' : 'file.ext'}`
                : isCreatingFolder
                ? 'folder_name'
                : 'filename.ext'
            }
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            className="w-full bg-[#0E1117] text-xs text-white px-2 py-1.5 rounded outline-none border border-[#315EF7] font-mono"
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsCreatingFile(false);
                setIsCreatingFolder(false);
              }
            }}
          />
          <div className="flex justify-between items-center mt-1.5 text-[10px] text-zinc-400">
            <span>Enter to save</span>
            <button
              type="button"
              onClick={() => {
                setIsCreatingFile(false);
                setIsCreatingFolder(false);
              }}
              className="text-zinc-500 hover:text-zinc-300"
            >
              Cancel (Esc)
            </button>
          </div>
        </form>
      )}

      {/* Drag & drop upload indicator */}
      {isUploading && (
        <div className="px-3 py-2 bg-[#315EF7]/10 border-b border-[#315EF7]/20 flex items-center gap-2 text-xs text-[#315EF7] font-mono">
          <RefreshCw className="w-3 h-3 animate-spin" />
          <span>Syncing workspace...</span>
        </div>
      )}

      {/* File Tree with root drop-zone support and hierarchical tree nodes */}
      <div
        className="flex-1 overflow-y-auto auth-scroll p-1 space-y-0.5"
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes('application/runix-item')) {
            e.preventDefault();
            setDropTargetFolder('');
          }
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) {
            setDropTargetFolder(null);
          }
        }}
        onDrop={(e) => {
          if (e.dataTransfer.types.includes('application/runix-item')) {
            e.preventDefault();
            handleMoveItem('');
          }
        }}
      >
        {files.length === 0 && !loading && (
          <div className="p-6 text-center text-xs text-zinc-500 font-mono flex flex-col items-center gap-2">
            <span>Empty workspace.</span>
            <button
              onClick={() => setIsCreatingFile(true)}
              className="px-2.5 py-1 rounded bg-[#315EF7]/20 text-[#315EF7] hover:bg-[#315EF7]/30 transition-colors"
            >
              + Create First File
            </button>
          </div>
        )}

        {treeNodes.map((node) => {
          const file = node.file;
          const isDir = file.type === 'directory';
          const isActive = activeFilePath === file.path;
          const isCollapsed = collapsedFolders.has(file.path);
          const isDropTarget = isDir && dropTargetFolder === file.path;
          const isBeingDragged = draggedItem?.path === file.path;
          const isRenaming = renamingPath === file.path;

          return (
            <div
              key={file.path}
              draggable={!isRenaming}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', file.path);
                e.dataTransfer.setData('application/runix-item', JSON.stringify(file));
                e.dataTransfer.effectAllowed = 'move';
                setDraggedItem(file);
              }}
              onDragEnd={() => {
                setDraggedItem(null);
                setDropTargetFolder(null);
              }}
              onDragOver={(e) => {
                if (isDir && e.dataTransfer.types.includes('application/runix-item') && draggedItem?.path !== file.path) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDropTargetFolder(file.path);
                }
              }}
              onDragLeave={(e) => {
                if (isDir && dropTargetFolder === file.path) {
                  e.preventDefault();
                  setDropTargetFolder(null);
                }
              }}
              onDrop={(e) => {
                if (isDir && e.dataTransfer.types.includes('application/runix-item')) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleMoveItem(file.path);
                }
              }}
              onClick={(e) => {
                if (isDir) {
                  setSelectedFolder(file.path);
                  toggleFolder(file.path, e);
                } else {
                  const parentDir = file.path.includes('/')
                    ? file.path.substring(0, file.path.lastIndexOf('/'))
                    : '';
                  setSelectedFolder(parentDir);
                  onOpenFile(file);
                }
              }}
              style={{ paddingLeft: `${6 + node.depth * 14}px` }}
              className={`group flex items-center justify-between pr-2 py-1.5 rounded text-xs cursor-pointer transition-colors ${
                isDropTarget
                  ? 'bg-[#315EF7]/20 border border-[#315EF7] text-white'
                  : isBeingDragged
                  ? 'opacity-40 bg-white/5'
                  : isActive
                  ? 'bg-[#1A1F2C] text-white border border-white/10 font-medium'
                  : selectedFolder === file.path && isDir
                  ? 'bg-white/[0.07] text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                {isDir ? (
                  <span
                    onClick={(e) => toggleFolder(file.path, e)}
                    className="p-0.5 hover:text-white"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-zinc-500" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-zinc-500" />
                    )}
                  </span>
                ) : (
                  <span className="w-3 h-3" />
                )}

                {isDir ? (
                  <FolderIcon folderName={file.name} isOpen={!isCollapsed} size={15} />
                ) : (
                  <FileIcon filename={file.name} size={15} />
                )}

                {isRenaming ? (
                  <input
                    type="text"
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleRenameItem(file, renameValue);
                      }
                      if (e.key === 'Escape') {
                        setRenamingPath(null);
                      }
                    }}
                    onBlur={() => handleRenameItem(file, renameValue)}
                    className="bg-[#090A0F] text-xs text-white px-1.5 py-0.5 rounded outline-none border border-[#315EF7] font-mono w-full"
                  />
                ) : (
                  <span className="font-mono truncate">{file.name}</span>
                )}
              </div>

              {/* Action buttons on hover */}
              {!isRenaming && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-1">
                  {isDir && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFolder(file.path);
                          setIsCreatingFile(true);
                          setIsCreatingFolder(false);
                          setNewItemName('');
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"
                        title={`New File inside /${file.path}`}
                      >
                        <FilePlus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFolder(file.path);
                          setIsCreatingFolder(true);
                          setIsCreatingFile(false);
                          setNewItemName('');
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"
                        title={`New Folder inside /${file.path}`}
                      >
                        <FolderPlus className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingPath(file.path);
                      setRenameValue(file.name);
                    }}
                    className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"
                    title="Rename"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  {!isDir && (
                    <button
                      onClick={(e) => handleDownloadFile(file, e)}
                      className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"
                      title="Download file"
                    >
                      <Download className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDeleteItem(file.path, isDir, e)}
                    className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-white/10"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="h-7 px-3 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-zinc-500 bg-[#090A0F]">
        <span>{files.length} items</span>
        <span className="text-[#315EF7]">Runix Core FS</span>
      </div>
    </aside>
  );
}
