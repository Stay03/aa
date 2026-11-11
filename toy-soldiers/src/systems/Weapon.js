import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { plastic } from '../world/materials.js';
import { TEAM_COLORS } from '../entities/SoldierModel.js';

const SWAP_SECONDS = 0.35;

// The player's guns: a primary and a secondary from the chosen loadout.
// All behaviour comes from the weapon's entry in CONFIG.weapons.
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

    this.viewModel = new THREE.Group();
    this.muzzle = new THREE.Object3D();
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    this.hip = new THREE.Vector3(0.7, -0.62, -1.6);
    this.ads = new THREE.Vector3(0, -0.3, -1.05);
    this.viewModel.position.copy(this.hip);
    rig.camera.add(this.viewModel);

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
    this.buildViewModel();
  }

  swap() {
    if (this.swapping > 0) return;
    this.index = 1 - this.index;
    this.reloading = 0;
    this.swapping = SWAP_SECONDS;
    this.cooldown = 0;
    this.ctx.audio.swap();
    this.buildViewModel();
  }

  buildViewModel() {
    const vm = this.viewModel;
    vm.clear();
    const { length: L, thick: T } = this.def.view;
    const mat = plastic(TEAM_COLORS.green, { roughness: 0.42 });
    const add = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      vm.add(m);
    };
    add(T, T * 1.35, L, 0, 0, 0.25 - L / 2);            // barrel and body
    add(T * 1.25, T * 1.9, 0.5, 0, -0.02, 0.45);         // receiver
    add(0.13, 0.42, 0.2, 0, -0.3, 0.3);                  // grip
    if (L > 1) add(T * 1.2, T * 1.6, 0.55, 0, -0.06, 0.95); // stock
    if (this.def.scope) add(0.12, 0.12, 0.7, 0, T + 0.08, -0.1);
    add(0.3, 0.3, 0.9, -0.1, -0.3, 0.85);                // sleeve
    this.muzzle.position.set(0, 0, 0.25 - L);
    this.flash.position.copy(this.muzzle.position);
    this.flash.visible = false;
    vm.add(this.muzzle, this.flash);
  }

  startReload() {
    if (this.reloading > 0 || this.ammo === this.def.magazine) return;
    this.reloading = this.def.reloadSeconds;
    this.ctx.audio.reload(this.def.reloadSeconds);
  }

  update(dt, input) {
    const def = this.def;
    const vm = this.viewModel;
    this.cooldown -= dt;
    this.hitFlash -= dt;
    this.swapping -= dt;
    this.kick *= Math.exp(-dt * 14);

    if (!this.player.alive) {
      vm.visible = false;
      this.scoped = false;
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

    const aiming = input.aim && this.reloading <= 0 && this.swapping <= 0;
    this.scoped = !!def.scope && aiming && this.rig.camera.fov < def.adsFov + 12;
    vm.visible = !this.rig.thirdPerson && !this.scoped;
    vm.position.lerp(aiming ? this.ads : this.hip, 1 - Math.exp(-dt * 18));
    vm.position.z += this.kick * 0.5;
    const lowered = this.reloading > 0
      ? Math.sin((this.reloading / def.reloadSeconds) * Math.PI) * 0.9
      : this.swapping > 0 ? (this.swapping / SWAP_SECONDS) * 1.1 : 0;
    vm.rotation.x = this.kick * 0.35 - lowered;
    this.flash.visible = this.cooldown > 1 / def.fireRate - 0.035;
  }

  // True while the player is holding aim with this weapon ready.
  isAiming(input) {
    return input.aim && this.player.alive && this.reloading <= 0 && this.swapping <= 0;
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
    const origin = cam.position.clone().addScaledVector(dir, this.rig.aimOffset);
    const from = new THREE.Vector3();
    (this.rig.thirdPerson || this.scoped ? this.player.model.muzzle : this.muzzle).getWorldPosition(from);

    const result = this.ctx.combat.fire(this.player, origin, dir, from, def, {
      spread: aiming ? def.adsSpread : def.hipSpread,
    });
    if (result) {
      this.hitFlash = result === 'kill' ? 0.25 : 0.12;
      this.ctx.audio.hitmarker(result === 'kill');
    }
  }
}
