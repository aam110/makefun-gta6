// Palmera Heat — keyboard and mouse input.
// One object owns every key, mouse button and look delta the game reads.
// The camera turns with pointer lock when available, and with click-drag or
// the arrow keys otherwise, so the game stays playable without a lock.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.lookDX = 0;
    this.lookDY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.locked = false;
    this.dragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.enabled = true;
    this._onKeyDown = null;
    this._onKeyUp = null;
  }

  attach(canvas) {
    this._onKeyDown = (e) => {
      if (!this.enabled) return;
      if (e.code === 'Space') e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    };
    this._onKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pressed.clear();
      this.mouseDown = false;
      this.dragging = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked) {
        this.lookDX += e.movementX || 0;
        this.lookDY += e.movementY || 0;
      } else if (this.dragging) {
        this.lookDX += e.clientX - this.lastX;
        this.lookDY += e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (e.button === 0) {
        this.mouseDown = true;
        this.mouseClicked = true;
        this.dragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        if (!this.locked) {
          try {
            canvas.requestPointerLock();
          } catch (err) { /* drag fallback stays available */ }
        }
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
        this.dragging = false;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isDown(code) {
    return this.keys.has(code);
  }

  /** True once, on the frame the key went down. */
  wasPressed(code) {
    return this.pressed.has(code);
  }

  /** Look deltas since the last call, then cleared. */
  consumeLook() {
    const dx = this.lookDX;
    const dy = this.lookDY;
    this.lookDX = 0;
    this.lookDY = 0;
    return { dx, dy };
  }

  consumeClick() {
    const c = this.mouseClicked;
    this.mouseClicked = false;
    return c;
  }

  /** End-of-frame housekeeping: edge-triggered state lives one frame. */
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }

  releasePointerLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }
}
