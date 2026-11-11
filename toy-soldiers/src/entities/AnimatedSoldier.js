import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { CONFIG } from '../config.js';

// The soldier: a Mixamo character ("Swat Guy") with its own skeleton and
// motion-captured animations, converted by tools/mixamo2glb.cjs, holding a
// separate gun model (tools/gun2glb.mjs).
//
// Animation is layered:
//   - lower body (hips and legs): idle, run, backpedal, strafe left/right and
//     jump, blended by speed and direction of travel;
//   - upper body (spine, arms, head): the rifle-aiming idle, or the reload;
//   - then the chest is turned so the gun points exactly where he is aiming,
//     whatever the legs are doing.
//
// Units are centimetres; the soldier faces -z and his right is +x.
const SOLDIER = `${import.meta.env.BASE_URL}models/soldier/`;
const GUNS = `${import.meta.env.BASE_URL}models/guns/`;
export const TEAM_COLORS = { green: 0x3f7d3a, tan: 0xc9a86a };

const LOWER = /^(Hips|(Left|Right)(UpLeg|Leg|Foot|ToeBase))\./;
// Bones whose mesh breaks off with a parent when the soldier is shot.
const CHUNK_OF = (name) => name.replace(/^(Left|Right)Hand.+/, '$1Hand').replace(/^(Left|Right)Toe.*/, '$1Foot')
  .replace(/^HeadTop_End/, 'Head').replace(/^(Left|Right)Shoulder/, 'Spine2').replace(/^Neck/, 'Head');
const TAU = Math.PI * 2;

let assets = null;

const loadGeometry = (url) => new GLTFLoader().loadAsync(url).then((g) => {
  let geometry = null;
  g.scene.traverse((o) => { if (o.isMesh) geometry = o.geometry; });
  return geometry;
});

// Darken creases and recesses slightly, per vertex, so a one-colour plastic
// figure reads clearly.
function shadeCavities(geometry) {
  const pos = geometry.getAttribute('position'), nor = geometry.getAttribute('normal'), index = geometry.index, n = pos.count;
  const near = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < index.count; t += 3) {
    const x = index.getX(t), y = index.getX(t + 1), z = index.getX(t + 2);
    near[x].add(y).add(z); near[y].add(x).add(z); near[z].add(x).add(y);
  }
  let cav = new Float32Array(n);
  const p = new THREE.Vector3(), q = new THREE.Vector3(), nv = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    p.fromBufferAttribute(pos, i); nv.fromBufferAttribute(nor, i);
    let sum = 0;
    for (const j of near[i]) sum += q.fromBufferAttribute(pos, j).sub(p).normalize().dot(nv);
    cav[i] = near[i].size ? sum / near[i].size : 0;
  }
  for (let pass = 0; pass < 2; pass++) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) { let sum = 0; for (const j of near[i]) sum += cav[j]; out[i] = near[i].size ? 0.5 * cav[i] + (0.5 * sum) / near[i].size : cav[i]; }
    cav = out;
  }
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.fill(1 - THREE.MathUtils.clamp(cav[i] * 1.7, -0.12, 0.45), i * 3, i * 3 + 3);
  geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

const white = (g) => g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3).fill(1), 3));

