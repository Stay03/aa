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
const ATLAS_COLS = 12, ATLAS_ROWS = 11, TILE = 128; // 132 tiles >= 26 letters x 5 colours

// Every alphabet-block face lives in one texture, so all blocks can share a
// single material (and be merged into a single mesh).
export function blockAtlasMaterial() {
  if (!cache.has('blockAtlas')) {
    const map = canvasTexture(ATLAS_COLS * TILE, ATLAS_ROWS * TILE, (g) => {
      for (let i = 0; i < 26 * BLOCK_COLORS.length; i++) {
        const x = (i % ATLAS_COLS) * TILE, y = Math.floor(i / ATLAS_COLS) * TILE;
        const col = BLOCK_COLORS[i % BLOCK_COLORS.length];
        g.fillStyle = '#ecd9b0';
        g.fillRect(x, y, TILE, TILE);
        g.strokeStyle = col;
        g.lineWidth = 10;
        g.strokeRect(x + 14, y + 14, TILE - 28, TILE - 28);
        g.fillStyle = col;
        g.font = 'bold 76px Georgia, serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String.fromCharCode(65 + Math.floor(i / BLOCK_COLORS.length)), x + TILE / 2, y + TILE / 2 + 4);
      }
    });
    cache.set('blockAtlas', new THREE.MeshStandardMaterial({ map, roughness: 0.6 }));
  }
  return cache.get('blockAtlas');
}

// UV rectangle [u0, v0, u1, v1] of tile `i`, inset to avoid bleeding.
export function blockAtlasTile(i) {
  const inset = 2 / TILE;
  const cx = i % ATLAS_COLS, cy = Math.floor(i / ATLAS_COLS);
  return [
    (cx + inset) / ATLAS_COLS, 1 - (cy + 1 - inset) / ATLAS_ROWS,
    (cx + 1 - inset) / ATLAS_COLS, 1 - (cy + inset) / ATLAS_ROWS,
  ];
}
export const BLOCK_TILES = 26 * BLOCK_COLORS.length;

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
