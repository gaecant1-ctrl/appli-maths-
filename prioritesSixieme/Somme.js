// ===== Somme =====
class Somme extends Expression{
  constructor(termes = [], base = {}) {
    super();
    this.termes = termes;
    this.instanceOptions = {
      parenthese: base.parenthese ?? false,
      parentheseObligatoire: base.parentheseObligatoire ?? null,
      affiche: base.affiche ?? true
    };
    this.nature = this.deduireNature();
  }


  

static simplifierSiUnTerme(termes, opts) {
  if (termes.length === 1) {
    return termes[0]; // ne rien toucher
  }
  return new Somme(termes, opts);
}



deduireNature() {
  try {
    const natures = this.termes.map(t =>
      (typeof t.getNature === "function") ? t.getNature({}) : null
    ).filter(Boolean);

    if (natures.length === 0) return null;

    const unique = new Set(natures);
    return (unique.size === 1) ? natures[0] : "Composée";
  } catch (e) {
    console.warn("Échec dans la déduction de nature :", e.message);
    return null;
  }
}



toString(opts) {
  // Fusion des options globales et locales de l'objet courant (Somme)

  // Générer le LaTeX des termes
  const str = this.termes.map(t => {
    t.instanceOptions.parentheseObligatoire="somme";
    return t.toString(opts);
  }).join(" + ");
 
  // Vérifier si la somme globale doit être parenthésée

  const parentheseObligatoire = this.instanceOptions.parentheseObligatoire;
  const parenthese = this.instanceOptions.parenthese;
  if (["produit", "quotient", "quotientNum", "quotientDen", "regroupement", "differenceD"].includes(parentheseObligatoire)|| parenthese === true) {
    return `(${str})`;
  }

  return str;
}




toLatex(opts) {

  // Générer le LaTeX des termes
  const str = this.termes.map(t => {
    t.instanceOptions.parentheseObligatoire="somme";
    return t.toLatex(opts);
  }).join(" + ");
  // Vérifier si la somme globale doit être parenthésée
  const parentheseObligatoire = this.instanceOptions.parentheseObligatoire;
  const parenthese = this.instanceOptions.parenthese;
  if (["produit", "quotient", "quotientNum", "quotientDen", "differenceD"].includes(parentheseObligatoire)|| parenthese === true) {
    return `\\left(${str}\\right)`;
  }

  return str;
}


  
 getPlusPetiteUniteAuto() {
  // 1. Filtrer les termes avec grandeur valide
  const termesGrandeur = this.termes.filter(t => t.grandeur && t.grandeur.uniteDict);
  if (termesGrandeur.length === 0) return null;

  // 2. Récupérer la nature de la première grandeur
  const nature = termesGrandeur[0].grandeur.nature;
  const convTab = Grandeur.conversionTable[nature];
  if (!convTab) return null;

  // 3. Récupérer la liste unique des unités présentes
  const unites = Array.from(new Set(
    termesGrandeur.flatMap(t => Object.keys(t.grandeur.uniteDict))
  ));

  // 4. Appeler la méthode statique pour récupérer la plus petite unité
  return Grandeur.getUniteExtreme(nature, unites, "plusPetite");
}



aplatir(opts) { console.log("aplatirS");
  if (!this.testEval()) return null;
    const plats = [];
    for (let t of this.termes) {
      if (t instanceof Somme) {
        plats.push(...t.aplatir(opts).termes);
      } else {
        plats.push(t);
      }
    }
    return Somme.simplifierSiUnTerme(plats, {
      parenthese: this.instanceOptions.parenthese,
      parentheseObligatoire: this.instanceOptions.parentheseObligatoire
     });
  }


regrouper(opts) { console.log("regrouperS");
  if (!this.testEval("regrouper")) return null;

  if(Somme.preparerSomme(this,opts)&&this.termes.length>2){
      const groupes = {};
    
      for (let terme of this.termes) {
        const uniteKey = JSON.stringify(terme?.grandeur?.uniteDict ?? {});
        if (!groupes[uniteKey]) groupes[uniteKey] = [];
        groupes[uniteKey].push(terme);
      }
    
      const base = {parenthese:true};
    
      const sousSommes = Object.values(groupes).map(groupe =>
        Somme.simplifierSiUnTerme(groupe, base)
      );
      const regroupement = Somme.simplifierSiUnTerme(sousSommes, {
        parenthese: this.instanceOptions.parenthese,
        parentheseObligatoire: this.instanceOptions.parentheseObligatoire,
        affiche: (opts.modeSomme.includes("regrAff")) ? true:false
      });

      return regroupement;
  }
  else{
    return this;
  }
  
}


convertir(opts) {
  console.log("convertirS");

  if (!Somme.preparerSomme(this, opts)) return this;

  const nature = this.getNature();
  let uniteOpe = opts.uniteOpe || opts.uniteBase;

  // 🛡️ Si aucune unité n’est donnée ou qu’elle ne correspond pas à la nature,
  // on cherche la plus petite unité automatiquement
  if (!uniteOpe || uniteOpe.estVide() || !uniteOpe.hasOwnProperty(nature)) {
    const min = this.getPlusPetiteUniteAuto();
    if (min) {
      uniteOpe = { [min.nature]: min.unite };
      console.warn(`Conversion fallback : utilisation de la plus petite unité "${min.unite}" pour la nature "${min.nature}".`);
    } else {
      console.warn("Conversion impossible : aucune unité valide trouvée.");
      return this;
    }
  }

  const convertis = this.termes.map(t =>
    typeof t.convertirSelonNature === "function"
      ? t.convertirSelonNature(uniteOpe, opts)
      : t
  );

  const res= Somme.simplifierSiUnTerme(convertis, {
    affiche: true,
    parenthese: this.instanceOptions.parenthese,
    parentheseObligatoire: this.instanceOptions.parentheseObligatoire
  });
  console.log(res);
  return res;
}



evaluerUnTerme(opts) {
  if (!this.testEval()) return null;

  for (let i = 0; i < this.termes.length; i++) {
    const t = this.termes[i];
    if (typeof t.isAtome === "function" && !t.isAtome()) {
      const etape = t.evaluerParEtape?.(opts) ?? t.evaluer?.(opts);
      if (!t.checkEqual?.(etape)) {
        const clone = [...this.termes];
        clone[i] = etape;
        const nouvelleSomme = new Somme(clone, {
          ...this.instanceOptions
        });
        nouvelleSomme.commentaire = `évaluation du terme ${i + 1}`;
        return nouvelleSomme;
      }
    }
  }

  // Si aucun sous-terme n’est évalué, retourner l’évaluation globale
  return this.evaluer(opts);
}



evaluerSousTermes(opts) { console.log("evaluerSousTermesS");
if (!this.testEval()) return null;
  if(!this.isTermeSimple()){
    const nouveauxTermes = [];
    for (let i = 0; i < this.termes.length; i++) {
      const terme = this.termes[i];
      const etape = terme.evaluerPasAPas(opts);
      nouveauxTermes.push(etape);
    }
  
    const somme=new Somme(nouveauxTermes, {
          parenthese: this.instanceOptions.parenthese,
          parentheseObligatoire: this.instanceOptions.parentheseObligatoire
        });
    return somme;
        
  }
    return this;
}


evaluer(opts) { console.log("evaluerS");
  if (!this.testEval()) return null;
  
  // On évalue tous les termes (chacun peut être un Atome ou déjà une Grandeur)
  const valeurs = this.termes.map(t => t.evaluer(opts));
  let base = valeurs[0];


  for (let i = 1; i < valeurs.length; i++) {
    base = base.add(valeurs[i],opts); // renvoie une nouvelle Grandeur !
  }

  return base;
}

enchainer(opts){ console.log("enchainerS");
    if (!this.testEval()) return null;
    const [g1, g2, ...reste] = this.termes;
    if(!g1.isAtome()){
      return Somme.simplifierSiUnTerme([g1.evaluerParEtape(opts),g2,...reste],{
            parenthese: this.instanceOptions.parenthese,
            parentheseObligatoire: this.instanceOptions.parentheseObligatoire
      });
      }
    if(!g2.isAtome()){
      return Somme.simplifierSiUnTerme([g1,g2.evaluerParEtape(opts),...reste],{
            parenthese: this.instanceOptions.parenthese,
            parentheseObligatoire: this.instanceOptions.parentheseObligatoire
      });
      }

    else{
      const addition = g1.add(g2,opts);
      const resteTermes = [addition, ...reste];
      return Somme.simplifierSiUnTerme(resteTermes, {
            parenthese: this.instanceOptions.parenthese,
            parentheseObligatoire: this.instanceOptions.parentheseObligatoire
      });
    }
   
 }



evaluerPasAPas(opts) {
  if (!this.testEval()) return null;


  const termes = this.termes;
  
 let regle="";
 if (opts.regles?.at(-1)?.at(-1) === "S") {
    regle = opts.regles.pop();
}
  console.log("regleSomme", regle);

  let moi=this;
  const doitFaire = (obj,valeur) => regle===valeur;
  

  if(opts.modeMixte=="duree"){
    const res=moi.toLatex(opts);
    moi.forcerAffichageDuree(opts);
    if (moi.toLatex(opts)!==res){return moi;}
  }
  
  if(doitFaire(moi,"aplatirS")) 
    { const res= moi.aplatir(opts);
    if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }
   
    if (doitFaire(moi,"regrouperS")) {
      const res = moi.regrouper(opts);
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }

  if(this.isTermeSimple()){
 

    if (doitFaire(moi,"convertirS")) {
      const res = moi.convertir(opts); 
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }
    

    if (doitFaire(moi,"directS")) {
      
      const res = moi.evaluer(opts);
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }
    if (doitFaire(moi,"directUnS")){ 
      const res = moi.enchainer(opts);
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }
    if (doitFaire(moi,"gdS")){ 
      const res = moi.enchainer(opts);
      if (!moi.checkEqual(res)){return res;}else{moi=res;}
    }
  }
  
 

  if (doitFaire(moi,"directS")){
      const res = moi.evaluerSousTermes(opts); 
      if (!moi.checkEqual(res)){return res;}else{moi=res;}

  }
  
    if (doitFaire(moi,"directUnS")){
      const res = moi.evaluerUnTerme(opts); 
      if (!moi.checkEqual(res)){return res;}else{moi=res;}

  }
  
  if (doitFaire(moi,"gdS")){
      const res = moi.enchainer(opts); 
      if (!moi.checkEqual(res)){return res;}else{moi=res;}

  }
  

  //par défaut;
    if(!regle==""){opts.regles.push(regle);}
    if (this.isTermeSimple()) {
      return moi.evaluer(opts);
      }
     else {
      return moi.evaluerSousTermes(opts);
    }
  
}


checkEqual(other) {
  if (!(other instanceof Somme)) return false;
  if (this.termes.length !== other.termes.length) return false;

  for (let i = 0; i < this.termes.length; i++) {
    const a = this.termes[i];
    const b = other.termes[i];

    // Pas de méthode ? On fait un toString pour fallback
    if (typeof a.checkEqual === "function" && typeof b.checkEqual === "function") {
      if (!a.checkEqual(b)) return false;
    } else {
      if (a.toString?.() !== b.toString?.()) return false;
    }
  }

  return true;
}


isTermeSimple(opts) {
  const tousSimples = this.termes.every(t => typeof t.isAtome === "function" && t.isAtome());


  return tousSimples;
}




