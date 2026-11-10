import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { plastic } from '../world/materials.js';
import { TEAM_COLORS } from '../entities/SoldierModel.js';

const R = CONFIG.rifle;

// Hitscan rifle. Stats live in CONFIG so more weapons become data, not code.
export class Weapon {
  constructor(ctx, player, rig) {
    this.ctx = ctx;
    this.player = player;
    this.rig = rig;
    this.ammo = R.magazine;
    this.cooldown = 0;
    this.reloading = 0;
    this.kick = 0;
    this.hitFlash = 0;
    this.kills = 0;

    // First-person view model, parented to the camera.
    const mat = plastic(TEAM_COLORS.green, { roughness: 0.42 });
    const vm = new THREE.Group();
    const add = (w, h, d, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      vm.add(m);
    };
    add(0.16, 0.22, 1.7, 0, 0, -0.6);
    add(0.2, 0.3, 0.7, 0, -0.02, 0.45);
    add(0.13, 0.42, 0.2, 0, -0.3, 0.1);
    add(0.3, 0.3, 0.9, -0.1, -0.25, 0.75); // sleeve
    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0, -1.5);
    vm.add(this.muzzle);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a }));
    this.flash.position.copy(this.muzzle.position);
    this.flash.visible = false;
    vm.add(this.flash);
    this.viewModel = vm;
    this.hip = new THREE.Vector3(0.7, -0.62, -1.6);
    this.ads = new THREE.Vector3(0, -0.3, -1.05);
    vm.position.copy(this.hip);
    rig.camera.add(vm);
  }

  startReload() {
    if (this.reloading > 0 || this.ammo === R.magazine) return;
    this.reloading = R.reloadSeconds;
  }

  update(dt, input) {
    this.cooldown -= dt;
    this.hitFlash -= dt;
    this.kick *= Math.exp(-dt * 14);

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) this.ammo = R.magazine;
    } else {
      if (input.pressed.has('reload')) this.startReload();
      if (input.fire && this.cooldown <= 0) {
        if (this.ammo > 0) this.fire(input.aim);
        else this.startReload();
      }
    }

    const vm = this.viewModel;
    vm.visible = !this.rig.thirdPerson;
    vm.position.lerp(input.aim ? this.ads : this.hip, 1 - Math.exp(-dt * 18));
    vm.position.z += this.kick * 0.5;
    vm.rotation.x = this.kick * 0.35 - (this.reloading > 0 ? Math.sin((this.reloading / R.reloadSeconds) * Math.PI) * 0.9 : 0);
    this.flash.visible = this.cooldown > 1 / R.fireRate - 0.035;
  }

  fire(aiming) {
    this.cooldown = 1 / R.fireRate;
    this.ammo--;
    this.kick = 1;
    this.player.pitch = Math.min(1.45, this.player.pitch + R.recoil);

    const { physics, effects } = this.ctx;
    const cam = this.rig.camera;
    const spread = aiming ? R.adsSpread : R.hipSpread;
    const dir = this.rig.forward.clone();
    dir.x += (Math.random() - 0.5) * spread;
    dir.y += (Math.random() - 0.5) * spread;
    dir.z += (Math.random() - 0.5) * spread;
    dir.normalize();

    // Start past the player in third person so the shot cannot hit things
    // between the camera and the soldier.
    const origin = cam.position.clone().addScaledVector(dir, this.rig.aimOffset);
    const hit = physics.raycast(origin, dir, R.range, this.player.collider);
    const end = hit ? hit.point : origin.clone().addScaledVector(dir, R.range);

    const from = new THREE.Vector3();
    (this.rig.thirdPerson ? this.player.model.muzzle : this.muzzle).getWorldPosition(from);
    effects.tracer(from, end);

    if (!hit) return;
    effects.impact(hit.point, hit.normal);
    if (hit.owner?.damage) {
      this.hitFlash = 0.12;
      if (hit.owner.damage(R.damage, dir)) this.kills++;
    } else if (hit.body?.isDynamic()) {
      hit.body.applyImpulseAtPoint({ x: dir.x * R.impulse, y: dir.y * R.impulse, z: dir.z * R.impulse }, hit.point, true);
    }
  }
}