// Call once before creating soldiers.
export async function preloadSoldier() {
  const name = CONFIG.soldier.model;
  const gunIds = [...new Set(Object.values(CONFIG.weapons).map((w) => w.model))];
  const loader = new GLTFLoader();
  const [full, game, ...gunData] = await Promise.all([
    loader.loadAsync(`${SOLDIER}${name}.glb`), loader.loadAsync(`${SOLDIER}${name}-lod.glb`),
    ...gunIds.flatMap((id) => [loadGeometry(`${GUNS}${id}-lod.glb`), loadGeometry(`${GUNS}${id}.glb`), fetch(`${GUNS}${id}.json`).then((r) => r.json())]),
  ]);
  for (const g of [full, game]) g.scene.traverse((o) => { if (o.isSkinnedMesh) shadeCavities(o.geometry); });

  // Split each clip into the part that drives the legs and the part that drives the rest.
  const src = Object.fromEntries(full.animations.map((c) => [c.name, c]));
  const part = (c, lower) => { const k = c.clone(); k.tracks = k.tracks.filter((t) => LOWER.test(t.name) === lower); return k; };
  const clips = {
    idleUpper: part(src.idle, false), reload: part(src.reload, false),
    idleLower: part(src.idle, true), run: part(src.run, true), back: part(src.back, true),
    left: part(src.left, true), right: part(src.right, true), jump: part(src.jump, true),
  };

  const box = new THREE.Box3().setFromObject(full.scene);
  const guns = {};
  gunIds.forEach((id, i) => {
    const hold = gunData[i * 3 + 2];
    white(gunData[i * 3]); white(gunData[i * 3 + 1]);
    guns[id] = { game: gunData[i * 3], full: gunData[i * 3 + 1], hold: Object.fromEntries(Object.entries(hold).map(([k, v]) => [k, Array.isArray(v) ? new THREE.Vector3(...v) : v])) };
  });
  assets = { scenes: { full: full.scene, game: game.scene }, clips, guns, scale: CONFIG.soldier.height / (box.max.y - box.min.y), chunks: null, mounts: {} };

  // Where each gun sits in the right hand, measured on a soldier posed in the aiming idle.
  const t = build('green', 'game');
  pose(t, { idleUpper: [1, 0], idleLower: [1, 0] });
  t.root.updateMatrixWorld(true);
  const at = (n) => t.bones[n].getWorldPosition(new THREE.Vector3());
  const palmR = at('RightHand').lerp(at('RightHandMiddle1'), 0.75);
  const handInv = t.bones.RightHand.matrixWorld.clone().invert();
  for (const [id, g] of Object.entries(guns)) {
    // In the aiming idle he points the rifle straight ahead, so the gun goes
    // in upright and facing forward, with its grip in his right palm.
    const world = new THREE.Matrix4().setPosition(palmR.clone().sub(g.hold.grip));
    assets.mounts[id] = handInv.clone().multiply(world);
  }
  assets.chunks = boneChunks(t);
}

// Rigid chunks of the mesh, one per major bone, for the break-apart effect.
// Stored in each bone's own space, so a chunk appears wherever its bone is.
function boneChunks(t) {
  const mesh = t.mesh, geo = mesh.geometry, skel = mesh.skeleton;
  const pos = geo.getAttribute('position'), nor = geo.getAttribute('normal'), col = geo.getAttribute('color'), index = geo.index;
  const si = geo.getAttribute('skinIndex'), sw = geo.getAttribute('skinWeight');
  const groupOf = skel.bones.map((b) => { const want = CHUNK_OF(b.name); return Math.max(0, skel.bones.findIndex((x) => x.name === want)); });
  const main = new Uint16Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    let best = 0;
    for (let k = 1; k < 4; k++) if (sw.getComponent(i, k) > sw.getComponent(i, best)) best = k;
    main[i] = groupOf[si.getComponent(i, best)];
  }
  const tris = new Map();
  for (let k = 0; k < index.count; k += 3) {
    const a = index.getX(k), b = index.getX(k + 1), c = index.getX(k + 2);
    const bone = main[a] === main[b] || main[a] === main[c] ? main[a] : main[b];
    if (!tris.has(bone)) tris.set(bone, []);
    tris.get(bone).push(a, b, c);
  }
  const out = [], v = new THREE.Vector3(), nv = new THREE.Vector3();
  for (const [bone, list] of tris) {
    if (list.length < 90) continue;
    const m = skel.boneInverses[bone].clone().multiply(mesh.bindMatrix), nm = new THREE.Matrix3().getNormalMatrix(m);
    const remap = new Map(), p = [], n = [], cl = [], idx = [];
    for (const i of list) {
      if (!remap.has(i)) {
        remap.set(i, p.length / 3);
        v.fromBufferAttribute(pos, i).applyMatrix4(m); nv.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
        p.push(v.x, v.y, v.z); n.push(nv.x, nv.y, nv.z); cl.push(col.getX(i), col.getY(i), col.getZ(i));
      }
      idx.push(remap.get(i));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
    g.setIndex(idx);
    out.push({ geometry: g, bone: skel.bones[bone].name });
  }
  return out;
}

