import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Soldier } from './Soldier.js';

const B = CONFIG.bot;
const M = CONFIG.move;
const TAU = Math.PI * 2;
const angleDiff = (a, b) => ((a - b + Math.PI) % TAU + TAU) % TAU - Math.PI;
const _eye = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _muzzle = new THREE.Vector3();

// Computer-controlled soldier. Each step it: looks for the nearest visible
// enemy, walks a path toward where enemies are, and fights when it sees one.
export class Bot extends Soldier {
  constructor(ctx, team, name, x, z) {
    super(ctx, team, name, x, z);
    this.enemy = null;        // currently visible target
    this.lastSeen = null;     // {x, z} of the last enemy sighting
    this.lastSeenAge = 99;
    this.senseIn = Math.random() * 0.3;
    this.reaction = 0;
    this.path = null;
    this.pathIndex = 0;
    this.repathIn = 0;
    this.goal = null;
    this.strafeDir = Math.random() < 0.5 ? -1 : 1;
    this.strafeIn = 0;
    this.pickLoadout();
    this.reloading = 0;
    this.cooldown = 0;
    this.burstLeft = 0;
    this.burstPause = 0;
    this.stuckCheck = { t: 0, x, z };
    this.wantJump = false;
  }

  // Bots carry only the primary of a randomly weighted loadout.
  pickLoadout() {
    let r = Math.random();
    const loadout = CONFIG.loadouts.find((l) => (r -= l.botWeight) <= 0) ?? CONFIG.loadouts[0];
    this.def = CONFIG.weapons[loadout.primary];
    this.ammo = this.def.magazine;
  }

  onRespawn() {
    this.enemy = null;
    this.lastSeen = null;
    this.path = null;
    this.goal = null;
    this.pickLoadout();
    this.reloading = 0;
  }

  onHurt(attacker) {
    // Getting shot tells you where the shooter is.
    if (attacker && !this.enemy) {
      this.lastSeen = { x: attacker.position.x, z: attacker.position.z };
      this.lastSeenAge = 0;
      this.repathIn = 0;
    }
  }

  fixedUpdate(dt) {
    this.tick(dt);
    if (!this.alive) return;
    if (!this.ctx.match.playing) {
      this.moveStep(dt, 0, 0, false, false);
      return;
    }

    this.sense(dt);
    let wishX = 0, wishZ = 0, faceYaw = this.yaw;

    if (this.enemy) {
      const dx = this.enemy.position.x - this.position.x;
      const dz = this.enemy.position.z - this.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      faceYaw = Math.atan2(-dx, -dz);
      const nx = dx / dist, nz = dz / dist;
      if (dist > this.def.botRange) {
        [wishX, wishZ] = this.follow(dt, this.enemy.position.x, this.enemy.position.z, M.walkSpeed);
      } else {
        // Strafe across the enemy's aim, backing off if too close.
        this.strafeIn -= dt;
        if (this.strafeIn <= 0) {
          this.strafeDir = -this.strafeDir;
          this.strafeIn = 0.5 + Math.random() * 1.1;
        }
        const back = dist < 20 ? -0.7 : 0;
        const s = M.walkSpeed * 0.7;
        wishX = (-nz * this.strafeDir + nx * back) * s;
        wishZ = (nx * this.strafeDir + nz * back) * s;
      }
      this.shoot(dt, faceYaw);
    } else {
      this.burstLeft = 0;
      const goal = this.pickGoal();
      [wishX, wishZ] = this.follow(dt, goal.x, goal.z, M.walkSpeed);
      if (wishX || wishZ) faceYaw = Math.atan2(-wishX, -wishZ);
      if (this.ammo < this.def.magazine * 0.4 && this.reloading <= 0) this.reloading = this.def.reloadSeconds;
    }

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.ammo = this.def.magazine;
    }
    this.cooldown -= dt;

    const turn = angleDiff(faceYaw, this.yaw);
    this.yaw += Math.sign(turn) * Math.min(Math.abs(turn), this.ctx.difficulty.turnRate * dt);

