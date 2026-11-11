// Convert a sculpted figure (binary STL or OBJ) into game-ready .glb files.
//   node tools/stl2glb.mjs <in.stl|in.obj> <out-basename> [--up z|y|-z|-y] [--turn degrees] [--height cm] [--lod triangles] [--aim keep] [--base keep]
// Welds the STL's loose triangles into a shared-vertex mesh, computes smooth
// normals, stands the figure on y = 0 centred on its base, scales it to the
// toy height, turns it so its weapon points down -z, and writes <out>.glb, a
// simplified <out>-lod.glb and <out>.json (muzzle position).
import { readFileSync, writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';
import { analyze } from './analyze.mjs';

const [input, outBase, ...rest] = process.argv.slice(2);
const opt = { up: 'z', turn: 0, height: 6, lod: 20000, base: 'remove' };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = isNaN(Number(rest[i + 1])) ? rest[i + 1] : Number(rest[i + 1]);

// ---- read the model: binary STL or OBJ -------------------------------------------
let triCount, raw;
if (input.toLowerCase().endsWith('.obj')) {
  const verts = [], tris = [];
  for (const line of readFileSync(input, 'utf8').split('\n')) {
    if (line.startsWith('v ')) { const p = line.split(/\s+/); verts.push(+p[1], +p[2], +p[3]); }
    else if (line.startsWith('f ')) {
      const ids = line.trim().split(/\s+/).slice(1).map((t) => { const i = parseInt(t, 10); return i < 0 ? verts.length / 3 + i : i - 1; });
      for (let k = 1; k < ids.length - 1; k++) tris.push(ids[0], ids[k], ids[k + 1]); // fan-triangulate quads and n-gons
    }
  }
  triCount = tris.length / 3;
  raw = new Float32Array(triCount * 9);
  for (let i = 0; i < tris.length; i++) raw.set(verts.slice(tris[i] * 3, tris[i] * 3 + 3), i * 3);
} else {
  const buf = readFileSync(input);
  triCount = buf.readUInt32LE(80);
  if (84 + triCount * 50 !== buf.length) throw new Error('Not a binary STL (size does not match its triangle count)');
  raw = new Float32Array(triCount * 9);
  for (let t = 0; t < triCount; t++) for (let k = 0; k < 9; k++) raw[t * 9 + k] = buf.readFloatLE(84 + t * 50 + 12 + k * 4);
}

// ---- orient: y up, then turn about y -----------------------------------------
const c = Math.cos((opt.turn * Math.PI) / 180), s = Math.sin((opt.turn * Math.PI) / 180);
for (let i = 0; i < raw.length; i += 3) {
  let x = raw[i], y = raw[i + 1], z = raw[i + 2];
  if (opt.up === 'z') [x, y, z] = [x, z, -y];
  else if (opt.up === '-z') [x, y, z] = [x, -z, y];
  else if (opt.up === '-y') [x, y, z] = [x, -y, -z];
  raw[i] = c * x + s * z; raw[i + 1] = y; raw[i + 2] = -s * x + c * z;
}
const bounds = () => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < raw.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], raw[i + a]); hi[a] = Math.max(hi[a], raw[i + a]); }
  return { lo, hi };
};
let { lo, hi } = bounds();

