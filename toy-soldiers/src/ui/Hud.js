import { CONFIG } from '../config.js';

const $ = (id) => document.getElementById(id);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Hud {
  constructor() {
    this.el = {
      crosshair: $('crosshair'), ammo: $('ammo'), health: $('health'), fuel: $('fuel'),
      info: $('info'), scope: $('scope'), loadouts: $('loadouts'), score: $('score'), feed: $('feed'), message: $('message'), vignette: $('vignette'),
      overlay: $('overlay'), title: $('overlay-title'), sub: $('overlay-sub'), status: $('overlay-status'),
    };
    this.last = {};
    this.onStart = null;
    this.el.overlay.addEventListener('click', () => {
      if (!this.onStart) return;
      this.el.overlay.style.display = 'none';
      this.onStart();
    });
  }

  // Loadout buttons on the start/result screen. `onPick(index)` selects one.
  buildLoadouts(onPick) {
    CONFIG.loadouts.forEach((l, i) => {
      const b = document.createElement('button');
      b.innerHTML = `${i + 1} · ${l.name}<small>${CONFIG.weapons[l.primary].name} + ${CONFIG.weapons[l.secondary].name}</small>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); onPick(i); });
      this.el.loadouts.appendChild(b);
    });
  }

  selectLoadout(index) {
    [...this.el.loadouts.children].forEach((b, i) => b.classList.toggle('selected', i === index));
  }

  ready(onStart) {
    this.onStart = onStart;
    this.el.status.textContent = 'Click to play';
  }

  showResult(winner, score) {
    this.el.title.textContent = winner === 'draw' ? 'DRAW' : winner === 'green' ? 'VICTORY' : 'DEFEAT';
    this.el.sub.textContent = `Green ${score.green} – ${score.tan} Tan`;
    this.el.status.textContent = 'Click to play again';
    this.el.overlay.style.display = 'flex';
  }

  set(key, el, value, html = false, style = null) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    if (style) el.style[style] = value;
    else if (html) el.innerHTML = value;
    else el.textContent = value;
  }

  update({ weapon, player, rig, lighting, match, fps, nextLoadout }) {
    const e = this.el;
    this.set('ammo', e.ammo, `${weapon.reloading > 0 ? 'Reloading…' : `${weapon.ammo} / ${weapon.def.magazine}`}<small>${weapon.def.name} · ${weapon.loadout.name}</small>`, true);
    this.set('scope', e.scope, weapon.scoped ? 'block' : 'none', false, 'display');
    this.set('info', e.info, `${rig.thirdPerson ? 'Third person' : 'First person'} · ${lighting.isNight ? 'Night' : 'Day'} · ${fps} fps · K/D ${player.kills}/${player.deaths}`);
    this.set('score', e.score,
      `<span class="green">GREEN ${match.score.green}</span><span class="clock">${clock(match.timeLeft)}</span><span class="tan">${match.score.tan} TAN</span>`, true);
    this.set('feed', e.feed, match.feed.map((f) =>
      `<div><span class="${f.killerTeam}">${f.killer}</span> melted <span class="${f.victimTeam}">${f.victim}</span></div>`).join(''), true);

    let msg = '';
    if (match.playing && !player.alive) {
      const by = player.lastAttacker ? `Melted by ${player.lastAttacker.name}` : 'Melted';
      msg = `${by} · respawning in ${Math.max(1, Math.ceil(player.respawnIn))} as ${nextLoadout.name}`;
    } else if (match.playing && nextLoadout !== weapon.loadout) {
      msg = `${nextLoadout.name} on next spawn`;
    } else if (match.playing && player.nearClimb && !player.climbing) {
      msg = 'Hold forward to climb';
    }
    this.set('message', e.message, msg);

    e.health.style.width = `${Math.max(0, player.health)}%`;
    e.fuel.style.width = `${player.fuel * 100}%`;
    e.vignette.style.opacity = Math.max(player.hurtFlash * 0.8, player.alive ? (1 - player.health / 100) * 0.5 : 0.6);
    e.crosshair.classList.toggle('hit', weapon.hitFlash > 0);
    e.crosshair.style.visibility = player.alive && !weapon.scoped ? 'visible' : 'hidden';
  }
}
