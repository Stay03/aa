import * as THREE from 'three';
import { CONFIG } from './config.js';
import { Physics, RAPIER } from './core/Physics.js';
import { Input } from './core/Input.js';
import { seeded } from './world/materials.js';
import { buildRoom } from './world/Room.js';
import { buildMap01, SPAWNS } from './world/map01.js';
import { Lighting } from './world/Lighting.js';
import { Player } from './entities/Player.js';
import { preloadSoldier, animateSoldier } from './entities/RiggedSoldier.js';
import { Bot } from './entities/Bot.js';
import { CameraRig } from './systems/CameraRig.js';
import { Weapon } from './systems/Weapon.js';
import { Effects } from './systems/Effects.js';
import { Combat } from './systems/Combat.js';
import { NavGrid } from './systems/NavGrid.js';
import { Match } from './systems/Match.js';
import { Audio } from './systems/Audio.js';
import { Hud } from './ui/Hud.js';
import { Menu } from './ui/Menu.js';
import { Settings } from './core/Settings.js';
import { Resolution } from './core/Resolution.js';
import { bakeStatic } from './world/bake.js';

const FIXED_DT = 1 / 60;
const MAX_STEPS = 3;

async function boot() {
  const settings = new Settings();
  // Anti-aliasing is fixed when the graphics context is created, so changing
  // it in Settings takes effect after a reload.
  const antialias = settings.get('antialias');
  const renderer = new THREE.WebGLRenderer({ antialias, powerPreference: 'high-performance' });
  const resolution = new Resolution(renderer);
  renderer.autoClear = false; // the gun is drawn as a second pass over the world
  renderer.setSize(innerWidth, innerHeight);
  document.body.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const physics = await Physics.create();
  const ctx = { scene, physics, RAPIER, rand: seeded(1234), effects: new Effects(scene), audio: new Audio(), soldiers: [], climbables: [] };
  ctx.combat = new Combat(ctx);
  ctx.match = new Match(ctx, SPAWNS);

  const roomRefs = buildRoom(ctx);
  buildMap01(ctx);
  // Merge everything that never moves into one mesh per material.
  bakeStatic(scene, new Set(physics.dynamic.map((d) => d.mesh)));
  const lighting = new Lighting(scene, renderer, roomRefs);

  // Navigation is derived from the finished map's static colliders.
  physics.fullStep();
  const { width: W, depth: D } = CONFIG.room;
  ctx.nav = new NavGrid(physics, { minX: -W / 2 + 2, maxX: W / 2 - 2, minZ: -D / 2 + 2, maxZ: D / 2 - 2 });
  // Snap spawn points onto walkable ground so a map edit cannot strand a bot.
  for (const team of Object.keys(SPAWNS)) {
    SPAWNS[team] = SPAWNS[team].map(([x, z]) => {
      const p = ctx.nav.point(ctx.nav.nearest(x, z));
      return [p.x, p.z];
    });
  }

  await preloadSoldier();
  const n = CONFIG.match.teamSize;
  const player = new Player(ctx, ...SPAWNS.green[0]);
  ctx.soldiers.push(player);
  for (let i = 1; i < n; i++) ctx.soldiers.push(new Bot(ctx, 'green', `Green ${i + 1}`, ...SPAWNS.green[i]));
  for (let i = 0; i < n; i++) ctx.soldiers.push(new Bot(ctx, 'tan', `Tan ${i + 1}`, ...SPAWNS.tan[i]));
  const bots = ctx.soldiers.filter((s) => !s.isPlayer);
  physics.fullStep(); // register the soldiers' bodies

  const rig = new CameraRig(ctx, player);
  const weapon = new Weapon(ctx, player, rig);

  const input = new Input(renderer.domElement);
  const hud = new Hud();
  let paused = false;
  let loadoutIndex = 0;

  const begin = () => {
    paused = false;
    menu.hide();
    ctx.audio.resume();
    input.lockPointer();
  };
  const menu = new Menu(settings, {
    onPlay: () => { ctx.match.start(); begin(); },
    onRestart: () => { ctx.match.start(); begin(); },
    onResume: () => begin(),
    onLoadout: (i) => pickLoadout(i),
  }, { antialias });

  // The chosen loadout takes effect at the next spawn, as in any class shooter.
  const pickLoadout = (i) => {
    loadoutIndex = (i + CONFIG.loadouts.length) % CONFIG.loadouts.length;
    menu.selectLoadout(loadoutIndex);
  };
  pickLoadout(0);
  player.onRespawn = () => weapon.setLoadout(CONFIG.loadouts[loadoutIndex]);

  // Settings -> systems. Runs once for every key at boot, then on each change.
  const apply = {
    sensitivity: (v) => { input.sensitivity = v; },
    invertY: (v) => { input.invertY = v; },
    volume: (v) => ctx.audio.setVolume(v),
    fov: (v) => { rig.baseFov = v; },
    difficulty: (v) => { ctx.difficulty = CONFIG.difficulty[v] ?? CONFIG.difficulty.normal; },
    shadows: (v) => lighting.setShadowQuality(v),
    resolution: (v) => resolution.setMode(v),
    night: (v) => lighting.setNight(v),
    thirdPerson: (v) => { rig.thirdPerson = v; },
  };
  for (const key of Object.keys(apply)) apply[key](settings.get(key));
  settings.onChange = (key, value) => apply[key]?.(value);
  lighting.t = lighting.target; // start in the saved time of day, no fade
  lighting.apply();

  const pause = () => {
    if (!ctx.match.playing || paused) return;
    paused = true;
    ctx.audio.jet(false);
    if (document.pointerLockElement) document.exitPointerLock();
    const { green, tan } = ctx.match.score;
    menu.show('pause', { sub: `Green ${green} – ${tan} Tan` });
  };
  // Esc releases the mouse in every browser; treat losing it as a pause.
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) pause(); });
  addEventListener('blur', pause);

  ctx.match.onEnd = (winner) => {
    if (document.pointerLockElement) document.exitPointerLock();
    ctx.audio.jet(false);
    const { green, tan } = ctx.match.score;
    menu.show('result', {
      title: winner === 'draw' ? 'DRAW' : winner === 'green' ? 'VICTORY' : 'DEFEAT',
      sub: `Green ${green} – ${tan} Tan`,
    });
  };
  renderer.domElement.addEventListener('click', () => { if (ctx.match.playing && !paused) input.lockPointer(); });
  menu.show('start');

  addEventListener('resize', () => {
    renderer.setSize(innerWidth, innerHeight);
    rig.resize();
    weapon.resize();
  });

  // Compile every shader now, so nothing compiles mid-fight.
  renderer.compile(scene, rig.camera);
  renderer.compile(weapon.viewScene, weapon.viewCamera);

  const timer = new THREE.Timer();
  const noPresses = new Set();
  const idleInput = { moveX: 0, moveZ: 0, lookX: 0, lookY: 0, jump: false, sprint: false, fire: false, aim: false, pressed: noPresses };
  const repeatInput = {};
  let acc = 0, fps = 60, fpsAcc = 0, fpsFrames = 0;

  renderer.setAnimationLoop(() => {
    timer.update();
    const rawDt = timer.getDelta();
    const dt = Math.min(rawDt, 0.1);
    fpsAcc += rawDt; fpsFrames++;
    if (fpsAcc >= 0.5) { fps = Math.round(fpsFrames / fpsAcc); fpsAcc = 0; fpsFrames = 0; }

    resolution.update(rawDt, ctx.match.playing && !paused && document.hasFocus());
    const s = input.update(dt);
    if (s.pressed.has('pause')) {
      if (paused) begin(); else pause();
    }
    const playing = ctx.match.playing && !paused;
    if (playing) {
      if (s.pressed.has('toggleCamera')) settings.set('thirdPerson', !rig.thirdPerson);
      if (s.pressed.has('toggleTime')) settings.set('night', !lighting.isNight);
    }
    if (!paused) {
      for (let i = 0; i < CONFIG.loadouts.length; i++) if (s.pressed.has(`loadout${i + 1}`)) pickLoadout(i);
      if (s.pressed.has('loadoutPrev')) pickLoadout(loadoutIndex - 1);
      if (s.pressed.has('loadoutNext')) pickLoadout(loadoutIndex + 1);
    }
    // Scale look speed with zoom so a scoped view is not twitchy.
    const zoom = rig.camera.fov / rig.baseFov;
    if (playing) player.look(s.lookX * zoom, s.lookY * zoom);

    // Fixed-step simulation; edge-triggered presses are consumed by the first step.
    // While paused nothing simulates and the match clock stands still.
    acc = paused ? 0 : acc + dt;
    let stepped = false;
    // At most MAX_STEPS per frame: after a slow frame, catching up on every
    // missed step would make the next frame slow too.
    if (acc > FIXED_DT * MAX_STEPS) acc = FIXED_DT * MAX_STEPS;
    ctx.nav.budget = 1; // one route search per frame, shared by all bots
    while (acc >= FIXED_DT) {
      // First step gets the real input; later steps the same without presses.
      let stepInput = s;
      if (!playing) stepInput = idleInput;
      else if (stepped) stepInput = Object.assign(repeatInput, s, { pressed: noPresses });
      player.fixedUpdate(FIXED_DT, stepInput);
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

    if (!paused) ctx.effects.update(dt);
    lighting.update(dt);
    hud.update({ weapon, player, rig, lighting, match: ctx.match, fps, resolution, nextLoadout: CONFIG.loadouts[loadoutIndex] });
    renderer.clear();
    renderer.render(scene, rig.camera);
    weapon.render(renderer, scene, lighting);
  });

  window.__game = { ctx, animateSoldier, resolution, settings, menu, get paused() { return paused; }, scene, physics, player, bots, rig, weapon, lighting, input, renderer, match: ctx.match };
}

boot().catch((err) => {
  console.error(err);
  const button = document.getElementById('btn-play');
  if (button) button.textContent = `Failed to start: ${err.message}`;
});