// ---- remove the moulded base ---------------------------------------------------
// The base's top is the largest flat, upward-facing surface near the bottom.
// Find its height, drop everything at or below it, and the figure stands on
// its boots. (The soles are left open; they face the floor.)
if (opt.base === 'remove') {
  const H = hi[1] - lo[1], bins = new Float64Array(200);
  const tri = (t) => {
    const o = t * 9;
    const ux = raw[o + 3] - raw[o], uy = raw[o + 4] - raw[o + 1], uz = raw[o + 5] - raw[o + 2];
    const vx = raw[o + 6] - raw[o], vy = raw[o + 7] - raw[o + 1], vz = raw[o + 8] - raw[o + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const area = Math.hypot(nx, ny, nz) / 2;
    return { up: area > 0 ? ny / (2 * area) : 0, area, y: (raw[o + 1] + raw[o + 4] + raw[o + 7]) / 3 };
  };
  for (let t = 0; t < triCount; t++) {
    const { up, area, y } = tri(t);
    const h = (y - lo[1]) / H;
    if (up > 0.95 && h < 0.08) bins[Math.floor(h * 1000)] += area;
  }
  let best = 0;
  for (let i = 1; i < bins.length; i++) if (bins[i] > bins[best]) best = i;
  const cutY = lo[1] + ((best + 1.5) / 1000) * H;
  // A real base is a wide flat disc. Without one, leave the figure alone.
  const hasBase = bins[best] > 0.05 * H * H;
  if (!hasBase) console.log('no moulded base found; nothing removed');
  const kept = [];
  for (let t = 0; t < triCount; t++) if (!hasBase || tri(t).y > cutY) kept.push(t);
  const next = new Float32Array(kept.length * 9);
  kept.forEach((t, i) => next.set(raw.subarray(t * 9, t * 9 + 9), i * 9));
  if (hasBase) console.log(`base removed: top found at ${(((best + 0.5) / 1000) * 100).toFixed(1)}% of the height, ${triCount - kept.length} triangles dropped`);
  raw = next;
  triCount = kept.length;
  ({ lo, hi } = bounds());
}
const scale = opt.height / (hi[1] - lo[1]);
// Centre on the feet: the average of the vertices in the lowest 3% of the figure.
let bx = 0, bz = 0, bn = 0;
const baseTop = lo[1] + (hi[1] - lo[1]) * 0.03;
for (let i = 0; i < raw.length; i += 3) if (raw[i + 1] <= baseTop) { bx += raw[i]; bz += raw[i + 2]; bn++; }
bx /= bn; bz /= bn;
for (let i = 0; i < raw.length; i += 3) { raw[i] = (raw[i] - bx) * scale; raw[i + 1] = (raw[i + 1] - lo[1]) * scale; raw[i + 2] = (raw[i + 2] - bz) * scale; }

// ---- face the weapon down -z (the game's forward) -----------------------------
// The muzzle is the point in the upper body that reaches furthest from the
// base centre. Rotate about y so it lies on -z, and remember where it is.
let muzzle = [0, 0, 0], far = -1;
for (let i = 0; i < raw.length; i += 3) {
  if (raw[i + 1] < opt.height * 0.55) continue;
  const d = Math.hypot(raw[i], raw[i + 2]);
  if (d > far) { far = d; muzzle = [raw[i], raw[i + 1], raw[i + 2]]; }
}
if (opt.aim !== 'keep') {
  const turnY = (a) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    for (let i = 0; i < raw.length; i += 3) {
      const x = raw[i], z = raw[i + 2];
      raw[i] = ca * x + sa * z; raw[i + 2] = -sa * x + ca * z;
    }
  };
  turnY(Math.atan2(muzzle[0], -muzzle[2])); // roughly: muzzle onto -z
  // Exactly: fit a line to the barrel (the front quarter of the reach) and
  // turn so the barrel itself runs along -z.
  const barrel = [];
  for (let i = 0; i < raw.length; i += 3) if (raw[i + 1] > opt.height * 0.55 && raw[i + 2] < -far * 0.74) barrel.push([raw[i], raw[i + 2]]);
  const mx = barrel.reduce((t, p) => t + p[0], 0) / barrel.length, mz = barrel.reduce((t, p) => t + p[1], 0) / barrel.length;
  let sxz = 0, szz = 0;
  for (const [x, z] of barrel) { sxz += (x - mx) * (z - mz); szz += (z - mz) * (z - mz); }
  turnY(-Math.atan(sxz / szz)); // remove the barrel's sideways slope
  muzzle = [0, 0, 0];
  for (let i = 0; i < raw.length; i += 3) if (raw[i + 1] > opt.height * 0.55 && raw[i + 2] < muzzle[2]) muzzle = [raw[i], raw[i + 1], raw[i + 2]];
}

