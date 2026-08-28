import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import type { AgentDefinition } from '../agents/types.js';
import { confinedPath } from '../skills/assets.js';
import { instructionAssetPath } from './assets.js';
import { mergeManagedBlock } from './block.js';
import { resolveInstructions } from './registry.js';
import type { InstalledInstruction, InstructionDefinition } from './types.js';

/**
 * `AGENTS.md` is the format nearly every agent reads, so it is the default
 * target; agents known to load something else declare `instructionsFile`.
 */
export const DEFAULT_INSTRUCTIONS_FILE = 'AGENTS.md';

export function resolveInstructionsPath(
  agent: AgentDefinition,
  projectRoot: string,
  global = false,
  globalHome = homedir()
): string | undefined {
  if (global) {
    return agent.globalInstructionsFile ? confinedPath(globalHome, agent.globalInstructionsFile) : undefined;
  }
  return confinedPath(projectRoot, agent.instructionsFile ?? DEFAULT_INSTRUCTIONS_FILE);
}

export interface InstallInstructionsOptions {
  projectRoot: string;
  agents: readonly AgentDefinition[];
  instructionIds: readonly string[];
  global?: boolean;
  globalHome?: string;
}

async function mergeInto(
  target: string,
  instruction: InstructionDefinition,
  content: string
): Promise<{ changed: boolean; merged: boolean }> {
  let original = '';
  let merged = false;
  try {
    original = await readFile(target, 'utf8');
    merged = true;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const next = mergeManagedBlock(original, instruction.id, content);
  if (merged && next === original) return { changed: false, merged };
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, next, 'utf8');
  return { changed: true, merged };
}

/**
 * Merge every requested instruction document into the file each selected agent
 * always loads. Agents resolving to the same file (most of them share
 * `AGENTS.md`) are written once and reported once.
 */
export async function installInstructions(options: InstallInstructionsOptions): Promise<InstalledInstruction[]> {
  const installed: InstalledInstruction[] = [];
  for (const instruction of resolveInstructions(options.instructionIds)) {
    const content = await readFile(instructionAssetPath(instruction.id), 'utf8');
    const seen = new Set<string>();
    for (const agent of options.agents) {
      const target = resolveInstructionsPath(agent, options.projectRoot, options.global, options.globalHome);
      if (!target || seen.has(target)) continue;
      seen.add(target);
      const { changed, merged } = await mergeInto(target, instruction, content);
      installed.push({ agent, instruction, path: target, changed, merged });
    }
  }
  return installed;
}
