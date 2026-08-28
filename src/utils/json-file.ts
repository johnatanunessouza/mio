import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

type JsonObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merge `patch` into the JSON document at `file`, preserving every key the
 * project already had. Existing leaf values win: mio never overwrites an MCP
 * server the user configured by hand.
 */
export async function mergeJsonFile(file: string, patch: JsonObject): Promise<{ changed: boolean }> {
  let current: JsonObject = {};
  let original: string | undefined;
  try {
    original = await readFile(file, 'utf8');
    const parsed: unknown = JSON.parse(original);
    if (!isPlainObject(parsed)) throw new Error(`Refusing to patch non-object JSON at ${file}`);
    current = parsed;
  } catch (error: unknown) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      if (error instanceof SyntaxError) throw new Error(`Cannot patch malformed JSON at ${file}: ${error.message}`);
      if (original !== undefined) throw error;
    }
  }

  const merged = mergeDeep(current, patch);
  const serialized = `${JSON.stringify(merged, null, 2)}\n`;
  if (original === serialized) return { changed: false };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, serialized, 'utf8');
  return { changed: true };
}

function mergeDeep(base: JsonObject, patch: JsonObject): JsonObject {
  const result: JsonObject = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const existing = result[key];
    if (isPlainObject(existing) && isPlainObject(value)) {
      result[key] = mergeDeep(existing, value);
    } else if (existing === undefined) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Set one top-level key in an existing JSON document, leaving every other key
 * untouched. Unlike `mergeJsonFile` this overwrites the key, for values that
 * must match exactly (arrays a CLI cannot set through its own config command).
 */
export async function setJsonValue(file: string, key: string, value: unknown): Promise<{ changed: boolean }> {
  let current: JsonObject = {};
  let original: string | undefined;
  try {
    original = await readFile(file, 'utf8');
    const parsed: unknown = JSON.parse(original);
    if (!isPlainObject(parsed)) throw new Error(`Refusing to patch non-object JSON at ${file}`);
    current = parsed;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      if (error instanceof SyntaxError) throw new Error(`Cannot patch malformed JSON at ${file}: ${error.message}`);
      if (original !== undefined) throw error;
    }
  }

  const serialized = `${JSON.stringify({ ...current, [key]: value }, null, 2)}\n`;
  if (original === serialized) return { changed: false };
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, serialized, 'utf8');
  return { changed: true };
}
