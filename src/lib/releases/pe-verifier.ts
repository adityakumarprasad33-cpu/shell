import fs from 'fs';
import crypto from 'crypto';

export interface PEVerification {
  isValidPE: boolean;
  is64Bit: boolean;
  machine: string;
  subsystem: string;
  fileSize: number;
  sha256: string;
  error?: string;
}

export function verifyPEBinary(filePath: string): PEVerification {
  if (!fs.existsSync(filePath)) {
    return {
      isValidPE: false,
      is64Bit: false,
      machine: 'unknown',
      subsystem: 'unknown',
      fileSize: 0,
      sha256: '',
      error: `File not found: ${filePath}`,
    };
  }

  const buffer = fs.readFileSync(filePath);
  const fileSize = buffer.length;

  // Compute SHA-256
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

  // Verify MZ magic
  if (buffer.length < 64 || buffer[0] !== 0x4d || buffer[1] !== 0x5a) {
    return {
      isValidPE: false,
      is64Bit: false,
      machine: 'invalid',
      subsystem: 'invalid',
      fileSize,
      sha256,
      error: 'Missing MZ DOS header magic (0x4D5A)',
    };
  }

  // Read e_lfanew offset to PE header
  const peOffset = buffer.readUInt32LE(0x3c);
  if (peOffset + 24 > buffer.length) {
    return {
      isValidPE: false,
      is64Bit: false,
      machine: 'invalid',
      subsystem: 'invalid',
      fileSize,
      sha256,
      error: `Invalid PE header offset: ${peOffset}`,
    };
  }

  // Verify PE signature: 'P' 'E' 0 0
  const peSig = buffer.slice(peOffset, peOffset + 4);
  if (
    peSig[0] !== 0x50 ||
    peSig[1] !== 0x45 ||
    peSig[2] !== 0x00 ||
    peSig[3] !== 0x00
  ) {
    return {
      isValidPE: false,
      is64Bit: false,
      machine: 'invalid',
      subsystem: 'invalid',
      fileSize,
      sha256,
      error: 'Missing PE signature (0x50450000)',
    };
  }

  // Read Machine from COFF Header (2 bytes at peOffset + 4)
  const machineId = buffer.readUInt16LE(peOffset + 4);
  let machine = 'unknown';
  let is64Bit = false;

  if (machineId === 0x8664) {
    machine = 'IMAGE_FILE_MACHINE_AMD64 (x64)';
    is64Bit = true;
  } else if (machineId === 0xaa64) {
    machine = 'IMAGE_FILE_MACHINE_ARM64';
    is64Bit = true;
  } else if (machineId === 0x014c) {
    machine = 'IMAGE_FILE_MACHINE_I386 (x86 32-bit)';
  }

  // Read Subsystem from Optional Header (offset peOffset + 24 + 68 for PE32+)
  let subsystem = 'unknown';
  if (peOffset + 24 + 70 <= buffer.length) {
    const subVal = buffer.readUInt16LE(peOffset + 24 + 68);
    if (subVal === 2) subsystem = 'IMAGE_SUBSYSTEM_WINDOWS_GUI';
    else if (subVal === 3) subsystem = 'IMAGE_SUBSYSTEM_WINDOWS_CUI';
    else subsystem = `Subsystem(${subVal})`;
  }

  return {
    isValidPE: true,
    is64Bit,
    machine,
    subsystem,
    fileSize,
    sha256,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
