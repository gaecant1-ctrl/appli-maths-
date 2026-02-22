
let evalCount=0;
class Expression {
  constructor() {
  // déjà préparé par la sous-classe
    this.testEval();
    this.commentaire =null
  }



testEval(details = "") {
  evalCount++;
  //console.log(evalCount);
  if (evalCount > 10000) {
    console.warn(`⛔ Évaluation bloquée dans ${this.constructor.name} : ${EvalCount}`);
    return false;
  }
  return true;
}




  evaluer(opts={}) { return this; }

  evaluerPasAPas(opts = {}) { return this; }
  
  transformerSelonModeMixte(opts = {}) {
  return this; // Comportement par défaut : rien à transformer
}


  toString(opts = {}) { return ''; }

  toLatex(opts = {}) { return ''; }

  isAtome() { return false; }

  getNature() { return "Inconnue"; }
  
  // Dans la classe de base Expression
toJSON() {
  return {
    type: this.constructor.name,
    nature: this.getNature(),
    valeur: this.toString()
  };
}

}

Expression.evalCount = 0; // compteur de debug (comme dans ton exemple)

// ===== Atome =====

  
  class Atome extends Expression {
 // === Dans Atome ===
// === Dans Atome ===
static from(input, opts = {}) {
  let grandeur;
  if (input instanceof Grandeur) {
    grandeur = input;
  } else if (typeof input === "string") {
    grandeur = Atome.parser(input.trim())[0];
  } else {
    throw new Error("Input doit être une string ou une instance de Grandeur.");
  }

  // ✅ Validation toujours active, sans option
  Grandeur.validerUniteDict(grandeur.uniteDict, { throwOnError: true });

  switch (grandeur.nature) {
    case "Duree":   return new Duree(grandeur, opts);
    case "Prix":
    case "Monnaie": return new Prix(grandeur, opts);
    default:        return new Atome(grandeur, opts);
  }
}


constructor(input, base = {}) {
  super();

  if (typeof input === "string") {
    this.texte = input.trim();
    const pars = Atome.parser(this.texte);
    this.grandeur = pars[0];
    this.nombre   = pars[1];
    this.unite    = pars[2];
  } else if (input instanceof Grandeur) {
    this.grandeur = input;
    this.texte = input.toString(base).trim();
    const pars = Atome.parser(this.texte);
    this.nombre = pars[1];
    this.unite  = pars[2];
  } else {
    throw new Error("Atome doit être construit avec une string ou une instance de Grandeur.");
  }

  // ✅ Optionnel : 2e barrière (utile si on instancie Atome(grandeur) sans passer par from)
  if (base.strictUnits ?? true) {
    Grandeur.validerUniteDict(this.grandeur.uniteDict, { throwOnError: true });
  }

  this.instanceOptions = {
    affiche : base.affiche ?? true,
    parenthese: base.parenthese ?? false,
    parentheseObligatoire: base.parentheseObligatoire ?? null
  };
  this.nature = this.grandeur.nature;
}


  static parser(str) {
    str = str.trim();
    str = str.replace(/^(\d+(?:[.,]\d+)?(?:\/\d+)?)([a-zA-Z€])/u, '$1 $2');

    const [nombreStrRaw, ...unitePartsRaw] = str.split(/\s+/);
    const nombreStr = nombreStrRaw.trim();
    const uniteParts = unitePartsRaw.map(u => u.trim());
    const nombre = new Nombre(nombreStr);

    if (uniteParts.length === 0) {
      return [new Grandeur(nombre, {}), nombre, null];
    } else {
      const unite = uniteParts.join(' ');
      const dict = Atome.parseUniteTexte(unite);
      return [new Grandeur(nombre, dict), nombre, unite];
    }
  }

static parseUniteTexte(uniteStr) {
  if (typeof uniteStr !== "string") throw new Error("Unité attendue sous forme de chaîne");

  // Transformation simple : "m/s" → "m·s^-1"
  uniteStr = uniteStr.replace(/\s+/g, ''); // retirer les espaces
  if (uniteStr.includes('/')) {
    const [num, den] = uniteStr.split('/');
    uniteStr = num + '·' + den.split('·').map(u => u.includes('^') ? u.replace(/\^(\d+)/, '^-$1') : `${u}^-1`).join('·');
  }

  const dict = {};
  uniteStr.split('·').filter(Boolean).forEach(u => {
    const [sym, expStr] = u.split('^');
    const exp = expStr ? parseInt(expStr, 10) : 1;
    if (!sym || isNaN(exp)) return;
    dict[sym] = (dict[sym] || 0) + exp;
  });

  return dict;
}


  evaluer(opts) {

     return this;

  }

  evaluerPasAPas(opts) {
    const { modeMixte=null} = opts;
    if (!this.testEval()) return null;
    const unite = opts?.uniteCible ?? opts?.uniteOpe;
    if(unite){this.convertirSelonNature(unite,opts);}
    return this;
  }
  
  modeMixteCreerSomme(opts) {
    const atome=this;
  if (!atome.nombre.isFractionMixte()) return atome;

  const [entier, fraction] = atome.nombre.scinderMixte();
  const dict = atome.grandeur.uniteDict;

  const g1 = new Atome(new Grandeur(entier, dict), opts);
  const g2 = new Atome(new Grandeur(fraction, dict), opts);

  return new Somme([g1, g2], {
    parenthese: false,
    parentheseObligatoire: atome.instanceOptions.parentheseObligatoire,
    modeSomme: ["structure"]
  });
}


  transformerSelonModeMixte(opts) {

  const modeMixte = opts.modeMixte ?? null;
  if (modeMixte === "structure" && this.nombre.isFractionMixte()) {
    return this.modeMixteCreerSomme(opts); // méthode déjà prête
  }
  return this;
}


toString(opts) {
  const { modeMixte = null, parentheseObligatoire = null } = opts;
  const valeur = this.grandeur?.valeur;
  const unite = this.grandeur?.uniteDict;

  if (!(valeur instanceof Nombre)) throw new Error("Valeur non définie dans l'atome.");

  if (modeMixte === "affichage" && valeur.isFractionMixte()) {
    const [entier, fraction] = valeur.scinderMixte();
    const g1 = new Grandeur(entier, unite);
    const g2 = new Grandeur(fraction, unite);
    let s = `${g1.toString(opts)} + ${g2.toString(opts)}`;
    return (["produit", "quotient", "quotientDen", "quotientNum", "difference"].includes(parentheseObligatoire)) ? `(${s})` : s;
  }

  // ✅ Correction ici
  const uniteStr = this.unite?.toString?.(opts) ?? '';
  if(valeur.valeurNum.a<0) return `(${valeur.toLatex(opts)}\\,${uniteStr})`;
 
  return `${this.nombre.toString(opts)} ${uniteStr}`.trim();
}

toLatex(opts) {
  const { modeMixte = null, parentheseObligatoire = null } = opts;
  const valeur = this.grandeur?.valeur;
  const uniteDict = this.grandeur?.uniteDict;

  if (!(valeur instanceof Nombre)) {
    throw new Error("Valeur non définie dans l'atome.");
  }
  
  if(valeur.valeurNum.a<0)

  // 🧮 Cas "mode mixte"
  if (modeMixte === "affichage" && valeur.isFractionMixte()) {
    const [entier, fraction] = valeur.scinderMixte();
    const g1 = new Grandeur(entier, uniteDict);
    const g2 = new Grandeur(fraction, uniteDict);
    let s = `${g1.toLatex(opts)} + ${g2.toLatex(opts)}`;
    const encadrer = ["produit", "quotient", "quotientDen", "quotientNum", "difference"].includes(parentheseObligatoire);
    return encadrer ? `\\left(${s}\\right)` : s;
  }

  // 🧾 Cas normal
  const uniteStr = uniteDictToLatexInline(uniteDict);
  if(valeur.valeurNum.a<0) return `\\left(${valeur.toLatex(opts)}\\,${uniteStr}\\right)`;
  return `${valeur.toLatex(opts)}\\,${uniteStr}`;
}



// Dans Atome
checkEqual(other) {
    return (
      other instanceof Atome &&
      this.grandeur.valeur.equal(other.grandeur.valeur) &&
      Grandeur.unitesEgales(this.grandeur.uniteDict, other.grandeur.uniteDict)
    );
  }

equals(other) {
  if (!(other instanceof Atome)) return false;

  // Si tu veux exiger la même nature logique (ex: Prix vs Duree -> false), garde ceci :
  const n1 = this.getNature?.();
  const n2 = other.getNature?.();
  if (n1 !== n2) return false;

  // Égalité sémantique : compare après conversion en unités fondamentales
  return this.grandeur?.equals?.(other.grandeur) === true;
}

convertirEn(uniteTexte,opts) {

  const dictCible = Atome.parseUniteTexte(uniteTexte);
  if (!Grandeur.unitesEgales(this.grandeur.uniteDict, dictCible)) {
    try {
      const grandeurConvertie = this.grandeur.convertirEn(dictCible);
      return new this.constructor(grandeurConvertie,{});
    } catch (e) {
      console.warn("Conversion impossible :", e.message);
    }
  }
  return this;
}



convertirSelonNature(dico,opts) {
  const cible = dico[this.nature];
  //console.log("cible",cible);
  if (cible) {
    return this.convertirEn(cible,opts); // ✅ retourne bien
  }
  return this;
}



  isAtome() {
    return true;
  }

  getNature() {
    return this.nature || "Inconnue";
  }
  
  isScalaire() {
  return Grandeur.unitesEgales(this.grandeur?.uniteDict ?? {}, {});
}

isNombreEntier() {
  const { a, b } = this.nombre?.simplify()?.valeurNum ?? {};
  return b === 1;
}

isNombreFracInfUn() {
  const { a, b } = this.nombre?.simplify()?.valeurNum ?? {};
  return b > 1 && abs(a) < b;
}


  
  add(other,opts) {
    if (!(other instanceof Atome)) {
      throw new Error("Addition uniquement entre atomes.");
    }
    const g = this.grandeur.add(other.grandeur);
    return new Atome(g,{});
  }
  
    sub(other,opts) {
    if (!(other instanceof Atome)) {
      throw new Error("Addition uniquement entre atomes.");
    }
    const g = this.grandeur.sub(other.grandeur);
    //console.log("g",g);
    return new Atome(g,{});
  }

mul(other, opts) {
  if (!(other instanceof Atome)) {
    throw new Error("Multiplication uniquement entre atomes.");
  }

  const produit = this.grandeur.mul(other.grandeur);
  const isThisScalaire = Grandeur.unitesEgales(this.grandeur.uniteDict, {});
  const isOtherScalaire = Grandeur.unitesEgales(other.grandeur.uniteDict, {});

  // Cas scalaire × Duree → on veut une Duree
  if (isThisScalaire && other instanceof Duree) return new Duree(produit, opts);
  if (isOtherScalaire && this instanceof Duree) return new Duree(produit, opts);

  return new Atome(produit,{});
}

  div(other,opts) {
    if (!(other instanceof Atome)) {
      throw new Error("Division uniquement entre atomes.");
    }
    const quotient = this.grandeur.div(other.grandeur);
    return new Atome(quotient,{});
  }

toJSON() {
  return {
    type: "Atome",
    nature: this.getNature(),
    texte: this.texte,
    valeur: this.nombre?.toString(),
    unite: this.unite || this.grandeur?.uniteDict || null
  };
}

}

