const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.el = {
      crosshair: $('crosshair'), ammo: $('ammo'), health: $('health'), fuel: $('fuel'),
      info: $('info'), score: $('score'), overlay: $('overlay'), status: $('overlay-status'),
    };
    this.last = '';
  }

  ready(onStart) {
    this.el.status.textContent = 'Click to play';
    this.el.overlay.addEventListener('click', () => {
      this.el.overlay.style.display = 'none';
      onStart();
    });
  }

  update({ weapon, player, rig, lighting, fps }) {
    const ammo = weapon.reloading > 0 ? 'Reloading…' : `${weapon.ammo} / ∞`;
    const info = `${rig.thirdPerson ? 'Third person' : 'First person'} · ${lighting.isNight ? 'Night' : 'Day'} · ${fps} fps`;
    const key = `${ammo}|${info}|${weapon.kills}`;
    if (key !== this.last) {
      this.last = key;
      this.el.ammo.textContent = ammo;
      this.el.info.textContent = info;
      this.el.score.textContent = `Tan soldiers melted: ${weapon.kills}`;
    }
    this.el.health.style.width = `${player.health}%`;
    this.el.fuel.style.width = `${player.fuel * 100}%`;
    this.el.crosshair.classList.toggle('hit', weapon.hitFlash > 0);
  }
}
