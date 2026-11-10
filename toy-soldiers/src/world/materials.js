import * as THREE from 'three';

const cache = new Map();

// Glossy injection-moulded plastic.
export function plastic(color, { roughness = 0.32, emissive = 0x000000 } = {}) {
  const key = `p:${color}:${roughness}:${emissive}`;
  if (!cache.has(key)) {
    cache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, emissive }));
  }
  return cache.get(key);
}

export function matte(color, roughness = 0.9) {
  const key = `m:${color}:${roughness}`;
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
  return cache.get(key);
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Deterministic RNG so the hand-built map looks the same on every load.
export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function woodFloorTexture() {
  const rand = seeded(7);
  const tex = canvasTexture(1024, 1024, (g, w, h) => {
    const plankH = h / 8;
    for (let row = 0; row < 8; row++) {
      let x = -rand() * 300;
      while (x < w) {
        const len = 260 + rand() * 260;
        const l = 52 + rand() * 12;
        g.fillStyle = `hsl(${28 + rand() * 6}, ${38 + rand() * 10}%, ${l}%)`;
        g.fillRect(x, row * plankH, len, plankH);
        g.strokeStyle = 'rgba(60,35,15,.10)';
        for (let i = 0; i < 9; i++) {
          const y = row * plankH + rand() * plankH;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len / 3, y + rand() * 6 - 3, x + (2 * len) / 3, y + rand() * 6 - 3, x + len, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(40,22,8,.55)';
        g.fillRect(x + len - 2, row * plankH, 2, plankH);
        x += len;
      }
      g.fillStyle = 'rgba(40,22,8,.55)';
      g.fillRect(0, row * plankH, w, 2);
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function rugTexture() {
  return canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#3f8f8a';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#f3e9d2';
    g.lineWidth = 14;
    g.strokeRect(22, 22, w - 44, h - 44);
    g.lineWidth = 4;
    g.strokeRect(46, 46, w - 92, h - 92);
    g.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < 4000; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  });
}

const BLOCK_COLORS = ['#d8452e', '#2e6fd8', '#2ea84f', '#e0a11b', '#8a45c9'];

export function blockFaceMaterial(letter, colorIndex) {
  const key = `b:${letter}:${colorIndex}`;
  if (!cache.has(key)) {
    const col = BLOCK_COLORS[colorIndex % BLOCK_COLORS.length];
    const map = canvasTexture(128, 128, (g, w, h) => {
      g.fillStyle = '#ecd9b0';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = col;
      g.lineWidth = 10;
      g.strokeRect(12, 12, w - 24, h - 24);
      g.fillStyle = col;
      g.font = 'bold 78px Georgia, serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(letter, w / 2, h / 2 + 4);
    });
    cache.set(key, new THREE.MeshStandardMaterial({ map, roughness: 0.6 }));
  }
  return cache.get(key);
}

export function rulerMaterial() {
  if (!cache.has('ruler')) {
    const map = canvasTexture(1024, 128, (g, w, h) => {
      g.fillStyle = '#f2c230';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#222';
      g.font = 'bold 26px sans-serif';
      for (let mm = 0; mm <= 300; mm++) {
        const x = (mm / 300) * w;
        const len = mm % 10 === 0 ? 46 : mm % 5 === 0 ? 30 : 18;
        g.fillRect(x, 0, mm % 10 === 0 ? 2 : 1, len);
        if (mm % 10 === 0 && mm > 0 && mm < 300) g.fillText(String(mm / 10), x - 8, 84);
      }
    });
    cache.set('ruler', new THREE.MeshStandardMaterial({ map, roughness: 0.35 }));
  }
  return cache.get('ruler');
}
