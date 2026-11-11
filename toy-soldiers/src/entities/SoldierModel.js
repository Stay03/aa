import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { plastic } from '../world/materials.js';

export const TEAM_COLORS = { green: 0x3f7d3a, tan: 0xc9a86a };

// Procedural moulded-plastic soldier, 6 cm tall, origin at the feet, facing -z.
// Stand-in until real sculpted models are sourced.
//
// It is drawn as three meshes (body and two legs) to keep draw calls low, but
// remembers the individual pieces so it can still break apart when shot.
export function createSoldier(team) {
  const mat = plastic(TEAM_COLORS[team], { roughness: 0.42 });
  const root = new THREE.Group();
  const pieces = []; // { geometry, matrix (relative to parent), parent }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
  const add = (geometry, x, y, z, { parent = root, rot = [0, 0, 0], scale = [1, 1, 1], offset = null } = {}) => {
    _m.compose(new THREE.Vector3(x, y, z), _q.setFromEuler(_e.set(...rot)), new THREE.Vector3(...scale));
    const matrix = offset ? offset.clone().multiply(_m) : _m.clone();
    pieces.push({ geometry, matrix, parent });
  };

  add(new THREE.CylinderGeometry(1.5, 1.6, 0.22, 20), 0, 0.11, 0, { scale: [1, 1, 0.75] }); // base

  const legGeo = new THREE.BoxGeometry(0.72, 2.5, 0.8);
  const bootGeo = new THREE.BoxGeometry(0.76, 0.4, 1.2);
  const legs = [-0.48, 0.48].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2.7, 0);
    root.add(pivot);
    add(legGeo, 0, -1.25, 0, { parent: pivot });
    add(bootGeo, 0, -2.32, -0.2, { parent: pivot });
    return pivot;
  });

  add(new THREE.BoxGeometry(1.9, 2.0, 1.05), 0, 3.65, 0);              // torso
  add(new THREE.BoxGeometry(1.5, 0.9, 0.5), 0, 3.8, 0.75);             // backpack
  add(new THREE.SphereGeometry(0.58, 16, 12), 0, 5.05, 0);             // head
  add(new THREE.SphereGeometry(0.76, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 5.12, 0, { scale: [1, 1, 1.12] }); // helmet

  const armGeo = new THREE.BoxGeometry(0.5, 0.5, 1.7);
  add(armGeo, 0.95, 4.0, -0.75, { rot: [0, -0.2, 0] });
  add(armGeo, -0.75, 3.95, -1.0, { rot: [0, 0.75, 0] });

  const rifleAt = new THREE.Matrix4().makeTranslation(0.55, 4.05, -1.5);
  add(new THREE.BoxGeometry(0.24, 0.34, 3.0), 0, 0, 0, { offset: rifleAt });
  add(new THREE.BoxGeometry(0.2, 0.6, 0.3), 0, -0.4, 0.5, { offset: rifleAt });
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.55, 4.05, -3.1);
  root.add(muzzle);

  // Merge the pieces of each parent into one mesh.
  for (const parent of [root, ...legs]) {
    const geos = pieces.filter((p) => p.parent === parent).map((p) => p.geometry.clone().applyMatrix4(p.matrix));
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    for (const g of geos) g.dispose();
  }

  return { root, pieces, material: mat, legs, muzzle };
}

export function animateLegs(model, phase, amount) {
  const swing = Math.sin(phase) * 0.7 * amount;
  model.legs[0].rotation.x = swing;
  model.legs[1].rotation.x = -swing;
}

// ---------------------------------------------------------------------------
// Sculpted soldier: the same contract as createSoldier (root, pieces,
// material, legs, muzzle) but modelled like a moulded army man: rounded
// limbs, a helmet with a brim, pack and bedroll, rifle held at the hip.
// ---------------------------------------------------------------------------
const Y = new THREE.Vector3(0, 1, 0);

