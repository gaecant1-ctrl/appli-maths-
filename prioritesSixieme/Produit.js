class Produit extends Expression {
  constructor(facteurs = [], base = {}) {
    super();
    this.facteurs=facteurs;
    this.instanceOptions = {
      parenthese: base.parenthese ?? false,
      parentheseObligatoire: base.parentheseObligatoire ?? null,
      affiche: base.affiche ?? true
    };
    this.nature = this.deduireNature();
  }

static simplifierSiUnFacteur(facteurs, opts = new Options()) {
  if (facteurs.length === 1) {
    return facteurs[0]; // ne rien toucher
  }
  return new Produit(facteurs, opts);
}


  deduireNature() {
    try {
      const valeur = this.evaluer({});
      return valeur?.nature || null;
    } catch (e) {
      console.warn("Impossible de déduire la nature par évaluation :", e.message);
      return null;
    }
  }

toString(opts ) {
 
  // Construire la chaîne des facteurs
  const str = this.facteurs.map(t => {
    t.instanceOptions.parentheseObligatoire="produit";
    return t.toString(opts);
  }).join(" × ");

  // Parenthésage du produit global si nécessaire
  const parentheseObligatoire = this.instanceOptions.parentheseObligatoire;
  const parenthese = this.instanceOptions.parenthese;
  if ([ "quotientDen"].includes(parentheseObligatoire)|| parenthese === true) {
    return `(${str})`;
  }

  return str;
}


toLatex(opts) {

  // Construire la chaîne des facteurs

  const latex = this.facteurs.map(t => {
    t.instanceOptions.parentheseObligatoire="produit";
    return t.toLatex(opts);
  }).join(" × ");

  // Parenthésage du produit global si nécessaire
  const parentheseObligatoire = this.instanceOptions.parentheseObligatoire;
  const parenthese = this.instanceOptions.parenthese;
  if ([ "quotientDen"].includes(parentheseObligatoire)|| parenthese === true) {
    return `(${latex})`;
  }

  return latex;
}

 getPlusPetiteUniteAuto() {
  // 1. Filtrer les termes avec grandeur valide
  const facteursGrandeur = this.facteurs.filter(t => t.grandeur && t.grandeur.uniteDict);
  if (facteursGrandeur.length === 0) return null;

  // 2. Récupérer la nature de la première grandeur
  const nature = facteursGrandeur[0].grandeur.nature;
  const convTab = Grandeur.conversionTable[nature];
  if (!convTab) return null;

  // 3. Récupérer la liste unique des unités présentes
  const unites = Array.from(new Set(
    facteursGrandeur.flatMap(t => Object.keys(t.grandeur.uniteDict))
  ));

  // 4. Appeler la méthode statique pour récupérer la plus petite unité
  return Grandeur.getUniteExtreme(nature, unites, "plusPetite");
}



aplatir(opts) { console.log("aplatirP");
  if (!this.testEval()) return null;
    const plats = [];
    for (let t of this.facteurs) {
      if (t instanceof Produit) {
        plats.push(...t.aplatir(opts).facteurs);
      } else {
        plats.push(t);
      }
    }
    return Produit.simplifierSiUnFacteur(plats, {
      parenthese: this.instanceOptions.parenthese,
      parentheseObligatoire: this.instanceOptions.parentheseObligatoire
     });
  }


regrouper(opts) { console.log("regrouperP");
  if (!this.testEval("regrouper")) return null;
  
  if (
    this.facteurs.length === 2 &&
    this.facteurs[0] instanceof Atome &&
    this.facteurs[0].isScalaire?.() &&
    !(this.facteurs[1].isScalaire?.())
  ) {
    return this; // pas besoin de regroupement
  }

  // Préparer les groupes par nature
  const groupes = new Map();

  for (const facteur of this.facteurs) {
    let nature = "Autre";

    if (facteur instanceof Atome) {
      nature = facteur.isScalaire?.() ? "Scalaire" : (facteur.nature || "Inconnue");
    }

    if (!groupes.has(nature)) groupes.set(nature, []);
    groupes.get(nature).push(facteur);
  }

  // Construire l'ordre d'affichage : Scalaire d'abord, puis natures triées, puis Autre
  const ordre = [
    "Scalaire",
    ...[...groupes.keys()]
      .filter(n => n !== "Scalaire" && n !== "Autre")
      .sort(),
    "Autre"
  ];

  // Options à transmettre aux sous-produits
  const base = {parenthese:true};
    


  // Créer les blocs regroupés
  const sousProduits = ordre.map(nature => {
    const facteurs = groupes.get(nature);
    if (!facteurs || facteurs.length === 0) return null;
    return Produit.simplifierSiUnFacteur(facteurs, base);
  }).filter(Boolean); // filtre les nulls

  // Si aucun changement par rapport à l’original, retourner l'objet courant
     const regroupement = Produit.simplifierSiUnFacteur(sousProduits, {
        parenthese: this.instanceOptions.parenthese,
        parentheseObligatoire: this.instanceOptions.parentheseObligatoire,
        affiche: (opts.modeProduit.includes("regrAff")) ? true:false
      });

      return regroupement;
  
}


convertir(opts) {
  console.log("convertirP");

  if (!this.isFacteurSimple(opts)) {
    console.log("Pas facteur simple, retour this");
    return this;
  }

  let uniteOpe = opts.uniteOpe || opts.uniteBase;
  console.log("uniteOpe:", uniteOpe);

  const facteursConvertis = this.facteurs.map((facteur, idx) => {
    console.log(`Facteur #${idx}`, facteur);

    if (!facteur.grandeur) {
      console.log("Facteur sans grandeur, retour tel quel");
      return facteur;
    }

    if (typeof facteur.convertirSelonNature !== "function") {
      console.log("Facteur sans méthode convertirSelonNature, retour tel quel");
      return facteur;
    }

    let uniteCibleParNature = {};

    for (const unite of Object.keys(facteur.grandeur.uniteDict)) {
      const nature = Grandeur.getNatureFromUnite(unite);
      console.log(`Unité dans facteur: ${unite}, nature: ${nature}`);

      if (uniteOpe && uniteOpe[nature]) {
        uniteCibleParNature[nature] = uniteOpe[nature];
        console.log(`Conversion prévue pour nature '${nature}' vers unité '${uniteOpe[nature]}'`);
      }
    }

    if (Object.keys(uniteCibleParNature).length === 0) {
      console.log("Aucune conversion applicable, retour facteur");
      return facteur;
    }

    console.log("Appel convertirSelonNature avec:", uniteCibleParNature, opts);
    const converti = facteur.convertirSelonNature(uniteCibleParNature, opts);
    console.log("Résultat conversion:", converti);

    return converti;
  });

  console.log("Facteurs convertis:", facteursConvertis);

  const simplifie = Produit.simplifierSiUnFacteur(facteursConvertis, {
    affiche: true,
    parenthese: this.instanceOptions.parenthese,
    parentheseObligatoire: this.instanceOptions.parentheseObligatoire
  });

  console.log("Produit simplifié:", simplifie);

  return simplifie;
}



evaluer(opts) {console.log("evaluerP");
  if (!this.testEval()) return null;

    const valeurs = this.facteurs.map(f => f.evaluer(opts));
    if (!valeurs.every(v => v.isAtome?.())) {
      throw new Error("evaluer: tous les facteurs doivent être des atomes");
    }
    return valeurs.reduce((acc, val) => acc.mul(val, opts));
  }

evaluerUnFacteur(opts) {
  if (!this.testEval()) return null;

  for (let i = 0; i < this.facteurs.length; i++) {
    const t = this.facteurs[i];
    if (typeof t.isAtome === "function" && !t.isAtome()) {
      const etape = t.evaluerParEtape?.(opts) ?? t.evaluer?.(opts);
      if (!t.checkEqual?.(etape)) {
        const clone = [...this.facteurs];
        clone[i] = etape;
        const nouveauProduit = new Produit(clone, {
          ...this.instanceOptions
        });
        nouveauProduit.commentaire = `évaluation du terme ${i + 1}`;
        return nouveauProduit;
      }
    }
  }

  // Si aucun sous-terme n’est évalué, retourner l’évaluation globale
  return this.evaluer(opts);
}

evaluerSousFacteurs(opts) { console.log("evaluerSousFacteursP");
if (!this.testEval()) return null;
  if(!this.isFacteurSimple()){
    const nouveauxFacteurs = [];
    for (let i = 0; i < this.facteurs.length; i++) {
      const facteur = this.facteurs[i];
      const etape = facteur.evaluerPasAPas(opts);
      nouveauxFacteurs.push(etape);
    }
  
    const produit=new Produit(nouveauxFacteurs, {
          parenthese: this.instanceOptions.parenthese,
          parentheseObligatoire: this.instanceOptions.parentheseObligatoire
        });
    return produit;
        
  }
    return this;
}

distribuerSiPossible(opts) {
  // Si on a plus de deux facteurs, la distribution n'est pas possible (on suppose que c'est une situation de produit de 2 facteurs)
  if (this.facteurs.length !== 2) return this;

  const [f1, f2] = this.facteurs;

  // Cas : f1 est une Somme → distribuer à gauche
  if (f1 instanceof Somme) {
    const nouveauxTermes = f1.termes.map(t => Produit.simplifierSiUnFacteur([t, f2], {}));
    let result = new Somme(nouveauxTermes,{
          parenthese: this.instanceOptions.parenthese,
          parentheseObligatoire: this.instanceOptions.parentheseObligatoire
       
    }
    );


    return result;
  }

  // Cas : f2 est une Somme → distribuer à droite
  if (f2 instanceof Somme) {
    const nouveauxTermes = f2.termes.map(t => Produit.simplifierSiUnFacteur([f1, t], {}));
    let result = new Somme(nouveauxTermes ,{
          parenthese: this.instanceOptions.parenthese,
          parentheseObligatoire: this.instanceOptions.parentheseObligatoire
       
    }
    );


    return result;
  }

  // Cas : f1 est une Différence → distribuer à gauche
  if (f1 instanceof Difference) {
    const gauche = Produit.simplifierSiUnFacteur([f1.termes[0], f2], opts);
    const droite = Produit.simplifierSiUnFacteur([f1.termes[1], f2], opts);
    return new Difference([gauche, droite],{
          parenthese: this.instanceOptions.parenthese,
          parentheseObligatoire: this.instanceOptions.parentheseObligatoire
       
    });
  }

  // Cas : f2 est une Différence → distribuer à droite
  if (f2 instanceof Difference) {
    const gauche = Produit.simplifierSiUnFacteur([f1, f2.termes[0]], opts);
    const droite = Produit.simplifierSiUnFacteur([f1, f2.termes[1]], opts);
    return new Difference([gauche, droite],{
          parenthese: this.instanceOptions.parenthese,
          parentheseObligatoire: this.instanceOptions.parentheseObligatoire
       
    });
  }

  // Sinon, il n'y a rien à distribuer, on retourne simplement le produit
  return this;
}


enchainer(opts){ console.log("enchainerP");
    if (!this.testEval()) return null;
    const [g1, g2, ...reste] = this.facteurs;
    if(!g1.isAtome()){
      return Produit.simplifierSiUnFacteur([g1.evaluerParEtape(opts),g2,...reste],{
            parenthese: this.instanceOptions.parenthese,
            parentheseObligatoire: this.instanceOptions.parentheseObligatoire
      });
      }
    if(!g2.isAtome()){
      return Produit.simplifierSiUnFacteur([g1,g2.evaluerParEtape(opts),...reste],{
            parenthese: this.instanceOptions.parenthese,
            parentheseObligatoire: this.instanceOptions.parentheseObligatoire
      });
      }

    else{
      const multiplication = g1.mul(g2,opts);
      const resteFacteurs = [multiplication, ...reste];
      return Produit.simplifierSiUnFacteur(resteFacteurs, {
            parenthese: this.instanceOptions.parenthese,
            parentheseObligatoire: this.instanceOptions.parentheseObligatoire
      });
    }
   
 }


evaluerPasAPas(opts) {

  if (!this.testEval()) return null;


 const facteurs = this.facteurs;
 let regle="";
 if (opts.regles?.at(-1)?.at(-1) === "P") {
    regle = opts.regles.pop();
}


  let moi=this;
  const doitFaire = (obj,valeur) => regle===valeur;
  
  if(doitFaire(moi,"aplatirP")) 
    { const res= moi.aplatir(opts);
    if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }

   if (doitFaire(moi,"regrouperP")) {
      const res = moi.regrouper(opts);
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }

  if(this.isFacteurSimple()){
 

    if (doitFaire(moi,"convertirP")) {
      const res = moi.convertir(opts); 
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }
    
    if (doitFaire(moi,"directP")) {
      
      const res = moi.evaluer(opts);
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }
    
    if (doitFaire(moi,"directUnP")){ 
      const res = moi.enchainer(opts);
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }
    
    if (doitFaire(moi,"gdP")){ 
      const res = moi.enchainer(opts);
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }
  }
  
  if (doitFaire(moi,"distribuerP")) {
      const res = moi.distribuerSiPossible(opts);
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }

  if (doitFaire(moi,"directP")){
      const res = moi.evaluerSousFacteurs(opts); 
      if (!moi.checkEqual(res)){return res;}else{moi=res;}

  }
  
    if (doitFaire(moi,"directUnP")){
      const res = moi.evaluerUnFacteur(opts); 
      if (!moi.checkEqual(res)){return res;}else{moi=res;}

  }
  
  if (doitFaire(moi,"gdP")){
      const res = moi.enchainer(opts); 
      if (!moi.checkEqual(res)){return res;}else{moi=res;}

  }
  
    if(!regle==""){opts.regles.push(regle);}
  //par défaut;
    if (this.isFacteurSimple()) {
      return moi.evaluer(opts);
      }
     else {
      return moi.evaluerSousFacteurs(opts);
    }
  

if (mode.includes("distributive") && !mode.includes("direct")) {
  console.log("distribuerP");
  const distribue = this.distribuerSiPossible(opts);
  distribue.instanceOptions.removeFromList("modeProduit", "distributive")
    .removeFromList("modeProduit", "distribAff");
  return mode.includes("distribAff") ? distribue : null;
}


  }
 checkEqual(other) {
  if (!(other instanceof Produit)) return false;
  if (this.facteurs.length !== other.facteurs.length) return false;

  for (let i = 0; i < this.facteurs.length; i++) {
    const f1 = this.facteurs[i];
    const f2 = other.facteurs[i];

    // Si un des deux n’a pas de checkEqual, considérer qu’ils ne sont pas égaux
    if (typeof f1.checkEqual !== "function" || typeof f2.checkEqual !== "function") {
      return false;
    }

    if (!f1.checkEqual(f2)) return false;
  }

  return true;
}




  isFacteurSimple(opts) {
    return this.facteurs.every(f => typeof f.isAtome === "function" && f.isAtome());
  }

  getNature() { return this.nature; }

  toJSON() {
    return {
      type: "Produit",
      nature: this.getNature(),
      facteurs: this.facteurs.map(f => f.toJSON())
    };
  }
}


