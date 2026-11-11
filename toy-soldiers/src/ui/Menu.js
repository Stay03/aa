import { CONFIG } from '../config.js';
import { SCHEMA } from '../core/Settings.js';

const $ = (id) => document.getElementById(id);

// Start, pause and result screens, the loadout picker and the settings form.
export class Menu {
  // `active` holds the values of reload-only settings as currently running.
  constructor(settings, handlers, active = {}) {
    this.settings = settings;
    this.active = active;
    this.handlers = handlers; // { onPlay, onResume, onRestart, onLoadout }
    this.mode = 'start';
    this.el = {
      overlay: $('overlay'), main: $('screen-main'), settingsScreen: $('screen-settings'),
      title: $('overlay-title'), sub: $('overlay-sub'), loadouts: $('loadouts'),
      play: $('btn-play'), restart: $('btn-restart'), settings: $('btn-settings'),
      form: $('settings-form'), back: $('btn-back'), defaults: $('btn-defaults'),
      reloadNote: $('reload-note'), reload: $('btn-reload'),
    };
    this.controls = {};

    this.el.play.addEventListener('click', () => (this.mode === 'pause' ? handlers.onResume() : handlers.onPlay()));
    this.el.restart.addEventListener('click', () => handlers.onRestart());
    this.el.settings.addEventListener('click', () => this.showSettings(true));
    this.el.back.addEventListener('click', () => this.showSettings(false));
    this.el.defaults.addEventListener('click', () => { settings.reset(); this.syncForm(); });
    this.el.reload.addEventListener('click', () => location.reload());

    CONFIG.loadouts.forEach((l, i) => {
      const b = document.createElement('button');
      b.innerHTML = `${i + 1} · ${l.name}<small>${CONFIG.weapons[l.primary].name} + ${CONFIG.weapons[l.secondary].name}</small>`;
      b.addEventListener('click', () => handlers.onLoadout(i));
      this.el.loadouts.appendChild(b);
    });
    this.buildForm();
  }

  get visible() { return this.el.overlay.style.display !== 'none'; }

  buildForm() {
    for (const field of SCHEMA) {
      const row = document.createElement('label');
      row.className = 'setting';
      const name = document.createElement('span');
      name.textContent = field.label;
      row.appendChild(name);

      let input, readout = null;
      if (field.options) {
        input = document.createElement('select');
        field.options.forEach(([, text], i) => input.add(new Option(text, String(i))));
        input.addEventListener('change', () => {
          this.settings.set(field.key, field.options[Number(input.value)][0]);
          this.syncReloadNote();
        });
      } else if (field.toggle) {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.addEventListener('change', () => this.settings.set(field.key, input.checked));
      } else {
        input = document.createElement('input');
        input.type = 'range';
        input.min = field.min; input.max = field.max; input.step = field.step;
        readout = document.createElement('output');
        input.addEventListener('input', () => {
          this.settings.set(field.key, Number(input.value));
          readout.textContent = field.format(Number(input.value));
        });
      }
      row.appendChild(input);
      if (readout) row.appendChild(readout);
      this.el.form.appendChild(row);
      this.controls[field.key] = { field, input, readout };
    }
    this.syncForm();
  }

  // Push current setting values into the form (after load, reset, or a hotkey).
  syncForm() {
    for (const { field, input, readout } of Object.values(this.controls)) {
      const v = this.settings.get(field.key);
      if (field.options) input.value = String(field.options.findIndex(([value]) => value === v));
      else if (field.toggle) input.checked = v;
      else { input.value = v; readout.textContent = field.format(v); }
    }
    this.syncReloadNote();
  }

  // Offer a reload when a setting that needs one differs from what is running.
  syncReloadNote() {
    const pending = SCHEMA.some((f) => f.needsReload && this.settings.get(f.key) !== this.active[f.key]);
    this.el.reloadNote.hidden = !pending;
  }

  selectLoadout(index) {
    [...this.el.loadouts.children].forEach((b, i) => b.classList.toggle('selected', i === index));
  }

  showSettings(on) {
    if (on) this.syncForm();
    this.el.main.hidden = on;
    this.el.settingsScreen.hidden = !on;
  }

  // mode: 'start' | 'pause' | 'result'
  show(mode, { title, sub } = {}) {
    this.mode = mode;
    this.el.title.textContent = title ?? (mode === 'pause' ? 'PAUSED' : 'TOY SOLDIERS');
    this.el.sub.textContent = sub ?? `Team deathmatch · ${CONFIG.match.teamSize} v ${CONFIG.match.teamSize} · first to ${CONFIG.match.scoreLimit}`;
    this.el.play.textContent = mode === 'pause' ? 'Resume' : mode === 'result' ? 'Play again' : 'Play';
    this.el.play.disabled = false;
    this.el.restart.hidden = mode !== 'pause';
    this.showSettings(false);
    this.el.overlay.style.display = 'flex';
  }

  hide() {
    this.el.overlay.style.display = 'none';
  }
}
