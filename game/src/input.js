// Keyboard and mouse input. Held keys steer; one-shot presses (sneak toggle,
// pebble, grab, pause, confirm, mute) are queued as flags and taken once by
// the loop. A mouse click sets a click-to-move waypoint the loop steers toward.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PEBBLE = 4;
export const ACTION_GRAB = 8;
export const ACTION_MUTE = 16;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const PEBBLE = new Set(['KeyE']);
const GRAB = new Set(['KeyF']);
const MUTE = new Set(['KeyM']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const SNEAK = new Set(['KeyC', 'ControlLeft', 'ControlRight']);

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let sneakHeld = false;
  let clickTarget = null;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    const code = codeOf(event);
    if (UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code)) {
      held.add(code);
      event.preventDefault();
    } else if (RUN.has(code)) {
      held.add(code);
    } else if (SNEAK.has(code)) {
      sneakHeld = true;
      event.preventDefault();
    } else if (CONFIRM.has(code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (PEBBLE.has(code)) {
      if (!event.repeat) actions |= ACTION_PEBBLE;
    } else if (GRAB.has(code)) {
      if (!event.repeat) actions |= ACTION_GRAB;
    } else if (MUTE.has(code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else {
      return;
    }
  });
  window.addEventListener('keyup', (event) => {
    held.delete(codeOf(event));
    if (SNEAK.has(codeOf(event))) sneakHeld = false;
  });
  window.addEventListener('blur', () => {
    held.clear();
    sneakHeld = false;
  });
  // Click on the canvas: walk there (click-to-move), or confirm on menus.
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    clickTarget = {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
    actions |= ACTION_CONFIRM;
  });

  return {
    /** Steering direction {x, y} in -1..1 from keys, or toward the click target. */
    direction(player) {
      let x = 0;
      let y = 0;
      for (const code of held) {
        if (LEFT.has(code)) x -= 1;
        if (RIGHT.has(code)) x += 1;
        if (UP.has(code)) y -= 1;
        if (DOWN.has(code)) y += 1;
      }
      if (x !== 0 || y !== 0) {
        clickTarget = null;
        const length = Math.hypot(x, y);
        return { x: x / length, y: y / length };
      }
      if (clickTarget) {
        const dx = clickTarget.x - player.x;
        const dy = clickTarget.y - player.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 8) {
          clickTarget = null;
          return { x: 0, y: 0 };
        }
        return { x: dx / distance, y: dy / distance };
      }
      return { x: 0, y: 0 };
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** True while the sneak key is held down. */
    sneakHeld() {
      return sneakHeld;
    },
    /** True while a run key is held down. */
    runHeld() {
      for (const code of held) if (RUN.has(code)) return true;
      return false;
    },
    /** Drop a pending click target (for example when the player is caught). */
    clearClick() {
      clickTarget = null;
    },
  };
}