class Quotient extends Expression {
  // Compat : ([num, den], base) OU (num, den, base)
  constructor(arg1 = [], arg2 = {}, arg3) {
    super();

    let termes, base;
    if (Array.isArray(arg1)) {
      termes = arg1;
      base = arg2 || {};
    } else {
      // ancien style : new Quotient(num, den, base)
      const numerateur = arg1;
      const denominateur = arg2;
      base = arg3 || {};
      termes = [numerateur, denominateur];
    }

    if (!Array.isArray(termes) || termes.length !== 2) {
      throw new Error("Quotient: il faut exactement deux termes [numerateur, denominateur].");
    }
    if (!termes[0] || !termes[1]) {
      throw new Error("Quotient: numérateur et dénominateur doivent être définis.");
    }

    this.termes = termes; // [num, den]

    this.instanceOptions = {
      parenthese: base.parenthese ?? false,
      parentheseObligatoire: base.parentheseObligatoire ?? null,
      affiche: base.affiche ?? true
    };

    this.nature = this.deduireNature();
  }

  // --- utilitaires ---
  static simplifierSiTrivial(num, den, opts = {}) {
    // Si on a des helpers isUn/isZero sur Atome, on les utilise :
    if (den?.isAtome?.() && den.isUn?.() === true) return num;   // a / 1 = a
    if (num?.isAtome?.() && num.isZero?.() === true) return num; // 0 / b = 0
    return new Quotient([num, den], opts);
  }

