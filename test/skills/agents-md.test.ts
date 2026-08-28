import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(repo, 'src', 'assets', 'skills', 'agents-create', 'scripts', 'agents-md.sh');
const BEGIN = '<!-- BEGIN GENERATED: mio:agents-create -->';
const END = '<!-- END GENERATED: mio:agents-create -->';

let project: string;

function write(relative: string, content: string): void {
  const target = path.join(project, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

function run(...args: string[]) {
  return spawnSync('bash', [script, '--root-dir', project, ...args], { cwd: project, encoding: 'utf8' });
}

beforeEach(() => {
  project = mkdtempSync(path.join(tmpdir(), 'mio-agents-md-'));
  write('package.json', JSON.stringify({ name: 'root', scripts: { build: 'tsc', test: 'vitest' } }));
  write('services/api/package.json', JSON.stringify({ name: 'api', dependencies: { express: '^4' } }));
  write('apps/web/package.json', JSON.stringify({ name: 'web', dependencies: { react: '^18' } }));
});
afterEach(() => { rmSync(project, { recursive: true, force: true }); });

describe('agents-md.sh', () => {
  it('lists nodes with the type detected from their manifests', () => {
    const result = run('--list');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('services/api  [tipo: service]');
    expect(result.stdout).toContain('apps/web  [tipo: app]');
  });

  it('requires a scope', () => {
    const result = spawnSync('bash', [script, '--root-dir', project], { cwd: project, encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('escolha um escopo');
  });

  it('writes the root file with the real tree and detected commands', () => {
    expect(run('--root').status).toBe(0);
    const content = readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    expect(content).toContain(BEGIN);
    expect(content).toContain(END);
    expect(content).toContain('**Monorepo**');
    expect(content).toContain('`npm run build`');
    expect(content).toContain('services/');
    expect(existsSync(path.join(project, 'services', 'api', 'AGENTS.md'))).toBe(false);
  });

  it('writes every node with --all', () => {
    expect(run('--all').status).toBe(0);
    expect(readFileSync(path.join(project, 'services', 'api', 'AGENTS.md'), 'utf8')).toContain('service (`services/api`)');
    expect(readFileSync(path.join(project, 'apps', 'web', 'AGENTS.md'), 'utf8')).toContain('app (`apps/web`)');
  });

  it('writes nothing in a dry run', () => {
    const result = run('--all', '--dry-run');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('DRY [root]');
    expect(existsSync(path.join(project, 'AGENTS.md'))).toBe(false);
  });

  it('is byte-for-byte idempotent', () => {
    run('--root');
    const first = readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    run('--root');
    expect(readFileSync(path.join(project, 'AGENTS.md'), 'utf8')).toBe(first);
  });

  it('rewrites only the managed block, preserving manual content', () => {
    run('--root');
    const manual = '\n## Minha seção\n\nregra que o usuário escreveu\n';
    writeFileSync(path.join(project, 'AGENTS.md'), `${readFileSync(path.join(project, 'AGENTS.md'), 'utf8')}${manual}`, 'utf8');
    write('services/worker/go.mod', 'module worker\n');

    expect(run('--root').status).toBe(0);
    const content = readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    expect(content).toContain('regra que o usuário escreveu');
    expect(content).toContain('services/worker/');
    expect(content.split(BEGIN)).toHaveLength(2);
  });

  it('prepends the block to an AGENTS.md written by hand', () => {
    write('AGENTS.md', '# Escrito à mão\n\nnão perder isso\n');
    expect(run('--root').status).toBe(0);
    const content = readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    expect(content.startsWith(BEGIN)).toBe(true);
    expect(content).toContain('não perder isso');
  });

  it('migrates a block left by the previous skill name', () => {
    write('AGENTS.md', '<!-- BEGIN GENERATED: generate-agents-md -->\nvelho\n<!-- END GENERATED: generate-agents-md -->\n\n## manual\ntexto\n');
    expect(run('--root').status).toBe(0);
    const content = readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    expect(content).toContain(BEGIN);
    expect(content).not.toContain('generate-agents-md');
    expect(content).not.toContain('velho');
    expect(content).toContain('texto');
  });

  it('keeps agent directories out of the tree', () => {
    write('.claude/skills/agents-create/SKILL.md', 'x');
    write('.codegraph/codegraph.db', 'x');
    expect(run('--root').status).toBe(0);
    const content = readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    expect(content).not.toContain('.claude/');
    expect(content).not.toContain('.codegraph/');
  });

  it('carries the mandatory code conventions in every node', () => {
    expect(run('--all').status).toBe(0);
    for (const file of ['AGENTS.md', 'services/api/AGENTS.md', 'apps/web/AGENTS.md']) {
      const content = readFileSync(path.join(project, file), 'utf8');
      expect(content).toContain('## Convenções de código (obrigatório)');
      expect(content).toContain('Não escreva comentários no código');
      expect(content).toContain('Não gere documentação embutida');
    }
  });

  it('leaves a block owned by mio init untouched', () => {
    write('AGENTS.md', '<!-- BEGIN MIO: response-protocol -->\nprotocolo\n<!-- END MIO: response-protocol -->\n');
    expect(run('--root').status).toBe(0);
    const content = readFileSync(path.join(project, 'AGENTS.md'), 'utf8');
    expect(content).toContain('<!-- BEGIN MIO: response-protocol -->');
    expect(content).toContain('protocolo');
    expect(content).toContain(BEGIN);
  });

  it('rejects an invalid --type', () => {
    const result = run('--root', '--type', 'nope');
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('--type aceita');
  });
});
