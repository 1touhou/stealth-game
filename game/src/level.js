// The gallery floor: parses the text map into walls, cover, shadow, relics and
// the exit, and answers the two questions the stealth rules keep asking —
// "can I walk here?" and "can this guard see that spot?"
import { TILE, MAP } from './config.js';

export const KIND_WALL = 'wall';
export const KIND_CRATE = 'crate';
export const KIND_CASE = 'case';

/** Build the level from MAP. Relic pedestals keep their names in order. */
export function createLevel() {
  const height = MAP.length;
  const width = MAP[0].length;
  const solid = new Uint8Array(width * height); // 1 where movement is blocked
  const blocksSight = new Uint8Array(width * height); // 1 where vision is blocked
  const shadow = new Uint8Array(width * height); // 1 where the floor is dark
  const crates = [];
  const cases = [];
  const relics = [];
  let playerStart = { x: 3 * TILE, y: 23 * TILE };
  let exit = { x: 37 * TILE, y: 1 * TILE };
  const relicNames = ['Sun Disk', 'Jade Fox', 'Moon Harp'];

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const cell = MAP[row][col];
      const index = row * width + col;
      const cx = col * TILE + TILE / 2;
      const cy = row * TILE + TILE / 2;
      if (cell === '#') {
        solid[index] = 1;
        blocksSight[index] = 1;
      } else if (cell === 'C') {
        solid[index] = 1;
        blocksSight[index] = 1;
        crates.push({ x: col * TILE, y: row * TILE, kind: KIND_CRATE });
      } else if (cell === 'D') {
        solid[index] = 1;
        blocksSight[index] = 1;
        cases.push({ x: col * TILE, y: row * TILE, kind: KIND_CASE });
      } else if (cell === 's') {
        shadow[index] = 1;
      } else if (cell === 'R') {
        relics.push({ x: cx, y: cy, name: relicNames[relics.length] ?? `Relic ${relics.length + 1}`, taken: false });
      } else if (cell === 'E') {
        exit = { x: cx, y: cy };
      } else if (cell === 'P') {
        playerStart = { x: cx, y: cy };
      }
    }
  }

  return { width, height, solid, blocksSight, shadow, crates, cases, relics, playerStart, exit };
}

/** Tile index at a pixel position, or -1 outside the level. */
export function tileAt(level, x, y) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (col < 0 || row < 0 || col >= level.width || row >= level.height) return -1;
  return row * level.width + col;
}

/** True when the circle at (x, y) with the given radius overlaps solid ground. */
export function hitsSolid(level, x, y, radius) {
  const left = Math.floor((x - radius) / TILE);
  const right = Math.floor((x + radius) / TILE);
  const top = Math.floor((y - radius) / TILE);
  const bottom = Math.floor((y + radius) / TILE);
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) {
      if (col < 0 || row < 0 || col >= level.width || row >= level.height) return true;
      if (!level.solid[row * level.width + col]) continue;
      const nearestX = Math.max(col * TILE, Math.min(x, col * TILE + TILE));
      const nearestY = Math.max(row * TILE, Math.min(y, row * TILE + TILE));
      const dx = x - nearestX;
      const dy = y - nearestY;
      if (dx * dx + dy * dy < radius * radius) return true;
    }
  }
  return false;
}

/** Move a circle by (dx, dy), sliding along walls instead of sticking to them. */
export function moveCircle(level, x, y, dx, dy, radius) {
  let nextX = x + dx;
  if (hitsSolid(level, nextX, y, radius)) nextX = x;
  let nextY = y + dy;
  if (hitsSolid(level, x, nextY, radius)) nextY = y;
  // The axis the slide just used can still clip a corner; re-check together.
  if (hitsSolid(level, nextX, nextY, radius)) {
    if (!hitsSolid(level, x, nextY, radius)) nextX = x;
    else if (!hitsSolid(level, nextX, y, radius)) nextY = y;
    else {
      nextX = x;
      nextY = y;
    }
  }
  return { x: nextX, y: nextY };
}

/** True when the straight line between two points crosses no sight-blocking tile. */
export function hasLineOfSight(level, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const distance = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(distance / (TILE / 4)));
  for (let step = 1; step < steps; step += 1) {
    const index = tileAt(level, x0 + (dx * step) / steps, y0 + (dy * step) / steps);
    if (index !== -1 && level.blocksSight[index]) return false;
  }
  return true;
}

/** True when the point stands on a shadow patch (dark floor hides the player). */
export function inShadow(level, x, y) {
  const index = tileAt(level, x, y);
  return index !== -1 && level.shadow[index] === 1;
}

/** Distance to the nearest relic the player can still steal, or null. */
export function nearestRelic(level, x, y) {
  let best = null;
  let bestDistance = Infinity;
  for (const relic of level.relics) {
    if (relic.taken) continue;
    const distance = Math.hypot(relic.x - x, relic.y - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = relic;
    }
  }
  return best === null ? null : { relic: best, distance: bestDistance };
}
