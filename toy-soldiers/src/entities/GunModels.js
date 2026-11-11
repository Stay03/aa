import * as THREE from 'three';
import { plastic } from '../world/materials.js';

// First-person gun models. Built in code as moulded toy guns: dark plastic
// bodies, tan furniture and the orange muzzle tip every toy gun has.
// Each gun points down -z with its origin at the top of the grip.
// Returns { group, muzzle, sightY, hip, ads } where sightY is the height of
// the sight line above the origin (used to line the sights up when aiming).

const DARK = () => plastic(0x2a2c30, { roughness: 0.5 });
const METAL = () => plastic(0x44474d, { roughness: 0.28 });
const TAN = () => plastic(0xb58a54, { roughness: 0.55 });
const ORANGE = () => plastic(0xff6a1a, { roughness: 0.4 });

function builder(skin) {
  const group = new THREE.Group();
  const put = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    group.add(m);
    return m;
  };
  const box = (mat, w, h, d, x, y, z, rx = 0) => put(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx);
  // Cylinder lying along z.
  const tube = (mat, r, len, x, y, z, seg = 14) => put(new THREE.CylinderGeometry(r, r, len, seg).rotateX(Math.PI / 2), mat, x, y, z);
  // Box stretched between two points: forearms.
  const limb = (mat, a, b, thick) => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const m = put(new THREE.BoxGeometry(thick, thick, va.distanceTo(vb)), mat, 0, 0, 0);
    m.position.copy(va).add(vb).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vb.sub(va).normalize());
  };
  // Right hand on the grip, left hand under the fore-end, sleeves running off screen.
  const hands = (grip, fore) => {
    box(skin, 0.056, 0.075, 0.07, grip[0], grip[1], grip[2]);
    limb(skin, [grip[0] + 0.02, grip[1] - 0.03, grip[2] + 0.03], [grip[0] + 0.2, grip[1] - 0.33, grip[2] + 0.45], 0.078);
    box(skin, 0.074, 0.05, 0.095, fore[0], fore[1], fore[2]);
    limb(skin, [fore[0] - 0.02, fore[1] - 0.03, fore[2] + 0.03], [fore[0] - 0.3, fore[1] - 0.36, fore[2] + 0.62], 0.078);
  };
  const muzzle = new THREE.Object3D();
  group.add(muzzle);
  return { group, box, tube, hands, muzzle };
}