  getNature() { return this.nature; }
  


  
  toJSON() {
  return {
    type: "Somme",
    nature: this.getNature(),
    termes: this.termes.map(t => t.toJSON())
  };
}


forcerAffichageDuree(opts) {
  const typeAffichage = opts.affichage ?? "mixte";
  const unites = opts.affichageDuree ?? ["h", "min", "s"];

  this.termes.forEach(t => {
    if (t instanceof Duree && t.doitAfficherMixte(unites)) {
      t.instanceOptions.affichage = typeAffichage;
    }
  });
}



static preparerSomme(objSomme, opts) {
  
  const termes = objSomme.termes;

  // 1. Teste si tous les termes sont simples
  const tousSimples = termes.every(t => typeof t.isAtome === "function" && t.isAtome());
  if (!tousSimples) return false;

  // 2. Vérifie si tous les termes ont le même constructeur
  const constructeurs = new Set(termes.map(t => t.constructor));
  if (constructeurs.size !== 1) return false;

  const [Constructeur] = [...constructeurs];

  // 3. Ne continue que si un modeMixte est activé
  if (!opts.modeMixte) return tousSimples;

  // 4. Vérifie que le constructeur est compatible avec le modeMixte
  const natureAttendue = opts.modeMixte.toLowerCase(); // ex: "duree"
  const nature = termes[0]?.grandeur?.nature?.toLowerCase?.();

  if (nature !== natureAttendue) return tousSimples;

  if (typeof Constructeur.preparerSomme !== "function") return tousSimples;

  // 5. Appelle la méthode de préparation spécifique
  console.log("prepare");
  const nouveauxTermes = Constructeur.preparerSomme(termes, opts);
  if (!Array.isArray(nouveauxTermes)) return tousSimples;

  objSomme.termes = nouveauxTermes;
  objSomme._structurePreparee = true;

  return true;
}





}


