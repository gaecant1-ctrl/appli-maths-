
class Grandeur {
  constructor(valeur, uniteDict) {
    this.valeur = valeur; // instance de Nombre
    this.uniteDict = uniteDict;
  }
  
  get nature() {
  return Grandeur.reconnaitreNature(this.uniteDict);
}


  // === Opérations ===

  add(other) {
    const r1 = Grandeur.reduireUniteDict(this.uniteDict);
    const r2 = Grandeur.reduireUniteDict(other.uniteDict);

    if (!Grandeur.unitesEgales(r1.unite, r2.unite)) {
      throw new Error("Addition impossible : unités incompatibles");
    }

    const v1 = this.valeur.mul(r1.facteur);
    const v2 = other.valeur.mul(r2.facteur);
    const somme = v1.add(v2);

    return new Grandeur(somme.div(r1.facteur), this.uniteDict);
  }

  sub(other) {
    const r1 = Grandeur.reduireUniteDict(this.uniteDict);
    const r2 = Grandeur.reduireUniteDict(other.uniteDict);

    if (!Grandeur.unitesEgales(r1.unite, r2.unite)) {
      throw new Error("Soustraction impossible : unités incompatibles");
    }

    const v1 = this.valeur.mul(r1.facteur);
    const v2 = other.valeur.mul(r2.facteur);
    const diff = v1.sub(v2);

    return new Grandeur(diff.div(r1.facteur), this.uniteDict);
  }

  mul(other) {
    const newValeur = this.valeur.mul(other.valeur);
    const newUnite = Grandeur.combineUnites(this.uniteDict, other.uniteDict, +1);
    return new Grandeur(newValeur, newUnite);
  }

  div(other) {
    const newValeur = this.valeur.div(other.valeur);
    const newUnite = Grandeur.combineUnites(this.uniteDict, other.uniteDict, -1);
    return new Grandeur(newValeur, newUnite);
  }

// Dans Grandeur

    toFondamentales() {
      const red = Grandeur.reduireUniteDict(this.uniteDict);
      // valeur en unités fondamentales
      const valeurSI = this.valeur.mul(red.facteur).simplify?.() ?? this.valeur.mul(red.facteur);
      return { valeur: valeurSI, unite: red.unite };
    }
    
  // Dans Grandeur
equals(other, opts = {}) {
  if (!(other instanceof Grandeur)) return false;

  const { valeur: v1, unite: u1 } = this.toFondamentales();
  const { valeur: v2, unite: u2 } = other.toFondamentales();

  // mêmes unités *fondamentales* (ex: s, m, kg, € … avec exposants)
  if (!Grandeur.unitesEgales(u1, u2)) return false;

  // comparaison numérique (Nombre.equal de préférence)
  if (typeof v1.equal === "function") {
    return v1.equal(v2);
  }
  // fallback strict si pas de Nombre.equal
  return String(v1) === String(v2);
}


  convertirEn(uniteDictCible) {

    const r1 = Grandeur.reduireUniteDict(this.uniteDict);
    const r2 = Grandeur.reduireUniteDict(uniteDictCible);

    if (!Grandeur.unitesEgales(r1.unite, r2.unite)) {
      throw new Error("Conversion impossible : unités incompatibles");
    }

    const valeurSI = this.valeur.mul(r1.facteur);
    const valeurCible = valeurSI.div(r2.facteur).simplify();
    return new Grandeur(valeurCible, uniteDictCible);
  }

  reduire() {
    const red = Grandeur.reduireUniteDict(this.uniteDict);
    const valeur = this.valeur.mul(red.facteur);
    const unite = red.unite;
    return new Grandeur(valeur,unite);
  }

toString(opts = {}) {
  const { autoReduce = false } = opts;
  let grandeur = this;
  if (autoReduce) {
    grandeur = this.reduire();
  }
  return `${grandeur.valeur.toString(opts)} ${afficheUnitesCollegien(grandeur.uniteDict)}`;
}

toLatex(opts = {}) {
  const { autoReduce = false } = opts;
  let valeur = this.valeur;
  let unite = this.uniteDict;

  if (autoReduce) {
    const red = Grandeur.reduireUniteDict(unite);
    valeur = valeur.mul(red.facteur);
    unite = red.unite;
  }

  const valLatex = valeur.toLatex(opts);
const uniteLatex = uniteDictToLatexInline(unite);
return `${valLatex}\\,${uniteLatex}`;

}


