import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { plastic } from '../world/materials.js';
import { CONFIG } from '../config.js';

// The soldier everyone plays as: a sculpted toy-soldier figure
// ("Modern Soldier Shooting Toy Soldier 3D Print" by nimproductions, CC BY 4.0;
// see public/models/soldier/CREDITS.txt), converted by tools/stl2glb.mjs.
//
// The sculpt is a single rigid pose. To let it run, the legs are given a
// small skeleton here (hips and knees, measured from the mesh by the
// converter) and the mesh is skinned to it. Standing still, the bones are at
// rest and the figure is exactly the sculpt.
const BASE = `${import.meta.env.BASE_URL}models/soldier/`;
export const TEAM_COLORS = { green: 0x3f7d3a, tan: 0xc9a86a };
const cache = new Map();
let info = null;      // measurements from the converter (joints, rifle, head, muzzle)
let pieces = null;    // break-apart chunks, built once
let rest = null;      // rest angles of the legs
let firstPerson = null;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const V = (a) => new THREE.Vector3(...a);

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
  // If the configured figure's files are missing, fall back to the first one.
  const load = (name) => Promise.all([
    loadFigure(`${name}-lod.glb`),
    loadFigure(`${name}.glb`), // full detail, used only for the close-up first-person view
    fetch(`${BASE}${name}.json`).then((r) => { if (!r.ok) throw new Error(`${name}.json missing`); return r.json(); }),
  ]);
  const [geometry, detailed, meta] = await load(CONFIG.soldier.model).catch((err) => {
    console.info(`Soldier model "${CONFIG.soldier.model}" not found (${err.message}); using "shooting".`);
    return load('shooting');
  });
  info = meta;
  pieces = splitIntoPieces(geometry);
  skin(geometry);
  firstPerson = buildFirstPerson(detailed);
  cache.set('game', geometry);
}

// ---- skinning -----------------------------------------------------------------
// Bones: 0 body, 1 left thigh, 2 left shin, 3 right thigh, 4 right shin,
// 5 weapon (the rifle with both arms, moving as one piece from the shoulders).
function skin(geometry) {
  const pos = geometry.getAttribute('position');
  const idx = new Uint16Array(pos.count * 4), wgt = new Float32Array(pos.count * 4);
  const legs = [info.legs.left, info.legs.right].map((l) => {
    const hip = V(l.hip), knee = V(l.knee), ankle = V(l.ankle);
    const thigh = knee.clone().sub(hip).normalize(), shin = ankle.clone().sub(knee).normalize();
    return { hip, knee, ankle, along: thigh.clone().add(shin).normalize() };
  });
  const seg = (p, a, b) => { // distance from p to segment ab
    const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1);
    return p.distanceTo(a.clone().addScaledVector(ab, t));
  };
  const head = V(info.head), r = info.rifle;
  const rifleTop = Math.max(...Object.entries(r.top).filter(([z]) => Number(z) < head.z - 0.45).map(([, y]) => y));
  const p = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    // Weapon unit: everything out in front of the chest. His head stays with
    // the body, except where the rifle itself passes his cheek.
    const onRifle = Math.abs(p.x - r.x) < 0.2 && p.y < rifleTop + 0.06 && p.y > r.y - 0.5;
    const notHead = onRifle ? 1 : smooth(0.7, 0.95, p.distanceTo(head));
    const weapon = smooth(3.6, 3.9, p.y) * smooth(-0.5, -1.05, p.z) * notHead;
    // How much this vertex belongs to a leg at all: fades in below the hips.
    const legness = 1 - smooth(info.crotch - 0.15, info.crotch + 0.5, p.y);
    let side = 0;
    if (legness > 0) {
      const d = legs.map((l) => Math.min(seg(p, l.hip, l.knee), seg(p, l.knee, l.ankle), seg(p, l.ankle, new THREE.Vector3(l.ankle.x, 0, l.ankle.z))));
      side = d[0] <= d[1] ? 0 : 1;
    }
    const l = legs[side];
    // Below the knee: fades in across the knee along the leg's direction.
    const shin = smooth(-0.22, 0.22, p.clone().sub(l.knee).dot(l.along));
    const o = i * 4;
    idx[o] = 0; idx[o + 1] = 1 + side * 2; idx[o + 2] = 2 + side * 2; idx[o + 3] = 5;
    wgt[o] = (1 - legness) * (1 - weapon); wgt[o + 1] = legness * (1 - shin); wgt[o + 2] = legness * shin; wgt[o + 3] = (1 - legness) * weapon;
  }
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));

  // Rest pose of each leg: forward swing and sideways splay of thigh and shin.
  const angles = (from, to) => {
    const d = V(to).sub(V(from));
    return { swing: Math.atan2(-d.z, -d.y), splay: Math.atan2(d.x, -d.y) };
  };
  rest = [info.legs.left, info.legs.right].map((l) => ({ thigh: angles(l.hip, l.knee), shin: angles(l.knee, l.ankle) }));
}

