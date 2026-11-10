import * as THREE from 'three';
import { plastic, matte, blockFaceMaterial, rulerMaterial } from './materials.js';

// Toy factories. Each one adds a mesh to the scene and a collider to physics.
// Positions are in cm; `y` is the height of the toy's underside unless noted.
// These are authored as self-contained pieces so a later "random spill" mode
// can scatter the same toys procedurally.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
const BOX = new THREE.BoxGeometry(1, 1, 1);

export const BLOCK = 4.5;

export function alphabetBlock(ctx, x, y, z, rotY = 0) {
  const mats = Array.from({ length: 6 }, () =>
    blockFaceMaterial(LETTERS[Math.floor(ctx.rand() * 26)], Math.floor(ctx.rand() * 5)));
  const mesh = shadow(new THREE.Mesh(BOX, mats));
  mesh.scale.setScalar(BLOCK);
  mesh.position.set(x, y + BLOCK / 2, z);
  mesh.rotation.y = rotY;
  ctx.scene.add(mesh);
  ctx.physics.addBox(mesh, BLOCK / 2, BLOCK / 2, BLOCK / 2);
  return mesh;
}

// Stack `n` blocks high with slight random twist, like a kid stacked them.
export function blockStack(ctx, x, z, n) {
  for (let i = 0; i < n; i++) alphabetBlock(ctx, x, i * BLOCK, z, (ctx.rand() - 0.5) * 0.25);
}

const STUD = new THREE.CylinderGeometry(1, 1, 0.6, 16);
const PITCH = 3.2;

// Chunky building brick, `sx` by `sz` studs.
export function brick(ctx, x, y, z, sx, sz, color, rotY = 0) {
  const w = sx * PITCH, d = sz * PITCH, h = 3.8;
  const mat = plastic(color);
  const mesh = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  for (let i = 0; i < sx; i++) {
    for (let j = 0; j < sz; j++) {
      const s = shadow(new THREE.Mesh(STUD, mat));
      s.position.set((i - (sx - 1) / 2) * PITCH, h / 2 + 0.3, (j - (sz - 1) / 2) * PITCH);
      mesh.add(s);
    }
  }
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = rotY;
  ctx.scene.add(mesh);
  ctx.physics.addBox(mesh, w / 2, h / 2, d / 2);
  return mesh;
}
export const BRICK_H = 3.8;

export function book(ctx, x, y, z, color, rotY = 0, w = 15, h = 2.6, d = 21) {
  const cover = matte(color, 0.55);
  const pages = matte(0xf4efe2, 0.95);
  const mesh = shadow(new THREE.Mesh(BOX, [pages, cover, cover, cover, pages, pages]));
  mesh.scale.set(w, h, d);
  mesh.position.set(x, y + h / 2, z);
  mesh.rotation.y = rotY;
  ctx.scene.add(mesh);
  ctx.physics.addBox(mesh, w / 2, h / 2, d / 2);
  return mesh;
}

export function crayon(ctx, x, z, color, rotY) {
  const r = 0.45, len = 9;
  const group = new THREE.Group();
  const body = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, len * 0.82, 14), matte(color, 0.5)));
  const tip = shadow(new THREE.Mesh(new THREE.ConeGeometry(r * 0.8, len * 0.18, 14), matte(color, 0.5)));
  body.rotation.z = Math.PI / 2;
  tip.rotation.z = -Math.PI / 2;
  tip.position.x = len / 2 - len * 0.09;
  body.position.x = -len * 0.09;
  group.add(body, tip);
  group.position.set(x, r, z);
  group.rotation.y = rotY;
  ctx.scene.add(group);
  ctx.physics.addBox(group, len / 2, r, r);
  return group;
}

// Flat plank made of pencils laid side by side; `from` and `to` are the two
// end points of its centre line, so it can be a bridge or a ramp.
export function pencilBridge(ctx, from, to, width = 2.7) {
  return plank(ctx, from, to, width, 0.8, (len) => {
    const g = new THREE.Group();
    const cols = [0xf2c230, 0xe2552b, 0x2f8f4a];
    for (let i = 0; i < 3; i++) {
      const p = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, len, 6), matte(cols[i], 0.5)));
      p.rotation.z = Math.PI / 2;
      p.position.z = (i - 1) * 0.9;
      g.add(p);
    }
    return g;
  });
}

export function ruler(ctx, from, to) {
  return plank(ctx, from, to, 3.6, 0.3, (len) => {
    const side = plastic(0xe0b020);
    const top = rulerMaterial();
    const m = shadow(new THREE.Mesh(BOX, [side, side, top, side, side, side]));
    m.scale.set(len, 0.3, 3.6);
    return m;
  });
}

function plank(ctx, from, to, width, thick, build) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
  const len = a.distanceTo(b);
  const obj = build(len);
  obj.position.copy(a).add(b).multiplyScalar(0.5);
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
  ctx.scene.add(obj);
  ctx.physics.addBox(obj, len / 2, thick / 2, width / 2);
  return obj;
}