export function createSculptedSoldier(team) {
  const mat = plastic(TEAM_COLORS[team], { roughness: 0.42 });
  const root = new THREE.Group();
  const pieces = [];
  const _q = new THREE.Quaternion(), _e = new THREE.Euler();

  // Add a piece from position / rotation / scale.
  const add = (geometry, pos, { parent = root, rot = [0, 0, 0], scale = [1, 1, 1] } = {}) => {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(_e.set(...rot)), new THREE.Vector3(...scale));
    pieces.push({ geometry, matrix, parent });
  };
  // A tapered limb between two points, with a ball at the far joint.
  const limb = (a, b, ra, rb, parent = root, joint = true) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const matrix = new THREE.Matrix4().compose(
      va.clone().add(vb).multiplyScalar(0.5), _q.setFromUnitVectors(Y, vb.clone().sub(va).normalize()).clone(), new THREE.Vector3(1, 1, 1));
    pieces.push({ geometry: new THREE.CylinderGeometry(rb, ra, len, 12), matrix, parent });
    if (joint) add(new THREE.SphereGeometry(rb * 1.04, 12, 10), b, { parent });
  };
  const ball = (r, pos, opts) => add(new THREE.SphereGeometry(r, 16, 12), pos, opts);

  // Base
  add(new THREE.CylinderGeometry(1.5, 1.66, 0.2, 28), [0, 0.1, -0.25], { scale: [1, 1, 0.82] });

  // Legs, each on a hip pivot so they can swing.
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.42, 2.72, 0.05);
    root.add(pivot);
    const p = { parent: pivot };
    limb([0, 0, 0], [0.02 * side, -1.2, -0.1], 0.42, 0.33, pivot);               // thigh -> knee
    limb([0.02 * side, -1.2, -0.1], [0.03 * side, -2.25, 0.08], 0.32, 0.25, pivot, false); // shin
    add(new THREE.CapsuleGeometry(0.31, 0.62, 4, 10), [0.03 * side, -2.36, -0.2], { ...p, rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.8] }); // boot
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 12), [0.03 * side, -2.05, 0.08], p);     // boot cuff
    return pivot;
  });

  // Hips, belt and kit
  ball(0.62, [0, 2.78, 0.05], { scale: [1.22, 0.72, 0.9] });
  add(new THREE.CylinderGeometry(0.8, 0.8, 0.24, 20), [0, 3.02, 0.03], { scale: [1, 1, 0.7] });
  add(new THREE.BoxGeometry(0.34, 0.42, 0.2), [-0.42, 2.95, -0.52]);                       // ammo pouches
  add(new THREE.BoxGeometry(0.34, 0.42, 0.2), [0.42, 2.95, -0.52]);
  ball(0.3, [-0.82, 2.82, 0.28], { scale: [0.6, 1.15, 1] });                               // canteen

  // Torso, shoulders, neck
  add(new THREE.CylinderGeometry(0.98, 0.74, 1.42, 18), [0, 3.72, 0.02], { scale: [1, 1, 0.64], rot: [-0.06, 0, 0] });
  ball(0.92, [0, 4.25, 0.0], { scale: [1.08, 0.5, 0.66] });                                // shoulder yoke
  add(new THREE.CylinderGeometry(0.22, 0.26, 0.34, 12), [0, 4.62, 0]);

  // Head and helmet
  ball(0.47, [0, 5.0, -0.02], { scale: [0.95, 1.08, 1] });
  add(new THREE.SphereGeometry(0.1, 8, 6), [0, 4.95, -0.48]);                              // nose
  add(new THREE.SphereGeometry(0.66, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), [0, 5.1, 0], { scale: [1, 0.86, 1.1] });
  add(new THREE.CylinderGeometry(0.72, 0.74, 0.07, 22), [0, 5.1, 0], { scale: [1, 1, 1.1] }); // brim

  // Pack and bedroll
  add(new THREE.BoxGeometry(1.0, 1.05, 0.46), [0, 3.82, 0.62]);
  add(new THREE.CapsuleGeometry(0.21, 0.9, 4, 10), [0, 4.46, 0.62], { rot: [0, 0, Math.PI / 2] });

  // Rifle, carried at the hip pointing forward
  const rx = 0.42, ry = 3.66;
  add(new THREE.BoxGeometry(0.2, 0.42, 0.75), [rx, ry - 0.06, -0.45], { rot: [0.1, 0, 0] });   // stock
  add(new THREE.BoxGeometry(0.2, 0.32, 0.9), [rx, ry, -1.25]);                              // receiver
  add(new THREE.BoxGeometry(0.15, 0.48, 0.2), [rx, ry - 0.36, -1.3], { rot: [0.2, 0, 0] });   // magazine
  add(new THREE.BoxGeometry(0.21, 0.25, 0.7), [rx, ry + 0.01, -2.03]);                      // handguard
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.85, 8), [rx, ry + 0.04, -2.78], { rot: [Math.PI / 2, 0, 0] });
  add(new THREE.BoxGeometry(0.06, 0.16, 0.06), [rx, ry + 0.2, -2.3]);                       // front sight

  // Arms: right hand on the grip, left hand under the handguard
  limb([0.98, 4.26, 0], [1.02, 3.55, -0.3], 0.3, 0.25);
  limb([1.02, 3.55, -0.3], [rx + 0.12, ry - 0.12, -1.02], 0.24, 0.2, root, false);
  ball(0.25, [rx + 0.06, ry - 0.14, -1.05]);
  limb([-0.98, 4.26, 0], [-0.82, 3.56, -0.85], 0.3, 0.25);
  limb([-0.82, 3.56, -0.85], [rx - 0.2, ry - 0.12, -1.95], 0.24, 0.2, root, false);
  ball(0.25, [rx - 0.12, ry - 0.14, -2.0]);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(rx, ry + 0.04, -3.2);
  root.add(muzzle);

  for (const parent of [root, ...legs]) {
    const geos = pieces.filter((p) => p.parent === parent).map((p) => {
      const g = p.geometry.index ? p.geometry.toNonIndexed() : p.geometry.clone();
      return g.applyMatrix4(p.matrix);
    });
    const mesh = new THREE.Mesh(mergeGeometries(geos, false), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    for (const g of geos) g.dispose();
  }
  return { root, pieces, material: mat, legs, muzzle };
}
