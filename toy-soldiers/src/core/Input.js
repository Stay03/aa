import { CONFIG } from '../config.js';

const DEADZONE = 0.18;
const dz = (v) => (Math.abs(v) < DEADZONE ? 0 : (v - Math.sign(v) * DEADZONE) / (1 - DEADZONE));

// Merges keyboard/mouse and gamepad into one action state so gameplay code
// never asks which device is in use.
export class Input {
  constructor(dom) {
    this.dom = dom;
    this.keys = new Set();
    this.mouseButtons = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pressedQueue = new Set();
    this.prevPad = {};
    this.sensitivity = 1; // from Settings
    this.invertY = false;

    this.state = {
      moveX: 0, moveZ: 0, lookX: 0, lookY: 0,
      jump: false, sprint: false, fire: false, aim: false,
      pressed: new Set(), // edge-triggered actions (jump, reload, swap, toggles, loadout keys)
    };

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const edge = {
        Space: 'jump', Escape: 'pause', KeyR: 'reload', KeyV: 'toggleCamera', KeyN: 'toggleTime', KeyQ: 'swap',
        Digit1: 'loadout1', Digit2: 'loadout2', Digit3: 'loadout3',
      }[e.code];
      if (edge) this.pressedQueue.add(edge);
      if (e.code === 'Space') e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouseButtons.clear(); });
    dom.addEventListener('mousedown', (e) => this.mouseButtons.add(e.button));
    addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    dom.addEventListener('wheel', () => this.pressedQueue.add('swap'), { passive: true });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== dom) return;
      // Browsers occasionally report one huge delta right after locking.
      if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
  }

  lockPointer() {
    try {
      const p = this.dom.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch { /* pointer lock unavailable; game still runs */ }
  }

  update(dt) {
    const s = this.state;
    const k = this.keys;
    s.pressed = this.pressedQueue;
    this.pressedQueue = new Set();

    s.moveX = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
    s.moveZ = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
    const flip = this.invertY ? -1 : 1;
    s.lookX = this.mouseDX * CONFIG.camera.mouseSensitivity * this.sensitivity;
    s.lookY = this.mouseDY * CONFIG.camera.mouseSensitivity * this.sensitivity * flip;
    this.mouseDX = 0;
    this.mouseDY = 0;
    s.jump = k.has('Space');
    s.sprint = k.has('ShiftLeft') || k.has('ShiftRight');
    s.fire = this.mouseButtons.has(0);
    s.aim = this.mouseButtons.has(2);

    const pad = [...(navigator.getGamepads?.() ?? [])].find((p) => p && p.connected);
    if (pad) {
      const b = (i) => !!pad.buttons[i]?.pressed || (pad.buttons[i]?.value ?? 0) > 0.4;
      const edge = (i, name) => {
        const now = b(i);
        if (now && !this.prevPad[i]) s.pressed.add(name);
        this.prevPad[i] = now;
      };
      const mx = dz(pad.axes[0] ?? 0);
      const mz = -dz(pad.axes[1] ?? 0);
      if (mx || mz) { s.moveX = mx; s.moveZ = mz; }
      const stick = CONFIG.camera.stickSensitivity * this.sensitivity * dt;
      s.lookX += dz(pad.axes[2] ?? 0) * stick;
      s.lookY += dz(pad.axes[3] ?? 0) * stick * flip;
      s.jump ||= b(0);
      s.sprint ||= b(10);
      s.fire ||= b(7);
      s.aim ||= b(6);
      edge(0, 'jump');
      edge(2, 'reload');
      edge(3, 'toggleCamera');
      edge(12, 'toggleTime');
      edge(5, 'swap');
      edge(9, 'pause');
      edge(14, 'loadoutPrev');
      edge(15, 'loadoutNext');
    }

    const len = Math.hypot(s.moveX, s.moveZ);
    if (len > 1) { s.moveX /= len; s.moveZ /= len; }
    return s;
  }
}