class Duree extends Atome {
  constructor(input, base) {
    super(input, base);
    this.instanceOptions = {
      affichage : base.affichage ?? "standard",
      parenthese: base.parenthese ?? false,
      parentheseObligatoire: base.parentheseObligatoire ?? false
    };
    this.nature = "Duree";
  }


formaterDureeParUnites(unites = ["h", "min", "s"]) {
  const conv = Grandeur.conversionTable.Duree.conversion;

  // Convertir l’objet en secondes via convertirEn()
  const enSecondes = this.convertirEn("s");
  let reste = enSecondes.grandeur.valeur; // Nombre

  const unitesTriees = [...unites].sort((a, b) => conv[b] - conv[a]);

  const result = [];

  for (let i = 0; i < unitesTriees.length; i++) {
    const u = unitesTriees[i];
    const facteur = conv[u];
    if (!facteur) throw new Error(`Unité inconnue : ${u}`);

    const nbUnit = reste.div(Nombre.fromParts(facteur));
    let valeurFinale;

    if (i < unitesTriees.length - 1) {
      const { a, b } = nbUnit.simplify().valeurNum;
      const entier = trunc(a / b);
      valeurFinale = Nombre.fromParts(entier, 1);
      reste = reste.sub(valeurFinale.mul(Nombre.fromParts(facteur)));
    } else {
      valeurFinale = nbUnit.simplify(); // dernière unité : conserver fraction
    }

    result.push({ unite: u, valeur: valeurFinale });
  }

  return result;
}


doitAfficherMixte(unites = ["h", "min", "s"]) {
  const composants = this.formaterDureeParUnites(unites);
  const visibles = composants.filter(c => !c.valeur.equal(Nombre.fromParts(0, 1)));
  return visibles.length > 0;
}



toString(opts = {}) {
  // ⚙️ Vérification dynamique du besoin d'affichage mixte
  const mixteMap = opts.affichageMixte ?? {};
  const affichageClasse = mixteMap["Duree"];

  // 💡 Forcer affichage mixte uniquement si pas déjà en modeMixte global
  if (affichageClasse && opts.modeMixte == null) {
    this.instanceOptions.affichage = "mixte";
  }

  const affichage = this.instanceOptions.affichage;

  // 🧩 Affichage mixte : décomposition par unités
  if (affichage === "mixte") {
    const unitesAffichage = affichageClasse ?? ["h", "min", "s"];
    const composants = this.formaterDureeParUnites(unitesAffichage);

    const morceaux = composants
      .filter(c => !c.valeur.equal(Nombre.fromParts(0, 1)))
      .map(c => `${c.valeur.toString(opts)} ${c.unite}`);

    const str = morceaux.join(" + ");

    const parentheseObligatoire = this.instanceOptions.parentheseObligatoire;
    const doitEncadrer = ["produit", "quotient", "quotientDen", "quotientNum", "differenceD"].includes(parentheseObligatoire);

    return doitEncadrer ? `(${str})` : str;
  }

  // 🧾 Affichage standard
  return super.toString(opts);
}



toLatex(opts = {}) {
  // ⚙️ Vérification dynamique du besoin d'affichage mixte
  const mixteMap = opts.affichageMixte ?? {};
  const affichageClasse = mixteMap["Duree"];

  // 💡 Forcer affichage mixte uniquement si pas déjà en modeMixte global
  if (affichageClasse && opts.modeMixte == null) {
    this.instanceOptions.affichage = "mixte";
  }

  const affichage = this.instanceOptions.affichage;

  // 🧩 Affichage mixte : décomposition par unités
  if (affichage === "mixte") {
    const unitesAffichage = affichageClasse ?? ["h", "min", "s"];
    const composants = this.formaterDureeParUnites(unitesAffichage);

    const morceaux = composants
      .filter(c => !c.valeur.equal(Nombre.fromParts(0, 1)))
      .map(c => `${c.valeur.toLatex(opts)}\\,\\text{${c.unite}}`);

    const str = morceaux.join(" + ");

    const parentheseObligatoire = this.instanceOptions.parentheseObligatoire;
    const doitEncadrer = ["produit", "quotient", "quotientDen", "quotientNum", "difference"].includes(parentheseObligatoire);

    return doitEncadrer ? `\\left(${str}\\right)` : str;
  }

  // 🧾 Affichage standard
  return super.toLatex(opts);
}





add(other, opts = {}) {
  if (!(other instanceof Duree)) {
    throw new Error("Addition uniquement entre durées.");
  }

  const somme = this.grandeur.add(other.grandeur);

  // 🛡️ Cas simple : on n’est pas en mode mixte → on ne touche à rien
  if (opts.modeMixte !== "duree") {
    return new Duree(somme, opts);
  }

  // 🎨 Cas mixte : on ajuste l'affichage selon les unités
  const unites1 = Object.keys(this.grandeur.uniteDict).sort().join(',');
  const unites2 = Object.keys(other.grandeur.uniteDict).sort().join(',');

  const affichage = (unites1 === unites2 && this.instanceOptions.affichage === "standard")
    ? "standard"
    : "mixte";

  return new Duree(somme, {
    ...opts,
    affichage
  });
}



sub(other, opts) {
  if (!(other instanceof Duree)) {
    throw new Error("Soustraction uniquement entre durées.");
  }
  const diff = this.grandeur.sub(other.grandeur);
  return new Duree(diff, opts);
}

mul(other, opts) {
  if (!(other instanceof Atome)) {
    throw new Error("Multiplication uniquement entre atomes.");
  }

  const produit = this.grandeur.mul(other.grandeur);
  const isScalaire = Grandeur.unitesEgales(other.grandeur.uniteDict, {});

  return isScalaire ? new Duree(produit, {}) : new Atome(produit, {});
}

div(other, opts ) {
  if (!(other instanceof Atome)) {
    throw new Error("Division uniquement entre atomes.");
  }

  const quotient = this.grandeur.div(other.grandeur);
  const isScalaire = Grandeur.unitesEgales(other.grandeur.uniteDict, {});

  return isScalaire ? new Duree(quotient, {}) : new Atome(quotient, {});
}


static preparerSomme(durees, opts = {}) {
  
  if (opts.modeMixte !== "duree") return durees;
  const unites = opts.affichageDuree ?? ["h", "min", "s"];

  const res=durees.flatMap(d => {
    if (!(d instanceof Duree)) return [d];

    const composants = d.formaterDureeParUnites(unites);
    const visibles = composants.filter(c => !c.valeur.equal(Nombre.fromParts(0, 1)));

    if (visibles.length > 1) {
      return visibles.map(({ unite, valeur }) => {
        const g = new Grandeur(valeur, { [unite]: 1 });
        return new Duree(g, { ...opts, affichage: "standard" });
      });
    }

    return [d];
  });
  return res;
}
}

