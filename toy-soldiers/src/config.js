// World units are centimetres. A toy soldier is 6 cm tall; the room is a real
// 4 m x 3.6 m bedroom. Everything about "toy scale" follows from these numbers.
export const CONFIG = {
  gravity: 120, // tuned for feel at toy scale, not real-world 981 cm/s^2

  soldier: { height: 6, radius: 1.1, eyeHeight: 5.3 },

  move: {
    walkSpeed: 34,
    sprintSpeed: 54,
    airControl: 0.6,
    jumpSpeed: 38, // clears one alphabet block (4.5 cm)
    stepHeight: 1.2,
    climbSpeed: 26,
  },

  jetpack: {
    accel: 260,
    maxRiseSpeed: 46,
    fuelSeconds: 1.2, // enough to reach the bed, not the desk
    rechargePerSecond: 0.6,
    minAirTime: 0.12,
  },

  camera: {
    fov: 75,
    adsFov: 48,
    thirdPerson: { distance: 11, height: 5.6, shoulder: 2.2 },
    mouseSensitivity: 0.0022,
    stickSensitivity: 2.6,
  },

  combat: { range: 900, impulse: 220 },

  // Weapons are data. `damage` is per pellet; `falloff` is
  // [full damage until, minimum from, minimum scale] in cm.
  // `botRange` is how close a bot gets before it stops and strafes.
  weapons: {
    rifle: {
      name: 'Rifle', auto: true, damage: 34, pellets: 1, fireRate: 9, magazine: 30, reloadSeconds: 1.6,
      hipSpread: 0.012, adsSpread: 0.003, recoil: 0.007, adsFov: 48,
      botRange: 55, botAim: 1,
      sound: { noise: 2200, tone: 420, decay: 0.07 }, view: { length: 1.7, thick: 0.16 },
    },
    scatter: {
      name: 'Scatter Gun', auto: false, damage: 14, pellets: 8, fireRate: 1.3, magazine: 6, reloadSeconds: 2.2,
      hipSpread: 0.09, adsSpread: 0.07, recoil: 0.03, adsFov: 60, falloff: [30, 90, 0.25],
      botRange: 26, botAim: 0.6,
      sound: { noise: 900, tone: 200, decay: 0.16 }, view: { length: 1.4, thick: 0.27 },
    },
    longshot: {
      name: 'Long Shot', auto: false, damage: 100, pellets: 1, fireRate: 0.8, magazine: 5, reloadSeconds: 2.4,
      hipSpread: 0.08, adsSpread: 0.0005, recoil: 0.03, adsFov: 16, scope: true,
      botRange: 150, botAim: 0.35,
      sound: { noise: 1400, tone: 300, decay: 0.22 }, view: { length: 2.5, thick: 0.13 },
    },
    pistol: {
      name: 'Sidearm', auto: false, damage: 26, pellets: 1, fireRate: 5, magazine: 12, reloadSeconds: 1.1,
      hipSpread: 0.012, adsSpread: 0.005, recoil: 0.012, adsFov: 56,
      botRange: 40, botAim: 1,
      sound: { noise: 3000, tone: 600, decay: 0.05 }, view: { length: 0.8, thick: 0.15 },
    },
  },

  // Each loadout is a primary plus a secondary. Unlocks will add to this list.
  loadouts: [
    { name: 'Rifleman', primary: 'rifle', secondary: 'pistol', botWeight: 0.5 },
    { name: 'Scout', primary: 'scatter', secondary: 'pistol', botWeight: 0.25 },
    { name: 'Sharpshooter', primary: 'longshot', secondary: 'pistol', botWeight: 0.25 },
  ],

  match: {
    teamSize: 4,
    scoreLimit: 30,
    timeLimitSeconds: 300,
    health: 100,
    respawnSeconds: 3,
    spawnProtectionSeconds: 1.5,
    regenDelay: 4,
    regenPerSecond: 30,
  },

  bot: {
    damageScale: 0.3,    // bots hit softer than the player with the same weapon
    maxFireRate: 5,
    aimError: 0.06,      // radians of random spread on each shot
    turnRate: 7,         // radians per second
    reaction: [0.25, 0.55],
    sightRange: 420,
  },

  room: { width: 400, depth: 360, height: 250 },
};
