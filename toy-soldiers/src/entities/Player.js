import { CONFIG } from '../config.js';
import { Soldier } from './Soldier.js';

const M = CONFIG.move;

export class Player extends Soldier {
  constructor(ctx, x, z) {
    super(ctx, 'green', 'You', x, z);
    this.isPlayer = true;
    this.hurtFlash = 0;
    this.lastAttacker = null;
    this.stepAt = 0;
  }

  look(dx, dy) {
    if (!this.alive) return;
    this.yaw -= dx;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy));
  }

  onHurt(attacker) {
    this.hurtFlash = 1;
    this.lastAttacker = attacker;
    this.ctx.audio.hurt();
  }

  fixedUpdate(dt, input) {
    this.tick(dt);
    if (!this.alive) return;
    const speed = input.sprint && input.moveZ > 0 ? M.sprintSpeed : M.walkSpeed;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward = (-sin, 0, -cos), right = (cos, 0, -sin)
    const wishX = (-sin * input.moveZ + cos * input.moveX) * speed;
    const wishZ = (-cos * input.moveZ - sin * input.moveX) * speed;
    this.moveStep(dt, wishX, wishZ, input.pressed.has('jump'), input.jump, input.moveZ);
  }

  update(dt, visible) {
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.2);
    this.updateVisual(dt, visible);
    this.ctx.audio.jet(this.alive && this.jetting);
    if (this.alive && this.grounded && this.walkPhase - this.stepAt > Math.PI) {
      this.stepAt = this.walkPhase;
      this.ctx.audio.step();
    }
  }
}
