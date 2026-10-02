import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken } from '@/lib/server/firebase-admin';
import { FilesystemEngine, sanitizePath } from '@/lib/workspace/filesystem-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const accountId = tokenUser?.uid || searchParams.get('accountId') || 'anonymous_dev';

    if (filePath) {
      const file = await FilesystemEngine.readFile(accountId, workspaceId, filePath);
      if (!file) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      return NextResponse.json({ file });
    }

    const files = await FilesystemEngine.getWorkspaceFilesAsync(accountId, workspaceId);
    return NextResponse.json({ files });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const { searchParams } = new URL(request.url);
    const contentType = request.headers.get('content-type') || '';

    // Handle multipart/form-data for attached files
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const accountId =
        tokenUser?.uid || (formData.get('accountId') as string) || searchParams.get('accountId') || 'anonymous_dev';
      const fileEntries = formData.getAll('files') as File[];
      const singleFile = formData.get('file') as File | null;
      const allFiles = fileEntries.length > 0 ? fileEntries : singleFile ? [singleFile] : [];

      if (allFiles.length === 0) {
        return NextResponse.json({ error: 'No files provided' }, { status: 400 });
      }

      const savedFiles = [];
      for (const f of allFiles) {
        const text = await f.text();
        const record = await FilesystemEngine.createFile(accountId, workspaceId, f.name, text);
        savedFiles.push(record);
      }

      return NextResponse.json({ files: savedFiles, success: true });
    }

    // Handle JSON payload
    const body = await request.json();
    const accountId = tokenUser?.uid || body.accountId || searchParams.get('accountId') || 'anonymous_dev';

    // 1. Action: MOVE (file or folder drag & drop)
    if (body.action === 'move') {
      const { sourcePath, destinationFolder } = body;
      if (!sourcePath) {
        return NextResponse.json({ error: 'sourcePath is required for move' }, { status: 400 });
      }
      const moveResult = await FilesystemEngine.moveItem(accountId, workspaceId, sourcePath, destinationFolder || '');
      if (!moveResult.success) {
        return NextResponse.json({ error: moveResult.error || 'Move operation failed' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        item: moveResult.item,
        oldPath: moveResult.oldPath,
        newPath: moveResult.newPath,
      });
    }

    // 2. Action: RENAME (file or folder)
    if (body.action === 'rename') {
      const { oldPath, newPath, isDirectory } = body;
      if (!oldPath || !newPath) {
        return NextResponse.json({ error: 'oldPath and newPath are required for rename' }, { status: 400 });
      }

      if (isDirectory) {
        const renameRes = await FilesystemEngine.renameFolder(accountId, workspaceId, oldPath, newPath);
        if (!renameRes.success) {
          return NextResponse.json({ error: renameRes.error || 'Failed to rename directory' }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          item: renameRes.item,
          affectedItems: renameRes.affectedItems,
        });
      } else {
        const renameRes = await FilesystemEngine.renameFile(accountId, workspaceId, oldPath, newPath);
        if (!renameRes.success) {
          return NextResponse.json({ error: renameRes.error || 'Failed to rename file' }, { status: 400 });
        }
        return NextResponse.json({
          success: true,
          item: renameRes.item,
        });
      }
    }

    const { path: rawPath, content = '', isDirectory = false } = body;

    if (!rawPath) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    if (isDirectory) {
      const folderRecord = await FilesystemEngine.createFolderAsync(accountId, workspaceId, rawPath);
      return NextResponse.json({ file: folderRecord, success: true });
    }

    // Save/create file with limit validation (0.8 MB, 5000 lines, 200,000 words), concurrency checks, and chunked persistence
    try {
      const fileRecord = await FilesystemEngine.createFile(accountId, workspaceId, rawPath, content, body.expectedVersion);
      return NextResponse.json({ file: fileRecord, success: true });
    } catch (saveErr: any) {
      const isLimitErr =
        saveErr.code === 'FILE_SIZE_LIMIT_EXCEEDED' ||
        saveErr.code === 'LINE_LIMIT_EXCEEDED' ||
        saveErr.code === 'WORD_LIMIT_EXCEEDED';
      const isConflict = saveErr.code === 'CONFLICT';

      return NextResponse.json(
        {
          error: saveErr.code || 'SAVE_FAILED',
          message: saveErr.message || 'File persistence failed',
        },
        { status: isLimitErr ? 400 : isConflict ? 409 : 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const rawPath = searchParams.get('path');
    const isRecursive = searchParams.get('recursive') === 'true';
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const accountId = tokenUser?.uid || searchParams.get('accountId') || 'anonymous_dev';

    if (!rawPath) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const deleted = await FilesystemEngine.deleteItem(accountId, workspaceId, rawPath, isRecursive);
    return NextResponse.json({ success: true, deleted, path: rawPath });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
