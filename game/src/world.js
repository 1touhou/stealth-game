// The world: owns the level, the player and the guards, and advances them one
// fixed step at a time. It keeps the timer, the alarm, the relic count and the
// event flags the loop turns into sound and screen changes.
import { PATROLS, RELICS, GUARD } from './config.js';
import { createLevel, nearestRelic } from './level.js';
import { createGuard, stepGuard, topSuspicion, anyAlert, STATE_ALERT } from './guards.js';
import { createPlayer, stepPlayer, pebbleLanding, onExit } from './player.js';

export const EVENT_RELIC = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_WIN = 8;
export const EVENT_PEBBLE = 16;

export function createWorld(seed) {
  void seed; // The level is fixed; the seed is kept so shots stay reproducible.
  const level = createLevel();
  const player = createPlayer(level);
  const guards = PATROLS.map((route, index) => createGuard(route, index));
  return {
    level,
    player,
    guards,
    time: 0,
    alarm: 0, // 0 calm, 1 raised: how hot the gallery is right now
    caught: false,
    won: false,
    spottedFlashes: 0,
    pebble: null, // {x, y, ttl} of a pebble still skittering, or null
    message: '',
    messageTtl: 0,
  };
}

/** Put everything back to the opening state. */
export function resetWorld(world) {
  const fresh = createWorld(0);
  world.level = fresh.level;
  world.player = fresh.player;
  world.guards = fresh.guards;
  world.time = 0;
  world.alarm = 0;
  world.caught = false;
  world.won = false;
  world.spottedFlashes = 0;
  world.pebble = null;
  world.message = '';
  world.messageTtl = 0;
}

/**
 * Advance the world one fixed step. `move` is {x, y} in -1..1, `actions` the
 * one-shot presses for this step. Returns an EVENT_* bitmask.
 */
export function stepWorld(world, move, actions, dt) {
  if (world.caught || world.won) return 0;
  world.time += dt;
  let events = 0;

  const playerEvent = stepPlayer(world.player, world.level, move, actions, dt);
  if (playerEvent === 'relic') {
    events |= EVENT_RELIC;
    const left = RELICS.length - world.player.relicsTaken;
    world.message = left === 0 ? 'All three relics pocketed — reach the green exit!' : `Relic pocketed. ${left} to go.`;
    world.messageTtl = 3;
  } else if (playerEvent === 'pebble') {
    events |= EVENT_PEBBLE;
    const landing = pebbleLanding(world.player);
    world.pebble = { x: landing.x, y: landing.y, ttl: 1.2 };
    for (const guard of world.guards) {
      const distance = Math.hypot(guard.x - landing.x, guard.y - landing.y);
      if (distance < GUARD.hearingPebble) guard.heard = { x: landing.x, y: landing.y };
    }
    world.message = 'Pebble tossed — a guard goes to look.';
    world.messageTtl = 2;
  }

  const guardEvents = [];
  for (const guard of world.guards) {
    const result = stepGuard(guard, world.player, world.level, dt, guardEvents);
    if (result === 'caught') {
      world.caught = true;
      events |= EVENT_CAUGHT;
    }
  }
  if (guardEvents.includes('spotted')) {
    events |= EVENT_SPOTTED;
    world.spottedFlashes += 1;
    world.message = 'Spotted! Break line of sight!';
    world.messageTtl = 2;
  }

  if (world.pebble) {
    world.pebble.ttl -= dt;
    if (world.pebble.ttl <= 0) world.pebble = null;
  }
  if (world.messageTtl > 0) {
    world.messageTtl -= dt;
    if (world.messageTtl <= 0) world.message = '';
  }

  // The alarm eases when no guard is chasing and nobody is very suspicious.
  const hot = anyAlert(world.guards) || topSuspicion(world.guards) > 60;
  world.alarm = Math.max(0, Math.min(1, world.alarm + (hot ? dt * 1.5 : -dt * 0.35)));

  if (world.player.relicsTaken >= RELICS.length && onExit(world.player, world.level)) {
    world.won = true;
    events |= EVENT_WIN;
  }
  return events;
}

/** The nearest relic and its distance, for the HUD's compass hint. */
export function worldNearestRelic(world) {
  return nearestRelic(world.level, world.player.x, world.player.y);
}

/** True while the exit is still locked (relics remain). */
export function exitLocked(world) {
  return world.player.relicsTaken < RELICS.length;
}
