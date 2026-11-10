import { CONFIG } from '../config.js';

const C = CONFIG.match;

// Team deathmatch rules: score, clock, respawns, kill feed, win condition.
export class Match {
  constructor(ctx, spawns) {
    this.ctx = ctx;
    this.spawns = spawns;
    this.score = { green: 0, tan: 0 };
    this.timeLeft = C.timeLimitSeconds;
    this.playing = false;
    this.winner = null;   // 'green' | 'tan' | 'draw' once the match is over
    this.feed = [];       // [{ killer, victim, killerTeam, victimTeam, age }]
    this.onEnd = null;
  }

  start() {
    this.score.green = 0;
    this.score.tan = 0;
    this.timeLeft = C.timeLimitSeconds;
    this.winner = null;
    this.feed.length = 0;
    for (const s of this.ctx.soldiers) {
      s.kills = 0;
      s.deaths = 0;
      this.respawn(s, true);
    }
    this.playing = true;
  }

  onKill(attacker, victim) {
    if (!this.playing) return;
    if (attacker && attacker.team !== victim.team) {
      attacker.kills++;
      this.score[attacker.team]++;
    }
    this.feed.unshift({
      killer: attacker?.name ?? 'The floor', killerTeam: attacker?.team ?? victim.team,
      victim: victim.name, victimTeam: victim.team, age: 0,
    });
    this.feed.length = Math.min(this.feed.length, 5);
    if (this.score.green >= C.scoreLimit || this.score.tan >= C.scoreLimit) this.end();
  }

  end() {
    this.playing = false;
    const { green, tan } = this.score;
    this.winner = green === tan ? 'draw' : green > tan ? 'green' : 'tan';
    this.onEnd?.(this.winner);
  }

  // Spawn at the team point farthest from any living enemy.
  respawn(soldier, initial = false) {
    const points = this.spawns[soldier.team];
    const others = this.ctx.soldiers.filter((s) => s !== soldier && s.alive);
    let best = points[0], bestScore = -Infinity;
    for (const p of points) {
      let score = Math.random() * 10;
      let nearestEnemy = 400;
      for (const o of others) {
        const d = Math.hypot(o.position.x - p[0], o.position.z - p[1]);
        if (d < 5) score -= 1000; // occupied
        if (o.team !== soldier.team) nearestEnemy = Math.min(nearestEnemy, d);
      }
      score += initial ? 0 : nearestEnemy;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    soldier.respawnAt(best[0], best[1], soldier.team === 'green' ? 0 : Math.PI);
  }

  update(dt) {
    for (const f of this.feed) f.age += dt;
    while (this.feed.length && this.feed[this.feed.length - 1].age > 6) this.feed.pop();
    if (!this.playing) return;
    this.timeLeft -= dt;
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.end(); return; }
    for (const s of this.ctx.soldiers) if (s.dead && s.respawnIn <= 0) this.respawn(s);
  }
}
