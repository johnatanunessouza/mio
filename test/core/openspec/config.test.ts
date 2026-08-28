import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyOpenspecGuidance, findOpenspecConfigPath } from '../../../src/core/openspec/config.js';
import { OPENSPEC_GUIDANCE_BLOCK_ID } from '../../../src/core/openspec/guidance.js';
import { beginMarker, endMarker } from '../../../src/core/instructions/block.js';

const BEGIN = beginMarker(OPENSPEC_GUIDANCE_BLOCK_ID, 'yaml');
const END = endMarker(OPENSPEC_GUIDANCE_BLOCK_ID, 'yaml');

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'mio-openspec-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const configPath = (name = 'config.yaml') => path.join(root, 'openspec', name);

function openspecProject(contents = 'schema: spec-driven\n', name = 'config.yaml'): string {
  mkdirSync(path.join(root, 'openspec'), { recursive: true });
  writeFileSync(configPath(name), contents, 'utf8');
  return configPath(name);
}

/** Put a `code-review` bundle where an agent's skills directory expects it. */
function installCodeReview(agentDir = '.claude'): void {
  const dir = path.join(root, agentDir, 'skills', 'code-review');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'SKILL.md'), '---\nname: code-review\n---\n', 'utf8');
}

describe('findOpenspecConfigPath', () => {
  it('returns nothing when the project has no openspec directory', async () => {
    expect(await findOpenspecConfigPath(root)).toBeUndefined();
  });

  it('finds the config file the project already has', async () => {
    openspecProject();
    expect(await findOpenspecConfigPath(root)).toBe(configPath());
  });

  it('honours the .yml spelling when that is what exists', async () => {
    openspecProject('schema: spec-driven\n', 'config.yml');
    expect(await findOpenspecConfigPath(root)).toBe(configPath('config.yml'));
  });

  it('falls back to config.yaml when the directory exists without a config', async () => {
    mkdirSync(path.join(root, 'openspec'), { recursive: true });
    expect(await findOpenspecConfigPath(root)).toBe(configPath());
  });
});

describe('applyOpenspecGuidance', () => {
  it('writes nothing when no installed skill contributes guidance', async () => {
    const file = openspecProject();
    const result = await applyOpenspecGuidance({ projectRoot: root });
    expect(result).toMatchObject({ changed: false, reason: 'no-guidance' });
    expect(readFileSync(file, 'utf8')).toBe('schema: spec-driven\n');
  });

  it('writes the archive guidance when the code-review skill is installed', async () => {
    const file = openspecProject();
    installCodeReview();
    const result = await applyOpenspecGuidance({ projectRoot: root });
    expect(result).toMatchObject({ changed: true, path: file, skillIds: ['code-review'], sections: ['archive'] });

    const written = readFileSync(file, 'utf8');
    expect(written).toContain(`${BEGIN}\narchive:\n  guidance:\n    - Antes de arquivar,`);
    expect(written.trimEnd().endsWith(END)).toBe(true);
  });

  it('applies guidance for a skill being installed before it is on disk', async () => {
    const file = openspecProject();
    const result = await applyOpenspecGuidance({ projectRoot: root, skillIds: ['code-review'] });
    expect(result.changed).toBe(true);
    expect(readFileSync(file, 'utf8')).toContain('archive:');
  });

  it('reports the project has no openspec yet instead of creating one', async () => {
    installCodeReview();
    const result = await applyOpenspecGuidance({ projectRoot: root });
    expect(result).toMatchObject({ changed: false, reason: 'no-openspec-project', skillIds: ['code-review'] });
  });

  it('creates config.yaml when openspec/ exists without one', async () => {
    mkdirSync(path.join(root, 'openspec'), { recursive: true });
    installCodeReview();
    expect((await applyOpenspecGuidance({ projectRoot: root })).changed).toBe(true);
    expect(readFileSync(configPath(), 'utf8')).toContain('archive:');
  });

  it('preserves everything the user wrote outside the markers', async () => {
    const file = openspecProject('schema: spec-driven\n\n# my own note\ncontext: |\n  Tech stack: TypeScript\n');
    installCodeReview();
    await applyOpenspecGuidance({ projectRoot: root });
    const written = readFileSync(file, 'utf8');
    expect(written).toContain('# my own note');
    expect(written).toContain('context: |\n  Tech stack: TypeScript');
    expect(written.indexOf('schema: spec-driven')).toBeLessThan(written.indexOf(BEGIN));
  });

  it('is idempotent across reruns', async () => {
    const file = openspecProject();
    installCodeReview();
    await applyOpenspecGuidance({ projectRoot: root });
    const once = readFileSync(file, 'utf8');
    expect((await applyOpenspecGuidance({ projectRoot: root })).changed).toBe(false);
    expect(readFileSync(file, 'utf8')).toBe(once);
  });

  it('replaces a stale block rather than appending a second one', async () => {
    const file = openspecProject(`schema: spec-driven\n\n${BEGIN}\narchive:\n  guidance:\n    - outdated\n${END}\n`);
    installCodeReview();
    await applyOpenspecGuidance({ projectRoot: root });
    const written = readFileSync(file, 'utf8');
    expect(written).not.toContain('outdated');
    expect(written.split(BEGIN)).toHaveLength(2);
  });

  it('detects the skill under any agent, not just the first', async () => {
    openspecProject();
    installCodeReview('.agents');
    expect((await applyOpenspecGuidance({ projectRoot: root })).changed).toBe(true);
  });

  it('writes nothing under dryRun but reports what it would write', async () => {
    const file = openspecProject();
    installCodeReview();
    const result = await applyOpenspecGuidance({ projectRoot: root, dryRun: true });
    expect(result).toMatchObject({ changed: false, path: file, skillIds: ['code-review'] });
    expect(readFileSync(file, 'utf8')).toBe('schema: spec-driven\n');
  });
});
