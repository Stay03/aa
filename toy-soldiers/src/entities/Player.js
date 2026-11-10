import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { RAPIER } from '../core/Physics.js';
import { createSoldier, animateLegs } from './SoldierModel.js';

const { soldier: S, move: M, jetpack: J } = CONFIG;
const HALF = S.height / 2;

export class Player {
  constructor(ctx, x, z) {
    this.ctx = ctx;
    const world = ctx.physics.world;

    this.body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(x, HALF + 0.1, z));
    this.collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF - S.radius, S.radius), this.body);

    this.controller = world.createCharacterController(0.05);
    this.controller.enableAutostep(M.stepHeight, 0.4, false);
    this.controller.enableSnapToGround(0.6);
    this.controller.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(50));
    this.controller.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(60));
    this.controller.setApplyImpulsesToDynamicBodies(true);
    this.controller.setCharacterMass(4);

    this.model = createSoldier('green');
    ctx.scene.add(this.model.root);

    this.yaw = 0;
    this.pitch = 0;
    this.velY = 0;
    this.horizontal = new THREE.Vector3();
    this.grounded = false;
    this.airTime = 0;
    this.fuel = 1;
    this.jetting = false;
    this.health = 100;
    this.walkPhase = 0;
    this.position = new THREE.Vector3(x, HALF, z); // capsule centre
    this.spawn = [x, z];
  }

  get feet() { return this.position.y - HALF; }

  look(dx, dy) {
    this.yaw -= dx;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy, -1.45, 1.45);
  }

  fixedUpdate(dt, input) {
    const speed = input.sprint && input.moveZ > 0 ? M.sprintSpeed : M.walkSpeed;
    const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
    // forward = (-sin, 0, -cos), right = (cos, 0, -sin)
    const wishX = (-sin * input.moveZ + cos * input.moveX) * speed;
    const wishZ = (-cos * input.moveZ - sin * input.moveX) * speed;
    const blend = 1 - Math.exp(-dt * (this.grounded ? 14 : 14 * M.airControl * 0.35));
    this.horizontal.x += (wishX - this.horizontal.x) * blend;
    this.horizontal.z += (wishZ - this.horizontal.z) * blend;

    if (this.grounded) {
      this.airTime = 0;
      this.fuel = Math.min(1, this.fuel + (J.rechargePerSecond * dt));
      if (input.pressed.has('jump')) {
        this.velY = M.jumpSpeed;
        this.grounded = false;
      }
    } else {
      this.airTime += dt;
    }

    this.jetting = !this.grounded && input.jump && this.fuel > 0 && this.airTime > J.minAirTime;
    if (this.jetting) {
      this.velY = Math.min(J.maxRiseSpeed, this.velY + J.accel * dt);
      this.fuel = Math.max(0, this.fuel - dt / J.fuelSeconds);
    }
    this.velY -= CONFIG.gravity * dt;
    this.velY = Math.max(this.velY, -160);

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

    if (this.position.y < -50) this.respawn();
  }

  respawn() {
    const [x, z] = this.spawn;
    this.body.setTranslation({ x, y: HALF + 0.1, z }, true);
    this.position.set(x, HALF + 0.1, z);
    this.velY = 0;
    this.horizontal.set(0, 0, 0);
    this.health = 100;
  }

  // Visual update, once per rendered frame.
  update(dt, visible) {
    const m = this.model;
    m.root.visible = visible;
    m.root.position.set(this.position.x, this.feet, this.position.z);
    m.root.rotation.y = this.yaw;
    const speed = this.horizontal.length();
    this.walkPhase += dt * speed * 0.42;
    animateLegs(m, this.walkPhase, this.grounded ? Math.min(1, speed / M.walkSpeed) : 0.3);
  }
}