  isTermeSimple() {
    return this.termes.every(t => typeof t.isAtome === "function" && t.isAtome());
  }

  deduireNature(opts = {}) {
    try {
      const v = this.evaluer(opts);
      return v?.nature || null;
    } catch (_e) {
      return null;
    }
  }

  getNature() { return this.nature; }

  // --- affichage (non fractionnaire) ---
toString(opts = {}) {
  const [num, den] = this.termes;
  if (num?.instanceOptions) num.instanceOptions.parentheseObligatoire = "quotientNum";
  if (den?.instanceOptions) den.instanceOptions.parentheseObligatoire = "quotientDen";

  const s = `${num.toString?.(opts)} ÷ ${den.toString?.(opts)}`;

  const pObl  = this.instanceOptions.parentheseObligatoire;
  const pForc = this.instanceOptions.parenthese === true;
  const doitEncadrer = pForc || pObl === "quotientDen"; // ✅ logique contexte gardée

  return doitEncadrer ? `(${s})` : s;
}

toLatex(opts = {}) {
  const [num, den] = this.termes;
  if (num?.instanceOptions) num.instanceOptions.parentheseObligatoire = "quotientNum";
  if (den?.instanceOptions) den.instanceOptions.parentheseObligatoire = "quotientDen";

  const s = `${num.toLatex?.(opts)} \\div ${den.toLatex?.(opts)}`;

  const pObl  = this.instanceOptions.parentheseObligatoire;
  const pForc = this.instanceOptions.parenthese === true;
  const doitEncadrer = pForc || pObl === "quotientDen";

  return doitEncadrer ? `\\left(${s}\\right)` : s;
}



