// Guards: patrol routes they walk, vision cones they see through, and the
// suspicion meter that carries them from calm patrol to investigation, chase
// and search — with a chance for the player to recover by breaking sight.
import { TILE, VISION, GUARD } from './config.js';
import { hasLineOfSight, inShadow, moveCircle } from './level.js';

export const STATE_PATROL = 'patrol';
export const STATE_SUSPICIOUS = 'suspicious';
export const STATE_ALERT = 'alert';
export const STATE_SEARCH = 'search';
export const STATE_RETURN = 'return';

/** One guard on a patrol route given as tile waypoints. */
export function createGuard(waypoints, index) {
  const points = waypoints.map(([col, row]) => ({ x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 }));
  const start = points[0];
  return {
    id: index,
    x: start.x,
    y: start.y,
    angle: 0,
    waypoints: points,
    waypoint: 1 % points.length,
    pause: 0,
    state: STATE_PATROL,
    suspicion: 0,
    lastSeen: null,
    searchTarget: null,
    searchTime: 0,
    scanAngle: 0,
    scanBase: 0, // angle the guard sweeps around while looking about
    heard: null,
    stepPhase: 0,
  };
}

/** Can this guard see the player right now? Cones, range, walls and light all count. */
export function canSeePlayer(guard, player, level) {
  const dx = player.x - guard.x;
  const dy = player.y - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > VISION.range) return { seen: false, strength: 0 };
  const toPlayer = Math.atan2(dy, dx);
  let difference = Math.abs(toPlayer - guard.angle);
  if (difference > Math.PI) difference = 2 * Math.PI - difference;
  const insideCone = difference < VISION.halfAngle || distance < VISION.nearRange;
  if (!insideCone) return { seen: false, strength: 0 };
  if (!hasLineOfSight(level, guard.x, guard.y, player.x, player.y)) return { seen: false, strength: 0 };
  // Closer and better-lit players are spotted faster; shadows and sneaking slow it.
  const closeness = 1 - distance / VISION.range;
  let strength = 0.55 + closeness * 0.9;
  if (inShadow(level, player.x, player.y)) strength *= VISION.gainShadow / VISION.gainLit;
  if (player.sneaking) strength *= VISION.gainSneak;
  if (player.running) strength *= VISION.gainRun;
  return { seen: true, strength };
}

/** Turn toward a target angle, at most `rate` radians this step. */
export function turnToward(guard, targetAngle, rate) {
  let difference = targetAngle - guard.angle;
  while (difference > Math.PI) difference -= 2 * Math.PI;
  while (difference < -Math.PI) difference += 2 * Math.PI;
  const turn = Math.max(-rate, Math.min(rate, difference));
  guard.angle += turn;
  return Math.abs(difference - turn) < 0.02;
}

/** Walk toward a point at the given speed; true when arrived. */
export function walkToward(guard, level, tx, ty, speed, dt) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 4) return true;
  const step = Math.min(distance, speed * dt);
  const moved = moveCircle(level, guard.x, guard.y, (dx / distance) * step, (dy / distance) * step, GUARD.radius);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.angle = Math.atan2(dy, dx);
  guard.stepPhase += step;
  return distance - step < 4;
}

/**
 * Advance one guard a step. Returns an event string for the world to act on:
 * 'spotted' when the guard first crosses into suspicion, 'caught' when the
 * player is caught, or null.
 */
