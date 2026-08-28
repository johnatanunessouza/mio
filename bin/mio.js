#!/usr/bin/env node

import { runCli } from '../dist/cli/index.js';

runCli().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
