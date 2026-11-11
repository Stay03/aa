import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from '../config.js';

// The soldier: a gun-less character mesh with a skeleton built here, holding
// a separate gun model.
//
//  - Mesh and joint positions come from tools/c4d2glb.mjs.
//  - Guns and their hold points come from tools/gun2glb.mjs.
//  - The skeleton, skin weights and all movement are made in this file:
//    legs stride, the spine follows the aim, and the arms are solved every
//    frame to reach the gun's grip and fore grip, wherever the gun is.
//
// Units are centimetres; the soldier faces -z and his right is +x.
const SOLDIER = `${import.meta.env.BASE_URL}models/soldier/`;
const GUNS = `${import.meta.env.BASE_URL}models/guns/`;
export const TEAM_COLORS = { green: 0x3f7d3a, tan: 0xc9a86a };

const B = { hips: 0, spine: 1, chest: 2, head: 3, armL: 4, foreL: 5, handL: 6, fingersL: 7, armR: 8, foreR: 9, handR: 10, fingersR: 11, thighL: 12, shinL: 13, footL: 14, thighR: 15, shinR: 16, footR: 17 };
const PARENT = [-1, 0, 1, 2, 2, 4, 5, 6, 2, 8, 9, 10, 0, 12, 13, 0, 15, 16];
const COUNT = PARENT.length;

const V = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

let assets = null; // { J, rest, geometry: {game, full}, guns: { id: { game, full, hold } } }

function loadGeometry(url) {
  return new GLTFLoader().loadAsync(url).then((g) => {
    let geometry = null;
    g.scene.traverse((o) => { if (o.isMesh) geometry = o.geometry; });
    return geometry;
  });
}

// Call once before creating soldiers.
export async function preloadSoldier() {
  const name = CONFIG.soldier.model;
  const gunIds = [...new Set(Object.values(CONFIG.weapons).map((w) => w.model))];
  const [game, full, meta, ...gunData] = await Promise.all([
    loadGeometry(`${SOLDIER}${name}-lod.glb`), loadGeometry(`${SOLDIER}${name}.glb`),
    fetch(`${SOLDIER}${name}.json`).then((r) => r.json()),
    ...gunIds.flatMap((id) => [loadGeometry(`${GUNS}${id}-lod.glb`), loadGeometry(`${GUNS}${id}.glb`), fetch(`${GUNS}${id}.json`).then((r) => r.json())]),
  ]);
  const J = meta.joints;
  const rest = restPositions(J);
  const side = (s) => {
    const a = s < 0 ? J.left : J.right;
    const armDir = V(a.tip).sub(V(a.shoulder)).normalize();
    // In the rest pose the palms face the floor. Palm normal and the axis
    // the fingers curl about follow from that.
    const palm = new THREE.Vector3(0, -1, 0).addScaledVector(armDir, armDir.y).normalize();
    const curl = new THREE.Vector3().crossVectors(armDir, palm).normalize();
    const basis = new THREE.Matrix4().makeBasis(armDir, palm, curl);
    return { armDir, palm, curl, restInv: new THREE.Quaternion().setFromRotationMatrix(basis).invert(), wrist: V(a.wrist), knuckle: V(a.knuckle) };
  };
  const hands = { [-1]: side(-1), 1: side(1) };
  for (const g of [game, full]) skin(g, J, rest, hands);
  const guns = {};
  // Guns share the soldier's material, which uses vertex colours: give them plain white.
  for (const g of gunData) if (g.isBufferGeometry) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));
  gunIds.forEach((id, i) => {
    const hold = gunData[i * 3 + 2];
    guns[id] = { game: gunData[i * 3], full: gunData[i * 3 + 1], hold: Object.fromEntries(Object.entries(hold).map(([k, v]) => [k, Array.isArray(v) ? V(v) : v])) };
  });
  assets = { J, rest, hands, geometry: { game, full }, guns, pieces: { game: boneChunks(game, rest), full: null } };
}

function restPositions(J) {
  const L = J.left, R = J.right;
  return [J.hips, J.spine, J.chest, J.neck, L.shoulder, L.elbow, L.wrist, L.knuckle, R.shoulder, R.elbow, R.wrist, R.knuckle,
    L.hip, L.knee, L.ankle, R.hip, R.knee, R.ankle].map(V);
}

