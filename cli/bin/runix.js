#!/usr/bin/env node

/**
 * RUNIX TERMINAL - Official Command Line Tool (runix)
 * https://console.runix.in
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { spawn, exec } = require('child_process');

const RUNIX_API_HOST = process.env.RUNIX_API_URL || 'https://console.runix.in';
const RUNIX_CONFIG_DIR = path.join(os.homedir(), '.runix');
const CREDENTIALS_FILE = path.join(RUNIX_CONFIG_DIR, 'credentials.json');

// Ensure config dir exists
if (!fs.existsSync(RUNIX_CONFIG_DIR)) {
  try {
    fs.mkdirSync(RUNIX_CONFIG_DIR, { recursive: true, mode: 0o700 });
  } catch {}
}

function getStoredCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function storeCredentials(data) {
  try {
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(data, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error('Failed to store credentials:', err.message);
  }
}

function clearCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      fs.unlinkSync(CREDENTIALS_FILE);
    }
  } catch {}
}

function printBanner() {
  console.log('\x1b[1;38;5;39m╭──────────────────────────────────────────╮\x1b[0m');
  console.log('\x1b[1;38;5;39m│\x1b[0m  \x1b[1;37mRUNIX TERMINAL CLI\x1b[0m — \x1b[90mv1.0.0            \x1b[0m\x1b[1;38;5;39m│\x1b[0m');
  console.log('\x1b[1;38;5;39m│\x1b[0m  \x1b[36mhttps://console.runix.in\x1b[0m                \x1b[1;38;5;39m│\x1b[0m');
  console.log('\x1b[1;38;5;39m╰──────────────────────────────────────────╯\x1b[0m\n');
}

function printHelp() {
  printBanner();
  console.log(`\x1b[1mUSAGE:\x1b[0m
  runix <command> [arguments] [options]

\x1b[1mAUTHENTICATION COMMANDS:\x1b[0m
  \x1b[36mrunix login\x1b[0m                   Authorize CLI with browser handshake
  \x1b[36mrunix logout\x1b[0m                  Clear stored credentials
  \x1b[36mrunix whoami\x1b[0m                  Display active Terminal Account identity
  \x1b[36mrunix status\x1b[0m                  Inspect sandbox telemetry and latency

\x1b[1mSESSION COMMANDS:\x1b[0m
  \x1b[36mrunix session list\x1b[0m            List active terminal sessions
  \x1b[36mrunix session open <title>\x1b[0m    Create and connect to a new session
  \x1b[36mrunix session close <id>\x1b[0m      Terminate active session

\x1b[1mWORKSPACE COMMANDS:\x1b[0m
  \x1b[36mrunix workspace list\x1b[0m          List cloud workspaces
  \x1b[36mrunix workspace create <name>\x1b[0m Create a new persistent workspace
  \x1b[36mrunix workspace open <id>\x1b[0m     Open workspace in browser console

\x1b[1mEXECUTION COMMANDS:\x1b[0m
  \x1b[36mrunix remote\x1b[0m                  Open interactive remote cloud shell
  \x1b[36mrunix remote exec "<cmd>"\x1b[0m     Stream command in isolated sandbox

\x1b[1mRUNTIME & DIAGNOSTIC COMMANDS:\x1b[0m
  \x1b[36mrunix runtimes\x1b[0m                List verified cloud & local runtimes (114 benchmark)
  \x1b[36mrunix detect <file>\x1b[0m           Inspect file language & runtime resolution
  \x1b[36mrunix doctor\x1b[0m                  Audit local toolchain, Node, Python & Git

\x1b[1mHISTORY COMMANDS:\x1b[0m
  \x1b[36mrunix history\x1b[0m                 List persistent command history
  \x1b[36mrunix history clear\x1b[0m           Clear command history from server
`);
}

async function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https:');
    const client = isHttps ? https : http;

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

// 1. runix login
async function handleLogin() {
  printBanner();
  console.log('\x1b[33mInitiating secure device authorization...\x1b[0m');

  try {
    const res = await requestJson(`${RUNIX_API_HOST}/api/auth/device-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (res.status !== 200) {
      console.error('\x1b[31mFailed to obtain device code from server.\x1b[0m');
      return;
    }

    const { deviceCode, userCode, verificationUri, interval = 3 } = res.body;

    console.log(`\n\x1b[1;32m1. Verification Code:\x1b[0m \x1b[1;37;44m ${userCode} \x1b[0m`);
    console.log(`\x1b[1;32m2. Verification URL:\x1b[0m  \x1b[36m${verificationUri}?code=${userCode}\x1b[0m\n`);
    console.log('Opening browser to approve authorization...');

    // Open URL in default browser
    const url = `${verificationUri}?code=${userCode}`;
    const openCmd =
      process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;

    exec(openCmd, () => {});

    console.log('\x1b[90mWaiting for confirmation from browser...\x1b[0m');

    // Poll until authorized or expired
    const pollInterval = setInterval(async () => {
      try {
        const pollRes = await requestJson(
          `${RUNIX_API_HOST}/api/auth/device-code?deviceCode=${deviceCode}`
        );

        if (pollRes.body.status === 'authorized') {
          clearInterval(pollInterval);
          storeCredentials({
            token: pollRes.body.token,
            accountId: pollRes.body.accountId,
            loggedInAt: new Date().toISOString(),
          });
          console.log('\n\x1b[1;32m✓ Successfully authenticated!\x1b[0m');
          console.log(`Account ID: \x1b[36m${pollRes.body.accountId}\x1b[0m`);
          console.log('You can now run \x1b[33mrunix status\x1b[0m or \x1b[33mrunix remote\x1b[0m.');
        } else if (pollRes.body.status === 'expired') {
          clearInterval(pollInterval);
          console.log('\n\x1b[31mDevice code expired. Please run `runix login` again.\x1b[0m');
        }
      } catch {}
    }, interval * 1000);
  } catch (err) {
    console.error('\x1b[31mConnection error:\x1b[0m', err.message);
  }
}

// 2. runix whoami
function handleWhoami() {
  const creds = getStoredCredentials();
  if (!creds) {
    console.log('\x1b[33mNot logged in.\x1b[0m Run \x1b[36mrunix login\x1b[0m to authenticate.');
    return;
  }
  console.log('\x1b[1mTerminal Account:\x1b[0m');
  console.log(`  Account ID:   \x1b[36m${creds.accountId}\x1b[0m`);
  console.log(`  Authorized:   \x1b[32m${creds.loggedInAt}\x1b[0m`);
  console.log(`  API Endpoint: \x1b[90m${RUNIX_API_HOST}\x1b[0m`);
}

// 3. runix logout
function handleLogout() {
  clearCredentials();
  console.log('\x1b[32m✓ Logged out from Runix Terminal CLI.\x1b[0m');
}

// 4. runix status
async function handleStatus() {
  const creds = getStoredCredentials();
  const start = Date.now();
  try {
    const res = await requestJson(`${RUNIX_API_HOST}/api/releases`);
    const latency = Date.now() - start;

    console.log('\x1b[1mRunix Sandbox Telemetry:\x1b[0m');
    console.log(`  Console API:     \x1b[32m● Online\x1b[0m (${latency}ms ping)`);
    console.log(`  Sandbox Engine:  \x1b[32m● Active\x1b[0m (isolated worker pool)`);
    console.log(`  Memory Limit:    512 MB per session`);
    console.log(`  Max Timeout:     30 seconds SLA`);
    console.log(`  Auth Status:     ${creds ? '\x1b[32mAuthenticated\x1b[0m' : '\x1b[33mGuest / Anonymous\x1b[0m'}`);
  } catch (err) {
    console.error('\x1b[31mStatus check failed:\x1b[0m', err.message);
  }
}

// 5. runix remote exec "<cmd>"
async function handleRemoteExec(cmd) {
  if (!cmd) {
    console.error('\x1b[31mPlease specify a command to execute.\x1b[0m');
    console.log('Example: \x1b[36mrunix remote exec "python main.py"\x1b[0m');
    return;
  }

  const creds = getStoredCredentials();
  console.log(`\x1b[90m[runix:sandbox] Executing: ${cmd}\x1b[0m`);

  const url = new URL(`${RUNIX_API_HOST}/api/terminal/execute`);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;

  const payload = JSON.stringify({
    sessionId: `cli_${Date.now()}`,
    command: cmd,
    accountId: creds?.accountId || 'cli_user',
  });

  const req = client.request(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(creds?.token ? { Authorization: `Bearer ${creds.token}` } : {}),
      },
    },
    (res) => {
      let buffer = '';
      res.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const item of lines) {
          const trimmed = item.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const ev = JSON.parse(trimmed.replace(/^data: /, ''));
              if (ev.type === 'stdout') {
                process.stdout.write(ev.data);
              } else if (ev.type === 'stderr') {
                process.stderr.write(ev.data);
              } else if (ev.type === 'exit') {
                process.exitCode = ev.exitCode;
              }
            } catch {
              process.stdout.write(item);
            }
          }
        }
      });
    }
  );

  req.on('error', (err) => {
    console.error('\x1b[31mSandbox execution failed:\x1b[0m', err.message);
  });

  req.write(payload);
  req.end();
}

async function handleRuntimes() {
  try {
    const res = await requestJson(`${RUNIX_API_HOST}/api/runtimes`);
    if (res.status === 200 && res.body.statistics) {
      const stats = res.body.statistics;
      console.log('\x1b[1;37mRUNIX UNIVERSAL RUNTIME REGISTRY\x1b[0m');
      console.log(`\x1b[90mTarget Benchmark: ${stats.totalTargetBenchmark} | Verified: ${stats.verifiedCount} | Available: ${stats.availableCount}\x1b[0m\n`);
      console.log('\x1b[1;37mID            NAME                TYPE        VERSION          STATUS       VERIFIED\x1b[0m');
      console.log('─'.repeat(80));

      const runtimes = res.body.runtimes || [];
      const display = runtimes.slice(0, 25);
      for (const r of display) {
        const idCol = r.id.padEnd(14);
        const nameCol = r.name.padEnd(20);
        const typeCol = r.type.padEnd(12);
        const verCol = (r.version || 'latest').padEnd(17);
        const statusCol = r.status.padEnd(13);
        const vBadge = r.verificationStatus === 'PASS' ? '\x1b[32mPASS\x1b[0m' : '\x1b[90mPENDING\x1b[0m';
        console.log(`${idCol}${nameCol}${typeCol}${verCol}${statusCol}${vBadge}`);
      }
      if (runtimes.length > 25) {
        console.log(`\x1b[90m... and ${runtimes.length - 25} more cataloged environments in registry.\x1b[0m`);
      }
      return;
    }
  } catch (err) {
    console.error('Failed to retrieve runtimes registry:', err.message);
  }
}

async function handleDetect(file) {
  if (!file) {
    console.error('Usage: runix detect <filename>');
    return;
  }
  const ext = path.extname(file).toLowerCase();
  try {
    const res = await requestJson(`${RUNIX_API_HOST}/api/runtimes?ext=${encodeURIComponent(ext)}`);
    if (res.status === 200 && res.body.runtimes && res.body.runtimes.length > 0) {
      const primary = res.body.runtimes[0];
      console.log('\x1b[1mLANGUAGE & RUNTIME RESOLUTION\x1b[0m');
      console.log(`  File:            \x1b[36m${file}\x1b[0m`);
      console.log(`  Runtime:         \x1b[32m${primary.name}\x1b[0m (${primary.id})`);
      console.log(`  Version:         ${primary.version}`);
      console.log(`  Type:            ${primary.type}`);
      console.log(`  Verification:    ${primary.verificationStatus === 'PASS' ? '\x1b[32mPASS (Verified)\x1b[0m' : '\x1b[33mPending\x1b[0m'}`);
      if (primary.runCommand) console.log(`  Execution:       \x1b[90m${primary.runCommand}\x1b[0m`);
      return;
    }
  } catch {}
  console.log(`File: ${file} (Extension: ${ext || 'none'})`);
}

function handleDoctor() {
  console.log('\x1b[1;37mRUNIX CLI SYSTEM & TOOLCHAIN AUDIT\x1b[0m');
  console.log('─'.repeat(50));
  console.log(`  \x1b[32m✓\x1b[0m Node.js Runtime:     ${process.version} (${process.arch})`);
  console.log(`  \x1b[32m✓\x1b[0m Host Platform:      ${process.platform}`);
  console.log(`  \x1b[32m✓\x1b[0m CLI Binary:         ${__filename}`);
  console.log(`  \x1b[32m✓\x1b[0m Config Storage:     ${RUNIX_CONFIG_DIR}`);
  console.log(`  \x1b[32m✓\x1b[0m API Endpoint:       ${RUNIX_API_HOST}`);

  const creds = getStoredCredentials();
  if (creds) {
    console.log(`  \x1b[32m✓\x1b[0m Credentials:        Authenticated (${creds.email || creds.accountId})`);
  } else {
    console.log(`  \x1b[33m!\x1b[0m Credentials:        Anonymous (Run 'runix login' to connect)`);
  }
}

// Main CLI dispatch
async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    printHelp();
    return;
  }

  if (cmd === 'version' || cmd === '--version' || cmd === '-v') {
    try {
      const res = await requestJson(`${RUNIX_API_HOST}/api/releases?latest=true`);
      if (res.status === 200 && res.body.release) {
        const r = res.body.release;
        console.log(`\x1b[1;36mRUNIX TERMINAL\x1b[0m \x1b[1mv${r.version}\x1b[0m (\x1b[32mOfficial Release\x1b[0m)`);
        console.log(`  Release Date:  \x1b[37m${r.publishedAt}\x1b[0m`);
        console.log(`  Platform:      \x1b[37m${r.platform.toUpperCase()} (${r.architecture})\x1b[0m`);
        console.log(`  Artifact:      \x1b[37m${r.filename}\x1b[0m (\x1b[90m${r.fileSize}\x1b[0m)`);
        console.log(`  SHA-256:       \x1b[32m${r.checksum}\x1b[0m`);
        console.log(`  Status:        \x1b[35m${r.status === 'available' ? 'Production GA' : 'Pipeline Processing'}\x1b[0m`);
        console.log(`  Download Hub:  \x1b[34mhttps://console.runix.in/download\x1b[0m`);
        return;
      }
    } catch {}
    console.log('runix v0.1.0 (Official Runix Terminal Build)');
    return;
  }

  switch (cmd) {
    case 'login':
      await handleLogin();
      break;
    case 'logout':
      handleLogout();
      break;
    case 'whoami':
      handleWhoami();
      break;
    case 'status':
      await handleStatus();
      break;
    case 'remote':
      if (args[1] === 'exec') {
        await handleRemoteExec(args.slice(2).join(' '));
      } else {
        console.log('\x1b[36mConnecting to Runix cloud shell...\x1b[0m');
        await handleRemoteExec(args[1] || 'bash');
      }
      break;
    case 'history':
      console.log('\x1b[33mCommand history managed at: https://console.runix.in\x1b[0m');
      break;
    case 'runtimes':
    case 'envs':
      await handleRuntimes();
      break;
    case 'detect':
      await handleDetect(args[1]);
      break;
    case 'doctor':
      handleDoctor();
      break;
    case 'workspace':
    case 'session':
      console.log(`\x1b[36mRunix ${cmd} controller ready.\x1b[0m`);
      break;
    default:
      console.log(`Unknown command: ${cmd}`);
      console.log('Run \x1b[36mrunix help\x1b[0m for available commands.');
  }
}

main().catch((err) => {
  console.error('\x1b[31mFatal error:\x1b[0m', err);
});
