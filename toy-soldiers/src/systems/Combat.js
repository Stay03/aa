import * as THREE from 'three';
import { CONFIG } from '../config.js';

const { range: RANGE, impulse: IMPULSE } = CONFIG.combat;
const _d = new THREE.Vector3();

// One place where a shot is resolved, shared by the player and the bots.
export class Combat {
  constructor(ctx) {
    this.ctx = ctx;
  }

  // Fires every pellet of `def` along `aim` with random `spread`.
  // Returns 'kill', 'hit' (an enemy soldier was damaged) or null.
  fire(shooter, origin, aim, muzzlePos, def, { spread = 0, damageScale = 1 } = {}) {
    const { physics, effects, audio } = this.ctx;
    audio.shot(muzzlePos, shooter.isPlayer, def.sound);
    let result = null;

    for (let i = 0; i < def.pellets; i++) {
      _d.copy(aim);
      _d.x += (Math.random() - 0.5) * spread;
      _d.y += (Math.random() - 0.5) * spread;
      _d.z += (Math.random() - 0.5) * spread;
      _d.normalize();

      const hit = physics.raycast(origin, _d, RANGE, shooter.collider);
      effects.tracer(muzzlePos, hit ? hit.point : origin.clone().addScaledVector(_d, RANGE));
      if (!hit) continue;
      effects.impact(hit.point, hit.normal, def.pellets > 1 ? 2 : 4);

      const victim = hit.owner;
      if (victim?.damage) {
        if (victim.team === shooter.team) continue; // no friendly fire
        let dmg = def.damage * damageScale;
        if (def.falloff) {
          const [near, far, min] = def.falloff;
          dmg *= 1 - (1 - min) * THREE.MathUtils.clamp((hit.distance - near) / (far - near), 0, 1);
        }
        if (victim.damage(dmg, _d, shooter)) result = 'kill';
        else result ??= 'hit';
      } else if (hit.body?.isDynamic()) {
        const k = IMPULSE / def.pellets;
        hit.body.applyImpulseAtPoint({ x: _d.x * k, y: _d.y * k, z: _d.z * k }, hit.point, true);
      }
    }
    return result;
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
