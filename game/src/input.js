// CAYO BRAVO — input.js: keyboard + mouse state, edge-triggered action keys,
// and drag-to-orbit camera control. No pointer lock: the camera follows the
// player and the mouse drags to look around.

export function createInput() {
  const input = {
    forward: false, back: false, left: false, right: false,
    handbrake: false, run: false,
    mouseDown: false, mouseX: 0, mouseY: 0,
    camYawOffset: 0, camPitch: 0.42,
    pressed: new Set(), // keys pressed since the last frame swap
    framePressed: new Set(), // keys pressed during the previous frame (consumed now)
    dragging: false, lastX: 0, lastY: 0,
    sensitivity: 1,
  };

  const KEYMAP = {
    KeyW: 'forward', ArrowUp: 'forward',
    KeyS: 'back', ArrowDown: 'back',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    Space: 'handbrake', ShiftLeft: 'run', ShiftRight: 'run',
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    input.pressed.add(e.code);
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = true;
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const mapped = KEYMAP[e.code];
    if (mapped) input[mapped] = false;
  });
  window.addEventListener('blur', () => {
    input.forward = input.back = input.left = input.right = false;
    input.handbrake = input.run = input.mouseDown = false;
  });

  const canvas = document.getElementById('scene');
  canvas.addEventListener('mousedown', (e) => {
    input.mouseDown = true;
    input.dragging = true;
    input.lastX = e.clientX; input.lastY = e.clientY;
    input.pressed.add('MouseDown');
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; input.dragging = false; });
  window.addEventListener('mousemove', (e) => {
    input.mouseX = e.clientX; input.mouseY = e.clientY;
    if (!input.dragging) return;
    const dx = e.clientX - input.lastX;
    const dy = e.clientY - input.lastY;
    input.lastX = e.clientX; input.lastY = e.clientY;
    input.camYawOffset -= dx * 0.005 * input.sensitivity;
    input.camPitch = Math.max(0.12, Math.min(1.1, input.camPitch + dy * 0.003 * input.sensitivity));
  });
  // Keep the camera drift centred when the player is not dragging.
  input.update = function updateInput(dt) {
    if (!this.dragging) this.camYawOffset *= Math.pow(0.25, dt);
  };
  // Frame swap: presses collected during the last frame (including during the
  // slow render) move into framePressed; fresh presses keep accumulating in
  // pressed for the next frame, so no keypress is ever wiped mid-frame.
  input.beginFrame = function beginFrame() {
    this.framePressed = this.pressed;
    this.pressed = new Set();
  };
  input.consume = function consume(code) {
    if (this.framePressed.has(code)) { this.framePressed.delete(code); return true; }
    return false;
  };
  input.endFrame = function endFrame() { /* kept for callers; swap is beginFrame */ };
  return input;
}
