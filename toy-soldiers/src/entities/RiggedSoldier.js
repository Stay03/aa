import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { plastic } from '../world/materials.js';
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
// Each bone is a segment with a thickness. A vertex follows the bones it is
// closest to; hands and fingers are assigned by position along the arm.
function skin(geometry, J, rest, hands) {
  const pos = geometry.getAttribute('position');
  const idx = new Uint16Array(pos.count * 4), wgt = new Float32Array(pos.count * 4);
  const L = J.left, R = J.right, up = (v, dy) => V(v).add(new THREE.Vector3(0, dy, 0));
  const segs = [ // [bone, from, to, radius, side (0 = either)]
    [B.hips, up(J.hips, -0.2), V(J.spine), 0.5, 0], [B.spine, V(J.spine), V(J.chest), 0.5, 0], [B.chest, V(J.chest), up(J.neck, -0.1), 0.6, 0],
    [B.head, V(J.neck), V(J.headTop), 0.42, 0],
    [B.armL, V(L.shoulder), V(L.elbow), 0.2, -1], [B.foreL, V(L.elbow), V(L.wrist), 0.17, -1],
    [B.armR, V(R.shoulder), V(R.elbow), 0.2, 1], [B.foreR, V(R.elbow), V(R.wrist), 0.17, 1],
    [B.thighL, V(L.hip), V(L.knee), 0.26, -1], [B.shinL, V(L.knee), V(L.ankle), 0.22, -1], [B.footL, V(L.ankle), V(L.toe), 0.2, -1],
    [B.thighR, V(R.hip), V(R.knee), 0.26, 1], [B.shinR, V(R.knee), V(R.ankle), 0.22, 1], [B.footR, V(R.ankle), V(R.toe), 0.2, 1],
  ];
  const p = new THREE.Vector3(), ab = new THREE.Vector3(), q = new THREE.Vector3();
  const dist = (a, b) => {
    ab.subVectors(b, a);
    const t = THREE.MathUtils.clamp(q.subVectors(p, a).dot(ab) / ab.lengthSq(), 0, 1);
    return q.copy(a).addScaledVector(ab, t).distanceTo(p);
  };
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const s = p.x < 0 ? -1 : 1;
    const cand = [];
    for (const [bone, a, b, r, sd] of segs) {
      if (sd && sd !== s) continue;
      const d = Math.max(0, dist(a, b) - r);
      cand.push([bone, 1 / (d + 0.05) ** 4]);
    }
    cand.sort((x, y) => y[1] - x[1]);
    let top = cand.slice(0, 2);
    // Hand and fingers: past the wrist, measured along the arm.
    const h = hands[s];
    const along = q.subVectors(p, h.wrist).dot(h.armDir);
    const off = q.subVectors(p, h.wrist).addScaledVector(h.armDir, -along).length();
    const hand = off < 0.7 ? smooth(-0.06, 0.08, along) : 0;
    const fingers = hand * smooth(-0.05, 0.07, q.subVectors(p, h.knuckle).dot(h.armDir));
    let sum = top.reduce((t, c) => t + c[1], 0);
    const out = top.map(([bone, w]) => [bone, (w / sum) * (1 - hand)]);
    if (hand > 0) out.push([s < 0 ? B.handL : B.handR, hand - fingers], [s < 0 ? B.fingersL : B.fingersR, fingers]);
    for (let k = 0; k < 4; k++) { idx[i * 4 + k] = out[k]?.[0] ?? 0; wgt[i * 4 + k] = out[k]?.[1] ?? 0; }
  }
  geometry.setAttribute('skinIndex', new THREE.BufferAttribute(idx, 4));
  geometry.setAttribute('skinWeight', new THREE.BufferAttribute(wgt, 4));
}

// Rigid chunks, one per bone, for the break-apart effect. Each is stored
// relative to its bone, so it appears wherever that bone currently is.
function boneChunks(geometry, rest) {
  const pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal'), index = geometry.index;
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
    const remap = new Map(), p = [], n = [], idx = [];
    for (const v of list) {
      if (!remap.has(v)) { remap.set(v, p.length / 3); p.push(pos.getX(v) - rest[bone].x, pos.getY(v) - rest[bone].y, pos.getZ(v) - rest[bone].z); n.push(nor.getX(v), nor.getY(v), nor.getZ(v)); }
      idx.push(remap.get(v));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setIndex(idx);
    out.push({ geometry: g, bone, matrix: new THREE.Matrix4() });
  });
  return out;
}

