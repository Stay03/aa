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
    // Open-list heap, allocated once. A cell can be pushed more than once.
    this.heapF = new Float32Array(this.w * this.h * 4);
    this.heapI = new Int32Array(this.w * this.h * 4);
    this.budget = 1; // path searches allowed this frame (reset by the main loop)

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

  // Budgeted search: at most one per rendered frame across all bots, so a
  // wave of re-planning (after a kill, say) is spread over several frames.
  // Returns undefined when the caller should simply try again next frame.
  requestPath(fromX, fromZ, toX, toZ) {
    if (this.budget <= 0) return undefined;
    this.budget--;
    return this.findPath(fromX, fromZ, toX, toZ);
  }

  // Weighted A* over the grid, then string-pulled. Returns [{x, z}, ...] or null.
  // The heuristic is inflated (GREED > 1): the search heads much more directly
  // for the goal and visits a fraction of the cells, at the price of routes
  // that can be slightly longer than the true shortest one.
  findPath(fromX, fromZ, toX, toZ) {
    const start = this.nearest(fromX, fromZ);
    const goal = this.nearest(toX, toZ);
    if (start < 0 || goal < 0) return null;
    const { w, h, g, parent, stamp, closed, walk, heapF, heapI } = this;
    const id = ++this.searchId;
    const gi = goal % w, gj = (goal / w) | 0;
    const GREED = 1.6;
    let size = 0;

    const push = (f, idx) => {
      if (size >= heapF.length) return; // heap full: drop (cannot happen in practice)
      let n = size++;
      while (n > 0) {
        const p = (n - 1) >> 1;
        if (heapF[p] <= f) break;
        heapF[n] = heapF[p]; heapI[n] = heapI[p];
        n = p;
      }
      heapF[n] = f; heapI[n] = idx;
    };
    const pop = () => {
      const top = heapI[0];
      const f = heapF[--size], idx = heapI[size];
      let n = 0;
      for (;;) {
        let c = n * 2 + 1;
        if (c >= size) break;
        if (c + 1 < size && heapF[c + 1] < heapF[c]) c++;
        if (heapF[c] >= f) break;
        heapF[n] = heapF[c]; heapI[n] = heapI[c];
        n = c;
      }
      heapF[n] = f; heapI[n] = idx;
      return top;
    };

    g[start] = 0; parent[start] = -1; stamp[start] = id;
    push(0, start);
    let found = false;
    while (size > 0) {
      const cur = pop();
      if (closed[cur] === id) continue;
      closed[cur] = id;
      if (cur === goal) { found = true; break; }
      const ci = cur % w, cj = (cur / w) | 0;
      const gc = g[cur];
      for (let dj = -1; dj <= 1; dj++) {
        const nj = cj + dj;
        if (nj < 0 || nj >= h) continue;
        for (let di = -1; di <= 1; di++) {
          const ni = ci + di;
          if ((!di && !dj) || ni < 0 || ni >= w) continue;
          const n = nj * w + ni;
          if (walk[n] !== 1 || closed[n] === id) continue;
          const diagonal = di !== 0 && dj !== 0;
          if (diagonal && (walk[cj * w + ni] !== 1 || walk[nj * w + ci] !== 1)) continue; // no corner cutting
          const cost = gc + (diagonal ? SQRT2 : 1);
          if (stamp[n] !== id || cost < g[n]) {
            g[n] = cost; parent[n] = cur; stamp[n] = id;
            const dx = Math.abs(ni - gi), dz = Math.abs(nj - gj);
            push(cost + GREED * (Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz)), n);
          }
        }
      }
    }
    if (!found) return null;

    const raw = [];
    for (let n = goal; n !== -1; n = parent[n]) raw.push(this.point(n));
    raw.reverse();

    // String pulling: from each kept waypoint, walk forward while the next
    // one is still reachable in a straight line. Linear in the path length.
    const path = [];
    let a = 0;
    while (a < raw.length - 1) {
      let b = a + 1;
      while (b + 1 < raw.length && this.lineClear(raw[a].x, raw[a].z, raw[b + 1].x, raw[b + 1].z)) b++;
      path.push(raw[b]);
      a = b;
    }
    return path.length ? path : [raw[raw.length - 1]];
  }
}
