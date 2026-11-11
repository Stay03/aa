// Pull a character mesh out of a Cinema 4D (.c4d) file and prepare it for the game.
//   node tools/c4d2glb.mjs <in.c4d> <out-basename> [--height cm]
//
// There is no open reader for .c4d, so this relies on what the format
// visibly does: large arrays are stored as tagged blocks (0x8c, byte length,
// type), a mesh being four int32 blocks (polygon corners a, b, c, d) followed
// by three float64 blocks (point x, y, z). Every such group in the file is a
// mesh; a character saved with levels of detail has one group per level.
//
// Writes <out>.glb (most detailed), <out>-lod.glb (next level) and <out>.json
// (joint positions measured from the mesh, for the game's skeleton).
import { readFileSync, writeFileSync } from 'node:fs';
import { writeGlb, computeNormals } from './glb.mjs';

const [input, outBase, ...rest] = process.argv.slice(2);
const opt = { height: 6 };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = Number(rest[i + 1]);

const d = readFileSync(input);
const blocks = [];
for (let o = d.indexOf(0x8c); o >= 0 && o + 6 < d.length; o = d.indexOf(0x8c, o + 1)) {
  const len = d.readUInt32BE(o + 1) - 1, type = d[o + 5];
  if (len > 2000 && o + 6 + len <= d.length && (type === 3 || type === 6)) blocks.push({ o: o + 6, len, type });
}
const meshes = [];
for (let i = 0; i + 6 < blocks.length; i++) {
  const g = blocks.slice(i, i + 7);
  const ints = g.slice(0, 4), dbls = g.slice(4);
  if (!ints.every((b) => b.type === 3 && b.len === ints[0].len) || !dbls.every((b) => b.type === 6 && b.len === dbls[0].len)) continue;
  const polys = ints[0].len / 4, points = dbls[0].len / 8;
  const corner = ints.map((b) => Uint32Array.from({ length: polys }, (_, k) => d.readUInt32BE(b.o + k * 4)));
  const coord = dbls.map((b) => Float64Array.from({ length: points }, (_, k) => d.readDoubleBE(b.o + k * 8)));
  if (corner.some((c) => c.some((v) => v >= points))) continue;
  const idx = [];
  for (let k = 0; k < polys; k++) {
    idx.push(corner[0][k], corner[1][k], corner[2][k]);
    if (corner[3][k] !== corner[2][k]) idx.push(corner[0][k], corner[2][k], corner[3][k]); // a quad
  }
  const positions = new Float32Array(points * 3);
  for (let k = 0; k < points; k++) { positions[k * 3] = coord[0][k]; positions[k * 3 + 1] = coord[1][k]; positions[k * 3 + 2] = coord[2][k]; }
  meshes.push({ positions, indices: Uint32Array.from(idx) });
  i += 6;
}
if (!meshes.length) throw new Error('No meshes found in this file');
meshes.sort((a, b) => b.indices.length - a.indices.length);
console.log(`found ${meshes.length} mesh(es): ${meshes.map((m) => m.indices.length / 3).join(', ')} triangles`);

// Stand on y = 0, centre on x and z, scale to the toy height. All levels get the same transform.
const P0 = meshes[0].positions;
const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < P0.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], P0[i + a]); hi[a] = Math.max(hi[a], P0[i + a]); }
const s = opt.height / (hi[1] - lo[1]), cx = (lo[0] + hi[0]) / 2;
// Centre front-to-back on the feet, not on the bounding box.
let fz = 0, fn = 0;
for (let i = 0; i < P0.length; i += 3) if (P0[i + 1] < lo[1] + (hi[1] - lo[1]) * 0.03) { fz += P0[i + 2]; fn++; }
fz /= fn;
for (const m of meshes) for (let i = 0; i < m.positions.length; i += 3) {
  m.positions[i] = (m.positions[i] - cx) * s; m.positions[i + 1] = (m.positions[i + 1] - lo[1]) * s; m.positions[i + 2] = (m.positions[i + 2] - fz) * s;
}

// ---- measure the joints from the most detailed mesh ---------------------------------
const P = meshes[0].positions, I = meshes[0].indices, n = P.length / 3, H = opt.height;
const pts = (test) => { const o = []; for (let i = 0; i < n; i++) { const p = [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]; if (test(p)) o.push(p); } return o; };
const mean = (a) => a.reduce((m, p) => [m[0] + p[0] / a.length, m[1] + p[1] / a.length, m[2] + p[2] / a.length], [0, 0, 0]);

