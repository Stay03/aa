import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { plastic } from '../world/materials.js';
import { TEAM_COLORS } from './SoldierModel.js';

// Kenney "Mini Characters" soldier (CC0), rigged and animated.
// Loaded once, then cloned per soldier. With `team` set it is recoloured as
// one-colour moulded plastic; with `team` null it keeps Kenney's own colours.
const BASE = `${import.meta.env.BASE_URL}models/kenney/`;
const HEIGHT_CM = 6;
let cache = null;

export function loadKenneySoldier() {
  cache ??= Promise.all([
    new GLTFLoader().loadAsync(`${BASE}mini-characters/character-soldier.glb`),
    new GLTFLoader().loadAsync(`${BASE}blaster-kit/blaster-d.glb`),
  ]).then(([soldier, blaster]) => ({ soldier, blaster }));
  return cache;
}

export async function createKenneySoldier(team) {
  const { soldier, blaster } = await loadKenneySoldier();
  const model = cloneSkinned(soldier.scene);
  const box = new THREE.Box3().setFromObject(model);
  const scale = HEIGHT_CM / (box.max.y - box.min.y);
  model.scale.setScalar(scale);
  model.rotation.y = Math.PI; // Kenney models face +z; the game's forward is -z

  const mat = team ? plastic(TEAM_COLORS[team], { roughness: 0.42 }) : null;
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.frustumCulled = false; // skinned bounds are unreliable at this scale
    if (mat) o.material = mat;
  });

  // Toy blaster held out in front, between the hands of the "holding" pose.
  const gun = blaster.scene.clone();
  gun.traverse((o) => { if (o.isMesh) { o.castShadow = true; if (mat) o.material = mat; } });
  gun.scale.setScalar(0.5);
  gun.position.set(0, 0.25, 0.3);
  model.add(gun);

  const root = new THREE.Group();
  root.add(model);
  if (team) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.75, 0.2, 28), mat);
    base.position.y = 0.1;
    base.receiveShadow = true;
    base.castShadow = true;
    root.add(base);
    model.position.y = 0.2;
  }

  // Locomotion clips drive legs/torso/head; a "holding" clip owns the arms.
  const mixer = new THREE.AnimationMixer(model);
  const clips = Object.fromEntries(soldier.animations.map((c) => [c.name, c]));
  const noArms = (clip) => {
    const c = clip.clone();
    c.tracks = c.tracks.filter((t) => !t.name.startsWith('arm-'));
    return c;
  };
  const actions = {};
  for (const name of ['idle', 'walk', 'sprint']) {
    actions[name] = mixer.clipAction(noArms(clips[name]));
    actions[name].play();
    actions[name].setEffectiveWeight(0);
  }
  mixer.clipAction(clips['holding-both']).play();

  let current = null;
  const setState = (name) => {
    if (name === current) return;
    for (const [n, a] of Object.entries(actions)) a.setEffectiveWeight(n === name ? 1 : 0);
    current = name;
  };
  setState('idle');

  return { root, mixer, setState, clipNames: Object.keys(clips) };
}
