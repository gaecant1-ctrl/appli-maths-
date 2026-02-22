// Niveau.js — version <select> avec montage tardif (alignée au CSS)
class Niveau {
  static _uid = 0;

  constructor({ mount = null, levels, defaultKey } = {}) {
    this.levels = levels || { facile:"Facile", moyen:"Moyen", difficile:"Difficile" };
    this.value  = (defaultKey && this.levels[defaultKey]) ? defaultKey : Object.keys(this.levels)[0];
    this.el = null;        // défini au render
    this.selectEl = null;

    if (mount) this.renderInto(mount); // on peut aussi monter plus tard
  }

  renderInto(mount) {
    this.el = mount;              // on suppose un <div> valide
    this.el.innerHTML = '';       // reset

    const id = `niveau-select-${Niveau._uid++}`;

    const wrapper = document.createElement('div');
    wrapper.className = 'niveau-picker';   // <-- important pour le style 160x40

    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = 'Niveau : ';

    const sel = document.createElement('select');
    sel.id = id;
    sel.name = 'niveau';

    for (const [key, text] of Object.entries(this.levels)) {
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = text;
      if (key === this.value) opt.selected = true;
      sel.appendChild(opt);
    }

    sel.addEventListener('change', () => { this.value = sel.value; });

    wrapper.appendChild(label);
    wrapper.appendChild(sel);
    this.el.appendChild(wrapper);
    this.selectEl = sel;
  }

  getKey(){ return this.value; }
  

}

window.Niveau = Niveau;
