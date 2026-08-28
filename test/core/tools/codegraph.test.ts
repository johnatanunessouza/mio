import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { __testing } from '../../../src/core/tools/codegraph.js';

const { writeCopilotMcpConfig } = __testing;

let project: string;
beforeEach(() => { project = mkdtempSync(path.join(tmpdir(), 'mio-codegraph-')); });
afterEach(() => { rmSync(project, { recursive: true, force: true }); });

const read = (...segments: string[]) => JSON.parse(readFileSync(path.join(project, ...segments), 'utf8'));

describe('copilot MCP config', () => {
  it('writes one file per copilot surface, each under a directory the agent owns', async () => {
    const steps = await writeCopilotMcpConfig(project, '/usr/bin/codegraph');
    expect(steps.map((step) => step.status)).toEqual(['done', 'done']);

    expect(read('.vscode', 'mcp.json').servers.codegraph).toEqual({
      type: 'stdio', command: '/usr/bin/codegraph', args: ['serve', '--mcp'],
    });
    expect(read('.github', 'mcp.json').mcpServers.codegraph).toEqual({
      type: 'stdio', command: '/usr/bin/codegraph', args: ['serve', '--mcp'], tools: ['*'],
    });
  });

  it('leaves the root .mcp.json alone, since Claude Code and others read it', async () => {
    writeFileSync(path.join(project, '.mcp.json'), '{\n  "mcpServers": {}\n}\n', 'utf8');
    await writeCopilotMcpConfig(project, 'codegraph');
    expect(read('.mcp.json')).toEqual({ mcpServers: {} });
  });

  it('flags a codegraph entry left in the root .mcp.json by an older mio', async () => {
    writeFileSync(path.join(project, '.mcp.json'), JSON.stringify({ mcpServers: { codegraph: {} } }), 'utf8');
    const steps = await writeCopilotMcpConfig(project, 'codegraph');
    const legacy = steps.find((step) => step.label === 'legacy root MCP');
    expect(legacy?.detail).toContain('.github/mcp.json');
  });

  it('preserves a server the user configured by hand', async () => {
    mkdirSync(path.join(project, '.github'), { recursive: true });
    writeFileSync(path.join(project, '.github', 'mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'x' } } }), 'utf8');
    await writeCopilotMcpConfig(project, 'codegraph');
    expect(Object.keys(read('.github', 'mcp.json').mcpServers).sort()).toEqual(['codegraph', 'other']);
  });

  it('reports both targets without touching disk in dry run', async () => {
    const steps = await writeCopilotMcpConfig(project, 'codegraph', true);
    expect(steps.every((step) => step.status === 'skipped')).toBe(true);
    expect(() => read('.vscode', 'mcp.json')).toThrow();
    expect(() => read('.github', 'mcp.json')).toThrow();
  });
});
