# Toy Soldiers

A first- and third-person shooter in the browser, built with three.js and the
Rapier physics engine. You are a 6 cm plastic soldier in a child's bedroom; the
toy chest has tipped over and its contents are the map.

![Day, third person](docs/day-third-person.png)
![Night, first person](docs/night-first-person.png)
![Rifle at the hip](docs/rifle-hip.png)
![Rifle aimed](docs/rifle-aim.png)
![Match HUD](docs/match.png)
![View from the desk](docs/desk-view.png)

## Run

```
npm install
npm run dev
```

Open the printed URL in a desktop browser and click to play.

## Controls

| Action | Keyboard / mouse | Gamepad |
|---|---|---|
| Move / look | WASD / mouse | Left stick / right stick |
| Fire / aim | Left click / right click | RT / LT |
| Jump, hold in the air for jetpack | Space | A |
| Sprint | Shift | L3 |
| Reload | R | X |
| Swap weapon | Q or mouse wheel | RB |
| Change loadout (next spawn) | 1 2 3 | D-pad left / right |
| Climb a rope | Walk into it, hold forward | Same |
| First / third person | V | Y |
| Day / night | N | D-pad up |
| Pause | Esc | Start |

## What is in this build

- Team deathmatch, 4 v 4: you and three green bots against four tan bots. First to 30 kills or the best score after 5 minutes wins.
- Bots that find their way around the map, hunt the other team, strafe and fire in bursts, and reload.
- Health that regenerates out of combat, 3-second respawns away from enemies, brief spawn protection, kill feed, scoreboard and result screen.
- The bedroom at real scale (4 m x 3.6 m), with bed, desk, window and the tipped toy chest.
- Map 01, hand-placed: alphabet blocks, building bricks, books, a ruler ramp, a pencil bridge, cars, crayons, a teddy bear, and knockable dominoes, marbles and a ball.
- One soldier controller shared by the player and bots, with first- and third-person cameras, jump and jetpack.
- Three loadouts, picked on the start screen or changed for the next spawn: Rifleman (Rifle), Scout (Scatter Gun) and Sharpshooter (scoped Long Shot), each with a Sidearm. Bots use them too.
- Weapons defined as data in `src/config.js`: damage, pellets, fire rate, spread, recoil, range falloff, zoom. Soldiers break into plastic pieces that melt.
- Three climbable ropes: a shoelace up the bed, a jump rope up the desk, twine up to the roof of the toy chest. The jetpack reaches the bed but not the desk.
- Synthesised sound: gunshots (positional for other soldiers), plastic shatter, hit marker, footsteps, reload, jetpack.
- Day and night lighting presets with a blend between them.
- First-person gun models with hands and working iron sights, drawn in their own pass so they stay small in the corner and never clip into walls.
- Start, pause and result screens. Pausing freezes the match and offers resume, restart and settings.
- Settings saved in the browser: bot difficulty, look sensitivity, invert look, field of view, volume, default camera, time of day, resolution, shadow quality.
- Keyboard/mouse and gamepad input.

## Not built yet

- Grenades and unlocks.
- Bots using the jetpack or climbing; they stay on the floor.
- Sourced toy models; everything is currently generated in code.
- Multiplayer.
- The random-spill map generator.

## Performance

- Static geometry (the room and every toy that never moves) is merged into one mesh per material at load, and all alphabet-block faces share one texture. This took the frame from about 1,800 draw calls to about 170.
- Each soldier is three meshes instead of fifteen.
- Shadow maps refresh on alternate frames, and the lamp's only at night.
- Tracers and impact chips are two pooled instanced meshes, so a firefight adds no objects. A dying soldier's pieces share one material and cast no shadows.
- Weapon and shatter sounds are rendered into buffers once, then played back, instead of building a synth graph per shot.
- Route-finding is a weighted A* on typed arrays, limited to one search per frame across all bots.
- The simulation runs at most three catch-up steps per frame, and all shaders are compiled at load.
- Resolution is automatic by default: it drops the pixel density when the frame rate falls below about 50 and raises it again when there is headroom. The HUD shows the current percentage.

## Layout

| Path | Purpose |
|---|---|
| `src/config.js` | Scale and all tuning numbers |
| `src/core/` | Input (keyboard, mouse, gamepad), saved settings, automatic resolution and the physics wrapper |
| `src/world/` | Room, toy factories, map 01 placement, static-mesh baking, lighting, materials |
| `src/entities/` | Soldier base class and model, first-person gun models, player, bot |
| `src/systems/` | Camera rig, weapon, combat, navigation grid, match rules, audio, effects |
| `src/ui/` | HUD and menus |

World units are centimetres.
