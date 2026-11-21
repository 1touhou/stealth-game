// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between
// five screens: title, play, paused, caught and win.
//
// ?shot=cover|stalk|alarm|escape (with &seed=N) stages that scene instead of
// running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP, BEST_KEY } from './config.js';
import { createWorld, stepWorld, resetWorld, EVENT_RELIC, EVENT_SPOTTED, EVENT_CAUGHT, EVENT_WIN, EVENT_PEBBLE } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_PEBBLE, ACTION_GRAB, ACTION_MUTE, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CAUGHT, SCREEN_WIN } from './render.js';
import { createSoundBank } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);
const sounds = createSoundBank();

function readBest() {
  try {
    return Number.parseFloat(window.localStorage.getItem(BEST_KEY) ?? '0') || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best time then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, 0);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let lastStepPhase = 0;
  // A read-only handle for automated play-testing; the game never uses it.
  window.__lamplightWorld = world;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    resetWorld(world);
    accumulator = 0;
    screen = SCREEN_PLAY;
    sounds.startAmbient();
    announce('Playing. Steal all three relics, then reach the green exit unseen.');
  }

  function endCaught() {
    screen = SCREEN_CAUGHT;
    sounds.caught();
    announce(`Caught after ${Math.floor(world.time)} seconds. Press Space to try again.`);
  }

  function endWin() {
    screen = SCREEN_WIN;
    sounds.win();
    if (best === 0 || world.time < best) {
      best = world.time;
      saveBest(best);
    }
    announce(`Clean getaway in ${Math.floor(world.time)} seconds. Press Space to steal again.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = sounds.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_CAUGHT || screen === SCREEN_WIN)) {
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    return actions;
  }

  function step(actions) {
    const move = input.direction(world.player);
    const stepActions = {
      sneakHeld: input.sneakHeld(),
      runHeld: input.runHeld(),
      pebble: Boolean(actions & ACTION_PEBBLE),
      grab: Boolean(actions & ACTION_GRAB),
    };
    const events = stepWorld(world, move, stepActions, STEP);
    if (events & EVENT_RELIC) sounds.relic();
    if (events & EVENT_SPOTTED) sounds.question();
    if (events & EVENT_PEBBLE) sounds.pebble();
    if (events & EVENT_CAUGHT) endCaught();
    else if (events & EVENT_WIN) endWin();
    // Footsteps tick as the player covers ground: soft sneaking, loud running.
    const moved = world.player.stepPhase - lastStepPhase;
    if (moved > 26) {
      sounds.footstep(world.player.running, world.player.sneaking);
      lastStepPhase = world.player.stepPhase;
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lamplight, the Quiet Gallery. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
