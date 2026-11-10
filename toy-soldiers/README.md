# Toy Soldiers

A first- and third-person shooter in the browser, built with three.js and the
Rapier physics engine. You are a 6 cm plastic soldier in a child's bedroom; the
toy chest has tipped over and its contents are the map.

![Day, third person](docs/day-third-person.png)
![Night, first person](docs/night-first-person.png)

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
| First / third person | V | Y |
| Day / night | N | D-pad up |

## What is in this build

- The bedroom at real scale (4 m x 3.6 m), with bed, desk, window and the tipped toy chest.
- Map 01, hand-placed: alphabet blocks, building bricks, books, a ruler ramp, a pencil bridge, cars, crayons, a teddy bear, and knockable dominoes, marbles and a ball.
- One player controller shared by the first- and third-person cameras, with jump and jetpack.
- A hitscan rifle with recoil, spread, aim-down-sights and reload.
- Tan soldiers as stationary targets that break into plastic pieces, melt, and respawn.
- Day and night lighting presets with a blend between them.
- Keyboard/mouse and gamepad input.

## Not built yet

- Bot AI and the team deathmatch rules (score, rounds, player damage and death).
- Loadouts, more weapons, grenades, unlocks.
- Audio.
- Rope, shoelace and other climb routes onto the furniture.
- Sourced toy models; everything is currently generated in code.
- Multiplayer.
- The random-spill map generator.

## Layout

| Path | Purpose |
|---|---|
| `src/config.js` | Scale and all tuning numbers |
| `src/core/` | Input (keyboard, mouse, gamepad) and the physics wrapper |
| `src/world/` | Room, toy factories, map 01 placement, lighting, materials |
| `src/entities/` | Soldier model, player, target |
| `src/systems/` | Camera rig, weapon, effects |
| `src/ui/` | HUD |

World units are centimetres.
