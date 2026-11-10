import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RAPIER } from '../core/Physics.js';
import { createSoldier, animateLegs } from './SoldierModel.js';

const { soldier: S, move: M, jetpack: J } = CONFIG;
const HALF = S.height / 2;

// Everything a player and a bot have in common: body, movement, health,
// death and respawn. Subclasses decide where to go and when to shoot.
export class Soldier {
  constructor(ctx, team, name, x, z) {
    this.ctx = ctx;
    this.team = team;
    this.name = name;
    this.isPlayer = false;
    const world = ctx.physics.world;

    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, HALF + 0.1, z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF - S.radius, S.radius), this.body);
    ctx.physics.owners.set(this.collider.handle, this);

    this.controller = world.createCharacterController(0.05);
    this.controller.enableAutostep(M.stepHeight, 0.4, false);
    this.controller.enableSnapToGround(0.6);
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(60));
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(4);

    this.model = createSoldier(team);
    ctx.scene.add(this.model.root);

    this.position = new THREE.Vector3(x, HALF + 0.1, z); // capsule centre
    this.horizontal = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.velY = 0;
    this.grounded = false;
    this.airTime = 0;
    this.fuel = 1;
    this.jetting = false;
    this.walkPhase = 0;

    this.health = CONFIG.match.health;
    this.sinceDamage = 99;
    this.protectedFor = 0;
    this.dead = false;
    this.respawnIn = 0;
    this.kills = 0;
    this.deaths = 0;
  }

  get alive() { return !this.dead; }
  get feet() { return this.position.y - HALF; }
  eye(out = new THREE.Vector3()) { return out.set(this.position.x, this.feet + S.eyeHeight, this.position.z); }

  // One physics step of movement. `wishX/wishZ` is the wanted ground velocity.
  moveStep(dt, wishX, wishZ, jumpPressed, jumpHeld) {
    const blend = 1 - Math.exp(-dt * (this.grounded ? 14 : 14 * M.airControl * 0.35));
    this.horizontal.x += (wishX - this.horizontal.x) * blend;
    this.horizontal.z += (wishZ - this.horizontal.z) * blend;

    if (this.grounded) {
      this.airTime = 0;
      this.fuel = Math.min(1, this.fuel + J.rechargePerSecond * dt);
      if (jumpPressed) {
        this.velY = M.jumpSpeed;
        this.grounded = false;
      }
    } else {
      this.airTime += dt;
    }

    this.jetting = !this.grounded && jumpHeld && this.fuel > 0 && this.airTime > J.minAirTime;
    if (this.jetting) {
      this.velY = Math.min(J.maxRiseSpeed, this.velY + J.accel * dt);
      this.fuel = Math.max(0, this.fuel - dt / J.fuelSeconds);
    }
    this.velY = Math.max(this.velY - CONFIG.gravity * dt, -160);

    const desired = { x: this.horizontal.x * dt, y: this.velY * dt, z: this.horizontal.z * dt };
    this.controller.computeColliderMovement(this.collider, desired);
    const mv = this.controller.computedMovement();
    const t = this.body.translation();
    const next = { x: t.x + mv.x, y: t.y + mv.y, z: t.z + mv.z };
    this.body.setNextKinematicTranslation(next);
    this.position.set(next.x, next.y, next.z);

    this.grounded = this.controller.computedGrounded();
    if (this.grounded && this.velY < 0) this.velY = -2;
    if (this.velY > 0 && mv.y < desired.y - 1e-4) this.velY = 0; // bumped a ceiling
  }

  // Returns true if this hit was the killing one.
  damage(amount, dir, attacker) {
    if (!this.alive || !this.ctx.match.playing || this.protectedFor > 0) return false;
    this.health -= amount;
    this.sinceDamage = 0;
    this.onHurt?.(attacker);
    if (this.health > 0) return false;
    this.die(dir, attacker);
    return true;
  }

  die(dir, attacker) {
    this.health = 0;
    this.dead = true;
    this.deaths++;
    this.respawnIn = CONFIG.match.respawnSeconds;
    this.ctx.effects.shatter(this.model, dir);
    this.ctx.audio.shatter(this.position);
    this.model.root.visible = false;
    this.collider.setEnabled(false);
    this.horizontal.set(0, 0, 0);
    this.ctx.match.onKill(attacker, this);
  }

  respawnAt(x, z, yaw) {
    const y = HALF + 1.4; // spawns may sit on the chest lid
    this.body.setTranslation({ x, y, z }, true);
    this.position.set(x, y, z);
    this.collider.setEnabled(true);
    this.velY = 0;
    this.horizontal.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.fuel = 1;
    this.health = CONFIG.match.health;
    this.dead = false;
    this.respawnIn = 0;
    this.sinceDamage = 99;
    this.protectedFor = CONFIG.match.spawnProtectionSeconds;
    this.model.root.visible = true;
    this.onRespawn?.();
  }

  // Timers that run every physics step whether alive or not.
  tick(dt) {
    if (!this.alive) {
      this.respawnIn -= dt;
      return;
    }
    this.sinceDamage += dt;
    this.protectedFor -= dt;
    if (this.sinceDamage > CONFIG.match.regenDelay && this.health < CONFIG.match.health) {
      this.health = Math.min(CONFIG.match.health, this.health + CONFIG.match.regenPerSecond * dt);
    }
    if (this.position.y < -50) this.die(new THREE.Vector3(0, 0, 1), null);
  }

  // Visual update, once per rendered frame.
  updateVisual(dt, visible = true) {
    const m = this.model;
    m.root.visible = visible && this.alive;
    if (!this.alive) return;
    m.root.position.set(this.position.x, this.feet, this.position.z);
    m.root.rotation.y = this.yaw;
    const speed = this.horizontal.length();
    this.walkPhase += dt * speed * 0.42;
    animateLegs(m, this.walkPhase, this.grounded ? Math.min(1, speed / M.walkSpeed) : 0.3);
  }
}
