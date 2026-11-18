// Keyboard + mouse input: held keys, edge-triggered presses, pointer-lock look.
// The game reads this every frame; menus read it too (Enter advances dialogs).

export function createInput() {
  return {
    keys: new Set(),        // currently held KeyboardEvent.code values
    pressed: new Set(),     // codes pressed since last frame (edge triggered)
    mouseX: 0, mouseY: 0,   // last mouse position in CSS pixels
    mouseDX: 0, mouseDY: 0, // accumulated movement since last frame
    mouseDown: false,       // left button held
    mouseClicked: false,    // left button pressed since last frame
    rightDown: false,       // right button held (aim)
    locked: false,          // pointer lock active
    wheel: 0,
  };
}

export function attachInput(input, element) {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    if (!input.keys.has(e.code)) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
    input.rightDown = false;
  });
  element.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX;
    input.mouseY = e.clientY;
    if (input.locked) {
      input.mouseDX += e.movementX;
      input.mouseDY += e.movementY;
    }
  });
  element.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouseDown = true; input.mouseClicked = true; }
    if (e.button === 2) input.rightDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
    if (e.button === 2) input.rightDown = false;
  });
  element.addEventListener('contextmenu', (e) => e.preventDefault());
  element.addEventListener('wheel', (e) => { input.wheel += e.deltaY; }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === element;
  });
}

export function requestLookLock(element) {
  if (document.pointerLockElement !== element) {
    try { element.requestPointerLock(); } catch { /* headless / denied: drag-look still works */ }
  }
}

export function releaseLookLock() {
  if (document.pointerLockElement) document.exitPointerLock();
}

// Consume an edge-triggered press (true once per physical press).
export function wasPressed(input, code) {
  if (input.pressed.has(code)) { input.pressed.delete(code); return true; }
  return false;
}
export function isDown(input, ...codes) {
  return codes.some((c) => input.keys.has(c));
}

// WASD / arrows as a -1..1 pair: x = strafe right, y = forward.
export function moveAxes(input) {
  const x = (isDown(input, 'KeyD', 'ArrowRight') ? 1 : 0) - (isDown(input, 'KeyA', 'ArrowLeft') ? 1 : 0);
  const y = (isDown(input, 'KeyW', 'ArrowUp') ? 1 : 0) - (isDown(input, 'KeyS', 'ArrowDown') ? 1 : 0);
  return { x, y };
}

// Called at the end of every frame to clear per-frame state.
export function endFrameInput(input) {
  input.pressed.clear();
  input.mouseDX = 0;
  input.mouseDY = 0;
  input.mouseClicked = false;
  input.wheel = 0;
}