// ---- weld --------------------------------------------------------------------
const map = new Map(), pos = [], idx = new Uint32Array(triCount * 3);
const q = (v) => Math.round(v * 2e4);
for (let v = 0; v < triCount * 3; v++) {
  const x = raw[v * 3], y = raw[v * 3 + 1], z = raw[v * 3 + 2];
  const key = `${q(x)},${q(y)},${q(z)}`;
  let id = map.get(key);
  if (id === undefined) { id = pos.length / 3; pos.push(x, y, z); map.set(key, id); }
  idx[v] = id;
}
const positions = new Float32Array(pos);

function normalsFor(indices) {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, d = indices[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[d] - positions[a], vy = positions[d + 1] - positions[a + 1], vz = positions[d + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // area-weighted
    for (const o of [a, b, d]) { n[o] += nx; n[o + 1] += ny; n[o + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

// Keep only the vertices an index list uses.
function compact(indices, normals) {
  const remap = new Int32Array(positions.length / 3).fill(-1), p = [], n = [], out = new Uint32Array(indices.length);
  for (let i = 0; i < indices.length; i++) {
    const v = indices[i];
    if (remap[v] < 0) { remap[v] = p.length / 3; p.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]); n.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]); }
    out[i] = remap[v];
  }
  return { positions: new Float32Array(p), normals: new Float32Array(n), indices: out };
}

function writeGlb(path, { positions: P, normals: N, indices: I }) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], P[i + a]); max[a] = Math.max(max[a], P[i + a]); }
  const bin = Buffer.concat([Buffer.from(P.buffer, P.byteOffset, P.byteLength), Buffer.from(N.buffer, N.byteOffset, N.byteLength), Buffer.from(I.buffer, I.byteOffset, I.byteLength)]);
  const json = {
    asset: { version: '2.0', generator: 'toy-soldiers stl2glb' },
    scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: P.byteLength, target: 34962 },
      { buffer: 0, byteOffset: P.byteLength, byteLength: N.byteLength, target: 34962 },
      { buffer: 0, byteOffset: P.byteLength + N.byteLength, byteLength: I.byteLength, target: 34963 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: P.length / 3, type: 'VEC3', min, max },
      { bufferView: 1, componentType: 5126, count: N.length / 3, type: 'VEC3' },
      { bufferView: 2, componentType: 5125, count: I.length, type: 'SCALAR' },
    ],
  };
  let jb = Buffer.from(JSON.stringify(json));
  jb = Buffer.concat([jb, Buffer.alloc((4 - (jb.length % 4)) % 4, 0x20)]);
  const bb = Buffer.concat([bin, Buffer.alloc((4 - (bin.length % 4)) % 4)]);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(28 + jb.length + bb.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(jb.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bb.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  writeFileSync(path, Buffer.concat([head, jh, jb, bh, bb]));
  return `${path.split('/').pop()}: ${I.length / 3} triangles, ${P.length / 3} vertices, ${Math.round((28 + jb.length + bb.length) / 1024)} KB`;
}

({ lo, hi } = bounds());
console.log(`read ${triCount} triangles, welded to ${positions.length / 3} vertices`);
console.log(`size (cm): ${(hi[0] - lo[0]).toFixed(2)} wide, ${(hi[1] - lo[1]).toFixed(2)} tall, ${(hi[2] - lo[2]).toFixed(2)} deep`);
const full = normalsFor(idx);
console.log(writeGlb(`${outBase}.glb`, compact(idx, full)));

await MeshoptSimplifier.ready;
const [lodIdx, err] = MeshoptSimplifier.simplify(idx, positions, 3, Math.floor(opt.lod) * 3, 0.02);
// Shade the simplified mesh with the full-detail normals: it keeps the sculpted look.
console.log(writeGlb(`${outBase}-lod.glb`, compact(lodIdx, full)), `(error ${err.toFixed(4)})`);
const round = (v) => (Array.isArray(v) ? v.map(round) : typeof v === 'number' ? +v.toFixed(3) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v);
const measured = analyze(positions);
writeFileSync(`${outBase}.json`, JSON.stringify(round({ muzzle, height: opt.height, ...measured })));
console.log(JSON.stringify(round(measured), null, 1));
console.log(`muzzle at ${muzzle.map((v) => v.toFixed(2)).join(', ')}`);