const materials = {};
export function soldierMaterial(team) {
  materials[team] ??= new THREE.MeshStandardMaterial({ color: TEAM_COLORS[team], roughness: 0.45, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
  return materials[team];
}
let gunMat = null;
function gunMaterial(team) {
  if (CONFIG.soldier.gunColor == null) return soldierMaterial(team);
  gunMat ??= new THREE.MeshStandardMaterial({ color: CONFIG.soldier.gunColor, roughness: 0.4, metalness: 0, vertexColors: true, side: THREE.DoubleSide });
  return gunMat;
}
const dotGeometry = new THREE.SphereGeometry(0.011, 10, 8);
const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff2a1a, toneMapped: false });

// The character, its mixer and actions, without a gun.
function build(team, detail) {
  const root = new THREE.Group();
  const rig = new THREE.Group();          // scales the character to toy size and turns it to face -z
  rig.scale.setScalar(assets.scale);
  rig.rotation.y = Math.PI;
  rig.add(cloneSkinned(assets.scenes[detail]));
  root.add(rig);
  const bones = {};
  let mesh = null;
  rig.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isSkinnedMesh) { mesh = o; o.material = soldierMaterial(team); o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; }
  });
  const mixer = new THREE.AnimationMixer(rig);
  const actions = {};
  for (const [name, clip] of Object.entries(assets.clips)) { actions[name] = mixer.clipAction(clip); actions[name].play(); actions[name].setEffectiveWeight(0); }
  return { root, rig, mesh, bones, mixer, actions };
}

// Set every action's weight and time ({ name: [weight, seconds] }) and evaluate.
function pose(model, set) {
  for (const [name, action] of Object.entries(model.actions)) {
    const s = set[name];
    action.setEffectiveWeight(s ? s[0] : 0);
    if (s) action.time = s[1];
  }
  model.mixer.update(0);
}

// `detail: 'full'` and `hideHead` are for the first-person copy of the player.
export function createSoldier(team, { detail = 'game', hideHead = false, gun = CONFIG.weapons.rifle.model } = {}) {
  if (!assets) throw new Error('preloadSoldier() must finish before soldiers are created');
  const model = build(team, detail);
  if (hideHead) model.bones.Head.scale.setScalar(0.001);
  const gunMesh = new THREE.Mesh(assets.guns[gun][detail], gunMaterial(team));
  gunMesh.castShadow = true;
  gunMesh.receiveShadow = true;
  gunMesh.frustumCulled = false;
  model.bones.RightHand.add(gunMesh);
  const muzzle = new THREE.Object3D();
  const dot = new THREE.Mesh(dotGeometry, dotMaterial);
  gunMesh.add(muzzle, dot);
  Object.assign(model, {
    material: model.mesh.material, gunMesh, muzzle, dot, gunId: null, hold: null, detail,
    eye: new THREE.Vector3(),       // camera point in the soldier's own space (first person)
    sightRest: new THREE.Vector3(), // where the sight sits when not reloading
    idleTime: Math.random() * 3,
    pieces: [
      ...assets.chunks.map((c) => ({ geometry: c.geometry, matrix: IDENTITY, parent: model.bones[c.bone] })),
      { geometry: assets.guns[gun].game, matrix: IDENTITY, parent: gunMesh, material: gunMesh.material },
    ],
  });
  setGun(model, gun);
  return model;
}
const IDENTITY = new THREE.Matrix4();

