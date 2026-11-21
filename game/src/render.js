// The renderer: paints the night gallery on one canvas — floor, walls, cover,
// relic pedestals, the exit, guards with their vision cones, the player, the
// lamp-light that shows what is safe, and the HUD — plus title, pause, caught
// and win screens. Everything is drawn from the world; nothing is an image.
import { TILE, COLORS, VISION, RELICS } from './config.js';
import { topSuspicion } from './guards.js';
import { exitLocked } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WIN = 'win';

const VIEW_WIDTH = 1280;
const VIEW_HEIGHT = 800;

/** Draw a vision cone as a translucent wedge from the guard's facing. */
function drawCone(ctx, guard) {
  const color = guard.state === 'alert' ? COLORS.coneAlert
    : guard.state === 'suspicious' || guard.state === 'search' ? COLORS.coneSuspicious
    : COLORS.coneCalm;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.arc(guard.x, guard.y, VISION.range, guard.angle - VISION.halfAngle, guard.angle + VISION.halfAngle);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

/** A small "?" or "!" bubble above a guard that is growing suspicious. */
function drawGuardMark(ctx, guard) {
  if (guard.state === 'patrol' && guard.suspicion < 12) return;
  const mark = guard.state === 'alert' ? '!' : guard.suspicion >= 38 || guard.state === 'suspicious' ? '?' : '·';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = guard.state === 'alert' ? '#ff6b5e' : '#ffd76a';
  ctx.fillText(mark, guard.x, guard.y - 26);
  // Suspicion arc around the guard: the meter the player reads at a glance.
  if (guard.suspicion > 0) {
    ctx.beginPath();
    ctx.arc(guard.x, guard.y, 20, -Math.PI / 2, -Math.PI / 2 + (guard.suspicion / 100) * Math.PI * 2);
    ctx.strokeStyle = guard.suspicion >= 38 ? '#ff6b5e' : '#ffd76a';
    ctx.lineWidth = 3;
    ctx.stroke();
  }
}

function drawFloor(ctx, level) {
  for (let row = 0; row < level.height; row += 1) {
    for (let col = 0; col < level.width; col += 1) {
      const index = row * level.width + col;
      const x = col * TILE;
      const y = row * TILE;
      if (level.solid[index]) continue;
      ctx.fillStyle = level.shadow[index] ? COLORS.shadowFloor : (row + col) % 2 === 0 ? COLORS.floor : COLORS.floorAlt;
      ctx.fillRect(x, y, TILE, TILE);
      if (level.shadow[index]) {
        ctx.fillStyle = 'rgba(120, 140, 255, 0.05)';
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      }
    }
  }
}

function drawWallsAndCover(ctx, level) {
  for (let row = 0; row < level.height; row += 1) {
    for (let col = 0; col < level.width; col += 1) {
      const index = row * level.width + col;
      const x = col * TILE;
      const y = row * TILE;
      if (level.solid[index] && level.blocksSight[index] && level.crates.every((c) => c.x !== x || c.y !== y)
        && level.cases.every((c) => c.x !== x || c.y !== y)) {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x, y, TILE, 5);
      }
    }
  }
  for (const crate of level.crates) {
    ctx.fillStyle = COLORS.crate;
    ctx.fillRect(crate.x + 2, crate.y + 2, TILE - 4, TILE - 4);
    ctx.fillStyle = COLORS.crateTop;
    ctx.fillRect(crate.x + 2, crate.y + 2, TILE - 4, 6);
    ctx.strokeStyle = '#5d451f';
    ctx.lineWidth = 2;
    ctx.strokeRect(crate.x + 2, crate.y + 2, TILE - 4, TILE - 4);
    ctx.beginPath();
    ctx.moveTo(crate.x + 2, crate.y + 2);
    ctx.lineTo(crate.x + TILE - 2, crate.y + TILE - 2);
    ctx.stroke();
  }
  for (const display of level.cases) {
    ctx.fillStyle = COLORS.caseBase;
    ctx.fillRect(display.x + 3, display.y + TILE - 10, TILE - 6, 8);
    ctx.fillStyle = COLORS.caseGlass;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(display.x + 4, display.y + 4, TILE - 8, TILE - 12);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#9fc4d8';
    ctx.lineWidth = 1;
    ctx.strokeRect(display.x + 4, display.y + 4, TILE - 8, TILE - 12);
  }
}