  // --- structure ---
  // Aplatissement des quotients imbriqués :
  // (a/b)/(c/d) -> (a×d)/(b×c), a/(b/c) -> (a×c)/b, (a/b)/c -> a/(b×c)
  aplatir(opts = {}) {
    if (!this.testEval()) return null;

    const [num0, den0] = this.termes;

    // aplatir récursif sur les sous-quotients d'abord
    const num = (num0 instanceof Quotient) ? num0.aplatir(opts) : num0;
    const den = (den0 instanceof Quotient) ? den0.aplatir(opts) : den0;

    let n = num, d = den;

    if (num instanceof Quotient) {
      // (a/b) / X  ->  a / (b×X)
      n = num.termes[0];
      d = Produit.simplifierSiUnFacteur(
        [num.termes[1], den],
        { parenthese:true, parentheseObligatoire:"quotientDen" }
      );
    }
    if (den instanceof Quotient) {
      // X / (c/d)  -> (X×d) / c
      n = Produit.simplifierSiUnFacteur([n, den.termes[0]], {});
      d = den.termes[1];
    }

    return Quotient.simplifierSiTrivial(n, d, {
      parenthese: this.instanceOptions.parenthese,
      parentheseObligatoire: this.instanceOptions.parentheseObligatoire,
      affiche: this.instanceOptions.affiche
    });
  }

