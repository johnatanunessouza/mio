import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentDefinition } from './agents/types.js';

/** Header that delimits the block mio owns inside the project `.gitignore`. */
export const AGENTS_BLOCK_HEADER = '## Agents ##';

/**
 * Directories mio always ignores regardless of the agent selection, because
 * some tool writes them into every project it touches.
 */
const ALWAYS_IGNORED = ['.codegraph'];

export interface GitignoreUpdate {
  path: string;
  changed: boolean;
  /** Entries added by this run; empty when the block was already complete. */
  added: string[];
  /** Every entry the block holds after the update, in written order. */
  entries: string[];
}

/**
 * Project-relative directories owned by the selected agents. `minimax-code`
 * and friends that only support a global skills directory contribute nothing:
 * their files never land inside the repository.
 */
export function collectAgentDirectories(agents: readonly AgentDefinition[]): string[] {
  const directories = new Set(ALWAYS_IGNORED);
  for (const agent of agents) {
    for (const dir of [agent.skillsDir, ...(agent.legacySkillsDirs ?? [])]) {
      if (dir) directories.add(dir);
    }
  }
  return [...directories].sort();
}

interface ParsedBlock {
  /** Line index of the header, or -1 when the block is absent. */
  start: number;
  /** Line index just past the block's last entry. */
  end: number;
  entries: string[];
}

/**
 * Locate the `## Agents ##` block. It ends at the first blank line or at the
 * next section header, so entries a user appended by hand are preserved and a
 * following unrelated section is never absorbed.
 */
function parseBlock(lines: readonly string[]): ParsedBlock {
  const start = lines.findIndex((line) => line.trim() === AGENTS_BLOCK_HEADER);
  if (start === -1) return { start, end: -1, entries: [] };

  const entries: string[] = [];
  let end = start + 1;
  for (; end < lines.length; end += 1) {
    const line = lines[end].trim();
    if (line === '') break;
    if (line.startsWith('#')) break;
    entries.push(line);
  }
  return { start, end, entries };
}

function renderBlock(entries: readonly string[]): string[] {
  return [AGENTS_BLOCK_HEADER, ...entries];
}

/**
 * Merge the agent directories into the `## Agents ##` block of the project
 * `.gitignore`, creating the file or the block when either is missing.
 *
 * Existing entries are kept and ordering is stable, so re-running `mio init`
 * with a different agent selection accumulates instead of rewriting, and a
 * run that adds nothing leaves the file byte-for-byte untouched.
 */
export async function updateGitignore(projectRoot: string, directories: readonly string[]): Promise<GitignoreUpdate> {
  const target = path.join(projectRoot, '.gitignore');

  let original = '';
  let existed = true;
  try {
    original = await readFile(target, 'utf8');
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    existed = false;
  }

  const newline = original.includes('\r\n') ? '\r\n' : '\n';
  // Split off the trailing newline so it is not carried around as an empty
  // line that would accumulate every time the block is rewritten.
  const body = original.endsWith('\n') ? original.replace(/\r?\n$/, '') : original;
  const lines = body.length === 0 ? [] : body.split(/\r?\n/);
  const block = parseBlock(lines);
  const added = directories.filter((dir) => !block.entries.includes(dir));

  if (block.start !== -1 && added.length === 0) {
    return { path: target, changed: false, added: [], entries: block.entries };
  }

  const entries = [...block.entries, ...added];
  let next: string[];
  if (block.start === -1) {
    // Append a fresh block, separated from whatever the file already had.
    const trimmed = [...lines];
    while (trimmed.length > 0 && trimmed.at(-1)!.trim() === '') trimmed.pop();
    next = trimmed.length === 0 ? renderBlock(entries) : [...trimmed, '', ...renderBlock(entries)];
  } else {
    next = [...lines.slice(0, block.start), ...renderBlock(entries), ...lines.slice(block.end)];
  }

  const content = `${next.join(newline)}${newline}`;
  if (existed && content === original) {
    return { path: target, changed: false, added: [], entries };
  }
  await writeFile(target, content, 'utf8');
  return { path: target, changed: true, added, entries };
}