export function stepGuard(guard, player, level, dt, events) {
  const sight = canSeePlayer(guard, player, level);
  let event = null;

  if (sight.seen) {
    const before = guard.suspicion;
    guard.suspicion = Math.min(VISION.catchAt, guard.suspicion + VISION.gainLit * sight.strength * dt);
    guard.lastSeen = { x: player.x, y: player.y };
    if (before < VISION.suspiciousAt && guard.suspicion >= VISION.suspiciousAt) event = 'spotted';
    if (guard.suspicion >= VISION.catchAt) return 'caught';
  } else {
    guard.suspicion = Math.max(0, guard.suspicion - VISION.decay * dt);
  }

  // A loud noise pulls a calm guard to look: running nearby, or a pebble landing.
  if (guard.state === STATE_PATROL && player.noise > 0) {
    const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
    if (distance < player.noise) {
      guard.state = STATE_SUSPICIOUS;
      guard.searchTarget = { x: player.x, y: player.y };
      guard.searchTime = GUARD.searchTime;
    }
  }
  if (guard.heard) {
    guard.state = STATE_SUSPICIOUS;
    guard.searchTarget = guard.heard;
    guard.searchTime = GUARD.searchTime;
    guard.heard = null;
  }

  switch (guard.state) {
    case STATE_PATROL: {
      if (guard.suspicion >= VISION.suspiciousAt) {
        guard.state = STATE_SUSPICIOUS;
        guard.searchTarget = guard.lastSeen ? { ...guard.lastSeen } : { x: guard.x, y: guard.y };
        guard.searchTime = GUARD.searchTime;
        break;
      }
      if (guard.pause > 0) {
        guard.pause -= dt;
        // Look around while waiting at a waypoint: the cone sweeps around the
        // direction the guard arrived facing, so patrols can be learned.
        guard.scanAngle += dt * 1.1;
        guard.angle = guard.scanBase + Math.sin(guard.scanAngle) * 0.45;
        break;
      }
      const target = guard.waypoints[guard.waypoint];
      if (walkToward(guard, level, target.x, target.y, GUARD.patrolSpeed, dt)) {
        guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
        guard.pause = GUARD.pauseAtWaypoint;
        guard.scanAngle = 0;
        guard.scanBase = guard.angle;
      }
      break;
    }
    case STATE_SUSPICIOUS: {
      // Walk to where the player was last seen and look around.
      if (guard.lastSeen && guard.suspicion >= VISION.suspiciousAt) {
        guard.state = STATE_ALERT;
        break;
      }
      const target = guard.searchTarget ?? { x: guard.x, y: guard.y };
      if (walkToward(guard, level, target.x, target.y, GUARD.investigateSpeed, dt)) {
        guard.searchTime -= dt;
        guard.scanAngle += dt * 2.2;
        guard.angle = guard.scanBase + Math.sin(guard.scanAngle) * 0.7;
        if (guard.searchTime <= 0) {
          guard.state = STATE_RETURN;
          guard.suspicion = 0;
        }
      } else {
        guard.scanBase = guard.angle;
      }
      break;
    }
    case STATE_ALERT: {
      // Chase the player's last seen spot; keep chasing while visible.
      if (sight.seen && guard.lastSeen) {
        const target = guard.lastSeen;
        walkToward(guard, level, target.x, target.y, GUARD.chaseSpeed, dt);
        guard.searchTime = GUARD.searchTime;
      } else {
        guard.state = STATE_SEARCH;
        guard.searchTarget = guard.lastSeen ? { ...guard.lastSeen } : { x: guard.x, y: guard.y };
        guard.searchTime = GUARD.searchTime;
      }
      break;
    }
    case STATE_SEARCH: {
      const target = guard.searchTarget ?? { x: guard.x, y: guard.y };
      if (walkToward(guard, level, target.x, target.y, GUARD.investigateSpeed, dt)) {
        guard.searchTime -= dt;
        guard.scanAngle += dt * 2.6;
        guard.angle = guard.scanBase + Math.sin(guard.scanAngle) * 0.7;
        if (guard.searchTime <= 0) {
          guard.state = STATE_RETURN;
          guard.suspicion = 0;
        }
      } else {
        guard.scanBase = guard.angle;
      }
      break;
    }
    case STATE_RETURN: {
      // Walk back to the nearest patrol waypoint, then resume the route.
      let nearest = 0;
      let nearestDistance = Infinity;
      guard.waypoints.forEach((point, index) => {
        const distance = Math.hypot(point.x - guard.x, point.y - guard.y);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = index;
        }
      });
      const target = guard.waypoints[nearest];
      if (walkToward(guard, level, target.x, target.y, GUARD.returnSpeed, dt)) {
        guard.waypoint = (nearest + 1) % guard.waypoints.length;
        guard.state = STATE_PATROL;
        guard.pause = 0.5;
      }
      break;
    }
    default:
      break;
  }

  if (events && event) events.push(event);
  return event;
}

/** The highest suspicion among the guards: what the HUD's meter shows. */
export function topSuspicion(guards) {
  let top = 0;
  for (const guard of guards) top = Math.max(top, guard.suspicion);
  return top;
}

/** True when any guard is actively chasing the player. */
export function anyAlert(guards) {
  return guards.some((guard) => guard.state === STATE_ALERT);
}
