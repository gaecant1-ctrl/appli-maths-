/*
 * Enonce.js — fabrique d'exercices paramétrables et aléatoires
 *
 * Idée clé :
 *   - Une classe de base Enonce gère le RNG (option de seed),
 *     et expose buildExercise(zone, index) qui retourne l'instance de votre Exercice*.
 *   - Chaque sous-classe implémente genVariant(index) => données aléatoires
 *     et toQuestionData(variant, index) => questionData compatible avec ExerciceExpression.
 *
 * Dépendances optionnelles : MathJax, REGLES.strict, avecMethodesListe, avecMethodesDict, ExerciceExpression.
 */

// ------------------------------------------------------------
// RNG (seedable) — Mulberry32 + hash de chaîne simple
// ------------------------------------------------------------
function hashStringToInt(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class RNG {
  constructor(seed) {
    if (seed === undefined || seed === null) {
      this.random = Math.random.bind(Math);
    } else {
      const s = typeof seed === 'string' ? hashStringToInt(seed) : (seed >>> 0);
      const gen = mulberry32(s);
      this.random = () => gen();
    }
  }
  next() { return this.random(); }
  int(min, maxInclusive) {
    const r = this.next();
    return Math.floor(r * (maxInclusive - min + 1)) + min;
  }
  pick(arr) { return arr[this.int(0, arr.length - 1)]; }
}

// Shallow merge helper (no Object.assign, ES5-friendly)
function merge(target) {
  for (var i = 1; i < arguments.length; i++) {
    var src = arguments[i];
    if (!src) continue;
    for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k];
  }
  return target;
}

// Helpers tolérants si vos fonctions utilitaires ne sont pas chargées
const AML = (typeof window !== 'undefined' && typeof window.avecMethodesListe === 'function')
  ? window.avecMethodesListe
  : (x) => x;
const AMD = (typeof window !== 'undefined' && typeof window.avecMethodesDict === 'function')
  ? window.avecMethodesDict
  : (x) => x;
const REGLES_STRICT = (typeof window !== 'undefined' && window.REGLES && window.REGLES.strict)
  ? window.REGLES.strict
  : {};

// ------------------------------------------------------------
// Classe de base
// ------------------------------------------------------------
// ------------------------------------------------------------
// Classe de base — lettre auto (A,B,C,...) selon l'index
// ------------------------------------------------------------
// ------------------------------------------------------------
// Classe de base — gère l'attribut `lettre` pour tous les énoncés
// ------------------------------------------------------------
class Enonce {
  /**
   * @param {Object} opts
   * @param {string|number} [opts.seed]
   * @param {Object} [opts.sharedOptions]   // ex: { affichageAvecLettre: null | "" | "A" }
   * @param {string|string[]} [opts.letterPool="ABCDEFGHIJKLMNOPQRSTUVWXYZ"]
   */
  constructor(opts = {}) {
    this.rng = new RNG(opts.seed);
    this.sharedOptions = opts.sharedOptions || {};
    this.letterPool = this._normalizeLetterPool(
      opts.letterPool || 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    );

    // Attribut accessible dans toutes les sous-classes
    this.lettre = null;
  }

  // ---- à surcharger ----
  genVariant(/* index */) { throw new Error('genVariant(index) non implémenté'); }
  toQuestionData(/* variant, index */) { throw new Error('toQuestionData(variant, index) non implémenté'); }

