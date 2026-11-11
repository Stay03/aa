import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Two authored presets, blended. A full day/night cycle can drive `t` later.
const PRESETS = {
  day: {
    sunColor: 0xfff1d6, sunIntensity: 3.4, sunPos: [-150, 300, -260],
    skyColor: 0xcfe6ff, groundColor: 0xb89a78, hemiIntensity: 1.25,
    background: 0xa9d4f5, env: 0.55, exposure: 1.0,
    lamp: 0, nightLight: 0, glow: 0,
  },
  night: {
    sunColor: 0x8fb2ff, sunIntensity: 0.55, sunPos: [90, 260, -300],
    skyColor: 0x33466e, groundColor: 0x141826, hemiIntensity: 0.38,
    background: 0x070b18, env: 0.07, exposure: 1.1,
    lamp: 1, nightLight: 1, glow: 1,
  },
};

export class Lighting {
  constructor(scene, renderer, refs) {
    this.scene = scene;
    this.renderer = renderer;
    this.refs = refs;
    this.t = 0;      // 0 = day, 1 = night
    this.target = 0;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.background = new THREE.Color();

    // Sun by day, moon by night. One shadow map covers the whole room.
    this.sun = new THREE.DirectionalLight();
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    const c = this.sun.shadow.camera;
    c.left = -260; c.right = 260; c.top = 260; c.bottom = -260; c.near = 20; c.far = 900;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.25;
    this.sun.shadow.radius = 2.5;
    this.sun.target.position.set(0, 0, 10);
    scene.add(this.sun, this.sun.target);

    this.hemi = new THREE.HemisphereLight();
    scene.add(this.hemi);

    // Night-only warm sources. They create lit zones against dark flanks.
    this.lamp = new THREE.SpotLight(0xffc98a, 0, 520, 0.62, 0.55, 1.6);
    this.lamp.position.copy(refs.lampPosition);
    this.lamp.target.position.set(-40, 0, 20);
    this.lamp.castShadow = true;
    this.lamp.shadow.mapSize.set(2048, 2048);
    this.lamp.shadow.camera.near = 10;
    this.lamp.shadow.camera.far = 520;
    this.lamp.shadow.bias = -0.0006;
    this.lamp.shadow.normalBias = 0.2;
    scene.add(this.lamp, this.lamp.target);

    this.nightLight = new THREE.PointLight(0xff9a4a, 0, 230, 1.5);
    this.nightLight.position.copy(refs.nightLightPosition);
    scene.add(this.nightLight);

    // Shadow maps are refreshed on alternate frames (sun on one, lamp on the
    // next) and the lamp's only while it is lit. Half the shadow cost, and a
    // one-frame lag on a moving soldier's shadow is not visible.
    this.sun.shadow.autoUpdate = false;
    this.lamp.shadow.autoUpdate = false;
    this.sun.shadow.needsUpdate = true;
    this.lamp.shadow.needsUpdate = true;
    this.frame = 0;

    this._a = new THREE.Color();
    this._b = new THREE.Color();
    this.apply();
  }

  get isNight() { return this.target === 1; }

  setNight(night) { this.target = night ? 1 : 0; }

  setShadowQuality(level) {
    const size = { low: 1024, medium: 2048, high: 4096 }[level] ?? 2048;
    for (const [light, s] of [[this.sun, size], [this.lamp, size / 2]]) {
      light.shadow.mapSize.set(s, s);
      light.shadow.map?.dispose();
      light.shadow.map = null;
      light.shadow.needsUpdate = true;
    }
  }

  update(dt) {
    this.frame++;
    if (this.frame % 2 === 0) this.sun.shadow.needsUpdate = true;
    else if (this.lamp.intensity > 0) this.lamp.shadow.needsUpdate = true;
    if (this.t === this.target) return;
    const step = dt / 1.5;
    this.t = this.target > this.t ? Math.min(this.target, this.t + step) : Math.max(this.target, this.t - step);
    this.apply();
  }

  apply() {
    const d = PRESETS.day, n = PRESETS.night;
    const t = this.t * this.t * (3 - 2 * this.t);
    const num = (k) => d[k] + (n[k] - d[k]) * t;
    const col = (k, out) => out.copy(this._a.set(d[k])).lerp(this._b.set(n[k]), t);

    col('sunColor', this.sun.color);
    this.sun.intensity = num('sunIntensity');
    this.sun.position.set(...d.sunPos.map((v, i) => v + (n.sunPos[i] - v) * t));
    col('skyColor', this.hemi.color);
    col('groundColor', this.hemi.groundColor);
    this.hemi.intensity = num('hemiIntensity');
    col('background', this.scene.background);
    this.scene.environmentIntensity = num('env');
    this.renderer.toneMappingExposure = num('exposure');

    this.lamp.intensity = num('lamp') * 9000;
    this.nightLight.intensity = num('nightLight') * 2600;
    this.refs.lampBulb.material.emissiveIntensity = num('lamp') * 3;
    this.refs.nightLightLens.material.emissiveIntensity = num('nightLight') * 2.5;
    this.refs.glowStarMaterial.emissiveIntensity = num('glow') * 1.6;
  }
}