// Legs: centre of each leg at every height, up to where they join.
let crotch = 0;
const legLine = { [-1]: [], 1: [] };
for (let y = 0.1; y < H * 0.6; y += 0.1) {
  const sl = pts((p) => p[1] >= y && p[1] < y + 0.1 && Math.abs(p[0]) < H * 0.2);
  const L = sl.filter((p) => p[0] < 0), R = sl.filter((p) => p[0] >= 0);
  if (!L.length || !R.length) continue;
  const gap = Math.min(...R.map((p) => p[0])) - Math.max(...L.map((p) => p[0]));
  if (gap < 0.03 && y > H * 0.3) { crotch = y; break; }
  legLine[-1].push(mean(L)); legLine[1].push(mean(R));
}
const at = (line, y) => line.reduce((b, p) => (Math.abs(p[1] - y) < Math.abs(b[1] - y) ? p : b));
const leg = (side) => {
  const line = legLine[side], top = line[line.length - 1];
  const hip = [top[0], crotch + 0.3, top[2]], ankle = at(line, H * 0.065);
  const knee = at(line, ankle[1] + (hip[1] - ankle[1]) * 0.49);
  // Foot: the lowest slice, from heel to toe.
  const foot = pts((p) => p[1] < H * 0.04 && Math.sign(p[0]) === side);
  const toe = [mean(foot)[0], 0.12, Math.min(...foot.map((p) => p[2]))];
  return { hip, knee, ankle, toe };
};

// Arms: each hand is a separate piece of the model, which locates the wrist.
const parent = new Int32Array(n).map((_, i) => i);
const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
for (let t = 0; t < I.length; t += 3) { const a = find(I[t]); parent[find(I[t + 1])] = a; parent[find(I[t + 2])] = a; }
const comp = new Map();
for (let i = 0; i < n; i++) { const r = find(i); if (!comp.has(r)) comp.set(r, []); comp.get(r).push([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); }
const arm = (side) => {
  const hand = [...comp.values()].filter((c) => c.length > 150 && c.length < n * 0.2 && Math.sign(mean(c)[0]) === side)
    .sort((a, b) => Math.abs(mean(b)[0]) - Math.abs(mean(a)[0]))[0];
  const handC = mean(hand);
  // Arm line: from the shoulder (a fixed fraction of the height out from the spine) to the hand.
  const sleeve = pts((p) => Math.sign(p[0]) === side && Math.abs(p[0]) > H * 0.14 && Math.abs(p[0]) < Math.abs(handC[0]) - 0.2 && p[1] > handC[1] - 0.3);
  const near = mean(sleeve.filter((p) => Math.abs(p[0]) < H * 0.17));
  const dir = [handC[0] - near[0], handC[1] - near[1], handC[2] - near[2]];
  const dl = Math.hypot(...dir), u = dir.map((v) => v / dl);
  const along = (t) => [near[0] + u[0] * t, near[1] + u[1] * t, near[2] + u[2] * t];
  const proj = (p) => (p[0] - near[0]) * u[0] + (p[1] - near[1]) * u[1] + (p[2] - near[2]) * u[2];
  const shoulder = along(proj([side * H * 0.105, near[1], near[2]]) );
  const wristT = Math.min(...hand.map(proj)), tipT = Math.max(...hand.map(proj));
  const shT = proj(shoulder);
  return { shoulder, elbow: along(shT + (wristT - shT) * 0.5), wrist: along(wristT), knuckle: along(wristT + (tipT - wristT) * 0.48), tip: along(tipT) };
};
const armL = arm(-1), armR = arm(1);
const shoulderY = (armL.shoulder[1] + armR.shoulder[1]) / 2;

// Neck: the narrowest slice above the shoulders. Head: everything above it.
let neckY = shoulderY, narrow = Infinity;
for (let y = shoulderY; y < H * 0.93; y += 0.05) {
  const sl = pts((p) => p[1] >= y && p[1] < y + 0.05 && Math.abs(p[0]) < H * 0.12);
  if (sl.length < 8) continue;
  const w = Math.max(...sl.map((p) => p[0])) - Math.min(...sl.map((p) => p[0]));
  if (w < narrow) { narrow = w; neckY = y; }
}
const headPts = pts((p) => p[1] > neckY + 0.1 && Math.abs(p[0]) < H * 0.12);
const head = mean(headPts);
const spineZ = mean(pts((p) => p[1] > crotch + 0.4 && p[1] < shoulderY - 0.3 && Math.abs(p[0]) < H * 0.08))[2];
const joints = {
  hips: [0, crotch + 0.3, spineZ], spine: [0, crotch + 0.3 + (shoulderY - crotch - 0.3) * 0.38, spineZ],
  chest: [0, crotch + 0.3 + (shoulderY - crotch - 0.3) * 0.72, spineZ], neck: [0, neckY, head[2] + 0.05], head, headTop: [head[0], H, head[2]],
  left: { ...armL, ...leg(-1) }, right: { ...armR, ...leg(1) },
};
const round = (v) => (Array.isArray(v) ? v.map(round) : typeof v === 'number' ? +v.toFixed(3) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v);
writeFileSync(`${outBase}.json`, JSON.stringify(round({ height: H, crotch, joints })));

console.log(writeGlb(`${outBase}.glb`, { ...meshes[0], normals: computeNormals(meshes[0].positions, meshes[0].indices) }));
const lod = meshes[1] ?? meshes[0];
console.log(writeGlb(`${outBase}-lod.glb`, { ...lod, normals: computeNormals(lod.positions, lod.indices) }));
console.log(JSON.stringify(round(joints)));
