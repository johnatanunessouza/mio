#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { cpSync, existsSync, rmSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const runTsc = (args = []) => {
  const tscPath = require.resolve('typescript/bin/tsc');
  execFileSync(process.execPath, [tscPath, ...args], { stdio: 'inherit' });
};

console.log('🔨 Building mio...\n');

// Clean dist directory
if (existsSync('dist')) {
  console.log('Cleaning dist directory...');
  rmSync('dist', { recursive: true, force: true });
}

// Run TypeScript compiler (use local version explicitly)
console.log('Compiling TypeScript...');
try {
  runTsc(['--version']);
  runTsc();
} catch (error) {
  console.error('\n❌ Build failed!');
  process.exit(1);
}

// Copy non-TS payload (bundled skills) that tsc does not emit.
if (existsSync('src/assets')) {
  console.log('Copying assets...');
  cpSync('src/assets', 'dist/assets', { recursive: true });
}

console.log('\n✅ Build completed successfully!');
