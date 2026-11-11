import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CONFIG } from '../config.js';

export { RAPIER };

// Thin wrapper over Rapier. Meshes passed in must be direct children of the
// scene so their local transform is their world transform.
export class Physics {
  static async create() {
    await RAPIER.init();
    return new Physics();
  }

  constructor() {
    this.world = new RAPIER.World({ x: 0, y: -CONFIG.gravity, z: 0 });
    this.world.timestep = 1 / 60;
    this.dynamic = [];
    this.owners = new Map(); // collider handle -> gameplay object (a Soldier)
    this.hit = { distance: 0, point: new THREE.Vector3(), normal: new THREE.Vector3(), collider: null, body: null, owner: null };
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  }

  _body(mesh, dynamic) {
    const desc = dynamic ? RAPIER.RigidBodyDesc.dynamic() : RAPIER.RigidBodyDesc.fixed();
    const p = mesh.position;
    const q = mesh.quaternion;
    desc.setTranslation(p.x, p.y, p.z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w });
    const body = this.world.createRigidBody(desc);
    if (dynamic) this.dynamic.push({ mesh, body });
    return body;
  }

  _attach(mesh, shape, { dynamic = false, density = 1, restitution = 0.1, friction = 0.7, owner = null } = {}) {
    const body = this._body(mesh, dynamic);
    shape.setDensity(density).setRestitution(restitution).setFriction(friction);
    const collider = this.world.createCollider(shape, body);
    if (owner) this.owners.set(collider.handle, owner);
    return { body, collider };
  }

  addBox(mesh, hx, hy, hz, opts) {
    return this._attach(mesh, RAPIER.ColliderDesc.cuboid(hx, hy, hz), opts);
  }

  addBall(mesh, r, opts) {
    return this._attach(mesh, RAPIER.ColliderDesc.ball(r), opts);
  }

  addCapsule(mesh, halfHeight, r, opts) {
    return this._attach(mesh, RAPIER.ColliderDesc.capsule(halfHeight, r), opts);
  }

  // Static box with no mesh (invisible wall, floor slab).
  addStaticBox(x, y, z, hx, hy, hz) {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z));
    return this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz), body);
  }

  // Rapier's own world.step() also re-scans every body and collider on each
  // call to pick up ones created or removed inside the engine (soft bodies).
  // This game never does that, and the scan was the largest source of
  // per-frame garbage, so the normal step goes straight to the pipeline.
  step() {
    const w = this.world;
    w.physicsPipeline.step(w.gravity, w.integrationParameters, w.islands, w.broadPhase, w.narrowPhase,
      w.bodies, w.colliders, w.softBodies, w.impulseJoints, w.multibodyJoints, w.ccdSolver);
  }

  // The library's complete step. Use after adding or removing bodies.
  fullStep() {
    this.world.step();
  }

  sync() {
    for (const { mesh, body } of this.dynamic) {
      if (body.isSleeping()) continue; // resting toys have not moved
      const t = body.translation();
      const r = body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  _aim(origin, dir) {
    const ray = this.ray;
    ray.origin.x = origin.x; ray.origin.y = origin.y; ray.origin.z = origin.z;
    ray.dir.x = dir.x; ray.dir.y = dir.y; ray.dir.z = dir.z;
    return ray;
  }

  // Full hit information. The returned object and its vectors are reused by
  // the next raycast: read what you need straight away, clone to keep.
  raycast(origin, dir, maxDist, excludeCollider) {
    const hit = this.world.castRayAndGetNormal(this._aim(origin, dir), maxDist, true, undefined, undefined, excludeCollider);
    if (!hit) return null;
    const d = hit.timeOfImpact, out = this.hit;
    out.distance = d;
    out.point.set(origin.x + dir.x * d, origin.y + dir.y * d, origin.z + dir.z * d);
    out.normal.set(hit.normal.x, hit.normal.y, hit.normal.z);
    out.collider = hit.collider;
    out.body = hit.collider.parent();
    out.owner = this.owners.get(hit.collider.handle) ?? null;
    return out;
  }

  // Cheaper query for line-of-sight checks: only what was hit, if anything.
  raycastOwner(origin, dir, maxDist, excludeCollider) {
    const hit = this.world.castRay(this._aim(origin, dir), maxDist, true, undefined, undefined, excludeCollider);
    return hit ? this.owners.get(hit.collider.handle) ?? null : undefined;
  }
}
