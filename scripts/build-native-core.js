const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function buildNativeCore() {
  const rootDir = process.cwd();
  const isWindows = process.platform === 'win32';
  const binName = isWindows ? 'runix-core.exe' : 'runix-core';
  const binDir = path.join(rootDir, 'runix-core', 'bin');
  const targetBin = path.join(binDir, binName);

  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
  }

  // If already compiled and runnable, verify it
  if (fs.existsSync(targetBin)) {
    try {
      const res = spawnSync(targetBin, ['version'], { encoding: 'utf-8', timeout: 5000 });
      if (res.status === 0) {
        console.log(`[runix:core] Existing native binary verified: ${targetBin}`);
        return true;
      }
    } catch {}
  }

  console.log(`[runix:core] Building native C++20 Core for ${process.platform} (${process.arch})...`);

  // Attempt 1: CMake
  try {
    const buildDir = path.join(rootDir, 'runix-core', 'build');
    execSync(`cmake -B "${buildDir}" -S "${path.join(rootDir, 'runix-core')}" -DCMAKE_BUILD_TYPE=Release`, { stdio: 'inherit' });
    execSync(`cmake --build "${buildDir}" --config Release`, { stdio: 'inherit' });
    console.log(`[runix:core] CMake build successful.`);
    return true;
  } catch (cmakeErr) {
    console.log(`[runix:core] CMake not found or failed, falling back to direct C++20 compiler...`);
  }

  // Attempt 2: Direct G++ / Clang++ invocation
  const srcFiles = fs
    .readdirSync(path.join(rootDir, 'runix-core', 'src'))
    .filter((f) => f.endsWith('.cpp'))
    .map((f) => `"${path.join(rootDir, 'runix-core', 'src', f)}"`)
    .join(' ');

  const includeDir = `"${path.join(rootDir, 'runix-core', 'include')}"`;

  const compilers = isWindows
    ? ['g++', 'clang++']
    : ['g++', 'clang++', 'c++'];

  for (const comp of compilers) {
    try {
      console.log(`[runix:core] Attempting compilation with ${comp}...`);
      const cmd = `${comp} -std=c++20 -O2 -I ${includeDir} ${srcFiles} -o "${targetBin}"`;
      execSync(cmd, { stdio: 'inherit' });
      console.log(`[runix:core] Compilation succeeded with ${comp}: ${targetBin}`);
      return true;
    } catch {}
  }

  console.warn(`[runix:core] Warning: Could not automatically build native core binary on ${process.platform}.`);
  return false;
}

if (require.main === module) {
  buildNativeCore();
}

module.exports = { buildNativeCore };
