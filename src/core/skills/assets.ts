import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** `dist/assets`, the bundled payload `build.js` copies out of `src/assets`. */
const assetsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets');

export function skillAssetDir(skillName: string): string {
  return path.join(assetsRoot, 'skills', skillName);
}

export function commandAssetPath(body: string): string {
  return path.join(assetsRoot, 'commands', body);
}

/**
 * Resolve `target` inside `root`, refusing anything that escapes it. Agent
 * directories come from a fixed catalog, but a bad entry must never let mio
 * write outside the project the user pointed at.
 */
export function confinedPath(root: string, target: string): string {
  const absoluteRoot = path.resolve(root);
  const resolved = path.resolve(absoluteRoot, target);
  const relative = path.relative(absoluteRoot, resolved);
  if (relative === '' || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Refusing to write outside the allowed target root: ${target}`);
  }
  return resolved;
}
