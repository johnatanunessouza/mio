import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mergeJsonFile, setJsonValue } from '../../src/utils/json-file.js';

let root: string;
beforeEach(() => { root = mkdtempSync(path.join(tmpdir(), 'mio-json-test-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

describe('mergeJsonFile', () => {
  it('creates the file and its parent directory', async () => {
    const file = path.join(root, '.vscode', 'mcp.json');
    expect((await mergeJsonFile(file, { servers: { codegraph: { command: 'codegraph' } } })).changed).toBe(true);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ servers: { codegraph: { command: 'codegraph' } } });
  });

  it('preserves servers the user configured by hand', async () => {
    const file = path.join(root, '.mcp.json');
    writeFileSync(file, JSON.stringify({ mcpServers: { mine: { command: 'x' } } }));
    await mergeJsonFile(file, { mcpServers: { codegraph: { command: 'codegraph' } } });
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    expect(parsed.mcpServers.mine).toEqual({ command: 'x' });
    expect(parsed.mcpServers.codegraph).toEqual({ command: 'codegraph' });
  });

  it('never overwrites an existing leaf value', async () => {
    const file = path.join(root, '.mcp.json');
    writeFileSync(file, JSON.stringify({ mcpServers: { codegraph: { command: '/custom/codegraph' } } }));
    await mergeJsonFile(file, { mcpServers: { codegraph: { command: 'codegraph', args: ['serve'] } } });
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    expect(parsed.mcpServers.codegraph.command).toBe('/custom/codegraph');
    expect(parsed.mcpServers.codegraph.args).toEqual(['serve']);
  });

  it('is idempotent', async () => {
    const file = path.join(root, '.mcp.json');
    const patch = { mcpServers: { codegraph: { command: 'codegraph' } } };
    await mergeJsonFile(file, patch);
    expect((await mergeJsonFile(file, patch)).changed).toBe(false);
  });

  it('refuses to patch malformed JSON rather than clobbering it', async () => {
    const file = path.join(root, 'broken.json');
    writeFileSync(file, '{ not json');
    await expect(mergeJsonFile(file, { a: 1 })).rejects.toThrow(/malformed JSON/);
    expect(readFileSync(file, 'utf8')).toBe('{ not json');
  });
});

describe('setJsonValue', () => {
  it('overwrites one key and leaves the rest untouched', async () => {
    const file = path.join(root, 'config.json');
    writeFileSync(file, JSON.stringify({ profile: 'core', workflows: ['propose'], telemetry: { id: 'abc' } }));
    expect((await setJsonValue(file, 'workflows', ['propose', 'apply'])).changed).toBe(true);
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    expect(parsed.workflows).toEqual(['propose', 'apply']);
    expect(parsed.telemetry).toEqual({ id: 'abc' });
    expect(parsed.profile).toBe('core');
  });

  it('reports no change when the value already matches', async () => {
    const file = path.join(root, 'config.json');
    writeFileSync(file, `${JSON.stringify({ workflows: ['a'] }, null, 2)}\n`);
    expect((await setJsonValue(file, 'workflows', ['a'])).changed).toBe(false);
  });
});
