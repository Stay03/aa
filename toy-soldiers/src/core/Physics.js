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

  step() {
    this.world.step();
  }

  sync() {
    for (const { mesh, body } of this.dynamic) {
      const t = body.translation();
      const r = body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  raycast(origin, dir, maxDist, excludeCollider) {
    const ray = this.ray;
    ray.origin.x = origin.x; ray.origin.y = origin.y; ray.origin.z = origin.z;
    ray.dir.x = dir.x; ray.dir.y = dir.y; ray.dir.z = dir.z;
    const hit = this.world.castRayAndGetNormal(ray, maxDist, true, undefined, undefined, excludeCollider);
    if (!hit) return null;
    const d = hit.timeOfImpact;
    return {
      distance: d,
      point: new THREE.Vector3(origin.x + dir.x * d, origin.y + dir.y * d, origin.z + dir.z * d),
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
      collider: hit.collider,
      body: hit.collider.parent(),
      owner: this.owners.get(hit.collider.handle) ?? null,
    };
  }
}
