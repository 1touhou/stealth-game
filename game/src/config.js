// Tunables for Lamplight: tile size, movement, detection and alarm behaviour.
// One place for every number the other files share, so balancing is a one-file edit.
export const TILE = 32;
export const STEP = 1 / 60;
export const BEST_KEY = 'lamplight-best-time';

// Player movement, in pixels per second.
export const PLAYER = {
  walk: 150,
  sneak: 82,
  run: 235,
  radius: 11,
};

// How far a guard sees, and how fast suspicion grows while the player is visible.
export const VISION = {
  range: 235,
  halfAngle: 0.61, // ~35 degrees each side of the facing direction
  nearRange: 46, // inside this, the player is seen almost at once
  gainLit: 62, // suspicion per second, player lit and standing
  gainShadow: 22, // suspicion per second, player in a shadow patch
  gainSneak: 0.45, // multiplier while sneaking
  gainRun: 1.6, // multiplier while running
  decay: 26, // suspicion lost per second while unseen
  catchAt: 100, // suspicion that catches the player
  suspiciousAt: 38, // suspicion that makes a guard investigate
};

// Alarm states a guard moves through.
export const GUARD = {
  patrolSpeed: 58,
  investigateSpeed: 96,
  chaseSpeed: 132,
  returnSpeed: 78,
  pauseAtWaypoint: 1.4, // seconds a guard waits and looks around
  searchTime: 6, // seconds a guard searches after losing the player
  hearingRun: 150, // running is heard this far away
  hearingPebble: 260, // a thrown pebble is heard this far away
  radius: 12,
};

// Pebble distractions the player carries.
export const PEBBLES = 3;

// Relics to steal before the skylight exit opens.
export const RELICS = ['Sun Disk', 'Jade Fox', 'Moon Harp'];

// The level, drawn as text: '#' wall, '.' floor, 'C' crate, 'D' display case,
// 's' shadow patch, 'R' relic pedestal, 'E' exit, 'P' player start.
// Every row is 40 tiles wide; the level is 25 rows tall.
export const MAP = [
  '########################################',
  '#......s..........#........#....E......#',
  '#..C......D.......#...R....#...........#',
  '#......s..........#........#...C.......#',
  '#..D......C...s...#........#...........#',
  '#................#...s....#....D.......#',
  '#..s.....C........#........#...........#',
  '####.######.#######..######.#######.####',
  '#......s..........#........#...........#',
  '#..C......D...s...#....R...#...C.......#',
  '#................#........#............#',
  '#..D......C.......#...s....#...D.......#',
  '#......s..........#........#...........#',
  '####.######.#######..######.#######.####',
  '#......s..........#........#...........#',
  '#..C......D...s...#....R...#...C.......#',
  '#................#........#............#',
  '#..D......C.......#...s....#...D.......#',
  '#......s..........#........#...........#',
  '#..C......D...s...#........#...C.......#',
  '#................#........#............#',
  '#..D......C.......#...s....#...D.......#',
  '#......s..........#........#...........#',
  '#..P...................................#',
  '########################################',
];

// Guard patrol routes, in tile coordinates. Each guard walks its waypoints in
// order, pauses at each one and looks around before moving on.
export const PATROLS = [
  // Hall guard: sweeps the west wing past the Sun Disk's corridor.
  [[6, 2], [14, 2], [14, 6], [6, 6]],
  // North-east guard: circles the Jade Fox wing.
  [[24, 2], [36, 2], [36, 6], [24, 6]],
  // Middle guard: patrols the central hall between the wings.
  [[6, 10], [36, 10], [36, 12], [6, 12]],
  // South guard: sweeps the Moon Harp wing and the entrance hall.
  [[24, 16], [36, 16], [36, 22], [10, 22]],
];

// Palette: a night gallery lit by warm lamps, so lit floor reads safe and
// shadow reads hidden at a glance.
export const COLORS = {
  floor: '#2b2f3a',
  floorAlt: '#272b35',
  shadowFloor: '#12141f',
  wall: '#4a4238',
  wallTop: '#6b5f4d',
  crate: '#7a5c33',
  crateTop: '#9c7a45',
  caseGlass: '#3d6f8e',
  caseBase: '#54432c',
  lampGlow: '#ffd98a',
  coneCalm: 'rgba(255, 214, 120, 0.20)',
  coneSuspicious: 'rgba(255, 166, 66, 0.34)',
  coneAlert: 'rgba(255, 84, 66, 0.40)',
  guard: '#c94f43',
  guardDark: '#8e2f26',
  player: '#e8dcc0',
  playerCloak: '#3f6d8e',
  exit: '#58d68d',
  relic: '#ffd76a',
  text: '#f2ead8',
  textDim: '#b8ad93',
};
