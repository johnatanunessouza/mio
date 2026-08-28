import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import type { RepositorySkill, SkillCategory, SkillRepositoryCheckout } from './types.js';

/** The file that makes a directory a skill, in the format every agent reads. */
export const SKILL_MANIFEST = 'SKILL.md';

function unquote(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && (trimmed.startsWith('"') || trimmed.startsWith("'")) && trimmed.endsWith(trimmed[0])) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Read `name` and `description` out of a SKILL.md frontmatter block. Only the
 * two keys the menu shows are parsed, but folded and literal block scalars
 * (`>-`, `|`) are supported because real skills wrap long descriptions.
 */
export function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  const normalized = content.replace(/^﻿/, '');
  const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(normalized);
  if (!match) return {};

  const lines = match[1].split(/\r?\n/);
  const fields: Record<string, string> = {};
  for (let index = 0; index < lines.length; index += 1) {
    const entry = /^([A-Za-z0-9_-]+):[ \t]*(.*)$/.exec(lines[index]);
    if (!entry) continue;
    const [, key, rawValue] = entry;
    if (!/^[|>][+-]?$/.test(rawValue.trim())) {
      fields[key] = unquote(rawValue);
      continue;
    }
    // Block scalar: every following more-indented line belongs to this key.
    const folded = rawValue.trim().startsWith('>');
    const block: string[] = [];
    while (index + 1 < lines.length && (lines[index + 1].trim() === '' || /^\s+\S/.test(lines[index + 1]))) {
      index += 1;
      block.push(lines[index].trim());
    }
    fields[key] = folded ? block.join(' ').replace(/\s+/g, ' ').trim() : block.join('\n').trim();
  }
  return { name: fields.name || undefined, description: fields.description || undefined };
}

async function readDirectories(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function readSkill(categoryId: string, categoryPath: string, id: string): Promise<RepositorySkill | undefined> {
  const skillPath = path.join(categoryPath, id);
  let manifest: string;
  try {
    manifest = await readFile(path.join(skillPath, SKILL_MANIFEST), 'utf8');
  } catch (error: unknown) {
    // A directory without a manifest is not a skill: skip it rather than
    // installing something no agent would load.
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
  const frontmatter = parseSkillFrontmatter(manifest);
  return { id, category: categoryId, path: skillPath, name: frontmatter.name ?? id, description: frontmatter.description };
}

/** Read one category directory and the skills it contains. */
export async function readSkillCategory(skillsRoot: string, categoryId: string): Promise<SkillCategory> {
  const categoryPath = path.join(skillsRoot, categoryId);
  const skills: RepositorySkill[] = [];
  for (const id of await readDirectories(categoryPath)) {
    const skill = await readSkill(categoryId, categoryPath, id);
    if (skill) skills.push(skill);
  }
  return { id: categoryId, path: categoryPath, skills };
}

/**
 * Read every category of a checkout. Empty categories are kept so the list
 * mirrors the repository the user browses on the remote.
 */
export async function readSkillCatalog(checkout: SkillRepositoryCheckout): Promise<SkillCategory[]> {
  const categories: SkillCategory[] = [];
  for (const id of await readDirectories(checkout.skillsRoot)) {
    categories.push(await readSkillCategory(checkout.skillsRoot, id));
  }
  return categories;
}

export function findCategory(categories: readonly SkillCategory[], id: string): SkillCategory {
  const wanted = id.trim().toLowerCase();
  const found = categories.find((category) => category.id.toLowerCase() === wanted);
  if (!found) {
    throw new Error(`Unknown category: ${id}. Available categories: ${categories.map((category) => category.id).join(', ')}`);
  }
  return found;
}

/** Resolve requested skill ids inside one category, preserving listed order. */
export function resolveCategorySkills(category: SkillCategory, ids: readonly string[]): RepositorySkill[] {
  const requested = ids.map((id) => id.trim().toLowerCase()).filter(Boolean);
  const unknown = requested.filter((id) => !category.skills.some((skill) => skill.id.toLowerCase() === id));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown skill in "${category.id}": ${unknown.join(', ')}. `
      + `Available skills: ${category.skills.map((skill) => skill.id).join(', ') || '(none)'}`
    );
  }
  return category.skills.filter((skill) => requested.includes(skill.id.toLowerCase()));
}
