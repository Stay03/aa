// Tiny .glb reader/writer shared by the asset tools.
import { readFileSync, writeFileSync } from 'node:fs';

export function writeGlb(path, { positions: P, normals: N, indices: I }) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], P[i + a]); max[a] = Math.max(max[a], P[i + a]); }
  const bin = Buffer.concat([Buffer.from(P.buffer, P.byteOffset, P.byteLength), Buffer.from(N.buffer, N.byteOffset, N.byteLength), Buffer.from(I.buffer, I.byteOffset, I.byteLength)]);
  const json = {
    asset: { version: '2.0', generator: 'toy-soldiers tools' },
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

// Area-weighted smooth normals for an indexed mesh.
export function computeNormals(positions, indices) {
  const n = new Float32Array(positions.length);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3, b = indices[t + 1] * 3, d = indices[t + 2] * 3;
    const ux = positions[b] - positions[a], uy = positions[b + 1] - positions[a + 1], uz = positions[b + 2] - positions[a + 2];
    const vx = positions[d] - positions[a], vy = positions[d + 1] - positions[a + 1], vz = positions[d + 2] - positions[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const o of [a, b, d]) { n[o] += nx; n[o + 1] += ny; n[o + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

// Read every mesh primitive of a .glb with its node transform applied.
// Returns [{ name, material, positions (Float32Array, world), indices }].
export function readGlbParts(path) {
  const b = readFileSync(path);
  const jl = b.readUInt32LE(12);
  const g = JSON.parse(b.slice(20, 20 + jl));
  const bin = b.slice(20 + jl + 8);
  const TYPES = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  const accessor = (i) => {
    const a = g.accessors[i], v = g.bufferViews[a.bufferView], T = TYPES[a.componentType], size = SIZE[a.type];
    const stride = v.byteStride ?? T.BYTES_PER_ELEMENT * size, start = bin.byteOffset + (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
    const out = new T(a.count * size);
    const dv = new DataView(bin.buffer);
    const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
    for (let n = 0; n < a.count; n++) for (let k = 0; k < size; k++) out[n * size + k] = dv[get](start + n * stride + k * T.BYTES_PER_ELEMENT, true);
    return out;
  };
  const mat = (n) => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1]; // column-major
  };
  const mul = (a, c) => { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) o[j * 4 + i] = a[i] * c[j * 4] + a[4 + i] * c[j * 4 + 1] + a[8 + i] * c[j * 4 + 2] + a[12 + i] * c[j * 4 + 3]; return o; };
  const parts = [];
  const visit = (ni, parent) => {
    const n = g.nodes[ni], m = mul(parent, mat(n));
    if (n.mesh !== undefined) {
      for (const p of g.meshes[n.mesh].primitives) {
        const src = accessor(p.attributes.POSITION), positions = new Float32Array(src.length);
        for (let i = 0; i < src.length; i += 3) {
          const x = src[i], y = src[i + 1], z = src[i + 2];
          positions[i] = m[0] * x + m[4] * y + m[8] * z + m[12]; positions[i + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; positions[i + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        }
        const indices = p.indices !== undefined ? Uint32Array.from(accessor(p.indices)) : Uint32Array.from({ length: src.length / 3 }, (_, i) => i);
        parts.push({ name: n.name, material: g.materials?.[p.material]?.name ?? '', positions, indices });
      }
    }
    for (const c of n.children ?? []) visit(c, m);
  };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const r of g.scenes[g.scene ?? 0].nodes) visit(r, I);
  return parts;
}
