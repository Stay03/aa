import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createSoldier } from './SoldierModel.js';

const HALF = CONFIG.soldier.height / 2;

// Stationary tan soldier. Stand-in for bots: takes damage, breaks apart,
// comes back. The bot AI will replace the "stationary" part.
export class Target {
  constructor(ctx, x, y, z, facing) {
    this.ctx = ctx;
    this.model = createSoldier('tan');
    this.model.root.position.set(x, y, z);
    this.model.root.rotation.y = facing;
    ctx.scene.add(this.model.root);

    this.anchor = new THREE.Object3D();
    this.anchor.position.set(x, y + HALF, z);
    const { collider } = ctx.physics.addCapsule(this.anchor, HALF - CONFIG.soldier.radius, CONFIG.soldier.radius, { owner: this });
    this.collider = collider;

    this.health = CONFIG.target.health;
    this.respawnIn = 0;
  }

  get alive() { return this.respawnIn <= 0; }

  // Returns true if this hit destroyed the soldier.
  damage(amount, dir) {
    if (!this.alive) return false;
    this.health -= amount;
    if (this.health > 0) {
      this.model.root.rotation.z = (Math.random() - 0.5) * 0.25; // flinch
      return false;
    }
    this.ctx.effects.shatter(this.model, dir);
    this.model.root.visible = false;
    this.collider.setEnabled(false);
    this.respawnIn = CONFIG.target.respawnSeconds;
    return true;
  }

  update(dt) {
    if (this.alive) {
      this.model.root.rotation.z *= Math.exp(-dt * 10);
      return;
    }
    this.respawnIn -= dt;
    if (this.respawnIn <= 0) {
      this.health = CONFIG.target.health;
      this.model.root.visible = true;
      this.model.root.rotation.z = 0;
      this.collider.setEnabled(true);
    }
  }
}
