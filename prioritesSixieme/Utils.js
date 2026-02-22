// Utils

function abs(n) {
  return n < 0 ? -n : n;
}

function gcd(a, b) {
  a = abs(a); b = abs(b);
  while (b) { let t = b; b = a % b; a = t; }
  return a;
}

function lcm(a, b) {
  return abs(a * b) / gcd(a, b);
}

function trunc(n) {
  // Retire la partie décimale sans appel à Math
  return n >= 0 ? n - (n % 1) : n - (n % 1);
}

function round(n) {
  const entier = trunc(n);
  const fraction = n - entier;
  return fraction >= 0.5 ? entier + 1 : entier;
}

function debugArbre(expr, depth = 0) {
  const indent = '  '.repeat(depth);
  if (!expr) {
    console.log(`${indent}[null ou undefined]`);
    return;
  }

  const type = expr.constructor?.name ?? '???';
  const nature = expr.getNature?.() ?? '??';
  const isAtome = expr.isAtome?.() ? '✓' : '✗';
  const str = expr.toString?.() ?? '[pas de toString]';

  let evalResult;
  let evalType = '';
  try {
    evalResult = expr.evaluer?.();
    evalType = evalResult?.constructor?.name ?? '???';
  } catch (e) {
    evalResult = `[ERREUR: ${e.message}]`;
    evalType = '⚠️';
  }

  console.log(`${indent}${type} | nature: ${nature} | Atome: ${isAtome} | ${str}`);
  console.log(`${indent}↳ evaluer → ${evalType} | ${evalResult?.toString?.() ?? evalResult}`);

  // Explorons les enfants
  if (Array.isArray(expr.termes)) {
    expr.termes.forEach(t => debugArbre(t, depth + 1));
  }
  if (Array.isArray(expr.facteurs)) {
    expr.facteurs.forEach(f => debugArbre(f, depth + 1));
  }
}



function avecMethodesListe(arr) {
  arr.ajouter = function (...valeurs) {
    for (const val of valeurs.flat()) {
      if (!this.includes(val)) this.push(val);
    }
    return this;
  };

  arr.enlever = function (...valeurs) {
    for (const val of valeurs.flat()) {
      let i;
      while ((i = this.indexOf(val)) >= 0) {
        this.splice(i, 1);
      }
    }
    return this;
  };

  arr.vider = function () {
    this.length = 0;
    return this;
  };

  return arr;
}

function avecMethodesDict(obj = {}) {
  obj.ajouter = function (cle, valeur) {
    this[cle] = valeur;
    return this;
  };

  obj.enlever = function (...cles) {
    for (const cle of cles.flat()) {
      delete this[cle];
    }
    return this;
  };

  obj.vider = function () {
    for (const cle in this) {
      if (Object.prototype.hasOwnProperty.call(this, cle)) {
        delete this[cle];
      }
    }
    return this;
  };
  
obj.estVide = function () {
  return Object.entries(this)
    .filter(([_, v]) => typeof v !== "function")
    .length === 0;
};

  return obj;
}

function estDans(valeur, liste1 = [], liste2 = []) {
  return liste1.includes(valeur) && liste2.includes(valeur);
}

// Erreur dédiée : permet d'identifier clairement une unité invalide
class UniteInvalideError extends Error {
  constructor(invalidUnits = [], message = "") {
    super(message || `Unités inconnues: ${invalidUnits.join(", ")}`);
    this.name = "UniteInvalideError";
    this.code = "UNITE_INVALIDE";
    this.invalidUnits = invalidUnits; // ex: ["xm", "s2"]
  }
}

function makeSeed(base, niveau, type, index) {
  // base est ta graine "globale"
  // niveau = "facile" | "moyen" | "difficile"
  // type = ex: "euclide", "somme", "produit"...
  // index = numéro de la question
  return `${base}:${niveau}:${type}:q${index}`;
}