export function setGun(model, id) {
  if (model.gunId === id) return;
  const g = assets.guns[id];
  model.gunId = id;
  model.hold = g.hold;
  model.gunMesh.geometry = g[model.detail];
  assets.mounts[id].decompose(model.gunMesh.position, model.gunMesh.quaternion, model.gunMesh.scale);
  model.muzzle.position.copy(g.hold.muzzle);
  model.dot.visible = !!g.hold.dot;
  model.dot.position.copy(g.hold.sight);
  model.pieces[model.pieces.length - 1].geometry = g.game;
}

const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _rq = new THREE.Quaternion(), _fix = new THREE.Quaternion();
const _cur = new THREE.Vector3(), _want = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
const NO_TURN = new THREE.Quaternion();

// Turn `bone` by a share of the rotation that takes the gun's current
// direction onto the wanted one (both in world space).
function turnToward(model, bone, share) {
  model.rig.updateWorldMatrix(true, true);
  model.gunMesh.getWorldQuaternion(_q);
  _cur.set(0, 0, -1).applyQuaternion(_q);
  _fix.setFromUnitVectors(_cur, _want);
  if (share < 1) _fix.copy(NO_TURN).slerp(_q.setFromUnitVectors(_cur, _want), share);
  bone.parent.getWorldQuaternion(_pq);
  // local' = parent^-1 * fix * parent * local
  bone.quaternion.premultiply(_pq).premultiply(_fix).premultiply(_pq.invert());
}

