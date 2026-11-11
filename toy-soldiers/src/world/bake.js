import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Collapse every static mesh in the scene into one mesh per material.
// The room and toys are hundreds of small meshes; drawing each one separately
// (and again for every shadow map) is what costs frame rate in a browser.
// Colliders were already created from the original transforms, and materials
// are reused by reference, so gameplay and material tweaks are unaffected.
export function bakeStatic(scene, keep) {
  scene.updateMatrixWorld(true);
  const buckets = new Map();
  const nonIndexed = new Map();
  const removed = [];

  const push = (geometry, material, mesh) => {
    const key = `${material.uuid}|${mesh.castShadow}|${mesh.receiveShadow}`;
    if (!buckets.has(key)) buckets.set(key, { material, cast: mesh.castShadow, receive: mesh.receiveShadow, parts: [] });
    geometry.applyMatrix4(mesh.matrixWorld);
    buckets.get(key).parts.push(geometry);
  };

  // A plain copy holding only the attributes every geometry shares.
  const slice = (src, start, count) => {
    const g = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'uv']) {
      const a = src.getAttribute(name);
      g.setAttribute(name, new THREE.BufferAttribute(a.array.slice(start * a.itemSize, (start + count) * a.itemSize), a.itemSize));
    }
    return g;
  };

  for (const root of [...scene.children]) {
    if (keep.has(root) || root.isLight || root.isCamera) continue;
    let meshes = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      if (!nonIndexed.has(o.geometry)) nonIndexed.set(o.geometry, o.geometry.index ? o.geometry.toNonIndexed() : o.geometry);
      const src = nonIndexed.get(o.geometry);
      const total = src.getAttribute('position').count;
      if (Array.isArray(o.material)) {
        for (const grp of src.groups) push(slice(src, grp.start, Math.min(grp.count, total - grp.start)), o.material[grp.materialIndex], o);
      } else {
        push(slice(src, 0, total), o.material, o);
      }
    });
    if (meshes) removed.push(root);
  }

  for (const root of removed) scene.remove(root);
  for (const { material, cast, receive, parts } of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeometries(parts, false), material);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    for (const p of parts) p.dispose();
  }
  return { before: removed.length, after: buckets.size };
}