  // === Static members ===

  static conversionTable = {}; // à définir globalement

  static combineUnites(u1, u2, signe = 1) {
    const res = { ...u1 };
    for (const [k, v] of Object.entries(u2)) {
      res[k] = (res[k] || 0) + signe * v;
      if (res[k] === 0) delete res[k];
    }
    return res;
  }

  static unitesEgales(a, b) {
    const ka = Object.keys(a).filter(k => a[k] !== 0);
    const kb = Object.keys(b).filter(k => b[k] !== 0);
    if (ka.length !== kb.length) return false;
    return ka.every(k => b.hasOwnProperty(k) && a[k] === b[k]);
  }

  static reduireUniteDict(uniteDict) {
    const table = Grandeur.conversionTable;
    const resultat = {};
    let facteurGlobal = new Nombre("1");

    for (const [unite, exposant] of Object.entries(uniteDict)) {
      if (exposant === 0) continue;
      let trouve = false;

      for (const type in table) {
        const { conversion, uniteFondamentale } = table[type];
        if (conversion.hasOwnProperty(unite)) {
          const facteur = new Nombre(conversion[unite].toString());
          const facteurExposant = facteur.pow(exposant);
          facteurGlobal = facteurGlobal.mul(facteurExposant);
          resultat[uniteFondamentale] = (resultat[uniteFondamentale] || 0) + exposant;
          trouve = true;
          break;
        }
      }

      if (!trouve) {
        resultat[unite] = (resultat[unite] || 0) + exposant;
      }
    }

    for (const u in resultat) {
      if (resultat[u] === 0) delete resultat[u];
    }

    return {
      unite: resultat,
      facteur: facteurGlobal
    };
  }
  
static reconnaitreNature(uniteDict) {
  const reduction = this.reduireUniteDict(uniteDict);
  const uniteReduite = reduction.unite;
  
    if (Object.keys(uniteReduite).length === 0) {
    return "Scalaire";
  }
  
  for (const nom in this.profilsPhysiques) {
    if (this.unitesEgales(uniteReduite, this.profilsPhysiques[nom])) {
      return nom;
    }
  }

  return "Inconnue";
}




static getUniteExtreme(nature, unites, mode = "plusPetite") {
  const convTab = Grandeur.conversionTable[nature];
  if (!convTab) return null;
  const conversions = convTab.conversion;

  let uniteExtreme = null;
  let facteurExtreme = mode === "plusPetite" ? Infinity : -Infinity;

  for (const u of unites) {
    const facteur = conversions[u];
    if (facteur === undefined) continue;

    if ((mode === "plusPetite" && facteur < facteurExtreme) ||
        (mode === "plusGrande" && facteur > facteurExtreme)) {
      facteurExtreme = facteur;
      uniteExtreme = u;
    }
  }

  if (!uniteExtreme) return null;
  return { nature, unite: uniteExtreme };
}

static getNatureFromUnite(unite) {
  for (const [nature, data] of Object.entries(this.conversionTable)) {
    if (data.conversion.hasOwnProperty(unite)) {
      return nature;
    }
  }
  return null; // ou "Inconnue"
}

// === Dans Grandeur ===
static _validUnitSet = null;

static _buildValidUnitSet() {
  const set = new Set();
  for (const [, data] of Object.entries(this.conversionTable)) {
    if (data.uniteFondamentale) set.add(data.uniteFondamentale);
    for (const k of Object.keys(data.conversion || {})) set.add(k);
  }
  return set;
}

static getValidUnitSet() {
  if (!this._validUnitSet) this._validUnitSet = this._buildValidUnitSet();
  return this._validUnitSet;
}

static validerUniteDict(uniteDict = {}, { throwOnError = true } = {}) {
  const valid = this.getValidUnitSet();
  const invalid = Object.keys(uniteDict)
    .filter(k => uniteDict[k] !== 0)
    .filter(k => !valid.has(k));

  if (invalid.length && throwOnError) {
    // ⚠️ on jette une erreur typée, facile à reconnaître
    throw new UniteInvalideError(
      invalid,
      `Unité${invalid.length>1?'s':''} inconnue${invalid.length>1?'s':''}: ${invalid.join(", ")}`
    );
  }

  return { ok: invalid.length === 0, invalid, validSet: Array.from(valid) };
}


}


