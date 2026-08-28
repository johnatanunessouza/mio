/** Strip the `v` prefix a git tag carries: `v1.12.0` -> `1.12.0`. */
export function normalizeVersion(value: string): string {
  return value.trim().replace(/^v/i, '');
}

function parseParts(value: string): number[] | undefined {
  const [core] = normalizeVersion(value).split(/[-+]/, 1);
  const parts = core.split('.');
  if (parts.length !== 3) return undefined;
  const numbers = parts.map((part) => (/^\d+$/.test(part) ? Number(part) : Number.NaN));
  return numbers.some(Number.isNaN) ? undefined : numbers;
}

/**
 * Whether `candidate` is a release the user does not have yet.
 *
 * Only stable `MAJOR.MINOR.PATCH` releases notify: a pre-release is never
 * offered to someone running a stable build, and anything unparseable is
 * treated as "not newer" so a malformed tag can never nag.
 */
export function isNewerVersion(candidate: string, current: string): boolean {
  if (/[-+]/.test(normalizeVersion(candidate))) return false;
  const next = parseParts(candidate);
  const now = parseParts(current);
  if (!next || !now) return false;
  for (let index = 0; index < 3; index += 1) {
    if (next[index] > now[index]) return true;
    if (next[index] < now[index]) return false;
  }
  return false;
}