export function domino(ctx, x, z, rotY, color = 0xf5f2ea) {
  const w = 2.4, h = 4.8, t = 0.7;
  const mesh = shadow(new THREE.Mesh(BOX, plastic(color, { roughness: 0.25 })));
  mesh.scale.set(w, h, t);
  mesh.position.set(x, h / 2, z);
  mesh.rotation.y = rotY;
  ctx.scene.add(mesh);
  ctx.physics.addBox(mesh, w / 2, h / 2, t / 2, { dynamic: true, density: 0.6, friction: 0.5 });
  return mesh;
}

export function ball(ctx, x, z, r = 5) {
  const mesh = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), plastic(0xe23a3a, { roughness: 0.4 })));
  const band = new THREE.Mesh(new THREE.TorusGeometry(r * 1.001, r * 0.09, 8, 48), plastic(0xfafafa));
  band.rotation.x = Math.PI / 2;
  mesh.add(band);
  mesh.position.set(x, r, z);
  ctx.scene.add(mesh);
  ctx.physics.addBall(mesh, r, { dynamic: true, density: 0.02, restitution: 0.65 });
  return mesh;
}

export function marble(ctx, x, z, color) {
  const r = 0.8;
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.05 });
  const mesh = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat));
  mesh.position.set(x, r, z);
  ctx.scene.add(mesh);
  ctx.physics.addBall(mesh, r, { dynamic: true, density: 2.5, restitution: 0.4, friction: 0.3 });
  return mesh;
}

export function toyCar(ctx, x, z, color, rotY) {
  const group = new THREE.Group();
  const body = shadow(new THREE.Mesh(new THREE.BoxGeometry(16, 3.2, 7), plastic(color)));
  body.position.y = 0.4;
  const cabin = shadow(new THREE.Mesh(new THREE.BoxGeometry(8, 2.8, 6.2), plastic(color)));
  cabin.position.set(-0.8, 3.3, 0);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(8.1, 1.8, 6.3), plastic(0x9fd0e8, { roughness: 0.1 }));
  glass.position.set(-0.8, 3.5, 0);
  group.add(body, cabin, glass);
  const wheelGeo = new THREE.CylinderGeometry(1.7, 1.7, 1.4, 20);
  for (const [wx, wz] of [[5, 3.4], [5, -3.4], [-5, 3.4], [-5, -3.4]]) {
    const wh = shadow(new THREE.Mesh(wheelGeo, matte(0x1c1c1c, 0.8)));
    wh.rotation.x = Math.PI / 2;
    wh.position.set(wx, -1.3, wz);
    group.add(wh);
  }
  group.position.set(x, 3, z); // origin is the collider centre
  group.rotation.y = rotY;
  ctx.scene.add(group);
  ctx.physics.addBox(group, 8, 3, 3.6);
  return group;
}

// Big soft landmark. Blocks sightlines across the middle of the map.
export function teddyBear(ctx, x, z, rotY) {
  const fur = matte(0x9a6a3c, 1);
  const light = matte(0xd9b98a, 1);
  const group = new THREE.Group();
  const sphere = (r, px, py, pz, mat = fur, sy = 1) => {
    const m = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 28, 20), mat));
    m.position.set(px, py, pz);
    m.scale.y = sy;
    group.add(m);
    return m;
  };
  sphere(15, 0, 14, 0, fur, 1.05);            // body
  sphere(8, 0, 13, 11, light, 1);              // belly
  sphere(10.5, 0, 36, 1);                      // head
  sphere(4.5, 0, 34, 10, light);               // muzzle
  sphere(1.3, 0, 35.5, 14, matte(0x1a1a1a, 0.3)); // nose
  sphere(1, -4, 39, 9.6, matte(0x1a1a1a, 0.3));
  sphere(1, 4, 39, 9.6, matte(0x1a1a1a, 0.3));
  sphere(4, -8.5, 44.5, 0);
  sphere(4, 8.5, 44.5, 0);
  sphere(6, -16, 20, 5, fur, 1.4);             // arms
  sphere(6, 16, 20, 5, fur, 1.4);
  sphere(7, -10, 5.5, 15);                     // legs, sitting
  sphere(7, 10, 5.5, 15);
  group.position.set(x, 0, z);
  group.rotation.y = rotY;
  ctx.scene.add(group);

  // Colliders: one body, a few balls.
  const { RAPIER } = ctx;
  const q = group.quaternion;
  const body = ctx.physics.world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0, z).setRotation({ x: q.x, y: q.y, z: q.z, w: q.w }));
  for (const [r, px, py, pz] of [[15, 0, 14, 0], [10.5, 0, 36, 1], [7, -10, 5.5, 15], [7, 10, 5.5, 15], [6, -16, 20, 5], [6, 16, 20, 5]]) {
    ctx.physics.world.createCollider(RAPIER.ColliderDesc.ball(r).setTranslation(px, py, pz), body);
  }
  return group;
}
