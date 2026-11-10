# Toy Soldiers

A first- and third-person shooter in the browser, built with three.js and the
Rapier physics engine. You are a 6 cm plastic soldier in a child's bedroom; the
toy chest has tipped over and its contents are the map.

![Day, third person](docs/day-third-person.png)
![Night, first person](docs/night-first-person.png)
![Match HUD](docs/match.png)

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

- Team deathmatch, 4 v 4: you and three green bots against four tan bots. First to 30 kills or the best score after 5 minutes wins.
- Bots that find their way around the map, hunt the other team, strafe and fire in bursts, and reload.
- Health that regenerates out of combat, 3-second respawns away from enemies, brief spawn protection, kill feed, scoreboard and result screen.
- The bedroom at real scale (4 m x 3.6 m), with bed, desk, window and the tipped toy chest.
- Map 01, hand-placed: alphabet blocks, building bricks, books, a ruler ramp, a pencil bridge, cars, crayons, a teddy bear, and knockable dominoes, marbles and a ball.
- One soldier controller shared by the player and bots, with first- and third-person cameras, jump and jetpack.
- A hitscan rifle with recoil, spread, aim-down-sights and reload. Soldiers break into plastic pieces that melt.
- Synthesised sound: gunshots (positional for other soldiers), plastic shatter, hit marker, footsteps, reload, jetpack.
- Day and night lighting presets with a blend between them.
- Keyboard/mouse and gamepad input.

## Not built yet

- Loadouts, more weapons, grenades, unlocks.
- Bots using the jetpack or climbing; they stay on the floor.
- Rope, shoelace and other climb routes onto the furniture.
- Sourced toy models; everything is currently generated in code.
- Menus and settings (sensitivity, volume, difficulty).
- Multiplayer.
- The random-spill map generator.

## Layout

| Path | Purpose |
|---|---|
| `src/config.js` | Scale and all tuning numbers |
| `src/core/` | Input (keyboard, mouse, gamepad) and the physics wrapper |
| `src/world/` | Room, toy factories, map 01 placement, lighting, materials |
| `src/entities/` | Soldier base class and model, player, bot |
| `src/systems/` | Camera rig, weapon, combat, navigation grid, match rules, audio, effects |
| `src/ui/` | HUD |

World units are centimetres.
