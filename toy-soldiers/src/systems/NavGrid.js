import { RAPIER } from '../core/Physics.js';

const SQRT2 = Math.SQRT2;

// Walkability grid over the bedroom floor plus A* pathfinding. Built once
// from the static colliders, so any map (hand-made or spilled at random)
// gets navigation for free.
export class NavGrid {
  constructor(physics, { minX, maxX, minZ, maxZ }, cell = 3) {
    this.cell = cell;
    this.minX = minX;
    this.minZ = minZ;
    this.w = Math.floor((maxX - minX) / cell);
    this.h = Math.floor((maxZ - minZ) / cell);
    this.walk = new Uint8Array(this.w * this.h);
    this.g = new Float32Array(this.w * this.h);
    this.parent = new Int32Array(this.w * this.h);
    this.stamp = new Uint32Array(this.w * this.h); // search id when opened
    this.closed = new Uint32Array(this.w * this.h);
    this.searchId = 0;

    // A fat capsule hovering just above lids and crayons (things a soldier
    // steps over). Anything it touches blocks the cell.
    const shape = new RAPIER.Capsule(1.2, 1.7);
    const rot = { x: 0, y: 0, z: 0, w: 1 };
    const flags = RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC;
    this.walkable = [];
    for (let j = 0; j < this.h; j++) {
      for (let i = 0; i < this.w; i++) {
        const p = { x: this.cx(i), y: 1.3 + 1.7 + 1.2, z: this.cz(j) };
        if (!physics.world.intersectionWithShape(p, rot, shape, flags)) {
          this.walk[j * this.w + i] = 1;
          this.walkable.push(j * this.w + i);
        }
      }
    }
  }

  cx(i) { return this.minX + (i + 0.5) * this.cell; }
  cz(j) { return this.minZ + (j + 0.5) * this.cell; }
  ci(x) { return Math.max(0, Math.min(this.w - 1, Math.floor((x - this.minX) / this.cell))); }
  cj(z) { return Math.max(0, Math.min(this.h - 1, Math.floor((z - this.minZ) / this.cell))); }
  ok(i, j) { return i >= 0 && j >= 0 && i < this.w && j < this.h && this.walk[j * this.w + i] === 1; }

  // Closest walkable cell index to a world position (spiral search).
  nearest(x, z) {
    const i0 = this.ci(x), j0 = this.cj(z);
    if (this.ok(i0, j0)) return j0 * this.w + i0;
    for (let r = 1; r < 40; r++) {
      let best = -1, bestD = Infinity;
      for (let j = j0 - r; j <= j0 + r; j++) {
        for (let i = i0 - r; i <= i0 + r; i++) {
          if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r || !this.ok(i, j)) continue;
          const d = (this.cx(i) - x) ** 2 + (this.cz(j) - z) ** 2;
          if (d < bestD) { bestD = d; best = j * this.w + i; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  point(idx) { return { x: this.cx(idx % this.w), z: this.cz(Math.floor(idx / this.w)) }; }

  randomPoint(rand = Math.random) {
    return this.point(this.walkable[Math.floor(rand() * this.walkable.length)]);
  }

  // True if a soldier can walk the straight segment a -> b.
  lineClear(ax, az, bx, bz) {
    const dist = Math.hypot(bx - ax, bz - az);
    const steps = Math.ceil(dist / (this.cell * 0.5));
    for (let s = 0; s <= steps; s++) {
      const t = steps === 0 ? 0 : s / steps;
      if (!this.ok(this.ci(ax + (bx - ax) * t), this.cj(az + (bz - az) * t))) return false;
    }
    return true;
  }

  // A* over the grid, then string-pulled. Returns [{x, z}, ...] or null.
  findPath(fromX, fromZ, toX, toZ) {
    const start = this.nearest(fromX, fromZ);
    const goal = this.nearest(toX, toZ);
    if (start < 0 || goal < 0) return null;
    const { w, g, parent, stamp, closed } = this;
    const id = ++this.searchId;
    const gi = goal % w, gj = Math.floor(goal / w);
    const hCost = (idx) => {
      const dx = Math.abs((idx % w) - gi), dz = Math.abs(Math.floor(idx / w) - gj);
      return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
    };

    // Binary heap of [f, idx] pairs stored flat.
    const heap = [];
    const push = (f, idx) => {
      let n = heap.length;
      heap.push(f, idx);
      while (n > 0) {
        const p = ((n / 2 - 1) >> 1) * 2;
        if (heap[p] <= heap[n]) break;
        [heap[p], heap[n]] = [heap[n], heap[p]];
        [heap[p + 1], heap[n + 1]] = [heap[n + 1], heap[p + 1]];
        n = p;
      }
    };
    const pop = () => {
      const top = heap[1];
      const lastI = heap.pop(), lastF = heap.pop();
      if (heap.length) {
        heap[0] = lastF; heap[1] = lastI;
        let n = 0;
        for (;;) {
          const l = n * 2 + 2, r = l + 2;
          let m = n;
          if (l < heap.length && heap[l] < heap[m]) m = l;
          if (r < heap.length && heap[r] < heap[m]) m = r;
          if (m === n) break;
          [heap[m], heap[n]] = [heap[n], heap[m]];
          [heap[m + 1], heap[n + 1]] = [heap[n + 1], heap[m + 1]];
          n = m;
        }
      }
      return top;
    };

    g[start] = 0; parent[start] = -1; stamp[start] = id;
    push(hCost(start), start);
    let found = false;
    while (heap.length) {
      const cur = pop();
      if (closed[cur] === id) continue;
      closed[cur] = id;
      if (cur === goal) { found = true; break; }
      const ci = cur % w, cj = Math.floor(cur / w);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di, nj = cj + dj;
          if (!this.ok(ni, nj)) continue;
          if (di && dj && (!this.ok(ci + di, cj) || !this.ok(ci, cj + dj))) continue; // no corner cutting
          const n = nj * w + ni;
          if (closed[n] === id) continue;
          const cost = g[cur] + (di && dj ? SQRT2 : 1);
          if (stamp[n] !== id || cost < g[n]) {
            g[n] = cost; parent[n] = cur; stamp[n] = id;
            push(cost + hCost(n), n);
          }
        }
      }
    }
    if (!found) return null;

    const raw = [];
    for (let n = goal; n !== -1; n = parent[n]) raw.push(this.point(n));
    raw.reverse();

    // String pulling: skip waypoints that can be reached in a straight line.
    const path = [];
    let a = 0;
    while (a < raw.length - 1) {
      let b = raw.length - 1;
      while (b > a + 1 && !this.lineClear(raw[a].x, raw[a].z, raw[b].x, raw[b].z)) b--;
      path.push(raw[b]);
      a = b;
    }
    return path.length ? path : [raw[raw.length - 1]];
  }
}
