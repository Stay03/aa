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
