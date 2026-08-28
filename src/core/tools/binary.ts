import chalk from 'chalk';
import { run, which } from '../../utils/exec.js';
import type { ToolDefinition, ToolInstallStep } from './types.js';

export interface EnsuredBinary {
  /** Absolute path to the executable, or undefined when it is still missing. */
  binaryPath?: string;
  step: ToolInstallStep;
}

/**
 * Guarantee the tool's executable exists, installing the npm package globally
 * when it does not. A failed install is reported as a step and never throws:
 * the remaining file-based configuration still runs.
 */
export async function ensureBinary(tool: ToolDefinition, dryRun = false): Promise<EnsuredBinary> {
  const existing = await which(tool.binary);
  if (existing) {
    return { binaryPath: existing, step: { label: `${tool.binary} found`, status: 'done', detail: existing } };
  }

  const installCommand = `npm install -g ${tool.npmPackage}`;
  if (dryRun) {
    return { step: { label: `${tool.binary} missing`, status: 'skipped', detail: `dry run: would run \`${installCommand}\`` } };
  }

  console.log(chalk.dim(`  ${tool.binary} not found on PATH — running \`${installCommand}\`...`));
  const result = await run('npm', ['install', '-g', tool.npmPackage], { inherit: true });
  if (result.code !== 0) {
    return {
      step: {
        label: `install ${tool.npmPackage}`,
        status: 'failed',
        detail: `\`${installCommand}\` exited with code ${result.code} — install it manually and re-run \`mio init\``,
      },
    };
  }

  const installed = await which(tool.binary);
  if (!installed) {
    return {
      step: {
        label: `install ${tool.npmPackage}`,
        status: 'failed',
        detail: `${tool.binary} is still not on PATH after installing — open a new shell (or run \`hash -r\`) and re-run \`mio init\``,
      },
    };
  }
  return { binaryPath: installed, step: { label: `installed ${tool.npmPackage}`, status: 'done', detail: installed } };
}