export function soldierMaterial(team) {
  const mat = plastic(TEAM_COLORS[team], { roughness: 0.45 });
  mat.side = THREE.DoubleSide; // broken pieces are hollow
  return mat;
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

  const gunMesh = new THREE.Mesh(assets.guns[gun][detail], material);
  gunMesh.castShadow = true;
  gunMesh.receiveShadow = true;
  gunMesh.frustumCulled = false;
  root.add(gunMesh);
  const muzzle = new THREE.Object3D();
  gunMesh.add(muzzle);

  const model = {
    root, mesh, bones, material, gunMesh, muzzle, gunId: null, hold: null,
    eye: new THREE.Vector3(), // where his eye is, in the soldier's own space (updated by animateSoldier)
    pieces: [
      ...(assets.pieces.game).map((c) => ({ geometry: c.geometry, matrix: c.matrix, parent: bones[c.bone] })),
      { geometry: assets.guns[gun].game, matrix: new THREE.Matrix4(), parent: gunMesh },
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

// Run cycle, aim, recoil, reload, sprint, and holding the gun.
//   phase: advances with distance (2π per stride); amount: 0 standing to 1 running;
//   pace: 1 at a jog, higher sprinting.
//   pose: { pitch (radians), kick, reload, sprint, ads } — ads is 1 with the gun
//   up at the eye (how other soldiers always hold it) and 0 at the hip.
export function animateSoldier(model, phase, amount, pace = 1, pose = {}) {
  const { rest, J, hands } = assets;
  const { pitch = 0, kick = 0, reload = 0, sprint = 0, ads = 1 } = pose;
  const aim = THREE.MathUtils.clamp(pitch, -0.9, 0.9);
  const carry = Math.max(sprint, reload);

  // ---- legs: decide the angles first, so the hips can sit at the right height
  const reach = 0.62 * Math.min(1.35, pace);
  const legs = [-1, 1].map((s) => {
    const ph = phase + (s > 0 ? Math.PI : 0);
    const stance = s < 0 ? 0.2 : -0.16;                                   // standing: left foot forward
    const swing = THREE.MathUtils.lerp(stance, Math.sin(ph) * reach, amount);
    const bend = THREE.MathUtils.lerp(0.22, 0.2 + 1.15 * Math.max(0, Math.cos(ph)) ** 1.3, amount);
    return { s, swing, bend };
  });
  const Lt = rest[B.thighL].distanceTo(rest[B.shinL]), Ls = rest[B.shinL].distanceTo(rest[B.footL]);
  const drop = Math.max(...legs.map((l) => Lt * Math.cos(l.swing) + Ls * Math.cos(l.swing - l.bend)));

  // ---- body
  const hips = model.bones[B.hips];
  hips.position.set(rest[B.hips].x, rest[B.footL].y + drop + 0.02 * amount, rest[B.hips].z);
  fk(model, B.hips, -0.08 * amount - 0.1 * sprint, -0.3 * (1 - carry) + Math.sin(phase) * 0.08 * amount, Math.sin(phase) * 0.03 * amount);
  place(model, B.hips);
  fk(model, B.spine, aim * 0.25 - 0.06, -0.12 * (1 - carry), 0); place(model, B.spine);
  fk(model, B.chest, aim * 0.25 - 0.05 - 0.1 * sprint, -0.1 * (1 - carry), 0); place(model, B.chest);
  place(model, B.head);
  // Head looks where he aims, whatever the body is doing, tipped onto the sights.
  wq[B.head].setFromEuler(_e.set(aim * 0.85, 0, -0.1 * ads * (1 - carry), 'YXZ'));
  model.bones[B.head].quaternion.copy(_q.copy(wq[B.chest]).invert()).multiply(wq[B.head]);
  model.eye.set(0.12, 0.34, -0.3).applyQuaternion(wq[B.head]).add(wp[B.head]);

  // ---- gun: sights in front of his eye when aiming, lower and to the side otherwise
  const h = model.hold;
  const low = 1 - ads;
  gunQ.setFromEuler(_e.set(
    aim * (1 - carry) - 0.6 * sprint - 0.65 * reload + 0.09 * kick,
    0.2 * low + 0.5 * sprint,
    -0.1 * low + 0.45 * reload + 0.15 * sprint, 'YXZ'));
  gunP.set(0, 0, -(h.reach ?? 0.72)).applyQuaternion(gunQ).add(model.eye).sub(_a.copy(h.sight).applyQuaternion(gunQ)); // sight held in front of the eye
  gunP.x += 0.45 * low + 0.1 * carry;
  gunP.y -= 0.3 * low + 0.75 * carry;
  gunP.z += -0.05 * low + 0.14 * kick;
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

  // ---- legs
  for (const l of legs) {
    const thigh = l.s < 0 ? B.thighL : B.thighR;
    const splay = 0.07 * l.s * (1 - amount * 0.6);
    fk(model, thigh, l.swing, 0.3 * (1 - carry) * (1 - amount), splay);       // undo the hip turn so feet point forward
    fk(model, thigh + 1, -l.bend, 0, 0);
    fk(model, thigh + 2, l.bend - l.swing + Math.max(0, -Math.sin(phase + (l.s > 0 ? Math.PI : 0))) * 0.35 * amount, 0, -splay);
  }
}