Grandeur.conversionTable = {
  Longueur: {
    uniteFondamentale: "m",
    conversion: {
      mm: 0.001,
      cm: 0.01,
      dm: 0.1,
      m: 1,
      dam: 10,
      hm: 100,
      km: 1000
    }
  },
  Duree: {
    uniteFondamentale: "s",
    conversion: {
      s: 1,
      min: 60,
      h: 3600,
      j: 86400
    }
  },  
  Masse: {
    uniteFondamentale: "kg",
    conversion: {
      mg: 0.000001,
      cg: 0.00001,
      dg: 0.0001,
      g: 0.001,
      dag: 0.01,
      hg: 0.1,
      kg: 1,
      t: 1000
    }
  },
  Capacite: {
    uniteFondamentale: "L",
    conversion: {
      mL: 0.001,
      cL: 0.01,
      dL: 0.1,
      L: 1,
      daL: 10,
      hL: 100
    }
  },
  Prix: {
    uniteFondamentale: "€",
    conversion: {
      "c€": 0.01,
      "€": 1,
      "k€": 1000
    }
  }
};


Grandeur.profilsPhysiques = {
  Longueur:   { m: 1 },
  Surface:    { m: 2 },
  Volume:     { m: 3 },
  Capacite:   { L: 1 },
  Duree:      { s: 1 },
  Vitesse:    { m: 1, s: -1 },
  Accélération: { m: 1, s: -2 },
  Masse:      { kg: 1 },
  Prix: {"€" : 1},
  MasseVolumique : {kg : 1, m:-3}
  
};



function afficheUnitesCollegien(uniteDict) {
  const num = [];
  const den = [];

  for (const [u, exp] of Object.entries(uniteDict)) {
    if (exp > 0) {
      num.push(exp === 1 ? u : `${u}^${exp}`);
    } else if (exp < 0) {
      const e = Math.abs(exp);
      den.push(e === 1 ? u : `${u}^${e}`);
    }
  }

  if (num.length === 0 && den.length === 0) return "";

  return den.length === 0
    ? num.join("·")
    : `${num.join("·")} / ${den.join("·")}`;
}


function uniteDictToLatexFraction(uniteDict) {
  const num = [];
  const den = [];

  for (const [u, exp] of Object.entries(uniteDict)) {
    const base = `\\text{${u}}`;
    if (exp > 0) {
      num.push(exp === 1 ? base : `${base}^{${exp}}`);
    } else if (exp < 0) {
      const e = Math.abs(exp);
      den.push(e === 1 ? base : `${base}^{${e}}`);
    }
  }

  if (num.length === 0 && den.length === 0) return "";

  if (den.length === 0) {
    return num.join("\\cdot ");
  } else {
    return `\\frac{${num.join("\\cdot ")}}{${den.join("\\cdot ")}}`;
  }
}


function uniteDictToLatexInline(uniteDict = {}) {
  const num = [];
  const den = [];

  for (const [u, exp] of Object.entries(uniteDict)) {
    const unit = `\\text{${u}}`;
    if (exp > 0) {
      num.push(exp === 1 ? unit : `${unit}^{${exp}}`);
    } else if (exp < 0) {
      const absExp = Math.abs(exp);
      den.push(absExp === 1 ? unit : `${unit}^{${absExp}}`);
    }
  }

  if (num.length === 0 && den.length === 0) return "";

  const numerator = num.join("~");
  const denominator = den.join("~");

  return den.length ? `${numerator} / ${denominator}` : numerator;
}



console.log("Expression Chargée");


