import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createFirstPersonView } from '../entities/FigureSoldier.js';

const SWAP_SECONDS = 0.35;
const VIEW_FOV = 50;
// Where the rifle sits when not aiming, relative to looking down its sights:
// lower and to the right, turned slightly in toward the crosshair.
const HIP = { position: new THREE.Vector3(0.9, -0.42, 0.0), yaw: 0.16, pitch: 0.03, roll: -0.08 };
const ZERO = new THREE.Vector3();
const _v = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _from = new THREE.Vector3();

// The player's guns: a primary and a secondary from the chosen loadout.
// All behaviour comes from the weapon's entry in CONFIG.weapons.
//
// First person shows the soldier's own arms and rifle, cut from the same
// sculpted figure everyone else sees, so the view matches the toy. It is
// drawn in its own small scene with its own camera, on top of the world:
// that keeps it the same size at any field of view and stops it poking
// through walls. Every weapon uses the figure's rifle; the weapons differ in
// how they fire, not in this view.
export class Weapon {
  constructor(ctx, player, rig) {
    this.ctx = ctx;
    this.player = player;
    this.rig = rig;
    this.slots = [];
    this.index = 0;
    this.cooldown = 0;
    this.reloading = 0;
    this.swapping = 0;
    this.kick = 0;
    this.hitFlash = 0;
    this.prevFire = false;
    this.scoped = false;
    this.adsAmount = 0;   // 0 at the hip, 1 fully aimed
    this.bob = 0;
    this.sway = new THREE.Vector2();

    this.viewScene = new THREE.Scene();
    this.viewCamera = new THREE.PerspectiveCamera(VIEW_FOV, innerWidth / innerHeight, 0.03, 20);
    this.viewHemi = new THREE.HemisphereLight();
    this.viewKey = new THREE.DirectionalLight();
    this.viewKey.position.set(-0.6, 1, 0.7);
    this.holder = new THREE.Group();
    this.viewScene.add(this.viewHemi, this.viewKey, this.holder);
    this.flash = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffe9a0, toneMapped: false }));
    this.flash.visible = false;
    const view = createFirstPersonView(player.team);
    this.holder.add(view.mesh);
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.copy(view.muzzle);
    this.muzzle.add(this.flash);
    this.holder.add(this.muzzle);
    this.holder.position.copy(HIP.position);

    this.setLoadout(CONFIG.loadouts[0]);
  }

  get slot() { return this.slots[this.index]; }
  get def() { return this.slot.def; }
  get ammo() { return this.slot.ammo; }

  setLoadout(loadout) {
    this.loadout = loadout;
    this.slots = [loadout.primary, loadout.secondary].map((id) => {
      const def = CONFIG.weapons[id];
      return { id, def, ammo: def.magazine };
    });
    this.index = 0;
    this.cooldown = 0;
    this.reloading = 0;
    this.swapping = 0;
  }

  swap() {
    if (this.swapping > 0) return;
    this.index = 1 - this.index;
    this.reloading = 0;
    this.swapping = SWAP_SECONDS;
    this.cooldown = 0;
    this.ctx.audio.swap();
  }

  startReload() {
    if (this.reloading > 0 || this.ammo === this.def.magazine) return;
    this.reloading = this.def.reloadSeconds;
    this.ctx.audio.reload(this.def.reloadSeconds);
  }

  // True while the player is holding aim with this weapon ready.
  isAiming(input) {
    return input.aim && this.player.alive && this.reloading <= 0 && this.swapping <= 0;
  }

  update(dt, input) {
    const def = this.def;
    this.cooldown -= dt;
    this.hitFlash -= dt;
    this.swapping -= dt;
    this.kick *= Math.exp(-dt * 14);

    if (!this.player.alive) {
      this.scoped = false;
      this.adsAmount = 0;
      this.prevFire = input.fire;
      return;
    }

    if (input.pressed.has('swap')) this.swap();

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.slot.ammo = this.def.magazine;
    } else if (this.swapping <= 0) {
      if (input.pressed.has('reload')) this.startReload();
      const trigger = this.def.auto ? input.fire : input.fire && !this.prevFire;
      if (trigger && this.cooldown <= 0) {
        if (this.ammo > 0) this.fire(input.aim);
        else this.startReload();
      }
    }
    this.prevFire = input.fire;

    this.player.isReloading = this.reloading > 0;
    const aiming = this.isAiming(input);
    this.adsAmount += ((aiming ? 1 : 0) - this.adsAmount) * (1 - Math.exp(-dt * 16));
    this.scoped = !!def.scope && aiming && this.adsAmount > 0.85;
    this.pose(dt, input);
  }

  // Place the gun: hip or sights, plus walk bob, look sway, recoil and the
  // dip while reloading or swapping.
  pose(dt, input) {
    const a = this.adsAmount, loose = 1 - a * 0.85;
    const speed = this.player.grounded ? Math.min(1, this.player.horizontal.length() / CONFIG.move.walkSpeed) : 0;
    this.bob += dt * (4 + speed * 7);
    this.sway.x += (THREE.MathUtils.clamp(-input.lookX * 2, -0.1, 0.1) - this.sway.x) * (1 - Math.exp(-dt * 10));
    this.sway.y += (THREE.MathUtils.clamp(input.lookY * 2, -0.1, 0.1) - this.sway.y) * (1 - Math.exp(-dt * 10));

    const lowered = this.reloading > 0
      ? Math.sin((1 - this.reloading / this.def.reloadSeconds) * Math.PI)
      : this.swapping > 0 ? this.swapping / SWAP_SECONDS : 0;

    // Sprinting: the rifle swings down and across, out of the way.
    const sprinting = this.player.sprintBlend * (1 - a);

    const h = this.holder;
    h.position.lerpVectors(HIP.position, ZERO, a);
    h.position.x -= 0.25 * sprinting;
    h.position.y -= 0.3 * sprinting;
    h.position.x += (Math.cos(this.bob * 0.5) * 0.02 * speed + this.sway.x) * loose;
    h.position.y += (Math.sin(this.bob) * 0.016 * speed + this.sway.y - Math.sin(this.bob * 0.35) * 0.005) * loose - lowered * 0.55;
    h.position.z += this.kick * 0.12 * (1 - a * 0.5);
    h.rotation.set(
      HIP.pitch * (1 - a) + this.kick * 0.06 * (1 - a * 0.6) - lowered * 0.7 - 0.3 * sprinting,
      HIP.yaw * (1 - a) + this.sway.x * 0.4 * loose + 0.45 * sprinting,
      HIP.roll * (1 - a) + lowered * 0.3 - 0.25 * sprinting);
    this.flash.visible = this.cooldown > 1 / this.def.fireRate - 0.035;
    this.flash.scale.setScalar(0.7 + Math.random() * 0.9);
  }

  get viewVisible() {
    return this.player.alive && !this.rig.thirdPerson && !this.scoped;
  }

  // Where the first-person muzzle appears in the world, so tracers start at it.
  muzzleWorld(out) {
    const cam = this.rig.camera;
    this.muzzle.getWorldPosition(_v).project(this.viewCamera);
    out.set(_v.x, _v.y, 0.5).unproject(cam).sub(cam.position).normalize();
    return out.multiplyScalar(2.5).add(cam.position);
  }

  fire(aiming) {
    const def = this.def;
    this.cooldown = 1 / def.fireRate;
    this.slot.ammo--;
    this.kick = 1;
    this.player.pitch = Math.min(1.45, this.player.pitch + def.recoil);

    const cam = this.rig.camera;
    const dir = this.rig.forward;
    // Start past the player in third person so the shot cannot hit things
    // between the camera and the soldier.
    const origin = _origin.copy(cam.position).addScaledVector(dir, this.rig.aimOffset);
    const from = _from;
    if (this.rig.thirdPerson || this.scoped) this.player.model.muzzle.getWorldPosition(from);
    else this.muzzleWorld(from);

    const result = this.ctx.combat.fire(this.player, origin, dir, from, def, {
      spread: aiming ? def.adsSpread : def.hipSpread,
    });
    if (result) {
      this.hitFlash = result === 'kill' ? 0.25 : 0.12;
      this.ctx.audio.hitmarker(result === 'kill');
    }
  }

  resize() {
    this.viewCamera.aspect = innerWidth / innerHeight;
    this.viewCamera.updateProjectionMatrix();
  }

  // Draw the gun over the finished world frame, lit to match the room.
  render(renderer, scene, lighting) {
    if (!this.viewVisible) return;
    this.viewScene.environment = scene.environment;
    this.viewScene.environmentIntensity = scene.environmentIntensity;
    this.viewHemi.color.copy(lighting.hemi.color);
    this.viewHemi.groundColor.copy(lighting.hemi.groundColor);
    this.viewHemi.intensity = lighting.hemi.intensity;
    this.viewKey.color.copy(lighting.sun.color);
    this.viewKey.intensity = lighting.sun.intensity * 0.6 + lighting.lamp.intensity * 0.00012;
    renderer.clearDepth();
    renderer.render(this.viewScene, this.viewCamera);
  }
}