  // Distribution limitée : (A+B)/c -> A/c + B/c si c scalaire
distribuerSiPossible(opts = {}) {
  const [num, den] = this.termes;

  // On distribue UNIQUEMENT si le numérateur est Somme/Difference.
  // Pas de distribution sur un dénominateur somme/différence !
  if (num instanceof Somme) {
    const makeTerm = (t) => new Quotient([t, den], {
      parenthese: false,
      parentheseObligatoire: "quotient"
    });

    return new Somme(num.termes.map(makeTerm), {
      parenthese: this.instanceOptions.parenthese,
      parentheseObligatoire: this.instanceOptions.parentheseObligatoire,
      affiche: this.instanceOptions.affiche
    });
  }

  if (num instanceof Difference) {
    const makeTerm = (t) => new Quotient([t, den], {
      parenthese: false,
      parentheseObligatoire: "quotient"
    });

    return new Difference(num.termes.map(makeTerm), {
      parenthese: this.instanceOptions.parenthese,
      parentheseObligatoire: this.instanceOptions.parentheseObligatoire,
      affiche: this.instanceOptions.affiche
    });
  }

  // Sinon, rien à distribuer
  return this;
}


  convertir(opts = {}) {
    if (!this.testEval()) return null;

    const uniteCtx = opts.uniteOpe || opts.uniteBase || {};
    const convertis = this.termes.map(t =>
      (typeof t.convertirSelonNature === "function")
        ? t.convertirSelonNature(uniteCtx, opts)
        : t
    );

    return new Quotient(convertis, {
      parenthese: this.instanceOptions.parenthese,
      parentheseObligatoire: this.instanceOptions.parentheseObligatoire,
      affiche: this.instanceOptions.affiche
    });
  }

