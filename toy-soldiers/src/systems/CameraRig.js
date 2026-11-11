import * as THREE from 'three';
import { CONFIG } from '../config.js';

const C = CONFIG.camera;
const _eye = new THREE.Vector3(), _right = new THREE.Vector3(), _pivot = new THREE.Vector3(), _back = new THREE.Vector3();

// One camera, two modes. Both read the player's yaw/pitch, so switching
// between first and third person never changes where you are aiming.
export class CameraRig {
  constructor(ctx, player) {
    this.ctx = ctx;
    this.player = player;
    this.camera = new THREE.PerspectiveCamera(C.fov, innerWidth / innerHeight, 0.12, 1500);
    this.camera.rotation.order = 'YXZ';
    ctx.scene.add(this.camera);
    this.thirdPerson = false;
    this.baseFov = C.fov;    // from Settings
    this.distance = 0;       // current boom length, smoothed
    this.aimOffset = 0;      // how far in front of the camera the aim ray should start
    this.forward = new THREE.Vector3();
  }

  toggle() { this.thirdPerson = !this.thirdPerson; }

  update(dt, aiming, adsFov = C.adsFov) {
    const p = this.player;
    const cam = this.camera;
    if (!p.alive) return; // hold the last view while waiting to respawn
    cam.rotation.set(p.pitch, p.yaw, 0);
    cam.getWorldDirection(this.forward);

    const targetFov = aiming ? Math.min(adsFov, this.baseFov) : this.baseFov;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov += (targetFov - cam.fov) * (1 - Math.exp(-dt * 16));
      cam.updateProjectionMatrix();
    }

    const eye = _eye.set(p.position.x, p.feet + CONFIG.soldier.eyeHeight, p.position.z);
    if (!this.thirdPerson) {
      this.distance = 0;
      this.aimOffset = 0;
      cam.position.copy(eye);
      return;
    }

    const tp = C.thirdPerson;
    const right = _right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
    const pivot = _pivot.set(p.position.x, p.feet + tp.height, p.position.z)
      .addScaledVector(right, tp.shoulder * (aiming ? 0.8 : 1));
    const back = _back.copy(this.forward).negate();
    let want = aiming ? tp.distance * 0.55 : tp.distance;
    const hit = this.ctx.physics.raycast(pivot, back, want + 0.6, p.collider);
    if (hit) want = Math.max(0.6, hit.distance - 0.6);
    // Pull in instantly, ease back out.
    this.distance = want < this.distance ? want : this.distance + (want - this.distance) * (1 - Math.exp(-dt * 8));
    cam.position.copy(pivot).addScaledVector(back, this.distance);
    this.aimOffset = this.distance + 1.2;
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }
}