  // ---- helpers lettre (réutilisables par les sous-classes si besoin) ----
  _normalizeLetterPool(pool) {
    const arr = Array.isArray(pool) ? pool.slice()
              : (typeof pool === 'string' ? pool.split('') : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    const out = [], seen = Object.create(null);
    for (const ch of arr) {
      const up = String(ch || '').trim().toUpperCase();
      if (up.length === 1 && up >= 'A' && up <= 'Z' && !seen[up]) { seen[up] = true; out.push(up); }
    }
    return out.length ? out : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  }

  _letterByIndex(index) {
    const L = this.letterPool.length;
    const i = Math.max(1, parseInt(index || 1, 10)); // 1-based
    return this.letterPool[(i - 1) % L];
  }

  // Applique la règle: null → pas de lettre ; "" → lettre par index ; "A" → lettre fournie ; undefined → pas de lettre
  _resolveLetter(index, rawOption) {
    if (rawOption === null) return null;
    if (typeof rawOption === 'string') {
      const t = rawOption.trim();
      return (t === '') ? this._letterByIndex(index) : t;
    }
    // undefined ou autre → pas de lettre
    return null;
  }

  /** Construit et renvoie l'exercice (fixe this.lettre avant le template) */
  buildExercise(zone, index) {
    // 1) Détermine la lettre par défaut depuis sharedOptions (si présent)
    const sharedRaw = Object.prototype.hasOwnProperty.call(this.sharedOptions, 'affichageAvecLettre')
      ? this.sharedOptions.affichageAvecLettre
      : undefined;
    this.lettre = this._resolveLetter(index, sharedRaw);  // <-- dispo pour le template

    // 2) Données spécifiques
    const variant = this.genVariant(index);

    // 3) questionData de la sous-classe (peut utiliser this.lettre)
    const questionData = this.toQuestionData(variant, index) || {};

    // 4) Merge des options (sharedOptions -> spécifiques)
    const options = questionData.options = merge({}, this.sharedOptions, questionData.options || {});

    // 5) Si la question fournit SA PROPRE option, on la respecte (re-résolution + synchro)
    if (Object.prototype.hasOwnProperty.call(options, 'affichageAvecLettre')) {
      this.lettre = this._resolveLetter(index, options.affichageAvecLettre);
    }

    // 6) Injection finale dans options (pour ExerciceExpression)
    if (this.lettre) options.affichageAvecLettre = this.lettre;
    else delete options.affichageAvecLettre;

    // 7) Instanciation
    return new ExerciceExpression(zone, questionData);
  }
}



// ------------------------------------------------------------
// EnonceCompositeSimple — compile des blocs m∈{1..19} avec la règle E1-(E2)
// ------------------------------------------------------------
// ============================================================
// EnonceCompositeNature — version clean
// Règles de parenthésage :
//  - Somme  : E1 + E2                → jamais de () en plus
//  - Diff   : E1 - E2                → () autour de E2 si E2 est somme/diff
//  - Prod   : E1 * E2                → () autour d’un facteur s’il est somme/diff
//  - Quot   : E1 : E2 (ENTIER)       → () autour de E2 toujours ; () autour de E1 si somme/diff
//                                      si non divisible, on multiplie le numérateur par k = den/gcd(num,den)
// ============================================================
// ===== EnonceCompositeNature — version simple et stricte =====
class EnonceCompositeNature extends Enonce {

constructor(opts={}){
  super(opts);

  this.niveau = opts.niveau || 'moyen';

  this.rules = this._rulesForLevel(this.niveau);

  this.maxDepth = this.rules.maxDepth;
  this.maxAbs = (this.niveau === 'difficile') ? 200 : 30;
}


_rulesForLevel(level){

  const base = {
    allowNegativeAtoms: false,
    allowNegativeProductPair: false,
    allowNegativeDenominator: false,
    maxDepth: 2
  };

  if(level === 'facile'){
    return {
      ...base,
      maxDepth: 1
    };
  }

  if(level === 'moyen'){
    return {
      ...base,
      maxDepth: 2
    };
  }

  if(level === 'avance'){
    return {
      ...base,
      maxDepth: 3
    };
  }

  return base;
}
  // -------------------------------------------------
  // PRIORITÉ OPÉRATEURS
  // -------------------------------------------------
  _precedence(op){
    if(op==='+'||op==='-') return 1;
    if(op==='*'||op===':') return 2;
    return 3;
  }

  // -------------------------------------------------
  // ATOME
  // -------------------------------------------------
_atom(){

  let val = this.rng.int(1,9);

  if(this.rules.allowNegativeAtoms){
    if(this.rng.next() < 0.4){
      val = -val;
    }
  }

  return {
    type:'atom',
    value: val,
    toString(){ return String(val); }
  };
}