function makeSkeleton() {
  const body = new THREE.Bone();
  const bones = [body];
  for (const l of [info.legs.left, info.legs.right]) {
    const thigh = new THREE.Bone(), shin = new THREE.Bone();
    thigh.position.fromArray(l.hip);
    shin.position.set(l.knee[0] - l.hip[0], l.knee[1] - l.hip[1], l.knee[2] - l.hip[2]);
    body.add(thigh);
    thigh.add(shin);
    bones.push(thigh, shin);
  }
  // Weapon unit pivots at the shoulders.
  const weapon = new THREE.Bone();
  weapon.position.set(info.pelvis[0], 4.9, info.head[2] + 0.2);
  body.add(weapon);
  bones.push(weapon);
  return { body, bones };
}

// ---- break-apart chunks ---------------------------------------------------------
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
    const { geometry: g, centre } = subGeometry(pos, nor, tris, true);
    out.push({ geometry: g, matrix: new THREE.Matrix4().makeTranslation(centre.x, centre.y, centre.z) });
  }
  return out;
}

// A new geometry from a list of vertex indices (three per triangle).
function subGeometry(pos, nor, tris, recentre) {
  const remap = new Map(), p = [], n = [], idx = [];
  const centre = new THREE.Vector3();
  for (const v of tris) {
    if (!remap.has(v)) {
      remap.set(v, p.length / 3);
      p.push(pos.getX(v), pos.getY(v), pos.getZ(v));
      n.push(nor.getX(v), nor.getY(v), nor.getZ(v));
      centre.x += pos.getX(v); centre.y += pos.getY(v); centre.z += pos.getZ(v);
    }
    idx.push(remap.get(v));
  }
  centre.divideScalar(p.length / 3);
  if (recentre) for (let i = 0; i < p.length; i += 3) { p[i] -= centre.x; p[i + 1] -= centre.y; p[i + 2] -= centre.z; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
  g.setIndex(idx);
  return { geometry: g, centre };
}

// ---- first person ---------------------------------------------------------------
// What the soldier himself sees: his own arms and rifle. Cut from the figure:
// everything in front of his eye, minus his head. Returned in "eye space":
// the eye at the origin, the sight line along -z.
function buildFirstPerson(geometry) {
  const pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal'), index = geometry.index;
  const r = info.rifle, head = V(info.head);
  const tops = Object.entries(r.top).map(([z, y]) => [Number(z), y]).sort((a, b) => a[0] - b[0]);
  // Rear sight: the highest point on the rifle between the head and mid-barrel.
  // Front sight: the highest point on the front third.
  const rearZone = tops.filter(([z]) => z < head.z - 0.45 && z > r.muzzleZ * 0.5);
  const frontZone = tops.filter(([z]) => z < r.muzzleZ * 0.66);
  const rear = rearZone.reduce((m, t) => (t[1] > m[1] ? t : m));
  const front = frontZone.reduce((m, t) => (t[1] > m[1] ? t : m));
  const sight = new THREE.Vector3(0, front[1] - rear[1], front[0] - rear[0]).normalize();
  // The eye sits well behind the rear sight (about arm's length at this
  // scale); closer than that and the rifle fills the whole view.
  const eye = new THREE.Vector3(r.x, rear[1] + 0.02, rear[0]).addScaledVector(sight, -1.35);

  const tris = [];
  const c = new THREE.Vector3();
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), d = index.getX(t + 2);
    c.set(pos.getX(a) + pos.getX(b) + pos.getX(d), pos.getY(a) + pos.getY(b) + pos.getY(d), pos.getZ(a) + pos.getZ(b) + pos.getZ(d)).divideScalar(3);
    // Everything in front of his face from the chest up, minus his own head.
    // The cut edges (shoulders, chest) fall outside the bottom and sides of
    // the view.
    if (c.y < 3.6 || c.z > head.z - 0.15 || c.distanceTo(head) < 0.8) continue;
    tris.push(a, b, d);
  }
  const { geometry: g } = subGeometry(pos, nor, tris, false);
  // Into eye space: eye to the origin, sight line onto -z.
  const m = new THREE.Matrix4().lookAt(eye, eye.clone().add(sight), new THREE.Vector3(0, 1, 0)).setPosition(eye).invert();
  g.applyMatrix4(m);
  return { geometry: g, muzzle: V(info.muzzle).applyMatrix4(m) };
}

