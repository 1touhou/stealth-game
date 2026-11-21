// The screenshot scenes behind ?shot=cover|stalk|alarm|escape. Each one sets the
// real world to a chosen moment — the player, the guards, the relics and the
// alarm exactly where a play-through puts them — then lets the simulation run
// a few fixed steps, so the frame is the game itself, painted by its own
// renderer, and the same shot always gives the same frame.
import { TILE } from './config.js';
import { createWorld, stepWorld } from './world.js';
import { STATE_ALERT, STATE_SEARCH, STATE_SUSPICIOUS } from './guards.js';
import { SCREEN_PLAY } from './render.js';

/** Place a guard at a tile, facing an angle, in a state, with suspicion. */
function placeGuard(world, index, col, row, angle, state, suspicion) {
  const guard = world.guards[index];
  guard.x = col * TILE + TILE / 2;
  guard.y = row * TILE + TILE / 2;
  guard.angle = angle;
  guard.scanBase = angle;
  guard.state = state;
  guard.suspicion = suspicion;
  guard.lastSeen = { x: world.player.x, y: world.player.y };
  guard.searchTarget = { x: world.player.x, y: world.player.y };
  guard.searchTime = 6;
  guard.pause = 0;
}

/** Place the player at a tile, optionally sneaking. */
function placePlayer(world, col, row, sneaking) {
  world.player.x = col * TILE + TILE / 2;
  world.player.y = row * TILE + TILE / 2;
  world.player.sneaking = sneaking;
  world.player.facing = 0;
}

/** Let the world run a few fixed steps with no input so cones settle. */
function settle(world, steps) {
  for (let index = 0; index < steps; index += 1) {
    stepWorld(world, { x: 0, y: 0 }, { sneakHeld: world.player.sneaking, runHeld: false }, 1 / 60);
  }
}

/**
 * Stage the named scene on a fresh world and return the screen to draw.
 * Unknown names stage the cover.
 */
export function stageShot(name, world) {
  const fresh = createWorld(0);
  world.level = fresh.level;
  world.player = fresh.player;
  world.guards = fresh.guards;
  world.time = 0;
  world.alarm = 0;
  world.caught = false;
  world.won = false;
  world.message = '';
  world.messageTtl = 0;

  if (name === 'stalk') {
    // Deep in the west wing: Wren crouched in shadow while the hall guard
    // sweeps past, cone sliding just overhead.
    world.time = 74;
    placePlayer(world, 3, 6, true);
    world.player.facing = Math.PI / 2;
    placeGuard(world, 0, 10, 5, Math.PI, 'patrol', 12);
    placeGuard(world, 1, 30, 3, -Math.PI / 2, 'patrol', 0);
    placeGuard(world, 2, 20, 10, 0, 'patrol', 0);
    placeGuard(world, 3, 30, 20, Math.PI, 'patrol', 0);
    world.message = 'In the shadow — the guard walks right past.';
    world.messageTtl = 5;
    settle(world, 20);
  } else if (name === 'alarm') {
    // The near miss that went wrong: a guard has Wren in his cone, the alarm
    // is up, and the chase is on through the central hall.
    world.time = 142;
    world.player.relicsTaken = 1;
    world.level.relics[0].taken = true;
    placePlayer(world, 18, 10, false);
    world.player.facing = Math.PI;
    world.player.running = true;
    placeGuard(world, 2, 14, 10, 0, STATE_ALERT, 70);
    placeGuard(world, 0, 8, 6, Math.PI / 2, STATE_SUSPICIOUS, 52);
    placeGuard(world, 1, 30, 4, Math.PI, 'patrol', 0);
    placeGuard(world, 3, 26, 18, -Math.PI / 2, STATE_SEARCH, 20);
    world.alarm = 0.9;
    world.message = 'Spotted! Break line of sight!';
    world.messageTtl = 5;
    settle(world, 8);
  } else if (name === 'escape') {
    // The endgame: all three relics pocketed, Wren slipping along the north
    // wall toward the green exit while the guards search the wrong wing.
    world.time = 268;
    world.player.relicsTaken = 3;
    for (const relic of world.level.relics) relic.taken = true;
    placePlayer(world, 33, 2, true);
    world.player.facing = 0;
    placeGuard(world, 1, 26, 5, Math.PI / 2, STATE_SEARCH, 25);
    placeGuard(world, 0, 10, 4, 0, STATE_SUSPICIOUS, 40);
    placeGuard(world, 2, 20, 11, Math.PI, 'patrol', 0);
    placeGuard(world, 3, 30, 20, -Math.PI / 2, 'patrol', 0);
    world.alarm = 0.3;
    world.message = 'All three relics pocketed — reach the green EXIT!';
    world.messageTtl = 5;
    settle(world, 20);
  } else {
    // Cover: the whole game at a glance — Wren caught at the edge of a guard's
    // cone in the west wing, the Sun Disk glowing beyond, the exit far away.
    world.time = 38;
    placePlayer(world, 11, 5, true);
    world.player.facing = 0;
    placeGuard(world, 0, 14, 5, Math.PI, 'patrol', 30);
    placeGuard(world, 1, 30, 3, Math.PI / 2, 'patrol', 0);
    placeGuard(world, 2, 18, 11, 0, 'patrol', 0);
    placeGuard(world, 3, 28, 19, -Math.PI / 2, 'patrol', 0);
    world.message = 'The cone finds you — slip away before it fills!';
    world.messageTtl = 5;
    settle(world, 20);
  }
  return { screen: SCREEN_PLAY };
}
