// Measure a converted figure: leg joints (for the running skeleton) and the
// rifle's axis and sight line (for the first-person view).
// Input: welded positions (Float32Array, cm, y up, weapon toward -z).
export function analyze(P) {
  const n = P.length / 3;
  const slice = (y0, y1) => { const o = []; for (let i = 0; i < n; i++) if (P[i * 3 + 1] >= y0 && P[i * 3 + 1] < y1) o.push([P[i * 3], P[i * 3 + 2]]); return o; };

  // ---- legs: split each low slice into two clusters -------------------------
  const twoMeans = (pts) => {
    let a = pts.reduce((m, p) => (p[0] < m[0] ? p : m)), b = pts.reduce((m, p) => (p[0] > m[0] ? p : m));
    let ga = [], gb = [];
    for (let it = 0; it < 12; it++) {
      ga = []; gb = [];
      for (const p of pts) ((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2 < (p[0] - b[0]) ** 2 + (p[1] - b[1]) ** 2 ? ga : gb).push(p);
      const mean = (g) => [g.reduce((s, p) => s + p[0], 0) / g.length, g.reduce((s, p) => s + p[1], 0) / g.length];
      if (!ga.length || !gb.length) break;
      a = mean(ga); b = mean(gb);
    }
    // Gap between the clusters along the line joining their centres.
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / d, uz = (b[1] - a[1]) / d;
    let maxA = -Infinity, minB = Infinity;
    for (const p of ga) maxA = Math.max(maxA, (p[0] - a[0]) * ux + (p[1] - a[1]) * uz);
    for (const p of gb) minB = Math.min(minB, (p[0] - a[0]) * ux + (p[1] - a[1]) * uz);
    return { a, b, gap: minB - maxA };
  };
  const step = 0.1, left = [], right = [];
  let crotch = null;
  for (let y = 0.05; y < 3.6; y += step) {
    const pts = slice(y, y + step);
    if (pts.length < 20) continue;
    const { a, b, gap } = twoMeans(pts);
    if (gap < 0.04 && y > 1.6) { crotch = y; break; }
    const [l, r] = a[0] < b[0] ? [a, b] : [b, a];
    left.push([l[0], y + step / 2, l[1]]); right.push([r[0], y + step / 2, r[1]]);
  }
  const leg = (line, sideSign, pelvis) => {
    const ankle = line.find((p) => p[1] >= 0.33) ?? line[0];
    const hip = [pelvis[0] + 0.34 * sideSign, crotch + 0.32, pelvis[2]];
    // Knee: on the centreline, 48% of the way up from ankle to hip by path length.
    const path = [...line.filter((p) => p[1] >= ankle[1]), hip];
    const seg = path.slice(1).map((p, i) => Math.hypot(p[0] - path[i][0], p[1] - path[i][1], p[2] - path[i][2]));
    const total = seg.reduce((s, v) => s + v, 0);
    let acc = 0, knee = path[0];
    for (let i = 0; i < seg.length; i++) {
      if (acc + seg[i] >= total * 0.48) { const t = (total * 0.48 - acc) / seg[i]; knee = path[i].map((v, k) => v + (path[i + 1][k] - v) * t); break; }
      acc += seg[i];
    }
    return { hip, knee, ankle };
  };
  const top = slice(crotch + 0.25, crotch + 0.45);
  const pelvis = [top.reduce((s, p) => s + p[0], 0) / top.length, crotch + 0.35, top.reduce((s, p) => s + p[1], 0) / top.length];
  const legs = { left: leg(left, -1, pelvis), right: leg(right, 1, pelvis) };

  // ---- rifle (already turned to run along -z) and head -------------------------
  let muzzleZ = 0;
  for (let i = 0; i < n; i++) if (P[i * 3 + 1] > 3.3 && P[i * 3 + 2] < muzzleZ) muzzleZ = P[i * 3 + 2];
  // Barrel line: average x and y of the front fifth.
  let bx = 0, by = 0, bn = 0;
  for (let i = 0; i < n; i++) if (P[i * 3 + 1] > 3.3 && P[i * 3 + 2] < muzzleZ * 0.82) { bx += P[i * 3]; by += P[i * 3 + 1]; bn++; }
  bx /= bn; by /= bn;
  // Top edge of the rifle along its length (within a narrow strip over the barrel line).
  const topEdge = {};
  for (let i = 0; i < n; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (Math.abs(x - bx) > 0.14 || y < by - 0.1 || y > by + 0.75) continue;
    const bin = (Math.round(z / 0.2) * 0.2).toFixed(1);
    topEdge[bin] = Math.max(topEdge[bin] ?? 0, y);
  }
  // Head: centre of everything in the top 9% of the figure, dropped a little.
  let hx = 0, hz = 0, hn = 0, topY = 0;
  for (let i = 0; i < n; i++) topY = Math.max(topY, P[i * 3 + 1]);
  for (let i = 0; i < n; i++) if (P[i * 3 + 1] > topY * 0.91) { hx += P[i * 3]; hz += P[i * 3 + 2]; hn++; }
  const head = [hx / hn, topY - 0.52, hz / hn];
  const rifle = { x: bx, y: by, muzzleZ, top: topEdge };

  return { crotch, pelvis, legs, rifle, head };
}
