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

  rifle: {
    damage: 34,
    fireRate: 9,
    magazine: 30,
    reloadSeconds: 1.6,
    range: 900,
    hipSpread: 0.012,
    adsSpread: 0.003,
    recoil: 0.007,
    impulse: 220,
  },

  target: { health: 100, respawnSeconds: 5 },

  room: { width: 400, depth: 360, height: 250 },
};
