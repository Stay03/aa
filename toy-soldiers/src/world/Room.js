import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { matte, plastic, woodFloorTexture, rugTexture } from './materials.js';

const { width: W, depth: D, height: H } = CONFIG.room;

// The bedroom shell and furniture. Furniture is static: it is terrain.
export function buildRoom(ctx) {
  const { scene, physics } = ctx;
  const refs = { glowStars: [], lampBulb: null, nightLightLens: null };

  const box = (w, h, d, mat, x, y, z, { cast = true, collide = true } = {}) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = true;
    scene.add(m);
    if (collide) physics.addBox(m, w / 2, h / 2, d / 2);
    return m;
  };

  // Floor
  const floorTex = woodFloorTexture();
  floorTex.repeat.set(W / 130, D / 130);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  physics.addStaticBox(0, -2, 0, W / 2, 2, D / 2);

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(250, 210), new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 1 }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(-10, 0.06, 25);
  rug.receiveShadow = true;
  scene.add(rug);

  // Walls. They do not cast shadows so sunlight reads cleanly across the floor.
  const wall = matte(0xbcd4e6, 0.95);
  const trim = matte(0xf7f5f0, 0.6);
  const T = 4;
  const noCast = { cast: false };
  box(T, H, D, wall, -W / 2 - T / 2, H / 2, 0, noCast);
  box(T, H, D, wall, W / 2 + T / 2, H / 2, 0, noCast);
  box(W, H, T, wall, 0, H / 2, D / 2 + T / 2, noCast);
  // Back wall (-z) with a window opening x:[-65,65], y:[90,195]
  const zB = -D / 2 - T / 2;
  box(W / 2 - 65, H, T, wall, -(W / 2 + 65) / 2, H / 2, zB, noCast);
  box(W / 2 - 65, H, T, wall, (W / 2 + 65) / 2, H / 2, zB, noCast);
  box(130, 90, T, wall, 0, 45, zB, noCast);
  box(130, H - 195, T, wall, 0, (H + 195) / 2, zB, noCast);
  // Window frame + sill
  box(138, 4, 10, trim, 0, 88, zB + 2, { cast: false, collide: false });
  box(138, 4, 6, trim, 0, 197, zB, { cast: false, collide: false });
  box(4, 105, 6, trim, -67, 142.5, zB, { cast: false, collide: false });
  box(4, 105, 6, trim, 67, 142.5, zB, { cast: false, collide: false });
  box(3, 105, 3, trim, 0, 142.5, zB, { cast: false, collide: false });
  box(130, 3, 3, trim, 0, 142.5, zB, { cast: false, collide: false });
  // Ceiling + skirting boards
  box(W, T, D, matte(0xfafafa, 1), 0, H + T / 2, 0, noCast);
  for (const [w, d, x, z] of [[W, 1.2, 0, -D / 2 + 0.6], [W, 1.2, 0, D / 2 - 0.6], [1.2, D, -W / 2 + 0.6, 0], [1.2, D, W / 2 - 0.6, 0]]) {
    box(w, 9, d, trim, x, 4.5, z, { cast: false, collide: false });
  }

  // Bed along the +x wall. 25 cm of clearance underneath: a dark flank route.
  const bedWood = matte(0x8a5a33, 0.6);
  const bx = 147, bz = -68;
  for (const [lx, lz] of [[-46, -96], [46, -96], [-46, 96], [46, 96]]) box(7, 25, 7, bedWood, bx + lx, 12.5, bz + lz);
  box(100, 8, 200, bedWood, bx, 29, bz);
  box(96, 18, 194, matte(0xf3f0ea, 1), bx, 42, bz);
  box(98, 6, 130, matte(0x3d6fb5, 1), bx, 50, bz + 32);            // duvet
  box(60, 8, 32, matte(0xffffff, 1), bx, 55, bz - 76);             // pillow
  box(100, 70, 5, bedWood, bx, 35, bz - 100.5);                    // headboard

  // Desk in the -x corner, with the lamp that lights the night map.
  const deskWood = matte(0xd9c7a3, 0.5);
  const dx = -167, dz = -112;
  box(62, 3, 126, deskWood, dx, 73.5, dz);
  for (const [lx, lz] of [[-27, -59], [27, -59], [-27, 59], [27, 59]]) box(4, 72, 4, deskWood, dx + lx, 36, dz + lz);
  const lampMat = plastic(0xd94f3a);
  box(14, 2, 14, lampMat, dx + 14, 76, dz + 48);
  box(2, 30, 2, lampMat, dx + 14, 92, dz + 48, { collide: false });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(9, 12, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xd94f3a, roughness: 0.4, side: THREE.DoubleSide }));
  shade.position.set(dx + 20, 108, dz + 52);
  shade.rotation.set(0.5, 0, -0.5);
  scene.add(shade);
  refs.lampBulb = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffd9a0, emissiveIntensity: 0 }));
  refs.lampBulb.position.set(dx + 21, 105, dz + 53);
  scene.add(refs.lampBulb);
  refs.lampPosition = refs.lampBulb.position.clone();

  // Plug-in night light on the +z wall, close to the floor.
  box(7, 9, 2, trim, 120, 28, D / 2 - 1, { cast: false, collide: false });
  refs.nightLightLens = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xff9a3c, emissiveIntensity: 0 }));
  refs.nightLightLens.position.set(120, 28, D / 2 - 3);
  scene.add(refs.nightLightLens);
  refs.nightLightPosition = new THREE.Vector3(120, 28, D / 2 - 8);

  // Glow-in-the-dark stars above the bed.
  const starMat = new THREE.MeshStandardMaterial({ color: 0xe9f5c9, emissive: 0x9dff7a, emissiveIntensity: 0 });
  refs.glowStarMaterial = starMat;
  const rand = ctx.rand;
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Mesh(new THREE.CircleGeometry(2 + rand() * 2, 5), starMat);
    s.position.set(W / 2 - 0.3, 110 + rand() * 110, -160 + rand() * 180);
    s.rotation.set(0, -Math.PI / 2, rand() * 6);
    scene.add(s);
  }

  // Tipped-over toy chest: the source of the spill and an interior space.
  const chest = matte(0xc98a3f, 0.6);
  const cx = -20, cz = -105, cw = 80, ch = 46, cd = 50, ct = 2;
  box(cw, ct, cd, chest, cx, ct / 2, cz);
  box(cw, ct, cd, chest, cx, ch - ct / 2, cz);
  box(cw, ch, ct, chest, cx, ch / 2, cz - cd / 2 + ct / 2);
  box(ct, ch, cd, chest, cx - cw / 2 + ct / 2, ch / 2, cz);
  box(ct, ch, cd, chest, cx + cw / 2 - ct / 2, ch / 2, cz);
  box(cw, 1, 44, plastic(0xb5372f), cx, 0.5, cz + cd / 2 + 22);    // lid, flat on the floor

  return refs;
}