function drawRelicsAndExit(ctx, level, time) {
  for (const relic of level.relics) {
    if (relic.taken) continue;
    const bob = Math.sin(time * 2 + relic.x) * 3;
    ctx.beginPath();
    ctx.arc(relic.x, relic.y + bob, 17, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 106, 0.22)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(relic.x, relic.y + bob, 10, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.relic;
    ctx.fill();
    ctx.fillStyle = '#7a5c00';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◆', relic.x, relic.y + bob);
  }
  const exit = level.exit;
  const pulse = 0.6 + Math.sin(time * 3) * 0.25;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = COLORS.exit;
  ctx.fillRect(exit.x - 15, exit.y - 15, 30, 30);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#eafff2';
  ctx.lineWidth = 2;
  ctx.strokeRect(exit.x - 15, exit.y - 15, 30, 30);
  ctx.fillStyle = '#062b16';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', exit.x, exit.y);
}

function drawGuards(ctx, guards) {
  for (const guard of guards) drawCone(ctx, guard);
  for (const guard of guards) {
    // A walking bob so patrols read as moving, not pasted.
    const bob = Math.sin(guard.stepPhase * 0.09) * 1.5;
    ctx.beginPath();
    ctx.arc(guard.x, guard.y + bob, GUARD_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = guard.state === 'alert' ? '#ff6b5e' : COLORS.guard;
    ctx.fill();
    ctx.strokeStyle = COLORS.guardDark;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Facing tick: which way the guard looks.
    ctx.beginPath();
    ctx.moveTo(guard.x, guard.y + bob);
    ctx.lineTo(guard.x + Math.cos(guard.angle) * 16, guard.y + bob + Math.sin(guard.angle) * 16);
    ctx.strokeStyle = '#ffd9d4';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Little cap so guards read at a glance against the floor.
    ctx.beginPath();
    ctx.arc(guard.x, guard.y + bob, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#2b1410';
    ctx.fill();
    drawGuardMark(ctx, guard);
  }
}

const GUARD_RADIUS = 13;

function drawPlayer(ctx, player, level, time) {
  // Noise ring while running: the sound the player is making, made visible.
  if (player.noise > 60) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.noise * 0.55, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  const crouch = player.sneaking ? 0.8 : 1;
  ctx.beginPath();
  ctx.arc(player.x, player.y, PLAYER_RADIUS * crouch, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.playerCloak;
  ctx.fill();
  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(player.x, player.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.player;
  ctx.fill();
  // Facing tick.
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.facing) * 15, player.y + Math.sin(player.facing) * 15);
  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 2;
  ctx.stroke();
  void time;
  void level;
}

const PLAYER_RADIUS = 13;

/** Warm lamplight around the player and the exit; the rest stays night-dark. */
function drawLighting(ctx, world) {
  const gradient = ctx.createRadialGradient(
    world.player.x, world.player.y, 60,
    world.player.x, world.player.y, 340,
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(6, 8, 18, 0.42)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
}

function drawHud(ctx, world) {
  const suspicion = topSuspicion(world.guards);
  ctx.fillStyle = 'rgba(8, 10, 18, 0.78)';
  ctx.fillRect(0, 0, VIEW_WIDTH, 46);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('LAMPLIGHT — The Quiet Gallery', 14, 23);
  ctx.font = '15px sans-serif';
  ctx.fillStyle = COLORS.relic;
  ctx.fillText(`◆ Relics ${world.player.relicsTaken}/${RELICS.length}`, 330, 23);
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`Pebbles ${world.player.pebbles}  ·  ${formatTime(world.time)}`, 480, 23);
  // Suspicion meter: the near-miss tension, always visible.
  ctx.fillStyle = '#3a2a2a';
  ctx.fillRect(700, 14, 180, 18);
  ctx.fillStyle = suspicion >= 38 ? '#ff6b5e' : suspicion > 0 ? '#ffd76a' : '#58d68d';
  ctx.fillRect(700, 14, 180 * (suspicion / 100), 18);
  ctx.strokeStyle = '#f2ead8';
  ctx.lineWidth = 1;
  ctx.strokeRect(700, 14, 180, 18);
  ctx.fillStyle = COLORS.text;
  ctx.font = '13px sans-serif';
  ctx.fillText(suspicion >= 38 ? 'SEEN!' : 'Suspicion', 890, 23);
  ctx.fillStyle = world.alarm > 0.4 ? '#ff6b5e' : COLORS.textDim;
  ctx.fillText(world.alarm > 0.4 ? 'ALARM' : 'Quiet', 990, 23);
  const objective = exitLocked(world)
    ? 'Steal all three relics — stay out of the cones, hide in shadow.'
    : 'All relics pocketed — reach the green EXIT, unseen!';
  ctx.fillStyle = 'rgba(8, 10, 18, 0.78)';
  ctx.fillRect(0, VIEW_HEIGHT - 30, VIEW_WIDTH, 30);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '14px sans-serif';
  ctx.fillText(objective, 14, VIEW_HEIGHT - 15);
  if (world.message) {
    ctx.fillStyle = 'rgba(8, 10, 18, 0.8)';
    const width = ctx.measureText(world.message).width + 28;
    ctx.fillRect((VIEW_WIDTH - width) / 2, 56, width, 30);
    ctx.fillStyle = '#ffd76a';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(world.message, VIEW_WIDTH / 2, 71);
    ctx.textAlign = 'left';
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

function drawScreenOverlay(ctx, title, lines, hint) {
  ctx.fillStyle = 'rgba(6, 8, 16, 0.82)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, VIEW_WIDTH / 2, 300);
  ctx.font = '19px sans-serif';
  ctx.fillStyle = COLORS.textDim;
  lines.forEach((line, index) => {
    ctx.fillText(line, VIEW_WIDTH / 2, 360 + index * 30);
  });
  ctx.fillStyle = COLORS.relic;
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText(hint, VIEW_WIDTH / 2, 360 + lines.length * 30 + 30);
  ctx.textAlign = 'left';
}

export function createRenderer(canvas) {
  canvas.width = VIEW_WIDTH;
  canvas.height = VIEW_HEIGHT;
  const ctx = canvas.getContext('2d');

  return {
    /** Paint the world on `screen` (title, play, paused, caught or win). */
    draw(world, screen, best) {
      ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      ctx.fillStyle = '#10131c';
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
      drawFloor(ctx, world.level);
      drawRelicsAndExit(ctx, world.level, world.time);
      drawWallsAndCover(ctx, world.level);
      drawGuards(ctx, world.guards);
      if (world.pebble) {
        ctx.beginPath();
        ctx.arc(world.pebble.x, world.pebble.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#d8d2c0';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(world.pebble.x, world.pebble.y, 14 + (1.2 - world.pebble.ttl) * 30, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.stroke();
      }
      drawPlayer(ctx, world.player, world.level, world.time);
      drawLighting(ctx, world);
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(ctx, world);
      if (screen === SCREEN_TITLE) {
        drawScreenOverlay(ctx, 'LAMPLIGHT', [
          'The Quiet Gallery — a top-down stealth heist.',
          'Steal the Sun Disk, the Jade Fox and the Moon Harp,',
          'then slip out the green exit — unseen.',
          'WASD / arrows to move · Shift to run (loud!) · C to sneak',
          'E toss a pebble · F grab a relic · click to walk there · P pause · M mute',
          best > 0 ? `Best escape: ${formatTime(best)}` : 'No escape yet. The guards patrol — learn their routes.',
        ], 'Press Space or click to begin');
      } else if (screen === SCREEN_PAUSED) {
        drawScreenOverlay(ctx, 'Paused', ['The gallery waits. The guards do not forget.'], 'Press P or Space to keep sneaking');
      } else if (screen === SCREEN_CAUGHT) {
        drawScreenOverlay(ctx, 'CAUGHT!', [
          `A guard caught Wren after ${formatTime(world.time)}.`,
          `${world.player.relicsTaken} of ${RELICS.length} relics pocketed.`,
          'Patience beats speed: watch the cones, use the shadows.',
        ], 'Press Space to try again');
      } else if (screen === SCREEN_WIN) {
        drawScreenOverlay(ctx, 'CLEAN GETAWAY!', [
          `Wren slipped out with all three relics in ${formatTime(world.time)}.`,
          best > 0 ? `Best escape: ${formatTime(best)}` : '',
          'Not a single guard raised the alarm — or did they?',
        ], 'Press Space to steal again');
      }
    },
  };
}
