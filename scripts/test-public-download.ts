import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { verifyPEBinary } from './verify-and-package-release';

async function testPublicDownload() {
  console.log('==================================================');
  console.log(' END-TO-END PUBLIC DOWNLOAD & RUNTIME VERIFICATION');
  console.log('==================================================\n');

  const downloadUrl = 'http://localhost:3005/releases/windows/RunixTerminal.exe';
  const tempDownloadPath = path.resolve(process.cwd(), 'temp_downloaded_RunixTerminal.exe');

  console.log(`[1] Fetching public artifact from ${downloadUrl}...`);
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`HTTP Download failed with status ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  fs.writeFileSync(tempDownloadPath, buffer);
  console.log(`    Downloaded ${buffer.length} bytes successfully.`);

  console.log('\n[2] Verifying cryptographic SHA-256 integrity hash...');
  const computedHash = crypto.createHash('sha256').update(buffer).digest('hex');
  console.log(`    Downloaded File SHA-256: ${computedHash}`);

  // Compare with release manifest
  const manifestRaw = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/releases/release-manifest.ts'), 'utf8');
  if (!manifestRaw.includes(computedHash)) {
    throw new Error(`Checksum mismatch! Manifest does not contain ${computedHash}`);
  }
  console.log('    ✓ Hash matches official release manifest.');

  console.log('\n[3] Verifying PE executable binary format & x64 architecture...');
  const peCheck = verifyPEBinary(tempDownloadPath);
  if (!peCheck.isValidPE || !peCheck.is64Bit) {
    throw new Error(`Invalid PE executable: ${peCheck.error || peCheck.machine}`);
  }
  console.log(`    ✓ Valid PE32+ executable format confirmed`);
  console.log(`    ✓ Target architecture: ${peCheck.machine}`);
  console.log(`    ✓ Subsystem: ${peCheck.subsystem}`);

  console.log('\n[4] Testing execution launch on Windows x64 host...');
  const child = spawn(tempDownloadPath, [], {
    detached: true,
    stdio: 'ignore',
  });

  const pid = child.pid;
  console.log(`    Spawned RunixTerminal.exe process with PID: ${pid}`);

  // Give process 2 seconds to initialize window
  await new Promise((r) => setTimeout(r, 2500));

  // Check if process is still alive and running
  let isRunning = false;
  try {
    process.kill(pid!, 0);
    isRunning = true;
  } catch (e) {
    isRunning = false;
  }

  if (!isRunning) {
    throw new Error(`Process ${pid} terminated unexpectedly! Windows might have blocked it.`);
  }

  console.log(`    ✓ Process is alive and running smoothly (No 'This app can't run on your PC' error!)`);

  // Cleanly kill the test process
  try {
    process.kill(pid!, 'SIGTERM');
  } catch (e) {}

  // Also taskkill by pid just in case
  const { execSync } = require('child_process');
  try {
    execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
  } catch (e) {}

  // Clean up temporary download file
  if (fs.existsSync(tempDownloadPath)) {
    fs.unlinkSync(tempDownloadPath);
  }

  console.log('\n==================================================');
  console.log(' ALL END-TO-END DOWNLOAD TESTS PASSED 100%');
  console.log('==================================================');
}

testPublicDownload().catch((err) => {
  console.error('\nFAILED:', err);
  process.exit(1);
});
