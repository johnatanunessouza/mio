import path from 'node:path';
import { fileURLToPath } from 'node:url';

const assetsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets');

export function instructionAssetPath(id: string): string {
  return path.join(assetsRoot, 'instructions', `${id}.md`);
}
