// The burglar, Wren: walks, sneaks and runs, makes noise when hurrying, tosses
// pebbles to pull a guard away, and pockets a relic when close enough.
import { PLAYER, PEBBLES, GUARD } from './config.js';
import { moveCircle, nearestRelic, inShadow } from './level.js';

export function createPlayer(level) {
  return {
    x: level.playerStart.x,
    y: level.playerStart.y,
    sneaking: false,
    running: false,
    noise: 0, // how far this step's movement can be heard, in pixels
    pebbles: PEBBLES,
    relicsTaken: 0,
    stepPhase: 0,
    facing: -Math.PI / 2,
    waypoint: null, // click-to-move target, or null
  };
}

/**
 * Advance the player one step. `move` is {x, y} in -1..1 from keys or a click
 * target; `actions` carries one-shot presses (sneak toggle, pebble, grab).
 * Returns event strings for the world: 'relic', 'pebble', 'exit' or null.
 */
export function stepPlayer(player, level, move, actions, dt) {
  player.sneaking = actions.sneakHeld;
  player.running = actions.runHeld && !player.sneaking && (move.x !== 0 || move.y !== 0);
  const speed = player.sneaking ? PLAYER.sneak : player.running ? PLAYER.run : PLAYER.walk;
  const dx = move.x * speed * dt;
  const dy = move.y * speed * dt;
  if (dx !== 0 || dy !== 0) {
    const moved = moveCircle(level, player.x, player.y, dx, dy, PLAYER.radius);
    player.x = moved.x;
    player.y = moved.y;
    player.facing = Math.atan2(dy, dx);
    player.stepPhase += Math.hypot(dx, dy);
  }

  // Noise: running carries far, walking a little, sneaking almost none.
  player.noise = player.running ? GUARD.hearingRun : move.x !== 0 || move.y !== 0 ? 42 : 0;
  if (player.sneaking) player.noise = 0;

  if (actions.pebble && player.pebbles > 0) {
    player.pebbles -= 1;
    return 'pebble';
  }

  if (actions.grab) {
    const near = nearestRelic(level, player.x, player.y);
    if (near && near.distance < 52) {
      near.relic.taken = true;
      player.relicsTaken += 1;
      return 'relic';
    }
  }
  return null;
}

/** Where a tossed pebble lands: a short hop in the direction the player faces. */
export function pebbleLanding(player) {
  return {
    x: player.x + Math.cos(player.facing) * 150,
    y: player.y + Math.sin(player.facing) * 150,
  };
}

/** True when the player stands on the exit tile. */
export function onExit(player, level) {
  return Math.hypot(player.x - level.exit.x, player.y - level.exit.y) < 30;
}

/** True when the player is hidden in shadow right now. */
export function isHidden(player, level) {
  return inShadow(level, player.x, player.y);
}
