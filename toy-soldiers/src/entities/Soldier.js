import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RAPIER } from '../core/Physics.js';
import { createSoldier, animateSoldier, setGun } from './RiggedSoldier.js';

const { soldier: S, move: M, jetpack: J } = CONFIG;
const HALF = S.height / 2;
// Scratch objects reused every step by every soldier: no per-step garbage.
const _desired = { x: 0, y: 0, z: 0 };
const _moved = { x: 0, y: 0, z: 0 };
const _next = { x: 0, y: 0, z: 0 };

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
    this.climbing = false;
    this.nearClimb = false;
    this.walkPhase = 0;
    this.runBlend = 0;
    // Upper-body pose, eased each frame (see animateSoldier).
    this.kick = 0;            // set to 1 by Combat when this soldier fires
    this.isReloading = false; // set by the player's weapon or the bot
    this.sprintBlend = 0;
    this.reloadBlend = 0;

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

  // Ropes and laces: stand at one and push forward to go up, back to go down,
  // jump to let go. `climb` is -1..1; bots pass nothing and so never climb.
  updateClimb(climb, jumpPressed) {
    const feet = this.feet, px = this.position.x, pz = this.position.z;
    const rope = this.ctx.climbables.find((r) =>
      Math.hypot(r.x - px, r.z - pz) < r.radius && feet > r.y0 - 0.5 && feet < r.y1);
    this.nearClimb = !!rope;
    if (!rope) { this.climbing = false; return null; }
    if (!this.climbing) {
      if (climb > 0.2 && !jumpPressed) this.climbing = true;
    } else if (jumpPressed) {
      this.climbing = false;
      this.velY = M.jumpSpeed * 0.7;
      this.grounded = false;
    } else if (climb < 0 && this.grounded) {
      this.climbing = false;
    }
    return rope;
  }

  // One physics step of movement. `wishX/wishZ` is the wanted ground velocity.
  moveStep(dt, wishX, wishZ, jumpPressed, jumpHeld, climb = null) {
    const rope = climb !== null ? this.updateClimb(climb, jumpPressed) : null;
    if (this.climbing) {
      // Hold on: ignore steering and pull the soldier onto the rope.
      wishX = THREE.MathUtils.clamp((rope.x - this.position.x) * 10, -20, 20);
      wishZ = THREE.MathUtils.clamp((rope.z - this.position.z) * 10, -20, 20);
      jumpPressed = false;
      jumpHeld = false;
    }
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
    if (this.climbing) {
      this.velY = climb * M.climbSpeed;
      this.fuel = Math.min(1, this.fuel + J.rechargePerSecond * dt);
    } else {
      this.velY = Math.max(this.velY - CONFIG.gravity * dt, -160);
    }

    const desired = _desired;
    desired.x = this.horizontal.x * dt; desired.y = this.velY * dt; desired.z = this.horizontal.z * dt;
    this.controller.computeColliderMovement(this.collider, desired);
    const mv = this.controller.computedMovement(_moved);
    // `position` always mirrors the body's translation, so read it from there.
    const next = _next;
    next.x = this.position.x + mv.x; next.y = this.position.y + mv.y; next.z = this.position.z + mv.z;
    this.body.setNextKinematicTranslation(next);
    this.position.set(next.x, next.y, next.z);

    this.grounded = this.controller.computedGrounded();
    if (this.climbing && this.feet >= rope.y1 - 0.2) {
      // Reached the top: a small hop carries the soldier over the edge.
      this.climbing = false;
      this.velY = 24;
      this.grounded = false;
    }
    if (this.grounded && this.velY < 0 && !this.climbing) this.velY = -2;
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
    this.climbing = false;
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
    // Cadence rises with speed, up to about four strides a second.
    this.walkPhase += dt * Math.min(speed * 0.62, 26);
    // Ease in and out of the run so the legs never snap between poses.
    const target = this.grounded ? Math.min(1, speed / (M.walkSpeed * 0.6)) : 0.35;
    this.runBlend += (target - this.runBlend) * (1 - Math.exp(-dt * 12));
    const ease = 1 - Math.exp(-dt * 10);
    const sprinting = this.grounded && speed > M.walkSpeed * 1.25 && !this.isReloading;
    this.sprintBlend += ((sprinting ? 1 : 0) - this.sprintBlend) * ease;
    this.reloadBlend += ((this.isReloading ? 1 : 0) - this.reloadBlend) * ease;
    this.kick *= Math.exp(-dt * 16);
    setGun(m, this.gunModel ?? CONFIG.weapons.rifle.model);
    // Which way he is travelling relative to where he faces, so the legs
    // step that way: forward, sideways or backward.
    if (speed > 1) {
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const forward = -sin * this.horizontal.x - cos * this.horizontal.z, right = cos * this.horizontal.x - sin * this.horizontal.z;
      this.moveAngle = Math.atan2(right, forward);
    }
    animateSoldier(m, this.walkPhase, this.runBlend, speed / M.walkSpeed, {
      sprint: this.sprintBlend, reload: this.reloadBlend, kick: this.kick, pitch: this.pitch, moveAngle: this.moveAngle ?? 0,
    });
  }
}