// ===== Prix.js =====

class Prix extends Atome {
  constructor(input, base = {}) {
    super(input, base);
    this.instanceOptions = {
      affichage: base.affichage ?? "standard",
      parenthese: base.parenthese ?? false,
      parentheseObligatoire: base.parentheseObligatoire ?? null
    };
    this.nature = "Prix";
  }

  // Addition : entre deux prix uniquement
  add(other, opts = {}) {
    if (!(other instanceof Prix)) {
      throw new Error("Addition uniquement entre Prix.");
    }

    const somme = this.grandeur.add(other.grandeur);
    return new Prix(somme, opts);
  }

  // Soustraction : entre deux prix uniquement
  sub(other, opts = {}) {
    if (!(other instanceof Prix)) {
      throw new Error("Soustraction uniquement entre Prix.");
    }

    const diff = this.grandeur.sub(other.grandeur);
    return new Prix(diff, opts);
  }

  // Multiplication : uniquement par un scalaire
  mul(other, opts = {}) {
    if (!(other instanceof Atome)) {
      throw new Error("Multiplication uniquement avec un Atome.");
    }

    const isScalaire = Grandeur.unitesEgales(other.grandeur.uniteDict, {});
    if (!isScalaire) {
      throw new Error("Multiplication uniquement par un scalaire.");
    }

    const produit = this.grandeur.mul(other.grandeur);
    return new Prix(produit, opts);
  }

  // Division : uniquement par un scalaire
  div(other, opts = {}) {
    if (!(other instanceof Atome)) {
      throw new Error("Division uniquement avec un Atome.");
    }

    const isScalaire = Grandeur.unitesEgales(other.grandeur.uniteDict, {});
    if (!isScalaire) {
      throw new Error("Division uniquement par un scalaire.");
    }

    const quotient = this.grandeur.div(other.grandeur);
    return new Prix(quotient, opts);
  }

toLatex(opts = {}) {
  const valeurLatex = this.grandeur.valeur.toLatex(opts);
  const uniteLatex = uniteDictToLatexInline(this.grandeur.uniteDict) || '\\text{€}';
  return `${valeurLatex}\\,${uniteLatex}`;
}

toString(opts = {}) {
  const uniteTxt = afficheUnitesCollegien(this.grandeur.uniteDict) || '€';
  return `${this.grandeur.valeur.toString(opts)} ${uniteTxt}`.trim();
}


  static estPrix(grandeur) {
    if (!grandeur || !grandeur.uniteDict) return false;
    const unites = Object.keys(grandeur.uniteDict);
    return unites.length === 1 && unites[0] === "€";
  }

  static preparerSomme(prixList, opts = {}) {
    return prixList;
  }
}







