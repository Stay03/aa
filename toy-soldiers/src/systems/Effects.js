import * as THREE from 'three';
import { CONFIG } from '../config.js';

const UP = new THREE.Vector3(0, 1, 0);

// Short-lived visuals: tracers, impact chips, and soldiers breaking into
// plastic pieces that soften and melt away.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.debris = [];
    this.tracerGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 5);
    this.tracerMat = new THREE.MeshBasicMaterial({ color: 0xfff0a8, transparent: true });
    this.chipGeo = new THREE.TetrahedronGeometry(0.16);
    this.chipMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 });
  }

  tracer(from, to) {
    const len = from.distanceTo(to);
    if (len < 0.5) return;
    const m = new THREE.Mesh(this.tracerGeo, this.tracerMat.clone());
    m.scale.set(1, len, 1);
    m.position.copy(from).add(to).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
    this.scene.add(m);
    this.tracers.push({ mesh: m, life: 0.07 });
  }

  impact(point, normal) {
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(this.chipGeo, this.chipMat);
      m.position.copy(point);
      const vel = normal.clone().multiplyScalar(14 + Math.random() * 14)
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(22));
      this._addDebris(m, vel, 0.5, 0.16);
    }
  }

  // Detach every part of a soldier model and send it flying.
  shatter(model, dir) {
    model.root.updateWorldMatrix(true, true);
    for (const part of model.parts) {
      const m = new THREE.Mesh(part.geometry, part.material.clone());
      part.matrixWorld.decompose(m.position, m.quaternion, m.scale);
      m.castShadow = true;
      const vel = new THREE.Vector3(dir.x, 0, dir.z).multiplyScalar(18 + Math.random() * 22)
        .add(new THREE.Vector3((Math.random() - 0.5) * 34, 22 + Math.random() * 34, (Math.random() - 0.5) * 34));
      this._addDebris(m, vel, 2.6 + Math.random() * 0.8, 0.3, true);
    }
  }

  _addDebris(mesh, vel, life, floorOffset, melts = false) {
    this.scene.add(mesh);
    this.debris.push({
      mesh, vel, life, maxLife: life, floorOffset, melts,
      spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(18),
      baseScale: mesh.scale.clone(),
    });
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.mesh.material.opacity = Math.max(0, t.life / 0.07);
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.material.dispose();
        this.tracers.splice(i, 1);
      }
    }

    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      d.vel.y -= CONFIG.gravity * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      if (d.mesh.position.y < d.floorOffset) {
        d.mesh.position.y = d.floorOffset;
        d.vel.y = Math.abs(d.vel.y) * 0.32;
        d.vel.x *= 0.6;
        d.vel.z *= 0.6;
        d.spin.multiplyScalar(0.5);
      }
      d.mesh.rotation.x += d.spin.x * dt;
      d.mesh.rotation.y += d.spin.y * dt;
      d.mesh.rotation.z += d.spin.z * dt;

      if (d.melts) {
        // Final second: the piece slumps into a puddle and darkens.
        const k = THREE.MathUtils.clamp(1 - d.life / 1.1, 0, 1);
        d.mesh.scale.set(d.baseScale.x * (1 + k * 0.9), d.baseScale.y * (1 - k * 0.92), d.baseScale.z * (1 + k * 0.9));
        if (k > 0) {
          d.spin.set(0, 0, 0);
          d.mesh.material.color.multiplyScalar(1 - dt * 0.6);
        }
      }
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        if (d.melts) d.mesh.material.dispose();
        this.debris.splice(i, 1);
      }
    }
  }
}