// The first-person arms-and-rifle mesh and where its muzzle is (eye space).
export function createFirstPersonView(team) {
  const mesh = new THREE.Mesh(firstPerson.geometry, soldierMaterial(team));
  return { mesh, muzzle: firstPerson.muzzle.clone() };
}

// Team plastic. Double-sided so the hollow insides of cut pieces show.
export function soldierMaterial(team) {
  const mat = plastic(TEAM_COLORS[team], { roughness: 0.45 });
  mat.side = THREE.DoubleSide;
  return mat;
}

// ---- the in-game soldier ---------------------------------------------------------
// Requires preloadSoldier() to have finished.
export function createSoldier(team) {
  if (!pieces) throw new Error('preloadSoldier() must finish before soldiers are created');
  const material = soldierMaterial(team);
  const root = new THREE.Group();
  const figure = new THREE.Group();
  const mesh = new THREE.SkinnedMesh(cache.get('game'), material);
  const { body, bones } = makeSkeleton();
  mesh.add(body);
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false; // bounds do not follow the bones
  figure.add(mesh);
  root.add(figure);
  const muzzle = new THREE.Object3D();
  muzzle.position.fromArray(info.muzzle).sub(bones[5].position); // rides on the weapon bone
  bones[5].add(muzzle);
  return { root, figure, mesh, material, muzzle, bones, weaponRest: bones[5].position.clone(), pieces: pieces.map((p) => ({ ...p, parent: figure })) };
}

// Run cycle. `phase` advances with distance covered (2π per stride), `amount`
// is 0 standing (the sculpt's own pose) to 1 running, `pace` is 1 at a jog
// and higher when sprinting.
// `pose` adds what the upper body is doing, each 0 to 1 unless noted:
//   sprint (rifle carried low), reload (rifle dipped and canted),
//   kick (recoil), pitch (radians: aiming up or down).
export function animateSoldier(model, phase, amount, pace = 1, pose = {}) {
  const [body, thighL, shinL, thighR, shinR, weapon] = model.bones;
  const { sprint = 0, reload = 0, kick = 0, pitch = 0 } = pose;
  const reach = 0.62 * Math.min(1.35, pace);
  const leg = (thigh, shin, r, ph) => {
    const swing = Math.sin(ph) * reach;                         // thigh forward/back
    const bend = 0.22 + 1.15 * Math.max(0, Math.cos(ph)) ** 1.3; // knee folds as the leg comes through
    const thighX = swing - r.thigh.swing;
    const kneeRest = r.thigh.swing - r.shin.swing;
    // Legs come in under the hips to run, instead of the wide firing stance.
    thigh.rotation.set(amount * thighX, 0, amount * (0.04 * Math.sign(r.thigh.splay) - r.thigh.splay));
    shin.rotation.set(-amount * (bend - kneeRest), 0, amount * (r.thigh.splay - r.shin.splay) * 0.6);
  };
  leg(thighL, shinL, rest[0], phase);
  leg(thighR, shinR, rest[1], phase + Math.PI);
  // The body rises on each push-off and leans into the run.
  body.position.y = amount * (0.1 + 0.16 * Math.abs(Math.cos(phase)));
  body.rotation.set(-0.1 * amount - 0.08 * sprint, Math.sin(phase) * 0.07 * amount, Math.sin(phase) * 0.035 * amount);

  // Arms and rifle. Negative x-rotation points the muzzle down.
  const carry = Math.max(sprint, reload);
  weapon.rotation.set(
    THREE.MathUtils.clamp(pitch, -0.7, 0.7) * 0.75 * (1 - carry)   // follow the aim
      - 0.55 * sprint - 0.6 * reload                                // carried low / dipped to reload
      + 0.1 * kick                                                  // muzzle climbs on recoil
      + Math.sin(phase * 2) * 0.03 * amount,                        // bounce with each step
    0.35 * sprint - Math.sin(phase) * 0.05 * amount,
    0.45 * reload + 0.12 * sprint);
  weapon.position.z = model.weaponRest.z + 0.14 * kick;
  weapon.position.y = model.weaponRest.y - 0.1 * reload;
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