  // -------------------------------------------------
  // NOEUD BINAIRE AVEC RÈGLES
  // -------------------------------------------------
_binary(op,left,right){

  // ----- règles pédagogiques -----

  if(op==='*'){
    if(!this.rules.allowNegativeProductPair){
      if(left.value < 0 && right.value < 0) return null;
    }
  }

if(op===':'){

  // division uniquement si le dénominateur est un atome
  if(right.type !== 'atom') return null;

  if(!this.rules.allowNegativeDenominator){
    if(right.value <= 0) return null;
  }

  if(left.value % right.value !== 0) return null;
}

  // ----- calcul valeur -----
  let value;

  if(op==='+') value = left.value + right.value;
  if(op==='-') value = left.value - right.value;
  if(op==='*') value = left.value * right.value;
  if(op===':') value = left.value / right.value;
   if (value < 0) return null;
  if(!Number.isFinite(value)) return null;
  if(Math.abs(value) > this.maxAbs) return null;

  const self = this;

  return {
    type:'binary',
    op,
    left,
    right,
    value,

    toString(){

      const parentPrec = self._precedence(op);

      const leftStr = (() => {
        if(left.type==='atom') return left.toString();
        const childPrec = self._precedence(left.op);
        if(childPrec < parentPrec) return `(${left.toString()})`;
        return left.toString();
      })();

      const rightStr = (() => {
        if(right.type==='atom') return right.toString();
        const childPrec = self._precedence(right.op);

        if(childPrec < parentPrec) return `(${right.toString()})`;

        if((op==='-' || op===':') && childPrec === parentPrec){
          return `(${right.toString()})`;
        }

        return right.toString();
      })();

      return `${leftStr}${op}${rightStr}`;
    }
  };
}

  // -------------------------------------------------
  // CONSTRUCTION RÉCURSIVE
  // -------------------------------------------------


_buildWithOps(k){

  if(k === 0){
    return this._atom();
  }

  for(let i=0;i<80;i++){

    const leftOps  = this.rng.int(0, k-1);
    const rightOps = k-1 - leftOps;

    const left  = this._buildWithOps(leftOps);
    const right = this._buildWithOps(rightOps);

    if(!left || !right) continue;

    const op = this.rng.pick(['+','-','*',':']);

    const node = this._binary(op, left, right);

    if(node) return node;
  }

  return null;
}

_opsFromNiveau(){

  if(this.niveau === 'facile'){
    return 1;
  }

  if(this.niveau === 'moyen'){
    return this.rng.int(2,3);
  }

  if(this.niveau === 'avance'){
    return this.rng.int(4,5);
  }

  return 1;
}

  // -------------------------------------------------
  // GENERATION
  // -------------------------------------------------
genVariant(){

  const ops = this._opsFromNiveau();
  console.log("niveau =", this.niveau);
console.log("ops =", ops);
  for(let i=0;i<100;i++){
    const tree = this._buildWithOps(ops);
    if(tree){
      return { exprStr: tree.toString(), value: tree.value };
    }
  }

  throw new Error("Impossible de générer expression valide");
}