    this.unstick(dt, wishX || wishZ);
    this.moveStep(dt, wishX, wishZ, this.wantJump, false);
    this.wantJump = false;
  }

  sense(dt) {
    this.lastSeenAge += dt;
    this.reaction -= dt;
    this.senseIn -= dt;
    if (this.senseIn > 0) {
      if (this.enemy && !this.enemy.alive) this.enemy = null;
      return;
    }
    this.senseIn = 0.18 + Math.random() * 0.1;

    let best = null, bestD = B.sightRange;
    for (const other of this.ctx.soldiers) {
      if (other.team === this.team || !other.alive) continue;
      const d = other.position.distanceTo(this.position);
      if (d < bestD && this.ctx.combat.canSee(this, other, _eye, _dir)) {
        best = other;
        bestD = d;
      }
    }
    if (best && best !== this.enemy) {
      const [lo, hi] = this.ctx.difficulty.reaction;
      this.reaction = lo + Math.random() * (hi - lo);
    }
    this.enemy = best;
    if (best) {
      this.lastSeen = { x: best.position.x, z: best.position.z };
      this.lastSeenAge = 0;
    }
  }

  // Where to walk when nobody is in sight.
  pickGoal() {
    if (this.lastSeen && this.lastSeenAge < 6) {
      if (Math.hypot(this.lastSeen.x - this.position.x, this.lastSeen.z - this.position.z) > 6) return this.lastSeen;
      this.lastSeen = null; // got there, nobody home
    }
    if (!this.goal || Math.hypot(this.goal.x - this.position.x, this.goal.z - this.position.z) < 8) {
      // Usually push toward a living enemy; sometimes wander to keep the map in use.
      const enemies = this.ctx.soldiers.filter((s) => s.team !== this.team && s.alive);
      if (enemies.length && Math.random() < 0.7) {
        const e = enemies[Math.floor(Math.random() * enemies.length)];
        this.goal = { x: e.position.x, z: e.position.z };
      } else {
        this.goal = this.ctx.nav.randomPoint();
      }
      this.repathIn = 0;
    }
    return this.goal;
  }

  // Follow an A* path to (x, z). Returns the wanted ground velocity.
  follow(dt, x, z, speed) {
    const nav = this.ctx.nav;
    this.repathIn -= dt;
    const end = this.path?.[this.path.length - 1];
    const moved = !end || Math.hypot(end.x - x, end.z - z) > 12;
    if (!this.path || this.repathIn <= 0 || (moved && this.repathIn < 0.9)) {
      this.path = nav.findPath(this.position.x, this.position.z, x, z);
      this.pathIndex = 0;
      this.repathIn = 1.2 + Math.random() * 0.6;
      if (!this.path) { this.goal = null; return [0, 0]; }
    }
    while (this.pathIndex < this.path.length) {
      const wp = this.path[this.pathIndex];
      const dx = wp.x - this.position.x, dz = wp.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 1.6) return [(dx / d) * speed, (dz / d) * speed];
      this.pathIndex++;
    }
    this.path = null;
    return [0, 0];
  }

  shoot(dt, faceYaw) {
    const def = this.def;
    if (this.reloading > 0 || this.reaction > 0) return;
    if (this.ammo <= 0) { this.reloading = def.reloadSeconds; return; }
    if (Math.abs(angleDiff(faceYaw, this.yaw)) > 0.18) return;

    if (def.auto && this.burstLeft <= 0) {
      this.burstPause -= dt;
      if (this.burstPause > 0) return;
      this.burstLeft = 3 + Math.floor(Math.random() * 4);
    }
    if (this.cooldown > 0) return;

    this.cooldown = 1 / Math.min(def.fireRate, B.maxFireRate);
    this.ammo--;
    if (def.auto && --this.burstLeft <= 0) this.burstPause = 0.35 + Math.random() * 0.6;

    // The bot's own aiming mistake, shared by every pellet of the shot.
    const err = this.ctx.difficulty.aimError * def.botAim;
    this.eye(_eye);
    _dir.copy(this.enemy.position).sub(_eye).normalize();
    _dir.x += (Math.random() - 0.5) * 2 * err;
    _dir.y += (Math.random() - 0.5) * 2 * err;
    _dir.z += (Math.random() - 0.5) * 2 * err;
    _dir.normalize();
    this.model.muzzle.getWorldPosition(_muzzle);
    this.ctx.combat.fire(this, _eye, _dir, _muzzle, def, {
      spread: def.pellets > 1 ? def.hipSpread : 0,
      damageScale: this.ctx.difficulty.damageScale,
    });
  }

  // If we wanted to move but did not, hop and re-plan.
  unstick(dt, wantsToMove) {
    const c = this.stuckCheck;
    c.t += dt;
    if (c.t < 0.7) return;
    const moved = Math.hypot(this.position.x - c.x, this.position.z - c.z);
    if (wantsToMove && moved < 1.5) {
      this.wantJump = true;
      this.strafeDir = -this.strafeDir;
      this.path = null;
      this.goal = null;
    }
    c.t = 0; c.x = this.position.x; c.z = this.position.z;
  }
}
