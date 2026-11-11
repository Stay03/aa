// Prepare a gun model for the game.
//   node tools/gun2glb.mjs <in.glb> <out-basename> --length <cm> --grip <mat> --fore <mat> --stock <mat> --sight <mat> --barrel <mat> [--skip <mat>] [--lod triangles]
//
// The named materials tell it which parts are the pistol grip, the fore grip
// (or handguard), the stock and the sight. From those it turns the gun to
// point down -z with the grip underneath, scales it to the given length, puts
// the origin at the top of the pistol grip, and writes <out>.glb, a
// simplified <out>-lod.glb and <out>.json with the points a soldier needs:
// where each hand goes, where the butt meets the shoulder, the sight line
// and the muzzle.
import { writeFileSync } from 'node:fs';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readGlbParts, writeGlb, computeNormals } from './glb.mjs';

const [input, outBase, ...rest] = process.argv.slice(2);
const opt = { length: 2.75, lod: 6000 };
for (let i = 0; i < rest.length; i += 2) opt[rest[i].replace(/^--/, '')] = isNaN(Number(rest[i + 1])) ? rest[i + 1] : Number(rest[i + 1]);

const parts = readGlbParts(input);
const box = (ps) => {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of ps) for (let i = 0; i < p.positions.length; i += 3) for (let a = 0; a < 3; a++) { lo[a] = Math.min(lo[a], p.positions[i + a]); hi[a] = Math.max(hi[a], p.positions[i + a]); }
  return { lo, hi, mid: lo.map((v, a) => (v + hi[a]) / 2) };
};
const named = (m) => { const f = parts.filter((p) => p.material === m); if (!f.length) throw new Error(`No part with material "${m}". Have: ${[...new Set(parts.map((p) => p.material))].join(', ')}`); return box(f); };

// Long axis = barrel. Which end is the muzzle: the one away from the stock.
// Down = toward the pistol grip.
const all = box(parts), size = all.hi.map((v, a) => v - all.lo[a]);
const long = size.indexOf(Math.max(...size));
const stock = named(opt.stock), grip = named(opt.grip);
const fwdSign = Math.sign(all.mid[long] - stock.mid[long]) || 1;
const others = [0, 1, 2].filter((a) => a !== long);
const down = others.reduce((b, a) => (Math.abs(grip.mid[a] - all.mid[a]) > Math.abs(grip.mid[b] - all.mid[b]) ? a : b));
const downSign = Math.sign(grip.mid[down] - all.mid[down]) || -1;
const sideAxis = others.find((a) => a !== down);
// New axes: z = -forward, y = up, x = right (right-handed: x = y cross z).
const zAxis = [0, 0, 0]; zAxis[long] = -fwdSign;
const yAxis = [0, 0, 0]; yAxis[down] = -downSign;
const xAxis = [yAxis[1] * zAxis[2] - yAxis[2] * zAxis[1], yAxis[2] * zAxis[0] - yAxis[0] * zAxis[2], yAxis[0] * zAxis[1] - yAxis[1] * zAxis[0]];
const scale = opt.length / size[long];
// Origin: top of the pistol grip, centred.
const origin = [...grip.mid];
origin[down] = downSign > 0 ? grip.lo[down] : grip.hi[down];
origin[sideAxis] = all.mid[sideAxis];
const tf = (p) => { const r = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]]; return [xAxis, yAxis, zAxis].map((ax) => (r[0] * ax[0] + r[1] * ax[1] + r[2] * ax[2]) * scale); };

// Merge all parts into one mesh, welding identical points. `--skip` leaves a
// part out (a sight's glass, which would otherwise be solid plastic).
const map = new Map(), pos = [], idx = [];
for (const p of parts.filter((q) => q.material !== opt.skip)) for (const i of p.indices) {
  const v = tf([p.positions[i * 3], p.positions[i * 3 + 1], p.positions[i * 3 + 2]]);
  const key = v.map((c) => Math.round(c * 2e4)).join(',');
  let id = map.get(key);
  if (id === undefined) { id = pos.length / 3; pos.push(...v); map.set(key, id); }
  idx.push(id);
}
const positions = new Float32Array(pos), indices = Uint32Array.from(idx);
const normals = computeNormals(positions, indices);
console.log(writeGlb(`${outBase}.glb`, { positions, normals, indices }));

await MeshoptSimplifier.ready;
const [lodIdx] = MeshoptSimplifier.simplify(indices, positions, 3, Math.floor(opt.lod) * 3, 0.05, ['LockBorder'].slice(0, 0));
const remap = new Map(), lp = [], ln = [], li = [];
for (const v of lodIdx) { if (!remap.has(v)) { remap.set(v, lp.length / 3); lp.push(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2]); ln.push(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2]); } li.push(remap.get(v)); }
console.log(writeGlb(`${outBase}-lod.glb`, { positions: new Float32Array(lp), normals: new Float32Array(ln), indices: Uint32Array.from(li) }));

// Hold points, in the gun's own space.
const T = (b) => ({ lo: tf(b.lo), hi: tf(b.hi) });
const span = (b) => { const t = T(b); return { lo: t.lo.map((v, a) => Math.min(v, t.hi[a])), hi: t.lo.map((v, a) => Math.max(v, t.hi[a])) }; };
const g = span(grip), f = span(named(opt.fore)), st = span(stock), si = span(named(opt.sight)), a = span(all), br = span(named(opt.barrel ?? opt.fore));
const r3 = (v) => v.map((c) => +c.toFixed(3));
const info = {
  length: opt.length,
  grip: r3([0, (g.lo[1] + g.hi[1]) / 2 + 0.04, (g.lo[2] + g.hi[2]) / 2]),         // right hand
  fore: r3([0, f.lo[1] + (f.hi[1] - f.lo[1]) * 0.35, (f.lo[2] + f.hi[2]) / 2]),   // left hand
  butt: r3([0, (st.lo[1] + st.hi[1]) / 2, st.hi[2]]),                             // against the shoulder
  sight: r3([0, (si.lo[1] + si.hi[1]) / 2, (si.lo[2] + si.hi[2]) / 2]),           // look through here
  muzzle: r3([0, (br.lo[1] + br.hi[1]) / 2, a.lo[2]]),
};
writeFileSync(`${outBase}.json`, JSON.stringify(info));
console.log(JSON.stringify(info));