const BUILD = {
  rifle(skin) {
    const b = builder(skin), D = DARK(), M = METAL(), T = TAN();
    b.box(D, 0.05, 0.075, 0.36, 0, 0, -0.02);              // receiver
    b.box(D, 0.022, 0.014, 0.3, 0, 0.044, -0.03);          // top rail
    b.box(T, 0.046, 0.06, 0.3, 0, 0, -0.35);               // handguard
    b.tube(M, 0.011, 0.26, 0, 0.008, -0.63);               // barrel
    b.tube(ORANGE(), 0.014, 0.035, 0, 0.008, -0.775);      // toy tip
    b.box(D, 0.016, 0.05, 0.016, 0, 0.055, -0.49);         // front sight post
    b.box(D, 0.03, 0.012, 0.02, 0, 0.052, 0.1);            // rear sight base
    b.box(D, 0.006, 0.03, 0.012, -0.011, 0.067, 0.1);      // rear sight ears
    b.box(D, 0.006, 0.03, 0.012, 0.011, 0.067, 0.1);
    b.box(D, 0.034, 0.17, 0.07, 0, -0.115, -0.09, 0.18);   // magazine
    b.box(D, 0.036, 0.12, 0.05, 0, -0.09, 0.11, -0.3);     // grip
    b.box(T, 0.04, 0.07, 0.26, 0, -0.012, 0.29);           // stock
    b.box(D, 0.044, 0.1, 0.03, 0, -0.02, 0.43);            // butt pad
    b.hands([0, -0.1, 0.115], [0, -0.052, -0.36]);
    b.muzzle.position.set(0, 0.008, -0.8);
    return { ...b, sightY: 0.077, hip: [0.17, -0.165, -0.42], ads: [0, -0.077, -0.38] };
  },

  scatter(skin) {
    const b = builder(skin), D = DARK(), M = METAL(), T = TAN();
    for (const x of [-0.018, 0.018]) {
      b.tube(M, 0.017, 0.52, x, 0.012, -0.44);             // twin barrels
      b.tube(ORANGE(), 0.019, 0.03, x, 0.012, -0.705);
    }
    b.box(T, 0.072, 0.05, 0.24, 0, -0.024, -0.36);         // fore-end
    b.box(D, 0.062, 0.085, 0.24, 0, 0, -0.04);             // receiver
    b.box(M, 0.008, 0.014, 0.008, 0, 0.036, -0.68);        // bead sight
    b.box(D, 0.006, 0.012, 0.01, -0.012, 0.047, 0.06);     // rear notch
    b.box(D, 0.006, 0.012, 0.01, 0.012, 0.047, 0.06);
    b.box(D, 0.036, 0.11, 0.05, 0, -0.085, 0.1, -0.35);    // grip
    b.box(T, 0.045, 0.075, 0.3, 0, -0.04, 0.26, -0.1);     // stock
    b.hands([0, -0.095, 0.105], [0, -0.07, -0.36]);
    b.muzzle.position.set(0, 0.012, -0.72);
    return { ...b, sightY: 0.045, hip: [0.17, -0.16, -0.42], ads: [0, -0.045, -0.38] };
  },

  longshot(skin) {
    const b = builder(skin), D = DARK(), M = METAL(), T = TAN();
    b.box(D, 0.045, 0.065, 0.34, 0, 0, -0.02);             // receiver
    b.tube(M, 0.012, 0.62, 0, 0.006, -0.5);                // long barrel
    b.tube(ORANGE(), 0.015, 0.035, 0, 0.006, -0.825);
    b.box(T, 0.05, 0.05, 0.34, 0, -0.018, -0.34);          // fore-stock
    b.tube(D, 0.026, 0.3, 0, 0.078, -0.03);                // scope body
    b.tube(D, 0.034, 0.07, 0, 0.078, -0.2);                // objective bell
    b.tube(D, 0.03, 0.05, 0, 0.078, 0.13);                 // eyepiece
    b.box(D, 0.014, 0.03, 0.02, 0, 0.045, -0.1);           // scope mounts
    b.box(D, 0.014, 0.03, 0.02, 0, 0.045, 0.06);
    b.box(M, 0.05, 0.012, 0.012, 0.045, 0.01, 0.08);       // bolt handle
    b.box(D, 0.03, 0.07, 0.07, 0, -0.065, -0.06);          // magazine
    b.box(D, 0.036, 0.11, 0.05, 0, -0.085, 0.11, -0.3);    // grip
    b.box(T, 0.042, 0.08, 0.3, 0, -0.02, 0.3);             // stock
    b.box(T, 0.036, 0.03, 0.16, 0, 0.03, 0.27);            // cheek rest
    b.hands([0, -0.095, 0.115], [0, -0.065, -0.36]);
    b.muzzle.position.set(0, 0.006, -0.85);
    return { ...b, sightY: 0.078, hip: [0.17, -0.17, -0.42], ads: [0, -0.078, -0.26] };
  },

  pistol(skin) {
    const b = builder(skin), D = DARK(), M = METAL();
    b.box(M, 0.034, 0.042, 0.24, 0, 0.012, -0.08);         // slide
    b.box(D, 0.03, 0.024, 0.2, 0, -0.02, -0.06);           // frame
    b.box(D, 0.032, 0.13, 0.055, 0, -0.09, 0.03, -0.22);   // grip
    b.box(ORANGE(), 0.022, 0.022, 0.014, 0, 0.012, -0.205);
    b.box(D, 0.006, 0.012, 0.008, 0, 0.039, -0.19);        // front sight
    b.box(D, 0.006, 0.012, 0.008, -0.01, 0.039, 0.03);     // rear sight
    b.box(D, 0.006, 0.012, 0.008, 0.01, 0.039, 0.03);
    b.hands([0.004, -0.09, 0.035], [-0.03, -0.11, 0.02]);
    b.muzzle.position.set(0, 0.012, -0.215);
    return { ...b, sightY: 0.041, hip: [0.13, -0.15, -0.5], ads: [0, -0.041, -0.42] };
  },
};

export function buildGun(id, skinColor) {
  const skin = plastic(skinColor, { roughness: 0.42 });
  const g = (BUILD[id] ?? BUILD.rifle)(skin);
  return {
    group: g.group, muzzle: g.muzzle, sightY: g.sightY,
    hip: new THREE.Vector3(...g.hip), ads: new THREE.Vector3(...g.ads),
  };
}