const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _C = new THREE.Vector3(), _T = new THREE.Vector3();
const _ax = new THREE.Vector3(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _gq = new THREE.Quaternion();
const angle = (a, b) => Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
// Rotate a bone about an axis given in world space.
function spin(bone, axisWorld, radians) {
  bone.getWorldQuaternion(_gq);
  bone.quaternion.multiply(_q.setFromAxisAngle(_v2.copy(axisWorld).applyQuaternion(_gq.invert()).normalize(), radians));
}
// Two-bone reach: bend the left elbow and swing the arm so the palm lands on the fore grip.
function reachLeftHand(model) {
  const { LeftArm: a, LeftForeArm: b, LeftHand: c, LeftHandMiddle1: m } = model.bones;
  model.rig.updateWorldMatrix(true, true);
  a.getWorldPosition(_A); b.getWorldPosition(_B); c.getWorldPosition(_C);
  // Aim the wrist so that the palm (three quarters of the way to the knuckles) is on the grip.
  _T.copy(model.hold.fore).applyMatrix4(model.gunMesh.matrixWorld).sub(m.getWorldPosition(_v1).sub(_C).multiplyScalar(0.75));
  const lab = _A.distanceTo(_B), lcb = _B.distanceTo(_C), lat = THREE.MathUtils.clamp(_A.distanceTo(_T), 0.01, lab + lcb - 0.001);
  const ac = _v1.subVectors(_C, _A).normalize().clone(), ab = _v2.subVectors(_B, _A).normalize().clone(), at = _v1.subVectors(_T, _A).normalize().clone();
  const bend0 = angle(ac, ab), elbow0 = angle(_v1.subVectors(_A, _B).normalize(), _v2.subVectors(_C, _B).normalize());
  const bend1 = Math.acos(THREE.MathUtils.clamp((lcb * lcb - lab * lab - lat * lat) / (-2 * lab * lat), -1, 1));
  const elbow1 = Math.acos(THREE.MathUtils.clamp((lat * lat - lab * lab - lcb * lcb) / (-2 * lab * lcb), -1, 1));
  _ax.crossVectors(ac, ab);
  if (_ax.lengthSq() < 1e-8) _ax.set(0, 1, 0);
  _ax.normalize();
  const swingAxis = new THREE.Vector3().crossVectors(ac, at), swing = angle(ac, at);
  spin(a, _ax, bend1 - bend0);
  model.rig.updateWorldMatrix(true, true);
  spin(b, _ax, elbow1 - elbow0);
  if (swingAxis.lengthSq() > 1e-8) { model.rig.updateWorldMatrix(true, true); spinPre(a, swingAxis.normalize(), swing); }
}
// Rotate a bone about a world axis, applied on the world side (moves the whole limb).
function spinPre(bone, axisWorld, radians) {
  bone.parent.getWorldQuaternion(_pq);
  _fix.setFromAxisAngle(axisWorld, radians);
  bone.quaternion.premultiply(_pq).premultiply(_fix).premultiply(_pq.invert());
}

// Pose the soldier for this frame.
//   phase: advances with distance, 2π per full stride cycle; amount: 0 standing to 1 running.
//   pose: { dt, pitch (radians), kick, moveAngle (0 forward, π/2 right, π back),
//           air (0..1 off the ground), airTime (s), reload (0..1 blend), reloadT (0..1 progress),
//           ads (first person: 1 looking down the sights, 0 at the hip) }
export function animateSoldier(model, phase, amount, pace = 1, opts = {}) {
  const { dt = 0, pitch = 0, kick = 0, moveAngle = 0, air = 0, airTime = 0, reload = 0, reloadT = 0, ads = 1 } = opts;
  const c = assets.clips, p = phase / TAU - Math.floor(phase / TAU);
  model.idleTime = (model.idleTime + dt) % c.idleUpper.duration;

  // Legs: blend by direction of travel.
  let f = Math.max(0, Math.cos(moveAngle)), bk = Math.max(0, -Math.cos(moveAngle)), r = Math.max(0, Math.sin(moveAngle)), l = Math.max(0, -Math.sin(moveAngle));
  const sum = f + bk + r + l || 1, ground = (1 - air) * amount;
  pose(model, {
    idleUpper: [1 - reload, model.idleTime], reload: [reload, reloadT * c.reload.duration * 0.98],
    idleLower: [(1 - air) * (1 - amount), model.idleTime],
    run: [(ground * f) / sum, p * c.run.duration], back: [(ground * bk) / sum, p * c.back.duration],
    left: [(ground * l) / sum, p * c.left.duration], right: [(ground * r) / sum, p * c.right.duration],
    jump: [air, Math.min(0.1 + airTime * 0.4, 0.32)],
  });

  // Aim: turn the spine, then the chest, until the gun points where he is aiming.
  model.root.getWorldQuaternion(_rq);
  const up = THREE.MathUtils.clamp(pitch, -1.1, 1.1) + 0.035 * kick;
  _want.set(0, Math.sin(up), -Math.cos(up)).applyQuaternion(_rq);
  const aimed = 1 - reload; // let the reload animation move the gun freely
  if (aimed > 0.01) {
    turnToward(model, model.bones.Spine, 0.45 * aimed);
    turnToward(model, model.bones.Spine2, aimed);
  }
  // The animations were made for a generic rifle. Move the left hand onto
  // this gun's own fore grip (for a pistol, that is under the right hand).
  if (reload < 0.5) reachLeftHand(model);
  model.rig.updateWorldMatrix(true, true);

  // First person: where the camera goes, in the soldier's own space.
  const h = model.hold;
  model.gunMesh.getWorldQuaternion(_q);
  _a.copy(h.sight).applyMatrix4(model.gunMesh.matrixWorld);          // sight, world
  model.root.worldToLocal(_a);
  if (reload < 0.02) model.sightRest.copy(_a);
  // Looking down the sights: straight behind the sight. At the hip: up, left
  // and back from there, which puts the gun in the lower right of the view.
  _b.set(0, 0, (h.reach ?? 0.72) * 0.78);
  _c.set(-0.3, 0.2, 0.25).multiplyScalar(1 - ads);
  model.eye.copy(model.sightRest).add(_b).add(_c);
}
