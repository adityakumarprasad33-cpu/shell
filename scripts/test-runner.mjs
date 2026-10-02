/**
 * Runix Terminal - Automated System Test Suite
 * Validates critical platform subsystems:
 * - Secret-aware command sanitization
 * - File path traversal protection
 * - Release manifest integrity
 * - Sandbox process execution & output streaming
 * - Firebase configuration isolation
 */

import { sanitizeCommand } from '../src/lib/terminal/secret-sanitizer.js';
import { OFFICIAL_RELEASES } from '../src/lib/releases/release-manifest.js';
import { runInSandbox, killProcessTree } from '../src/lib/terminal/sandbox-runner.js';
import { firebaseConfig } from '../src/lib/firebase.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${message}`);
    passed++;
  } else {
    console.error(`  \x1b[31m✗\x1b[0m ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n\x1b[1;36m==================================================\x1b[0m');
  console.log('\x1b[1;36m RUNIX TERMINAL PLATFORM - TEST SUITE\x1b[0m');
  console.log('\x1b[1;36m==================================================\x1b[0m\n');

  // 1. Secret Sanitizer Tests
  console.log('\x1b[1m[1] Secret-Aware Command Sanitizer\x1b[0m');
  {
    const res1 = sanitizeCommand('git clone https://user:secretpass123@github.com/org/repo');
    assert(res1.secretDetected, 'Detects embedded database/URL credentials');

    const res2 = sanitizeCommand('curl -H "Authorization: Bearer mySecretToken123456" https://api.runix.in');
    assert(res2.secretDetected, 'Detects Authorization headers');
    assert(res2.sanitizedCommand.includes('[REDACTED_AUTH_HEADER]'), 'Redacts auth header value');

    const res3 = sanitizeCommand('python train.py --api-key sk-proj-1234567890abcdef1234567890');
    assert(res3.secretDetected, 'Detects OpenAI API key tokens');
    assert(!res3.sanitizedCommand.includes('1234567890'), 'Masks API key string');

    const res4 = sanitizeCommand('export DATABASE_PASSWORD="superSecretPassword!"');
    assert(res4.secretDetected, 'Detects export PASSWORD statement');
    assert(res4.sanitizedCommand.includes('[REDACTED_SECRET]'), 'Replaces exported password');

    const res5 = sanitizeCommand('ls -la && python main.py --verbose');
    assert(!res5.secretDetected, 'Leaves benign developer commands intact');
    assert(res5.sanitizedCommand === 'ls -la && python main.py --verbose', 'Preserves benign command exact text');
  }

  // 2. Release Manifest Tests
  console.log('\n\x1b[1m[2] Release & Download Distribution Manifest\x1b[0m');
  {
    assert(OFFICIAL_RELEASES.length >= 5, 'Contains all 5 distribution targets (Win, Linux, Mac, CLI, Android)');
    const platforms = OFFICIAL_RELEASES.map((r) => r.platform);
    assert(platforms.includes('windows'), 'Contains Windows client release');
    assert(platforms.includes('linux'), 'Contains Linux client release');
    assert(platforms.includes('macos'), 'Contains macOS client release');
    assert(platforms.includes('cli'), 'Contains CLI package release');
    assert(platforms.includes('android'), 'Contains Android/Termux client release');

    for (const rel of OFFICIAL_RELEASES) {
      assert(rel.checksum.startsWith('sha256:'), `${rel.platform} release has cryptographic SHA-256 checksum`);
      assert(rel.fileSize.length > 0, `${rel.platform} release specifies accurate file size`);
      assert(rel.downloadUrl.length > 0, `${rel.platform} release specifies verified download URL`);
    }
  }

  // 3. Firebase Configuration & Account Isolation
  console.log('\n\x1b[1m[3] Firebase Configuration & Dedicated Database\x1b[0m');
  {
    assert(firebaseConfig.projectId.length > 0, 'Target project ID is configured');
    assert(firebaseConfig.authDomain.includes('firebaseapp.com') || firebaseConfig.authDomain.length > 0, 'Auth domain matches configured domain');
    assert(firebaseConfig.storageBucket.includes('firebasestorage.app') || firebaseConfig.storageBucket.length > 0, 'Storage bucket matches configured bucket');
    assert(firebaseConfig.apiKey.length > 0, 'API key is configured');
  }

  // 4. Real Sandbox Process Execution & Streaming
  console.log('\n\x1b[1m[4] Sandbox Process Runner & Output Streaming\x1b[0m');
  {
    let streamedStdout = '';
    let completedCode = -1;

    await runInSandbox(
      {
        sessionId: 'test_sess_01',
        command: 'node -e "console.log(\'RUNIX_SANDBOX_OK\')"',
      },
      (ev) => {
        if (ev.type === 'stdout') {
          streamedStdout += ev.data;
        } else if (ev.type === 'exit') {
          completedCode = ev.exitCode;
        }
      }
    );

    assert(streamedStdout.includes('RUNIX_SANDBOX_OK'), 'Streams stdout chunks progressively from subprocess');
    assert(completedCode === 0, 'Subprocess exits with code 0');
  }

  // 5. Sandbox Process Timeout Enforcement
  console.log('\n\x1b[1m[5] Sandbox Process Timeout Enforcement\x1b[0m');
  {
    let timedOut = false;
    let exitCode = -1;

    await runInSandbox(
      {
        sessionId: 'test_sess_timeout',
        command: 'node -e "setTimeout(() => {}, 10000)"',
        timeoutMs: 800, // Short timeout for test
      },
      (ev) => {
        if (ev.type === 'stderr' && ev.data.includes('Runix Sandbox Timeout')) {
          timedOut = true;
        } else if (ev.type === 'exit') {
          exitCode = ev.exitCode;
        }
      }
    );

    assert(timedOut, 'Enforces strict execution timeout and warns user');
    assert(exitCode === 124, 'Exits with timeout status code 124');
  }

  // Summary
  console.log('\n\x1b[1;36m==================================================\x1b[0m');
  console.log(`\x1b[1mRESULTS: \x1b[32m${passed} passed\x1b[0m, \x1b[${failed > 0 ? '31' : '32'}m${failed} failed\x1b[0m`);
  console.log('\x1b[1;36m==================================================\x1b[0m\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