  // -------------------------------------------------
  // INTÉGRATION AVEC ExerciceExpression
  // -------------------------------------------------
  toQuestionData(v){

    const sujet = (this.lettre && this.lettre.trim())
      ? this.lettre
      : v.exprStr;

    return {
      question: `Calculer ${sujet}`,
      expressionInitiale: v.exprStr,
      options:{
        affichageInitial:{ expressionInitiale:true },
        modeCorrection:{
          correction:{
            expression:v.exprStr,
            etapes:true,
            result:false,
            rendu:'latex'
          }
        }
      }
    };
  }
}

window.EnonceCompositeNature = EnonceCompositeNature;

// ------------------------------------------------------------
// Export global
// ------------------------------------------------------------
window.Enonce = Enonce;

// ------------------------------------------------------------
// Router multi-types : compose plusieurs Enonce (ou factories) pour un même quiz
// - Choix pondéré par 'weight'
// - Contraintes par type: 'max' par quiz
// - Option 'sequence' pour imposer un ordre déterministe (par clés)
// - Évite par défaut deux types identiques consécutifs
// ------------------------------------------------------------
class EnonceRouter {
  /**
   * @param {Object} opts
   * @param {Array<{ key?:string, provider:any, weight?:number, max?:number }>} opts.entries
   *        provider: instance d'Enonce (avec buildExercise) OU fonction (zone,index)=>Exercice*
   * @param {string|number} [opts.seed]
   * @param {boolean} [opts.avoidConsecutiveSameType=true]
   * @param {string[]} [opts.sequence=null]  // tableau de keys pour imposer un ordre
   */
  constructor({ entries, seed, avoidConsecutiveSameType = true, sequence = null }) {
    if (!entries || !entries.length) throw new Error('EnonceRouter: entries requis');
    this.rng = new RNG(seed);
    this.avoidConsecutive = !!avoidConsecutiveSameType;
    this.sequence = Array.isArray(sequence) ? sequence.slice() : null;

    // Normalisation des entrées
    this.entries = entries.map((e, i) => ({
      key: e.key || `type${i+1}`,
      provider: e.provider,
      weight: ((e.weight != null ? e.weight : 1) > 0 ? (e.weight != null ? e.weight : 1) : 1),
      max: (e.max != null ? e.max : null)
    }));

    this.counts = Object.create(null); // par key
    this.lastKey = null;
  }

  getStats() {
    return { byKey: merge({}, this.counts), lastKey: this.lastKey };
  }

  _eligible() {
    return this.entries.filter(e => (e.max == null) || ((this.counts[e.key] || 0) < e.max));
  }

  _pickWeighted(cands, forbidKey = null) {
    let list = cands;
    if (forbidKey && this.avoidConsecutive && cands.length > 1) {
      list = cands.filter(e => e.key !== forbidKey);
      if (!list.length) list = cands; // si tous filtrés, on relâche
    }
    const totalW = list.reduce((s, e) => s + e.weight, 0);
    let r = this.rng.next() * totalW;
    for (const e of list) {
      if ((r -= e.weight) <= 0) return e;
    }
    return list[list.length - 1];
  }

  _resolveProvider(provider) {
    // instance Enonce (méthode buildExercise)
    if (provider && typeof provider.buildExercise === 'function') return provider.buildExercise.bind(provider);
    // fonction factory (zone,index)=>Exercice*
    if (typeof provider === 'function') return provider;
    throw new Error('EnonceRouter: provider invalide');
  }

  _pickEntryByKey(key) {
    return this.entries.find(e => e.key === key) || null;
  }

  pick(index) {
    // 1) Séquence imposée ?
    if (this.sequence && index - 1 < this.sequence.length) {
      const e = this._pickEntryByKey(this.sequence[index - 1]);
      if (!e) throw new Error(`EnonceRouter: key inconnue dans sequence: ${this.sequence[index - 1]}`);
      // Respecte 'max' si défini, sinon retombe sur pondération
      const used = (this.counts[e.key] || 0);
      if (e.max == null || used < e.max) return e;
    }

    // 2) Choix pondéré parmi éligibles
    const cands = this._eligible();
    if (!cands.length) throw new Error('EnonceRouter: plus aucun type éligible (tous max atteints)');
    return this._pickWeighted(cands, this.lastKey);
  }

  buildExercise(zone, index) {
    const entry = this.pick(index);
    const factory = this._resolveProvider(entry.provider);
    const ex = factory(zone, index);
    this.counts[entry.key] = (this.counts[entry.key] || 0) + 1;
    this.lastKey = entry.key;

    // Optionnel: exposer le type choisi sur le conteneur
    try { zone.dataset.enonceType = entry.key; } catch (_) {}

    return ex;
  }
}

// Export global
window.EnonceRouter = EnonceRouter;


