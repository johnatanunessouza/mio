/** Pixel-art animation used by the mio onboarding screen. */

const supportsUnicode =
  process.platform !== 'win32' || Boolean(process.env.WT_SESSION) || Boolean(process.env.TERM_PROGRAM);

const CHARS = supportsUnicode
  ? { full: '██', dim: '░░', empty: '  ' }
  : { full: '##', dim: '++', empty: '  ' };

/**
 * The cat, one character per cell: `#` solid, `:` always soft (whiskers),
 * `.` empty. Each cell renders as two columns, so the sprite is roughly
 * square on screen at 8x10.
 */
const CAT_SPRITE = [
  '.#....#.',
  '.##..##.',
  '.######.',
  ':#.##.#:',
  ':######:',
  '..####..',
  '.#####.#',
  '.#####.#',
  '.#######',
  '.##..##.',
] as const;

const CENTER_COLUMN = (CAT_SPRITE[0].length - 1) / 2;
const CENTER_ROW = (CAT_SPRITE.length - 1) / 2;

/** Distance from the sprite's center, in cells, rounded to a growth ring. */
function ringOf(column: number, row: number): number {
  return Math.round(Math.hypot(column - CENTER_COLUMN, row - CENTER_ROW));
}

const RINGS = CAT_SPRITE.flatMap((line, row) =>
  [...line].flatMap((cell, column) => (cell === '.' ? [] : [ringOf(column, row)]))
);
const MIN_RING = Math.min(...RINGS);
const MAX_RING = Math.max(...RINGS);

/** Frames past the last ring, so the finished cat stays readable before looping. */
const HOLD_FRAMES = 3;

/**
 * One frame of the pulse: rings inside `edge` are solid, the ring itself is the
 * soft leading edge, everything further out is still empty. `edge > MAX_RING`
 * yields the completed cat.
 */
function frameAt(edge: number): string[] {
  return CAT_SPRITE.map((line, row) =>
    [...line]
      .map((cell, column) => {
        if (cell === '.') return CHARS.empty;
        const ring = ringOf(column, row);
        if (ring > edge) return CHARS.empty;
        if (cell === ':') return CHARS.dim;
        return ring === edge ? CHARS.dim : CHARS.full;
      })
      .join('')
  );
}

/** The cat drawing itself from the center out, then holding, then looping. */
export const WELCOME_ANIMATION = {
  interval: 120,
  frames: [
    CAT_SPRITE.map(() => CHARS.empty.repeat(CAT_SPRITE[0].length)),
    ...Array.from({ length: MAX_RING - MIN_RING + 1 }, (_unused, step) => frameAt(MIN_RING + step)),
    ...Array.from({ length: HOLD_FRAMES }, () => frameAt(MAX_RING + 1)),
  ],
} as const;
