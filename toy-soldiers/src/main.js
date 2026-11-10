import * as THREE from 'three';
import { Physics, RAPIER } from './core/Physics.js';
import { Input } from './core/Input.js';
import { seeded } from './world/materials.js';
import { buildRoom } from './world/Room.js';
import { buildMap01, SPAWNS, TARGETS } from './world/map01.js';
import { Lighting } from './world/Lighting.js';
import { Player } from './entities/Player.js';
import { Target } from './entities/Target.js';
import { CameraRig } from './systems/CameraRig.js';
import { Weapon } from './systems/Weapon.js';
import { Effects } from './systems/Effects.js';
import { Hud } from './ui/Hud.js';

const FIXED_DT = 1 / 60;

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const physics = await Physics.create();
  const ctx = { scene, physics, RAPIER, rand: seeded(1234), effects: new Effects(scene) };

  const roomRefs = buildRoom(ctx);
  buildMap01(ctx);
  const lighting = new Lighting(scene, renderer, roomRefs);

  const [sx, sz] = SPAWNS.green[0];
  const player = new Player(ctx, sx, sz);
  const rig = new CameraRig(ctx, player);
  const weapon = new Weapon(ctx, player, rig);
  const targets = TARGETS.map(([x, y, z]) => new Target(ctx, x, y, z, Math.atan2(sx - x, sz - z) + Math.PI));

  const input = new Input(renderer.domElement);
  const hud = new Hud();
  let running = false;
  hud.ready(() => { running = true; input.lockPointer(); });
  renderer.domElement.addEventListener('click', () => input.lockPointer());

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    rig.resize();
  });

  const clock = new THREE.Timer();
  let acc = 0, fps = 60, fpsAcc = 0, fpsFrames = 0;

  renderer.setAnimationLoop(() => {
    clock.update();
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.1);
    fpsAcc += rawDt; fpsFrames++;
    if (fpsAcc >= 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }

    const s = input.update(dt);
    if (running) {
      if (s.pressed.has('toggleCamera')) rig.toggle();
      if (s.pressed.has('toggleTime')) lighting.toggle();
      player.look(s.lookX, s.lookY);

      // Fixed-step simulation; edge-triggered presses are consumed by the first step.
      acc += dt;
      let first = true;
      while (acc >= FIXED_DT) {
        player.fixedUpdate(FIXED_DT, first ? s : { ...s, pressed: new Set() });
        physics.step();
        acc -= FIXED_DT;
        first = false;
      }
      if (!first) physics.sync();

      player.update(dt, rig.thirdPerson);
      rig.update(dt, s.aim);
      weapon.update(dt, s);
      for (const t of targets) t.update(dt);
    } else {
      rig.update(dt, false);
    }

    ctx.effects.update(dt);
    lighting.update(dt);
    hud.update({ weapon, player, rig, lighting, fps });
    renderer.render(scene, rig.camera);
  });

  window.__game = { scene, physics, player, rig, weapon, lighting, targets, input, renderer };
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('overlay-status').textContent = `Failed to start: ${err.message}`;
});
