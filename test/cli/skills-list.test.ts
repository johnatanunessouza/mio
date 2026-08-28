import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const executable = path.join(root, 'bin', 'mio.js');

let repo: string;
let project: string;

function writeSkill(category: string, id: string, description: string): void {
  const target = path.join(repo, 'skills', category, id);
  mkdirSync(path.join(target, 'references'), { recursive: true });
  writeFileSync(path.join(target, 'SKILL.md'), `---\nname: ${id}\ndescription: ${description}\n---\n`, 'utf8');
  writeFileSync(path.join(target, 'references', 'notes.md'), 'notes\n', 'utf8');
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'mio-skills-list-repo-'));
  project = mkdtempSync(path.join(tmpdir(), 'mio-skills-list-dst-'));
  writeSkill('frontend', 'design-system', 'Build a design system');
  writeSkill('utils', 'debugging', 'Debug a failing test');
  mkdirSync(path.join(repo, 'skills', 'backend'), { recursive: true });
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
  rmSync(project, { recursive: true, force: true });
});

function run(...args: string[]) {
  return spawnSync(process.execPath, [executable, 'skills-list', ...args], { cwd: root, encoding: 'utf8' });
}

describe('mio skills-list', () => {
  it('lists the categories of the repository', () => {
    const result = run('--repo', repo, '--no-color');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('skills:');
    expect(result.stdout).toContain('backend (0 skills)');
    expect(result.stdout).toContain('frontend (1 skill)');
    expect(result.stdout).toContain('utils (1 skill)');
  });

  it('drills into one category and shows its skills', () => {
    const result = run('--repo', repo, '--category', 'utils', '--no-color');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('debugging — Debug a failing test');
  });

  it('prints the catalog as JSON without installing', () => {
    const result = run('--repo', repo, '--json');
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { categories: { id: string; skills: { id: string }[] }[] };
    expect(payload.categories.map((category) => category.id)).toEqual(['backend', 'frontend', 'utils']);
    expect(payload.categories[1].skills[0].id).toBe('design-system');
  });

  it('installs the selected skills into the selected agents', () => {
    const result = run(project, '--repo', repo, '--category', 'utils', '--skills', 'debugging', '--agents', 'claude,codex', '--no-color');
    expect(result.status).toBe(0);
    expect(existsSync(path.join(project, '.claude', 'skills', 'debugging', 'SKILL.md'))).toBe(true);
    expect(existsSync(path.join(project, '.claude', 'skills', 'debugging', 'references', 'notes.md'))).toBe(true);
    expect(existsSync(path.join(project, '.agents', 'skills', 'debugging', 'SKILL.md'))).toBe(true);
  });

  it('writes the archive guidance into openspec when code-review is installed', () => {
    writeSkill('utils', 'code-review', 'Review the current diff');
    mkdirSync(path.join(project, 'openspec'), { recursive: true });
    writeFileSync(path.join(project, 'openspec', 'config.yaml'), 'schema: spec-driven\n', 'utf8');

    const result = run(project, '--repo', repo, '--category', 'utils', '--skills', 'code-review', '--agents', 'claude', '--no-color');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('archive guidance written');

    const config = readFileSync(path.join(project, 'openspec', 'config.yaml'), 'utf8');
    expect(config).toContain('schema: spec-driven');
    expect(config).toContain('# BEGIN MIO: openspec-guidance');
    expect(config).toContain('archive:\n  guidance:\n    - Antes de arquivar,');
  });

  it('says nothing about openspec for a skill that contributes no guidance', () => {
    mkdirSync(path.join(project, 'openspec'), { recursive: true });
    writeFileSync(path.join(project, 'openspec', 'config.yaml'), 'schema: spec-driven\n', 'utf8');
    const result = run(project, '--repo', repo, '--category', 'utils', '--skills', 'debugging', '--agents', 'claude', '--no-color');
    expect(result.status).toBe(0);
    expect(result.stdout).not.toContain('OpenSpec');
    expect(readFileSync(path.join(project, 'openspec', 'config.yaml'), 'utf8')).toBe('schema: spec-driven\n');
  });

  it('tells the user openspec is missing when code-review lands in a project without it', () => {
    writeSkill('utils', 'code-review', 'Review the current diff');
    const result = run(project, '--repo', repo, '--category', 'utils', '--skills', 'code-review', '--agents', 'claude', '--no-color');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('mio init --tools openspec');
  });

  it('installs every skill of a category with --skills all', () => {
    expect(run(project, '--repo', repo, '--category', 'frontend', '--skills', 'all', '--agents', 'claude').status).toBe(0);
    expect(existsSync(path.join(project, '.claude', 'skills', 'design-system', 'SKILL.md'))).toBe(true);
  });

  it('reports an unchanged rerun instead of rewriting', () => {
    const args = [project, '--repo', repo, '--category', 'utils', '--skills', 'debugging', '--agents', 'claude', '--no-color'];
    expect(run(...args).stdout).toContain('✓ Claude Code');
    expect(run(...args).stdout).toContain('already up to date');
  });

  it('rejects an unknown skill before writing anything', () => {
    const result = run(project, '--repo', repo, '--category', 'utils', '--skills', 'ghost', '--agents', 'claude');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unknown skill in "utils": ghost');
    expect(existsSync(path.join(project, '.claude'))).toBe(false);
  });

  it('rejects an unknown category', () => {
    const result = run('--repo', repo, '--category', 'nope', '--skills', 'x', '--agents', 'claude');
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Unknown category: nope');
  });

  it('reads the categories from --skills-dir', () => {
    mkdirSync(path.join(repo, 'catalog', 'ops'), { recursive: true });
    const result = run('--repo', repo, '--skills-dir', 'catalog', '--no-color');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('ops (0 skills)');
    expect(result.stdout).not.toContain('frontend');
  });

  it('reports the configured repository as the default in --json', () => {
    // Reads the catalog entry without cloning: MIO_SKILLS_REPO points the
    // default at the local fixture, so the run stays offline.
    const result = spawnSync(process.execPath, [executable, 'skills-list', '--json'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, MIO_SKILLS_REPO: repo },
    });
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as { repository: { source: string } };
    expect(payload.repository.source).toBe(repo);
  });
});
