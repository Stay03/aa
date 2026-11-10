import * as THREE from 'three';
import { plastic } from '../world/materials.js';

export const TEAM_COLORS = { green: 0x3f7d3a, tan: 0xc9a86a };

// Procedural moulded-plastic soldier, 6 cm tall, origin at the feet, facing -z.
// Stand-in until real sculpted models are sourced; the rig points (legs,
// rifle) are what gameplay code relies on.
export function createSoldier(team) {
  const mat = plastic(TEAM_COLORS[team], { roughness: 0.42 });
  const root = new THREE.Group();
  const parts = [];
  const add = (geo, x, y, z, parent = root) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    parts.push(m);
    return m;
  };

  const base = add(new THREE.CylinderGeometry(1.5, 1.6, 0.22, 20), 0, 0.11, 0);
  base.scale.z = 0.75;

  const legGeo = new THREE.BoxGeometry(0.72, 2.5, 0.8);
  const legs = [-0.48, 0.48].map((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 2.7, 0);
    root.add(pivot);
    add(legGeo, 0, -1.25, 0, pivot);
    add(new THREE.BoxGeometry(0.76, 0.4, 1.2), 0, -2.32, -0.2, pivot); // boot
    return pivot;
  });

  add(new THREE.BoxGeometry(1.9, 2.0, 1.05), 0, 3.65, 0);              // torso
  add(new THREE.BoxGeometry(1.5, 0.9, 0.5), 0, 3.8, 0.75);             // backpack
  add(new THREE.SphereGeometry(0.58, 16, 12), 0, 5.05, 0);             // head
  const helmet = add(new THREE.SphereGeometry(0.76, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, 5.12, 0);
  helmet.scale.z = 1.12;

  const armGeo = new THREE.BoxGeometry(0.5, 0.5, 1.7);
  const armR = add(armGeo, 0.95, 4.0, -0.75);
  armR.rotation.y = -0.2;
  const armL = add(armGeo, -0.75, 3.95, -1.0);
  armL.rotation.y = 0.75;

  const rifle = new THREE.Group();
  rifle.position.set(0.55, 4.05, -1.5);
  root.add(rifle);
  add(new THREE.BoxGeometry(0.24, 0.34, 3.0), 0, 0, 0, rifle);
  add(new THREE.BoxGeometry(0.2, 0.6, 0.3), 0, -0.4, 0.5, rifle);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -1.6);
  rifle.add(muzzle);

  return { root, parts, legs, muzzle };
}

export function animateLegs(model, phase, amount) {
  const swing = Math.sin(phase) * 0.7 * amount;
  model.legs[0].rotation.x = swing;
  model.legs[1].rotation.x = -swing;
}