/// Différence

class Difference extends Expression {
  constructor(termes = [], base = {}) {
    super();
    this.termes = termes;
    this.instanceOptions = {
      parenthese: base.parenthese ?? false,
      parentheseObligatoire: base.parentheseObligatoire ?? null,
      affiche: base.affiche ?? true
    };
    this.nature = this.deduireNature();
  }

static simplifierSiUnTerme(termes, opts) {
  if (termes.length === 1) {
    return termes[0]; // ne rien toucher
  }
  return new Difference(termes, opts);
}

 deduireNature(opts = {}) {
  try {
    const natures = this.termes.map(t =>
      (typeof t.getNature === "function") ? t.getNature(opts) : null
    ).filter(Boolean);

    if (natures.length === 0) return null;

    const unique = new Set(natures);
    return (unique.size === 1) ? natures[0] : "Composée";
  } catch (e) {
    console.warn("Échec dans la déduction de nature :", e.message);
    return null;
  }
}


 toString(opts) {
  const parts = this.termes.map((t, i) => {
    // reset sûr (évite pollution d'appels précédents)
    t.instanceOptions.parentheseObligatoire = null;

    // RÈGLE: dans une différence, on NE JAMAIS parenthèse E1
    // On parenthèse E2 (et suivants) SEULEMENT si c'est une Somme ou une Différence
    if (i >= 1 && (t instanceof Somme || t instanceof Difference)) {
      t.instanceOptions.parentheseObligatoire = "differenceD";
    }
    return t.toString(opts);
  });

  const str = parts.join(" - ");

  // Parenthésage global si le CONTEXTE parent l'exige
  const parentheseObligatoire = this.instanceOptions.parentheseObligatoire;
  const parenthese = this.instanceOptions.parenthese === true; // ⚠ booléen

  if (["produit", "quotient", "quotientNum", "quotientDen", "regroupement", "differenceD"].includes(parentheseObligatoire) || parenthese) {
    return `(${str})`;
  }
  return str;
}


toLatex(opts) {
  const parts = this.termes.map((t, i) => {
    t.instanceOptions.parentheseObligatoire = null;
    if (i >= 1 && (t instanceof Somme || t instanceof Difference)) {
      t.instanceOptions.parentheseObligatoire = "differenceD";
    }
    return t.toLatex(opts);
  });
  const str = parts.join(" - ");

  const parentheseObligatoire = this.instanceOptions.parentheseObligatoire;
  const parenthese = this.instanceOptions.parenthese === true;

  if (["produit", "quotient", "quotientNum", "quotientDen", "regroupement", "differenceD"].includes(parentheseObligatoire) || parenthese) {
    return `\\left(${str}\\right)`;
  }
  return str;
}



