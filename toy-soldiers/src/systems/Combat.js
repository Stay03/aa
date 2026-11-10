import * as THREE from 'three';
import { CONFIG } from '../config.js';

// One place where a bullet is resolved, shared by the player and the bots.
export class Combat {
  constructor(ctx) {
    this.ctx = ctx;
  }

  // Returns 'kill', 'hit' (an enemy soldier) or null.
  fire(shooter, origin, dir, muzzlePos, { damage, impulse = CONFIG.rifle.impulse }) {
    const { physics, effects, audio } = this.ctx;
    const hit = physics.raycast(origin, dir, CONFIG.rifle.range, shooter.collider);
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, CONFIG.rifle.range);
    effects.tracer(muzzlePos, end);
    audio.shot(muzzlePos, shooter.isPlayer);
    if (!hit) return null;

    effects.impact(hit.point, hit.normal);
    const victim = hit.owner;
    if (victim?.damage) {
      if (victim.team === shooter.team) return null; // no friendly fire
      return victim.damage(damage, dir, shooter) ? 'kill' : 'hit';
    }
    if (hit.body?.isDynamic()) {
      hit.body.applyImpulseAtPoint({ x: dir.x * impulse, y: dir.y * impulse, z: dir.z * impulse }, hit.point, true);
    }
    return null;
  }

  // Can `from` see `to`? Ray from eye to the other soldier's chest.
  canSee(from, to, eye = new THREE.Vector3(), dir = new THREE.Vector3()) {
    from.eye(eye);
    dir.copy(to.position).sub(eye);
    const dist = dir.length();
    if (dist < 0.01) return true;
    dir.multiplyScalar(1 / dist);
    const hit = this.ctx.physics.raycast(eye, dir, dist + 1, from.collider);
    return !!hit && hit.owner === to;
  }
}
