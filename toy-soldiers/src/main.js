import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Physics, RAPIER } from './core/Physics.js';
import { Input } from './core/Input.js';
import { seeded } from './world/materials.js';
import { buildRoom } from './world/Room.js';
import { buildMap01, SPAWNS } from './world/map01.js';
import { Lighting } from './world/Lighting.js';
import { Player } from './entities/Player.js';
import { Bot } from './entities/Bot.js';
import { CameraRig } from './systems/CameraRig.js';
import { Weapon } from './systems/Weapon.js';
import { Effects } from './systems/Effects.js';
import { Combat } from './systems/Combat.js';
import { NavGrid } from './systems/NavGrid.js';
import { Match } from './systems/Match.js';
import { Audio } from './systems/Audio.js';
import { Hud } from './ui/Hud.js';

const FIXED_DT = 1 / 60;

async function boot() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const physics = await Physics.create();
  const ctx = { scene, physics, RAPIER, rand: seeded(1234), effects: new Effects(scene), audio: new Audio(), soldiers: [], climbables: [] };
  ctx.combat = new Combat(ctx);
  ctx.match = new Match(ctx, SPAWNS);

  const roomRefs = buildRoom(ctx);
  buildMap01(ctx);
  const lighting = new Lighting(scene, renderer, roomRefs);

  // Navigation is derived from the finished map's static colliders.
  physics.step();
  const { width: W, depth: D } = CONFIG.room;
  ctx.nav = new NavGrid(physics, { minX: -W / 2 + 2, maxX: W / 2 - 2, minZ: -D / 2 + 2, maxZ: D / 2 - 2 });
  // Snap spawn points onto walkable ground so a map edit cannot strand a bot.
  for (const team of Object.keys(SPAWNS)) {
    SPAWNS[team] = SPAWNS[team].map(([x, z]) => {
      const p = ctx.nav.point(ctx.nav.nearest(x, z));
      return [p.x, p.z];
    });
  }

  const n = CONFIG.match.teamSize;
  const player = new Player(ctx, ...SPAWNS.green[0]);
  ctx.soldiers.push(player);
  for (let i = 1; i < n; i++) ctx.soldiers.push(new Bot(ctx, 'green', `Green ${i + 1}`, ...SPAWNS.green[i]));
  for (let i = 0; i < n; i++) ctx.soldiers.push(new Bot(ctx, 'tan', `Tan ${i + 1}`, ...SPAWNS.tan[i]));
  const bots = ctx.soldiers.filter((s) => !s.isPlayer);

  const rig = new CameraRig(ctx, player);
  const weapon = new Weapon(ctx, player, rig);

  const input = new Input(renderer.domElement);
  const hud = new Hud();

  // The chosen loadout takes effect at the next spawn, as in any class shooter.
  let loadoutIndex = 0;
  const pickLoadout = (i) => {
    loadoutIndex = (i + CONFIG.loadouts.length) % CONFIG.loadouts.length;
    hud.selectLoadout(loadoutIndex);
  };
  hud.buildLoadouts(pickLoadout);
  pickLoadout(0);
  player.onRespawn = () => weapon.setLoadout(CONFIG.loadouts[loadoutIndex]);
  hud.ready(() => {
    ctx.audio.resume();
    ctx.match.start();
    input.lockPointer();
  });
  ctx.match.onEnd = (winner) => {
    document.exitPointerLock?.();
    ctx.audio.jet(false);
    hud.showResult(winner, ctx.match.score);
  };
  renderer.domElement.addEventListener('click', () => { if (ctx.match.playing) input.lockPointer(); });

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    rig.resize();
  });

  const timer = new THREE.Timer();
  const noPresses = new Set();
  let acc = 0, fps = 60, fpsAcc = 0, fpsFrames = 0;

  renderer.setAnimationLoop(() => {
    timer.update();
    const rawDt = timer.getDelta();
    const dt = Math.min(rawDt, 0.1);
    fpsAcc += rawDt; fpsFrames++;
    if (fpsAcc >= 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }

    const s = input.update(dt);
    const playing = ctx.match.playing;
    if (s.pressed.has('toggleCamera')) rig.toggle();
    if (s.pressed.has('toggleTime')) lighting.toggle();
    for (let i = 0; i < CONFIG.loadouts.length; i++) if (s.pressed.has(`loadout${i + 1}`)) pickLoadout(i);
    if (s.pressed.has('loadoutPrev')) pickLoadout(loadoutIndex - 1);
    if (s.pressed.has('loadoutNext')) pickLoadout(loadoutIndex + 1);
    // Scale look speed with zoom so a scoped view is not twitchy.
    const zoom = rig.camera.fov / CONFIG.camera.fov;
    if (playing) player.look(s.lookX * zoom, s.lookY * zoom);

    // Fixed-step simulation; edge-triggered presses are consumed by the first step.
    acc += dt;
    let stepped = false;
    while (acc >= FIXED_DT) {
      const idle = { ...s, moveX: 0, moveZ: 0, jump: false, pressed: noPresses };
      player.fixedUpdate(FIXED_DT, !playing ? idle : stepped ? { ...s, pressed: noPresses } : s);
      for (const b of bots) b.fixedUpdate(FIXED_DT);
      physics.step();
      ctx.match.update(FIXED_DT);
      acc -= FIXED_DT;
      stepped = true;
    }
    if (stepped) physics.sync();

    player.update(dt, rig.thirdPerson);
    for (const b of bots) b.updateVisual(dt);
    rig.update(dt, playing && weapon.isAiming(s), weapon.def.adsFov);
    if (playing) weapon.update(dt, s);
    ctx.audio.setListener(rig.camera, rig.forward);

    ctx.effects.update(dt);
    lighting.update(dt);
    hud.update({ weapon, player, rig, lighting, match: ctx.match, fps, nextLoadout: CONFIG.loadouts[loadoutIndex] });
    renderer.render(scene, rig.camera);
  });

  window.__game = { ctx, scene, physics, player, bots, rig, weapon, lighting, input, renderer, match: ctx.match };
}

boot().catch((err) => {
  console.error(err);
  document.getElementById('overlay-status').textContent = `Failed to start: ${err.message}`;
});
