import * as THREE from 'three';
import { CONFIG } from '../config.js';

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();
const _e = new THREE.Euler();

const MAX_TRACERS = 96;
const MAX_CHIPS = 320;
const MAX_DEBRIS = 90;
const TRACER_LIFE = 0.07;

// Short-lived visuals: tracers, impact chips, and soldiers breaking into
// plastic pieces that soften and melt away.
//
// Tracers and chips are each one instanced mesh with a fixed pool, so a
// firefight adds no objects, no materials and no garbage: two draw calls
// however much is happening.
export class Effects {
  constructor(scene) {
    this.scene = scene;

    this.tracerMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.035, 0.035, 1, 5),
      new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }),
      MAX_TRACERS);
    this.tracerMesh.setColorAt(0, _c.set(0));
    this.tracers = []; // { life } parallel to instance index
    this.tracerData = new Float32Array(MAX_TRACERS); // remaining life

    this.chipMesh = new THREE.InstancedMesh(
      new THREE.TetrahedronGeometry(0.16),
      new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 }),
      MAX_CHIPS);
    this.chips = []; // { pos, vel, life, spin }

    for (const m of [this.tracerMesh, this.chipMesh]) {
      m.count = 0;
      m.frustumCulled = false;
      m.receiveShadow = true; // same shader variant as the rest of the world
      scene.add(m);
    }

    this.debris = [];
  }

  tracer(from, to) {
    const len = from.distanceTo(to);
    const i = this.tracerMesh.count;
    if (len < 0.5 || i >= MAX_TRACERS) return;
    _p.copy(from).add(to).multiplyScalar(0.5);
    _q.setFromUnitVectors(UP, _s.copy(to).sub(from).normalize());
    this.tracerMesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(1, len, 1)));
    this.tracerData[i] = TRACER_LIFE;
    this.tracerMesh.count = i + 1;
    this.tracerMesh.instanceMatrix.needsUpdate = true;
  }

  impact(point, normal, count = 4) {
    for (let i = 0; i < count && this.chips.length < MAX_CHIPS; i++) {
      this.chips.push({
        pos: point.clone(),
        vel: normal.clone().multiplyScalar(14 + Math.random() * 14)
          .add(_p.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(22)),
        life: 0.35 + Math.random() * 0.25,
        spin: Math.random() * 6,
      });
    }
  }

  // Detach every piece of a soldier model and send it flying.
  shatter(model, dir) {
    model.root.updateWorldMatrix(true, true);
    // One material for the whole death, so the pieces can darken as they melt
    // without touching the living soldiers' shared material.
    const material = model.material.clone();
    let left = model.pieces.length;
    const done = () => { if (--left === 0) material.dispose(); };
    for (const piece of model.pieces) {
      const mesh = new THREE.Mesh(piece.geometry, material);
      _m.multiplyMatrices(piece.parent.matrixWorld, piece.matrix).decompose(mesh.position, mesh.quaternion, mesh.scale);
      mesh.receiveShadow = true; // keeps the soldier's shader variant: no compile hitch
      this.scene.add(mesh);
      const life = 2.6 + Math.random() * 0.8;
      this.debris.push({
        mesh, material, done, life,
        vel: new THREE.Vector3(dir.x, 0, dir.z).multiplyScalar(18 + Math.random() * 22)
          .add(_p.set((Math.random() - 0.5) * 34, 22 + Math.random() * 34, (Math.random() - 0.5) * 34)),
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(18),
        baseScale: mesh.scale.clone(),
      });
    }
    while (this.debris.length > MAX_DEBRIS) this.removeDebris(0);
  }

  removeDebris(i) {
    const d = this.debris[i];
    this.scene.remove(d.mesh);
    d.done();
    this.debris.splice(i, 1);
  }

  update(dt) {
    // Tracers: fade by colour (additive), swap-remove when spent.
    const tm = this.tracerMesh;
    if (tm.count) {
      for (let i = tm.count - 1; i >= 0; i--) {
        const life = (this.tracerData[i] -= dt);
        if (life <= 0) {
          const last = --tm.count;
          if (i !== last) {
            tm.getMatrixAt(last, _m);
            tm.setMatrixAt(i, _m);
            this.tracerData[i] = this.tracerData[last];
            tm.setColorAt(i, _c.set(0xfff0a8).multiplyScalar(Math.max(0, this.tracerData[i] / TRACER_LIFE)));
          }
        } else {
          tm.setColorAt(i, _c.set(0xfff0a8).multiplyScalar(life / TRACER_LIFE));
        }
      }
      tm.instanceMatrix.needsUpdate = true;
      tm.instanceColor.needsUpdate = true;
    }

    // Chips: simple ballistic flecks.
    const cm = this.chipMesh;
    if (this.chips.length || cm.count) {
      const g = CONFIG.gravity * dt;
      for (let i = this.chips.length - 1; i >= 0; i--) {
        const c = this.chips[i];
        c.life -= dt;
        if (c.life <= 0) { this.chips[i] = this.chips[this.chips.length - 1]; this.chips.pop(); continue; }
        c.vel.y -= g;
        c.pos.addScaledVector(c.vel, dt);
        if (c.pos.y < 0.1) { c.pos.y = 0.1; c.vel.y = Math.abs(c.vel.y) * 0.3; c.vel.x *= 0.6; c.vel.z *= 0.6; }
      }
      for (let i = 0; i < this.chips.length; i++) {
        const c = this.chips[i];
        cm.setMatrixAt(i, _m.compose(c.pos, _q.setFromEuler(_e.set(c.spin + c.life * 20, c.spin, 0)), _s.setScalar(Math.min(1, c.life * 6))));
      }
      cm.count = this.chips.length;
      cm.instanceMatrix.needsUpdate = true;
    }

    // Soldier pieces.
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) { this.removeDebris(i); continue; }
      d.vel.y -= CONFIG.gravity * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      if (d.mesh.position.y < 0.3) {
        d.mesh.position.y = 0.3;
        d.vel.y = Math.abs(d.vel.y) * 0.32;
        d.vel.x *= 0.6;
        d.vel.z *= 0.6;
        d.spin.multiplyScalar(0.5);
      }
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;

      // Final second: the piece slumps into a puddle and darkens.
      const k = THREE.MathUtils.clamp(1 - d.life / 1.1, 0, 1);
      if (k > 0) {
        d.mesh.scale.set(d.baseScale.x * (1 + k * 0.9), d.baseScale.y * (1 - k * 0.92), d.baseScale.z * (1 + k * 0.9));
        d.spin.set(0, 0, 0);
      }
    }
    // Darken each dying soldier's material once per frame, not once per piece.
    let prev = null;
    for (const d of this.debris) {
      if (d.material !== prev && d.life < 1.1) d.material.color.multiplyScalar(1 - dt * 0.6);
      prev = d.material;
    }
  }
}
