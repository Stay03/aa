// Model gallery: candidate soldiers, cars and guns side by side under the
// game's lighting, for choosing an art direction. Not part of the game.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { woodFloorTexture, seeded } from './world/materials.js';
import { alphabetBlock, crayon, toyCar } from './world/toys.js';
import { createSoldier, createSculptedSoldier, animateLegs, TEAM_COLORS } from './entities/SoldierModel.js';
import { createKenneySoldier } from './entities/KenneySoldier.js';
import { buildGun } from './entities/GunModels.js';

const BASE = `${import.meta.env.BASE_URL}models/kenney/`;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xbcd4e6);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
scene.add(new THREE.HemisphereLight(0xcfe6ff, 0xb89a78, 1.25));
const sun = new THREE.DirectionalLight(0xfff1d6, 3.4);
sun.position.set(-40, 80, -50);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 250 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.08;
scene.add(sun);

const tex = woodFloorTexture();
tex.repeat.set(4, 4);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 1000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

function label(text, x, y, z, size = 1) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(15,20,30,.82)';
  g.beginPath(); g.roundRect(4, 20, 504, 88, 20); g.fill();
  g.fillStyle = '#fff';
  g.font = 'bold 40px system-ui, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((l, i) => g.fillText(l, 256, 64 + (i - (lines.length - 1) / 2) * 40));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false }));
  s.scale.set(8 * size, 2 * size, 1);
  s.position.set(x, y, z);
  scene.add(s);
}

// Toy factories expect a physics world; the gallery has none.
const ctx = { scene, rand: seeded(5), physics: { addBox() {}, addBall() {} } };
const animated = []; // { update(dt, t) }

// ---------------------------------------------------------------- soldiers
const SX = [-13.5, -4.5, 4.5, 13.5];
function placeCode(make, team, x, z) {
  const m = make(team);
  m.root.position.set(x, 0, z);
  m.root.rotation.y = Math.PI; // face the camera
  scene.add(m.root);
  animated.push({ update: (dt, t) => animateLegs(m, t * 9, state.walking ? 1 : 0) });
}
placeCode(createSoldier, 'green', SX[0], 0);
placeCode(createSoldier, 'tan', SX[0], -9);
placeCode(createSculptedSoldier, 'green', SX[1], 0);
placeCode(createSculptedSoldier, 'tan', SX[1], -9);
label('A · Current\n(blocks, in code)', SX[0], 8.6, 0);
label('B · Sculpted\n(new, in code)', SX[1], 8.6, 0);
label('C · Kenney CC0\n(as plastic)', SX[2], 8.6, 0);
label('D · Kenney CC0\n(own colours)', SX[3], 8.6, 0);
for (const [team, x, z] of [['green', SX[2], 0], ['tan', SX[2], -9], [null, SX[3], 0]]) {
  createKenneySoldier(team).then((k) => {
    k.root.position.set(x, 0, z);
    k.root.rotation.y = Math.PI;
    scene.add(k.root);
    animated.push({ update: (dt) => { k.setState(state.walking ? 'walk' : 'idle'); k.mixer.update(dt); } });
  });
}
// Scale references
alphabetBlock(ctx, -22, 0, 1, 0.3);
crayon(ctx, 21, 2, 0xe23a3a, 1.2);

// -------------------------------------------------------------------- cars
const CZ = 60;
toyCar(ctx, -32, CZ, 0xd83a2e, 0.5);
label('Current\n(in code)', -32, 13, CZ, 2);
['racer', 'truck', 'monster-truck', 'suv', 'speedster'].forEach((name, i) => {
  const x = -12 + i * 19;
  new GLTFLoader().load(`${BASE}toy-car-kit/vehicle-${name}.glb`, (g) => {
    const car = g.scene;
    const box = new THREE.Box3().setFromObject(car);
    car.scale.setScalar(15 / (box.max.z - box.min.z)); // 15 cm long, a typical toy car
    car.position.set(x, 0, CZ);
    car.rotation.y = 0.5;
    car.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    scene.add(car);
  });
  label(`Kenney CC0\n${name}`, x, 15, CZ, 2);
});

// -------------------------------------------------------------------- guns
const GZ = 120, GUN_LEN = 14;
const stand = (obj, x, z, y = 5) => { obj.position.set(x, y, z); obj.rotation.y = Math.PI / 2 + 0.25; scene.add(obj); };
['rifle', 'scatter', 'longshot', 'pistol'].forEach((id, i) => {
  const gun = buildGun(id, TEAM_COLORS.green).group;
  // Hide the hands and sleeves for the display: keep only gun-coloured parts.
  gun.children.slice().forEach((c) => { if (c.material?.color?.getHex() === TEAM_COLORS.green) gun.remove(c); });
  gun.scale.setScalar(GUN_LEN);
  gun.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  stand(gun, -30 + i * 20, GZ + 30);
});
label('Current guns (in code)', 0, 1.8, GZ + 41, 3.2);
[['d', 'Rifle?'], ['l', 'Scatter?'], ['e', 'Long Shot?'], ['a', 'Sidearm?'], ['n', ''], ['g', ''], ['f', '']].forEach(([b, role], i) => {
  const x = -51 + i * 17;
  new GLTFLoader().load(`${BASE}blaster-kit/blaster-${b}.glb`, (g) => {
    const gun = g.scene;
    const box = new THREE.Box3().setFromObject(gun);
    gun.scale.setScalar(GUN_LEN / Math.max(box.max.z - box.min.z, 0.5));
    gun.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    stand(gun, x, GZ);
  });
});
label('Kenney CC0 toy blasters', 0, 1.8, GZ + 11, 3.2);

// ------------------------------------------------------------------- views
const VIEWS = {
  Soldiers: { pos: [0, 8, 30], target: [0, 3.8, -2] },
  'Soldier close-up': { pos: [-2, 6, 12.5], target: [0, 3.3, 0] },
  Cars: { pos: [16, 34, CZ + 92], target: [16, 6, CZ] },
  Guns: { pos: [0, 52, GZ + 118], target: [0, 4, GZ + 16] },
};
const state = { walking: true };
const bar = document.getElementById('bar');
function view(name) {
  const v = VIEWS[name];
  camera.position.set(...v.pos);
  controls.target.set(...v.target);
  controls.update();
}
for (const name of Object.keys(VIEWS)) {
  const b = document.createElement('button');
  b.textContent = name;
  b.onclick = () => view(name);
  bar.appendChild(b);
}
const walk = document.createElement('button');
walk.textContent = 'Walking';
walk.className = 'on';
walk.onclick = () => { state.walking = !state.walking; walk.classList.toggle('on', state.walking); };
bar.appendChild(walk);
view('Soldiers');

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const timer = new THREE.Timer();
renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1), t = timer.getElapsed();
  for (const a of animated) a.update(dt, t);
  controls.update();
  renderer.render(scene, camera);
});
window.__gallery = { view, state, scene, camera, VIEWS };
