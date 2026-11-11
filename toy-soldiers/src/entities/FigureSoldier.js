import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { plastic } from '../world/materials.js';

// The soldier everyone plays as: a sculpted toy-soldier figure
// ("Modern Soldier Shooting Toy Soldier 3D Print" by nimproductions, CC BY 4.0;
// see public/models/soldier/CREDITS.txt), converted by tools/stl2glb.mjs.
//
// It is one rigid moulded pose, like a real army man. Movement is shown by
// rocking and hopping the whole figure, the way a hand walks a toy along.
const BASE = `${import.meta.env.BASE_URL}models/soldier/`;
export const TEAM_COLORS = { green: 0x3f7d3a, tan: 0xc9a86a };
const cache = new Map();
let info = null;      // { muzzle: [x, y, z], height }
let pieces = null;    // break-apart chunks of the game mesh, built once

export function loadFigure(file) {
  if (!cache.has(file)) {
    cache.set(file, new GLTFLoader().loadAsync(BASE + file).then((g) => {
      let geometry = null;
      g.scene.traverse((o) => { if (o.isMesh) geometry = o.geometry; });
      return geometry;
    }));
  }
  return cache.get(file);
}

// Call once before creating soldiers.
export async function preloadSoldier() {
  const [geometry, meta] = await Promise.all([
    loadFigure('shooting-lod.glb'),
    fetch(`${BASE}shooting.json`).then((r) => r.json()),
  ]);
  info = meta;
  pieces = splitIntoPieces(geometry);
  cache.set('game', geometry);
}

// Cut the figure into chunks on a coarse grid, for the break-apart effect.
function splitIntoPieces(geometry) {
  geometry.computeBoundingBox();
  const { min, max } = geometry.boundingBox;
  const cells = [2, 5, 2];
  const size = new THREE.Vector3().subVectors(max, min);
  const pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal'), index = geometry.index;
  const groups = new Map();
  const cellOf = (v, axis) => Math.min(cells[axis] - 1, Math.floor(((v - min.getComponent(axis)) / size.getComponent(axis)) * cells[axis]));
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3, cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3, cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    const key = cellOf(cx, 0) + cellOf(cy, 1) * 10 + cellOf(cz, 2) * 100;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a, b, c);
  }
  const out = [];
  for (const tris of groups.values()) {
    if (tris.length < 60) continue; // skip slivers
    const remap = new Map(), p = [], n = [], idx = [];
    const centre = new THREE.Vector3();
    for (const v of tris) {
      if (!remap.has(v)) {
        remap.set(v, p.length / 3);
        p.push(pos.getX(v), pos.getY(v), pos.getZ(v));
        n.push(nor.getX(v), nor.getY(v), nor.getZ(v));
        centre.add(new THREE.Vector3(pos.getX(v), pos.getY(v), pos.getZ(v)));
      }
      idx.push(remap.get(v));
    }
    centre.divideScalar(p.length / 3);
    for (let i = 0; i < p.length; i += 3) { p[i] -= centre.x; p[i + 1] -= centre.y; p[i + 2] -= centre.z; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setIndex(idx);
    out.push({ geometry: g, matrix: new THREE.Matrix4().makeTranslation(centre.x, centre.y, centre.z) });
  }
  return out;
}

// Team plastic. Double-sided so the hollow insides of broken pieces show.
export function soldierMaterial(team) {
  const mat = plastic(TEAM_COLORS[team], { roughness: 0.45 });
  mat.side = THREE.DoubleSide;
  return mat;
}

// The in-game soldier. Requires preloadSoldier() to have finished.
export function createSoldier(team) {
  if (!pieces) throw new Error('preloadSoldier() must finish before soldiers are created');
  const material = soldierMaterial(team);
  const root = new THREE.Group();
  const figure = new THREE.Group(); // rocked and hopped; `root` stays put
  const mesh = new THREE.Mesh(cache.get('game'), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  figure.add(mesh);
  root.add(figure);
  const muzzle = new THREE.Object3D();
  muzzle.position.fromArray(info.muzzle);
  figure.add(muzzle);
  return { root, figure, material, muzzle, pieces: pieces.map((p) => ({ ...p, parent: figure })) };
}

// `phase` advances with distance walked; `amount` is 0 (still) to 1 (moving).
export function animateSoldier(model, phase, amount) {
  const f = model.figure;
  f.rotation.z = Math.sin(phase) * 0.09 * amount;
  f.rotation.x = Math.cos(phase * 2) * 0.03 * amount;
  f.position.y = Math.abs(Math.sin(phase)) * 0.22 * amount;
}

// For the gallery: any converted file, without the game extras.
export async function createFigureSoldier(team, file = 'shooting-lod.glb') {
  const mesh = new THREE.Mesh(await loadFigure(file), soldierMaterial(team));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const root = new THREE.Group();
  root.add(mesh);
  return { root, mesh };
}
