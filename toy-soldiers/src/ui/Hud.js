const $ = (id) => document.getElementById(id);
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Hud {
  constructor() {
    this.el = {
      crosshair: $('crosshair'), ammo: $('ammo'), health: $('health'), fuel: $('fuel'),
      info: $('info'), scope: $('scope'), score: $('score'), feed: $('feed'), message: $('message'), vignette: $('vignette'),
    };
    this.last = {};
  }

  set(key, el, value, html = false, style = null) {
    if (this.last[key] === value) return;
    this.last[key] = value;
    if (style) el.style[style] = value;
    else if (html) el.innerHTML = value;
    else el.textContent = value;
  }

  update({ weapon, player, rig, lighting, match, fps, resolution, nextLoadout }) {
    const e = this.el;
    this.set('ammo', e.ammo, `${weapon.reloading > 0 ? 'Reloading…' : `${weapon.ammo} / ${weapon.def.magazine}`}<small>${weapon.def.name} · ${weapon.loadout.name}</small>`, true);
    this.set('scope', e.scope, weapon.scoped ? 'block' : 'none', false, 'display');
    this.set('info', e.info, `${rig.thirdPerson ? 'Third person' : 'First person'} · ${lighting.isNight ? 'Night' : 'Day'} · ${fps} fps · ${Math.round((resolution.scale / resolution.max) * 100)}% res · K/D ${player.kills}/${player.deaths}`);
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

    this.set('health', e.health, `${Math.round(Math.max(0, player.health))}%`, false, 'width');
    this.set('fuel', e.fuel, `${Math.round(player.fuel * 100)}%`, false, 'width');
    this.set('vignette', e.vignette, Math.max(player.hurtFlash * 0.8, player.alive ? (1 - player.health / 100) * 0.5 : 0.6).toFixed(2), false, 'opacity');
    e.crosshair.classList.toggle('hit', weapon.hitFlash > 0);
    this.set('cross', e.crosshair, player.alive && weapon.adsAmount < 0.5 ? 'visible' : 'hidden', false, 'visibility');
  }
}
