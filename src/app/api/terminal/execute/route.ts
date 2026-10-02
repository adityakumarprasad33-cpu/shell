import { NextRequest, NextResponse } from 'next/server';
import { StreamEvent, killProcessTree } from '@/lib/terminal/sandbox-runner';
import { sanitizeCommand } from '@/lib/terminal/secret-sanitizer';
import { getAdminDb, verifyUserToken } from '@/lib/server/firebase-admin';
import { processTerminalCommand } from '@/lib/terminal/command-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, command, workingDirectory, accountId: rawAccountId, workspaceId = 'default' } = body;

    if (!sessionId || !command) {
      return NextResponse.json(
        { error: 'sessionId and command are required' },
        { status: 400 }
      );
    }

    // Verify authentication if Authorization header provided
    const authHeader = request.headers.get('authorization');
    const tokenUser = await verifyUserToken(authHeader);
    const accountId = tokenUser?.uid || rawAccountId || 'anonymous_dev';

    // Set up Server-Sent Events stream
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();

    const sendEvent = async (event: StreamEvent) => {
      try {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        await writer.write(encoder.encode(payload));
      } catch {}
    };

    // Run command via Command Engine
    (async () => {
      let finalExitCode = 0;
      let durationMs = 0;

      try {
        await processTerminalCommand(
          {
            sessionId,
            command,
            accountId,
            workspaceId,
            workingDirectory,
          },
          async (event) => {
            if (event.type === 'exit') {
              finalExitCode = event.exitCode ?? 0;
              durationMs = event.durationMs ?? 0;
            }
            await sendEvent(event);
          }
        );

        // Persist secret-aware command history to database
        const { sanitizedCommand, secretDetected } = sanitizeCommand(command);
        const adminDb = getAdminDb();
        if (adminDb && accountId !== 'anonymous_dev') {
          try {
            await adminDb
              .collection('terminalAccounts')
              .doc(accountId)
              .collection('history')
              .add({
                command: sanitizedCommand,
                originalSecretStripped: secretDetected,
                sessionId,
                accountId,
                timestamp: new Date().toISOString(),
                executionMode: 'remote',
                workingDirectory: workingDirectory || `~/workspace/${workspaceId}`,
                status: finalExitCode === 0 ? 'completed' : 'failed',
                exitCode: finalExitCode,
                durationMs,
              });
          } catch (historyErr) {
            console.warn('Failed to persist command history to Firestore:', historyErr);
          }
        }
      } catch (err: any) {
        await sendEvent({
          type: 'error',
          data: `Execution error: ${err.message}`,
        });
      } finally {
        try {
          await writer.close();
        } catch {}
      }
    })();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { sessionId, action } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const killed = killProcessTree(sessionId);
    return NextResponse.json({ success: true, killed, action: action || 'SIGINT' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