  evaluer(opts) {
        
    const valeurs = this.termes.map(t => t.evaluer(opts));
    let base = valeurs[0];
    for (let i = 1; i < valeurs.length; i++) {
      base = base.sub(valeurs[i], opts);
    }
    return base;
  }
  
 transformerSelonModeMixte(opts = {}) {
  const nouveaux = this.termes.map(t => t.transformerSelonModeMixte(opts));
  return new this.constructor(nouveaux, this.instanceOptions);
}

isTermeSimple(opts) {
  const tousSimples = this.termes.every(t => typeof t.isAtome === "function" && t.isAtome());


  return tousSimples;
}

convertir(opts) {
  console.log("convertirD");

  if (!this.isTermeSimple(opts)) return this;

  const nature = this.getNature();
  let uniteOpe = opts.uniteOpe || opts.uniteBase;

  // 🛡️ Si aucune unité n’est donnée ou qu’elle ne correspond pas à la nature,
  // on cherche la plus petite unité automatiquement
  if (!uniteOpe || uniteOpe.estVide() || !uniteOpe.hasOwnProperty(nature)) {
    const min = this.getPlusPetiteUniteAuto();
    if (min) {
      uniteOpe = { [min.nature]: min.unite };
      console.warn(`Conversion fallback : utilisation de la plus petite unité "${min.unite}" pour la nature "${min.nature}".`);
    } else {
      console.warn("Conversion impossible : aucune unité valide trouvée.");
      return this;
    }
  }

  const convertis = this.termes.map(t =>
    typeof t.convertirSelonNature === "function"
      ? t.convertirSelonNature(uniteOpe, opts)
      : t
  );

  const res= Difference.simplifierSiUnTerme(convertis, {
    affiche: true,
    parenthese: this.instanceOptions.parenthese,
    parentheseObligatoire: this.instanceOptions.parentheseObligatoire
  });
  console.log(res);
  return res;
}
  
  
evaluerPasAPas(opts) {
    if (!this.testEval()) return null;
  
 
    const termes = this.termes;

    for (let i = 0; i < termes.length; i++) {
      const t = termes[i];
      const etape = t.evaluerPasAPas(opts);
      console.log(etape);
      if (!t.checkEqual?.(etape)) {
        const clone = [...termes];
        clone[i] = etape;
        return Difference.simplifierSiUnTerme(clone, opts);
      }
    }
    const direct = this.evaluer(opts);
    if (!this.checkEqual(direct)) {
      return direct;
    }

    return this;
  }
 


  checkEqual(other) {
    if (!(other instanceof Difference)) return false;
    if (this.termes.length !== other.termes.length) return false;
    return this.termes.every((t, i) => t.checkEqual?.(other.termes[i]));
  }

  getNature() {
    return this.nature;
  }



  toJSON() {
    return {
      type: "Difference",
      nature: this.getNature(),
      termes: this.termes.map(t => t.toJSON())
    };
  }
}




