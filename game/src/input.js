// Keyboard + mouse input. Drag (or pointer lock) rotates the camera;
// the game reads keys by code so WASD and arrows both work.
export const Input = {
  keys: new Set(),
  lookDX: 0,
  lookDY: 0,
  mouseDown: false,
  mouseDownEdge: false, // set true on the frame the button goes down
  dragging: false,
  lastX: 0,
  lastY: 0,
  locked: false,

  init(canvas) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseDownEdge = true;
      this.dragging = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      if (e.button === 0 && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
      this.dragging = false;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.locked) {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
      } else if (this.dragging) {
        this.lookDX += e.clientX - this.lastX;
        this.lookDY += e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    // Touch: left half steers/moves, right half looks. Kept minimal.
    let touchId = null;
    canvas.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      touchId = t.identifier;
      this.lastX = t.clientX;
      this.lastY = t.clientY;
    }, { passive: true });
    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === touchId) {
          this.lookDX += (t.clientX - this.lastX) * 2;
          this.lookDY += (t.clientY - this.lastY) * 2;
          this.lastX = t.clientX;
          this.lastY = t.clientY;
        }
      }
    }, { passive: true });
    canvas.addEventListener('touchend', () => { touchId = null; });
  },

  down(code) { return this.keys.has(code); },
  axis() {
    // Returns {f, s}: forward/back and strafe, -1..1.
    let f = 0, s = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) f += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) f -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    return { f, s };
  },
  consumeLook() {
    const dx = this.lookDX, dy = this.lookDY;
    this.lookDX = 0;
    this.lookDY = 0;
    return { dx, dy };
  },
  endFrame() { this.mouseDownEdge = false; },
};