  // --- évaluation ---
  evaluer(opts = {}) {
    if (!this.testEval()) return null;

    const [n, d] = this.termes.map(t => t.evaluer?.(opts));
    if (!(n?.isAtome?.()) || !(d?.isAtome?.())) {
      throw new Error("evaluer: numérateur et dénominateur doivent être des atomes");
    }
    return n.div(d, opts);
  }

  evaluerUnTerme(opts = {}) {
    if (!this.testEval()) return null;

    const step = (e) => e.evaluerPasAPas?.(opts) ?? e.evaluer?.(opts);

    for (let i = 0; i < 2; i++) {
      const t = this.termes[i];
      if (typeof t.isAtome === "function" && !t.isAtome()) {
        const etape = step(t);
        if (!t.checkEqual?.(etape)) {
          const clone = [...this.termes];
          clone[i] = etape;
          const q = new Quotient(clone, { ...this.instanceOptions });
          q.commentaire = (i === 0) ? "évaluation du numérateur" : "évaluation du dénominateur";
          return q;
        }
      }
    }
    return this.evaluer(opts);
  }

  evaluerSousTermes(opts = {}) {
    if (!this.testEval()) return null;

    if (!this.isTermeSimple()) {
      const nouveaux = this.termes.map(t => t.evaluerPasAPas?.(opts) ?? t);
      return new Quotient(nouveaux, {
        parenthese: this.instanceOptions.parenthese,
        parentheseObligatoire: this.instanceOptions.parentheseObligatoire,
        affiche: this.instanceOptions.affiche
      });
    }
    return this;
  }


evaluerPasAPas(opts = {}) {
  if (!this.testEval()) return null;

  let regle="";
 if (opts.regles?.at(-1)?.at(-1) === "Q") {
    regle = opts.regles.pop();
}

 console.log("regleProduit",regle);
  console.log(this);
  
    let moi=this;
  const doitFaire = (obj,valeur) => regle===valeur;
  
  
  if (doitFaire(moi, "aplatirQ")) {
    const r = moi.aplatir(opts);
    if (!moi.checkEqual(r)) return r; else moi = r;
  }

  // ⬇️ Déplacé ICI : on tente la distributivité même si ce n'est pas "simple"
  if (doitFaire(moi, "distribuerQ")) {
    const r = moi.distribuerSiPossible(opts);
    if (!moi.checkEqual?.(r)) return r; else moi = r;
  }

  if (this.isTermeSimple()) {
    if (doitFaire(moi, "convertirQ")) {
      const r = moi.convertir(opts);
      if (!moi.checkEqual(r)) return r; else moi = r;
    }
    if (doitFaire(moi, "directQ")) {
      const r = moi.evaluer(opts);
      if (!moi.checkEqual(r)) return r; else moi = r;
    }
    if (doitFaire(moi, "directUnQ")) {
      const r = moi.evaluerUnTerme(opts);
      if (!moi.checkEqual(r)) return r; else moi = r;
    }
  }

  if (doitFaire(moi, "directQ")) {
    const r = moi.evaluerSousTermes(opts);
    if (!moi.checkEqual(r)) return r; else moi = r;
  }
  if (doitFaire(moi, "directUnQ")) {
    const r = moi.evaluerUnTerme(opts);
    if (!moi.checkEqual(r)) return r; else moi = r;
  }

  return this.isTermeSimple() ? moi.evaluer(opts) : moi.evaluerSousTermes(opts);
}
  // --- égalité / sérialisation ---
  checkEqual(other) {
    if (!(other instanceof Quotient)) return false;
    if (!Array.isArray(other.termes) || other.termes.length !== 2) return false;
    return this.termes.every((t, i) => t?.checkEqual?.(other.termes[i]));
  }

  toJSON() {
    return {
      type: "Quotient",
      nature: this.getNature(),
      termes: this.termes.map(t => t?.toJSON?.())
    };
  }
}






