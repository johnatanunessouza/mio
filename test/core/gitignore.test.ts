import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectAgentDirectories, updateGitignore } from '../../src/core/gitignore.js';
import { resolveAgents } from '../../src/core/agents/registry.js';

let project: string;
beforeEach(() => { project = mkdtempSync(path.join(tmpdir(), 'mio-gitignore-')); });
afterEach(() => { rmSync(project, { recursive: true, force: true }); });

const read = () => readFileSync(path.join(project, '.gitignore'), 'utf8');

describe('collectAgentDirectories', () => {
  it('always ignores the codegraph index, even with no agent selected', () => {
    expect(collectAgentDirectories([])).toEqual(['.codegraph']);
  });

  it('collects the directories of the selected agents', () => {
    expect(collectAgentDirectories(resolveAgents(['claude', 'github-copilot']))).toEqual(['.claude', '.codegraph', '.github']);
  });

  it('includes legacy directories so stale agent files stay ignored', () => {
    expect(collectAgentDirectories(resolveAgents(['codex']))).toEqual(['.agents', '.codegraph', '.codex']);
  });

  it('de-duplicates agents that share a directory', () => {
    expect(collectAgentDirectories(resolveAgents(['agents', 'zed']))).toEqual(['.agents', '.codegraph']);
  });

  it('omits agents that only support a global skills directory', () => {
    expect(collectAgentDirectories(resolveAgents(['minimax-code']))).toEqual(['.codegraph']);
  });
});

describe('updateGitignore', () => {
  it('creates the file with the block when no .gitignore exists', async () => {
    const result = await updateGitignore(project, ['.claude', '.codegraph']);
    expect(result.changed).toBe(true);
    expect(read()).toBe('## Agents ##\n.claude\n.codegraph\n');
  });

  it('appends the block without touching existing rules', async () => {
    writeFileSync(path.join(project, '.gitignore'), 'node_modules\ndist\n');
    await updateGitignore(project, ['.claude']);
    expect(read()).toBe('node_modules\ndist\n\n## Agents ##\n.claude\n');
  });

  it('is idempotent — a second run leaves the file byte-for-byte identical', async () => {
    await updateGitignore(project, ['.claude', '.codegraph']);
    const first = read();
    const second = await updateGitignore(project, ['.claude', '.codegraph']);
    expect(second.changed).toBe(false);
    expect(second.added).toEqual([]);
    expect(read()).toBe(first);
  });

  it('merges new directories into an existing block instead of duplicating it', async () => {
    await updateGitignore(project, ['.claude']);
    const result = await updateGitignore(project, ['.cursor', '.codegraph']);
    expect(result.added).toEqual(['.cursor', '.codegraph']);
    expect(read()).toBe('## Agents ##\n.claude\n.cursor\n.codegraph\n');
    expect(read().match(/## Agents ##/g)).toHaveLength(1);
  });

  it('keeps entries a user added to the block by hand', async () => {
    writeFileSync(path.join(project, '.gitignore'), '## Agents ##\n.mine\n');
    await updateGitignore(project, ['.claude']);
    expect(read()).toBe('## Agents ##\n.mine\n.claude\n');
  });

  it('stops the block at a blank line so a later section is not absorbed', async () => {
    writeFileSync(path.join(project, '.gitignore'), '## Agents ##\n.claude\n\n# build\ndist\n');
    await updateGitignore(project, ['.codegraph']);
    expect(read()).toBe('## Agents ##\n.claude\n.codegraph\n\n# build\ndist\n');
  });

  it('preserves CRLF line endings', async () => {
    writeFileSync(path.join(project, '.gitignore'), 'node_modules\r\n');
    await updateGitignore(project, ['.claude']);
    expect(read()).toBe('node_modules\r\n\r\n## Agents ##\r\n.claude\r\n');
  });
});