// ---- skinning -------------------------------------------------------------------
// Each vertex is assigned by where it sits on the body, not by raw distance
// to bones: the torso blends smoothly by height, each limb blends along its
// own length at the joints, and the result is then relaxed across the mesh
// so neighbouring vertices never disagree sharply. That keeps flat things
// (the vest, the back plate, pouches) flat when he twists and bends.
function skin(geometry, J, rest, hands) {
  const pos = geometry.getAttribute('position'), n = pos.count;
  const W = new Float32Array(n * COUNT);
  const L = J.left, R = J.right;
  const limb = (a) => {
    const hip = V(a.hip), knee = V(a.knee), ankle = V(a.ankle), shoulder = V(a.shoulder), elbow = V(a.elbow);
    return { hip, knee, ankle, shoulder, elbow, kneeDir: knee.clone().sub(hip).normalize().add(ankle.clone().sub(knee).normalize()).normalize() };
  };
  const limbs = { [-1]: limb(L), 1: limb(R) };
  const p = new THREE.Vector3(), q = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i);
    const s = p.x < 0 ? -1 : 1, lm = limbs[s], h = hands[s], o = i * COUNT;
    const arm = s < 0 ? B.armL : B.armR, thigh = s < 0 ? B.thighL : B.thighR;

    // Torso, by height.
    const a = smooth(J.spine[1] - 0.4, J.spine[1] + 0.3, p.y);
    const b = smooth(J.chest[1] - 0.35, J.chest[1] + 0.35, p.y);
    const c = smooth(J.neck[1] - 0.18, J.neck[1] + 0.1, p.y);
    let torso = 1;

    // Leg: everything below the hips, split at the knee and the ankle.
    const leg = 1 - smooth(J.hips[1] - 0.45, J.hips[1] + 0.2, p.y);
    if (leg > 0) {
      const shin = smooth(-0.25, 0.25, q.subVectors(p, lm.knee).dot(lm.kneeDir));
      const foot = 1 - smooth(lm.ankle.y - 0.14, lm.ankle.y + 0.14, p.y);
      W[o + thigh] = leg * (1 - shin);
      W[o + thigh + 1] = leg * shin * (1 - foot);
      W[o + thigh + 2] = leg * shin * foot;
      torso -= leg;
    }

    // Arm: a sleeve around the line from shoulder to hand, outside the chest.
    const t = q.subVectors(p, lm.shoulder).dot(h.armDir);
    const radial = q.subVectors(p, lm.shoulder).addScaledVector(h.armDir, -t).length();
    const sleeve = smooth(-0.28, 0.22, t) * (1 - smooth(0.3, 0.46, radial)) * smooth(0.42, 0.58, Math.abs(p.x)) * torso;
    if (sleeve > 0) {
      const fore = smooth(-0.22, 0.22, q.subVectors(p, lm.elbow).dot(h.armDir));
      const hand = smooth(-0.06, 0.08, q.subVectors(p, h.wrist).dot(h.armDir));
      const fingers = smooth(-0.05, 0.07, q.subVectors(p, h.knuckle).dot(h.armDir));
      W[o + arm] = sleeve * (1 - fore);
      W[o + arm + 1] = sleeve * fore * (1 - hand);
      W[o + arm + 2] = sleeve * fore * hand * (1 - fingers);
      W[o + arm + 3] = sleeve * fore * hand * fingers;
      torso -= sleeve;
    }
    W[o + B.hips] = torso * (1 - a);
    W[o + B.spine] = torso * a * (1 - b);
    W[o + B.chest] = torso * a * b * (1 - c);
    W[o + B.head] = torso * a * b * c;
  }

  // Relax across the mesh: each vertex moves toward the average of its neighbours.
  const index = geometry.index, near = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < index.count; t += 3) {
    const x = index.getX(t), y = index.getX(t + 1), z = index.getX(t + 2);
    near[x].add(y).add(z); near[y].add(x).add(z); near[z].add(x).add(y);
  }
  let cur = W, next = new Float32Array(W.length);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < n; i++) {
      const o = i * COUNT, k = near[i].size;
      for (let bn = 0; bn < COUNT; bn++) {
        let sum = 0;
        for (const j of near[i]) sum += cur[j * COUNT + bn];
        next[o + bn] = k ? 0.5 * cur[o + bn] + (0.5 * sum) / k : cur[o + bn];
      }
    }
    [cur, next] = [next, cur];
  }

  // Keep the four strongest bones per vertex.
  const idx = new Uint16Array(n * 4), wgt = new Float32Array(n * 4), order = Array.from({ length: COUNT }, (_, k) => k);
  for (let i = 0; i < n; i++) {
    const o = i * COUNT;
    order.sort((x, y) => cur[o + y] - cur[o + x]);
    let sum = 0;
    for (let k = 0; k < 4; k++) sum += cur[o + order[k]];
    for (let k = 0; k < 4; k++) { idx[i * 4 + k] = order[k]; wgt[i * 4 + k] = cur[o + order[k]] / (sum || 1); }
  }
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
  shadeCavities(geometry, near);
}

