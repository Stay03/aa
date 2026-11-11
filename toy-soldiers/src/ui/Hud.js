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

  // True when any of the values differ from the last call with this key.
  changed(key, ...values) {
    const prev = this.last[key];
    let same = !!prev && prev.length === values.length;
    for (let i = 0; same && i < values.length; i++) same = prev[i] === values[i];
    if (!same) this.last[key] = values;
    return !same;
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
    // Build strings only when what they show has changed.
    const ammoKey = weapon.reloading > 0 ? -1 : weapon.ammo;
    if (this.changed('ammoKey', ammoKey, weapon.def, weapon.loadout)) {
      e.ammo.innerHTML = `${ammoKey < 0 ? 'Reloading…' : `${weapon.ammo} / ${weapon.def.magazine}`}<small>${weapon.def.name} · ${weapon.loadout.name}</small>`;
    }
    const res = Math.round((resolution.scale / resolution.max) * 100);
    if (this.changed('infoKey', rig.thirdPerson, lighting.isNight, fps, res, player.kills, player.deaths)) {
      e.info.textContent = `${rig.thirdPerson ? 'Third person' : 'First person'} · ${lighting.isNight ? 'Night' : 'Day'} · ${fps} fps · ${res}% res · K/D ${player.kills}/${player.deaths}`;
    }
    if (this.changed('scoreKey', match.score.green, match.score.tan, Math.floor(match.timeLeft))) {
      e.score.innerHTML = `<span class="green">GREEN ${match.score.green}</span><span class="clock">${clock(match.timeLeft)}</span><span class="tan">${match.score.tan} TAN</span>`;
    }
    if (this.changed('feedKey', match.feed.length, match.feed[0])) {
      e.feed.innerHTML = match.feed.map((f) =>
        `<div><span class="${f.killerTeam}">${f.killer}</span> melted <span class="${f.victimTeam}">${f.victim}</span></div>`).join('');
    }
    this.set('scope', e.scope, weapon.scoped ? 'block' : 'none', false, 'display');

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

    // Bars scale with a transform: no layout, handled by the compositor.
    this.set('health', e.health, `scaleX(${(Math.max(0, player.health) / 100).toFixed(2)})`, false, 'transform');
    this.set('fuel', e.fuel, `scaleX(${player.fuel.toFixed(2)})`, false, 'transform');
    this.set('vignette', e.vignette, Math.max(player.hurtFlash * 0.8, player.alive ? (1 - player.health / 100) * 0.5 : 0.6).toFixed(1), false, 'opacity');
    e.crosshair.classList.toggle('hit', weapon.hitFlash > 0);
    this.set('cross', e.crosshair, player.alive && weapon.adsAmount < 0.5 ? 'visible' : 'hidden', false, 'visibility');
  }
}