// Darken creases and recesses slightly, per vertex. A one-colour plastic
// figure is hard to read without this: it is what makes pouches, straps and
// folds stand out, the way dirt and shadow do on a real toy.
function shadeCavities(geometry, near) {
  const pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal'), n = pos.count;
  let cav = new Float32Array(n);
  const p = new THREE.Vector3(), q = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i); nv.fromBufferAttribute(nor, i);
    let sum = 0;
    for (const j of near[i]) sum += q.fromBufferAttribute(pos, j).sub(p).normalize().dot(nv); // > 0: neighbours rise above this vertex
    cav[i] = near[i].size ? sum / near[i].size : 0;
  }
  for (let pass = 0; pass < 2; pass++) { // soften
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let sum = 0; for (const j of near[i]) sum += cav[j]; out[i] = near[i].size ? 0.5 * cav[i] + (0.5 * sum) / near[i].size : cav[i]; }
    cav = out;
  }
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.fill(1 - THREE.MathUtils.clamp(cav[i] * 1.7, -0.12, 0.45), i * 3, i * 3 + 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

// Rigid chunks, one per bone, for the break-apart effect. Each is stored
// relative to its bone, so it appears wherever that bone currently is.
function boneChunks(geometry, rest) {
  const pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal'), col = geometry.getAttribute('color'), index = geometry.index;
  const si = geometry.getAttribute('skinIndex'), sw = geometry.getAttribute('skinWeight');
  const main = new Uint8Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    main[i] = si.getComponent(i, best);
  }
  const tris = Array.from({ length: COUNT }, () => []);
  for (let t = 0; t < index.count; t += 3) {
    const a = index.getX(t), b = index.getX(t + 1), c = index.getX(t + 2);
    const bone = main[a] === main[b] || main[a] === main[c] ? main[a] : main[b];
    tris[bone].push(a, b, c);
  }
  const out = [];
  tris.forEach((list, bone) => {
    if (list.length < 30) return;
    const remap = new Map(), p = [], n = [], cl = [], idx = [];
    for (const v of list) {
      if (!remap.has(v)) { remap.set(v, p.length / 3); p.push(pos.getX(v) - rest[bone].x, pos.getY(v) - rest[bone].y, pos.getZ(v) - rest[bone].z); n.push(nor.getX(v), nor.getY(v), nor.getZ(v)); cl.push(col.getX(v), col.getY(v), col.getZ(v)); }
      idx.push(remap.get(v));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.setIndex(idx);
    out.push({ geometry: g, bone, matrix: new THREE.Matrix4() });
  });
  return out;
}

// Guns: their own dark plastic (or the team colour if gunColor is null).
let gunMat = null;
function gunMaterial(team) {
  if (CONFIG.soldier.gunColor == null) return soldierMaterial(team);
  gunMat ??= new THREE.MeshStandardMaterial({ color: CONFIG.soldier.gunColor, roughness: 0.4, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
  return gunMat;
}
const dotGeometry = new THREE.SphereGeometry(0.011, 10, 8);
const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });

const materials = {};
export function soldierMaterial(team) {
  materials[team] ??= new THREE.MeshStandardMaterial({
    color: TEAM_COLORS[team], roughness: 0.45, metalness: 0,
    vertexColors: true,       // cavity shading (see shadeCavities)
    side: THREE.DoubleSide,   // broken pieces are hollow
  });
  return materials[team];
}

// ---- the soldier --------------------------------------------------------------------
// `detail: 'full'` and `hideHead` are for the first-person copy of the player.
export function createSoldier(team, { detail = 'game', hideHead = false, gun = CONFIG.weapons.rifle.model } = {}) {
  if (!assets) throw new Error('preloadSoldier() must finish before soldiers are created');
  const material = soldierMaterial(team);
  const root = new THREE.Group();
  const mesh = new THREE.SkinnedMesh(assets.geometry[detail], material);
  const bones = assets.rest.map(() => new THREE.Bone());
  bones.forEach((b, i) => {
    const par = PARENT[i];
    if (par < 0) { b.position.copy(assets.rest[i]); mesh.add(b); } else { b.position.subVectors(assets.rest[i], assets.rest[par]); bones[par].add(b); }
  });
  mesh.bind(new THREE.Skeleton(bones));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  root.add(mesh);
  if (hideHead) bones[B.head].scale.setScalar(0.001);

  const gunMesh = new THREE.Mesh(assets.guns[gun][detail], gunMaterial(team));
  gunMesh.castShadow = true;
  gunMesh.receiveShadow = true;
  gunMesh.frustumCulled = false;
  root.add(gunMesh);
  const muzzle = new THREE.Object3D();
  const dot = new THREE.Mesh(dotGeometry, dotMaterial); // red-dot reticle, shown for guns that have one
  gunMesh.add(muzzle, dot);

  const model = {
    root, mesh, bones, material, gunMesh, muzzle, dot, gunId: null, hold: null,
    eye: new THREE.Vector3(), // where his eye is, in the soldier's own space (updated by animateSoldier)
    pieces: [
      ...(assets.pieces.game).map((c) => ({ geometry: c.geometry, matrix: c.matrix, parent: bones[c.bone] })),
      { geometry: assets.guns[gun].game, matrix: new THREE.Matrix4(), parent: gunMesh, material: gunMesh.material },
    ],
  };
  setGun(model, gun, detail);
  return model;
}

export function setGun(model, id, detail = 'game') {
  if (model.gunId === id) return;
  const g = assets.guns[id];
  model.gunId = id;
  model.hold = g.hold;
  model.gunMesh.geometry = g[detail];
  model.muzzle.position.copy(g.hold.muzzle);
  model.dot.visible = !!g.hold.dot;
  model.dot.position.copy(g.hold.sight);
  model.pieces[model.pieces.length - 1].geometry = g.game;
}

// ---- posing ----------------------------------------------------------------------------
const wq = Array.from({ length: COUNT }, () => new THREE.Quaternion()); // world rotation of each bone
const wp = Array.from({ length: COUNT }, () => new THREE.Vector3());    // world position of each bone
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const gunQ = new THREE.Quaternion(), gunP = new THREE.Vector3();
const palmV = new THREE.Vector3(), poleV = new THREE.Vector3(), elbow = new THREE.Vector3(), end = new THREE.Vector3();
const handM = new THREE.Matrix4();

// Set a bone's rotation from Euler angles and record where it and its children end up.
function fk(model, i, x, y, z) {
  const b = model.bones[i], par = PARENT[i];
  b.quaternion.setFromEuler(_e.set(x, y, z, 'YXZ'));
  if (par < 0) wq[i].copy(b.quaternion); else wq[i].multiplyQuaternions(wq[par], b.quaternion);
}
function place(model, i) {
  const par = PARENT[i];
  if (par < 0) wp[i].copy(model.bones[i].position);
  else wp[i].copy(model.bones[i].position).applyQuaternion(wq[par]).add(wp[par]);
}
// Point a bone so that the direction it had at rest (`restDir`) now runs along `dir`.
function aimBone(model, i, restDir, dir, twist = 0) {
  const par = PARENT[i];
  wq[i].setFromUnitVectors(restDir, dir);
  if (twist) wq[i].premultiply(_q.setFromAxisAngle(dir, twist));
  model.bones[i].quaternion.copy(_q2.copy(wq[par]).invert()).multiply(wq[i]);
}

// One leg's angles through a running stride. `p` is 0 at foot strike, 0.4 at
// toe-off, 1 at the next strike. Radians: thigh forward (+), knee flexed
// (+), foot relative to the shin (toe up +).
const GAIT = {
  at: [0, 0.2, 0.4, 0.6, 0.8, 1],
  thigh: [0.5, 0.02, -0.5, -0.08, 0.8, 0.5],
  knee: [0.25, 0.5, 0.22, 1.65, 0.95, 0.25],
  foot: [0.15, 0.0, -0.5, -0.35, -0.05, 0.15],
};
function gait(curve, p) {
  p -= Math.floor(p);
  const k = Math.min(4, Math.floor(p * 5)), t = p * 5 - k;
  // Catmull-Rom through the keys, wrapping round the cycle.
  const v = (j) => curve[((j % 5) + 5) % 5];
  const p0 = v(k - 1), p1 = v(k), p2 = v(k + 1), p3 = v(k + 2);
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
}

// Run cycle, aim, recoil, reload, sprint, and holding the gun.
//   phase: advances with distance (2π per stride); amount: 0 standing to 1 running;
//   pace: 1 at a jog, higher sprinting.
//   pose: { pitch (radians), kick, reload, sprint, ads, moveAngle, relief } — ads is 1
//   with the gun up at the eye (how other soldiers always hold it) and 0 at
//   the hip; moveAngle is the direction of travel relative to where he faces
//   (0 forward, π/2 to his right, π backward); relief scales how far in front of
//   the eye the sight is held (first person brings it closer for a larger sight picture).
export function animateSoldier(model, phase, amount, pace = 1, pose = {}) {
  const { rest, J, hands } = assets;
  const { pitch = 0, kick = 0, reload = 0, sprint = 0, ads = 1, moveAngle = 0, relief = 1 } = pose;
  const aim = THREE.MathUtils.clamp(pitch, -0.9, 0.9);
  const carry = Math.max(sprint, reload);
  const fwd = Math.cos(moveAngle), sideways = Math.sin(moveAngle);

  // ---- legs: decide the angles first, so the hips can sit at the right height
  const stride = Math.min(1.15, 0.75 + 0.25 * pace) * (1 - 0.35 * Math.abs(sideways)); // longer when faster, shorter sidestepping
  const legs = [-1, 1].map((s) => {
    const p = phase / (Math.PI * 2) + (s > 0 ? 0.5 : 0);
    const stance = s < 0 ? 0.2 : -0.16;                                   // standing: left foot forward
    const swing = THREE.MathUtils.lerp(stance, gait(GAIT.thigh, p) * stride, amount);
    const bend = THREE.MathUtils.lerp(0.22, gait(GAIT.knee, p), amount);
    const foot = THREE.MathUtils.lerp(0, gait(GAIT.foot, p), amount);
    return { s, swing, bend, foot };
  });
  const Lt = rest[B.thighL].distanceTo(rest[B.shinL]), Ls = rest[B.shinL].distanceTo(rest[B.footL]);
  // Hips ride on whichever leg reaches lowest, plus a little lift between
  // strides when both feet are off the ground.
  const drop = Math.max(...legs.map((l) => Lt * Math.cos(l.swing) + Ls * Math.cos(l.swing - l.bend)));
  const lift = 0.14 * amount * Math.min(1.3, pace) * Math.max(0, Math.sin(phase * 2 - 0.9));
  const twist = Math.sin(phase) * 0.14 * amount;                           // hips turn with each stride
  const bladed = 0.3 * (1 - carry) * (1 - amount);                         // standing: body turned off the line of fire

  // ---- body
  const hips = model.bones[B.hips];
  hips.position.set(rest[B.hips].x, rest[B.footL].y + drop + lift, rest[B.hips].z);
  fk(model, B.hips, -0.05 * amount, -bladed + twist, 0);
  place(model, B.hips);
  // The upper body leans into the run and turns back against the hips.
  const lean = 0.1 * amount * fwd + 0.12 * sprint;
  fk(model, B.spine, aim * 0.25 - 0.05 - lean, -0.4 * bladed - twist * 0.6, 0); place(model, B.spine);
  fk(model, B.chest, aim * 0.25 - 0.04 - lean * 0.6, -0.35 * bladed - twist * 0.5, 0); place(model, B.chest);
  place(model, B.head);
  // Head looks where he aims, whatever the body is doing, tipped onto the sights.
  wq[B.head].setFromEuler(_e.set(aim * 0.85, 0, -0.1 * ads * (1 - carry), 'YXZ'));
  model.bones[B.head].quaternion.copy(_q.copy(wq[B.chest]).invert()).multiply(wq[B.head]);
  model.eye.set(0.12, 0.34, -0.3).applyQuaternion(wq[B.head]).add(wp[B.head]);

  // ---- gun: sights in front of his eye when aiming, lower and to the side otherwise
  const h = model.hold;
  const low = 1 - ads;
  gunQ.setFromEuler(_e.set(
    aim * (1 - carry) - 0.6 * sprint - 0.65 * reload + 0.09 * kick + 0.03 * low,
    0.13 * low + 0.5 * sprint,
    -0.07 * low + 0.45 * reload + 0.15 * sprint, 'YXZ'));
  gunP.set(0, 0, -(h.reach ?? 0.72) * relief).applyQuaternion(gunQ).add(model.eye).sub(_a.copy(h.sight).applyQuaternion(gunQ)); // sight held in front of the eye
  // At the hip the gun drops just below the eye line and out to the right,
  // close enough to fill the lower right of the view.
  gunP.x += 0.3 * low + 0.1 * carry;
  gunP.y -= 0.23 * low + 0.75 * carry;
  gunP.z += -0.06 * low + 0.14 * kick;
  model.gunMesh.position.copy(gunP);
  model.gunMesh.quaternion.copy(gunQ);

  // ---- arms: reach for the gun
  for (const s of [1, -1]) {
    const arm = s < 0 ? B.armL : B.armR, fore = arm + 1, hand = arm + 2, fingers = arm + 3;
    place(model, arm);
    const grip = _a.copy(s > 0 ? h.grip : h.fore).applyQuaternion(gunQ).add(gunP);
    // Each hand comes in from its own side with the palm against the grip:
    // `handDir` is wrist-to-knuckles, `palmDir` is the way the palm faces.
    const handDir = _b.copy(s > 0 ? _d.set(0.0, 0.3, -1) : _d.set(0.3, 0.35, -0.88)).normalize().applyQuaternion(gunQ);
    const palmDir = palmV.set(-s, 0, 0).applyQuaternion(gunQ);
    palmDir.addScaledVector(handDir, -palmDir.dot(handDir)).normalize();
    const palm = rest[hand].distanceTo(rest[fingers]);
    const wrist = _c.copy(grip).addScaledVector(handDir, -palm * 0.75).addScaledVector(palmDir, -0.09);
    // Two-bone reach from shoulder to wrist; the elbow goes down and out.
    const l1 = rest[arm].distanceTo(rest[fore]), l2 = rest[fore].distanceTo(rest[hand]);
    const to = _d.subVectors(wrist, wp[arm]);
    const dist = Math.min(to.length(), l1 + l2 - 0.01);
    to.normalize();
    const cosA = (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist);
    poleV.set(0.75 * s, -1, 0.35);
    poleV.addScaledVector(to, -poleV.dot(to)).normalize();
    elbow.copy(wp[arm]).addScaledVector(to, l1 * cosA).addScaledVector(poleV, l1 * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
    end.copy(wp[arm]).addScaledVector(to, dist);
    const armRest = hands[s].armDir;
    aimBone(model, arm, armRest, _d.subVectors(elbow, wp[arm]).normalize());
    wp[fore].copy(elbow);
    aimBone(model, fore, armRest, _d.subVectors(end, elbow).normalize());
    wp[hand].copy(end);
    // Hand: turn its rest frame (along the arm, palm, curl axis) onto the wanted one.
    handM.makeBasis(handDir, palmDir, _d.crossVectors(handDir, palmDir));
    wq[hand].setFromRotationMatrix(handM).multiply(hands[s].restInv);
    model.bones[hand].quaternion.copy(_q.copy(wq[fore]).invert()).multiply(wq[hand]);
    // Fingers close round the grip.
    model.bones[fingers].quaternion.setFromAxisAngle(hands[s].curl, 1.35);
  }

  // ---- legs: swing along the direction of travel
  for (const l of legs) {
    const thigh = l.s < 0 ? B.thighL : B.thighR;
    const splay = 0.07 * l.s * (1 - amount * 0.6);
    fk(model, thigh, l.swing * fwd, bladed, splay + l.swing * sideways * 0.8);
    fk(model, thigh + 1, -l.bend, 0, 0);
    // Foot: flat on the ground when standing, following the stride when running.
    const level = THREE.MathUtils.clamp(l.bend - l.swing * fwd, -0.5, 0.5);
    fk(model, thigh + 2, THREE.MathUtils.lerp(level, -l.foot, amount), 0, -splay);
  }
}
