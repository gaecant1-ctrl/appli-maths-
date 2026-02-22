// === grader.js ===
// 1) Presets de règles (tu peux les ajuster)
window.REGLES = {
  strict: {
    accepterInvalide: true,
    memeType: true,
    egalite: { mode: 'symbolique', unite: 'exacte', epsilon: 0 },
    format:  { nombre: 'simple', exigerAtome: true, uniteCible: null, autoConvertToTarget: false,
    exigerExpression: false,memesAtomes: false, memesOperations: false, opsInclureUnaires: false,expressionSuffit: false     // <<< NOUVEAU : si true et égalité vraie (+ formes demandées), statut = 'correct'
},
suite:   { continuerSiInvalide: true, continuerSiInegale: false, continuerSiMauvaiseNature: true,continuerSiFormatIncorrect: true}  },
  souple: {
    accepterInvalide: true,
    memeType: false,
    egalite: { mode: 'numerique', unite: 'convertible', epsilon: 1e-6 },
        format:  { nombre: 'simple', exigerAtome: true, uniteCible: null, autoConvertToTarget: false,
    exigerExpression: false,memesAtomes: false, memesOperations: false, opsInclureUnaires: false,expressionSuffit: false     // <<< NOUVEAU : si true et égalité vraie (+ formes demandées), statut = 'correct'
},
suite:   { continuerSiInvalide: true, continuerSiInegale: true, continuerSiMauvaiseNature: true ,continuerSiFormatIncorrect: false }  },
  conversionUnites: {
    accepterInvalide: true,
    memeType: true,
    egalite: { mode: 'numerique', unite: 'convertible', epsilon: 1e-9 },
    format:  { nombre: 'simple', exigerAtome: true, uniteCible: null, autoConvertToTarget: false,
    exigerExpression: false,memesAtomes: false, memesOperations: false, opsInclureUnaires: false,expressionSuffit: false     // <<< NOUVEAU : si true et égalité vraie (+ formes demandées), statut = 'correct'
},suite:   { continuerSiInvalide: true, continuerSiInegale: true, continuerSiMauvaiseNature: true,continuerSiFormatIncorrect: false  }  }
};

// 2) Helpers
function unitDictToText(dict = {}) {
  const parts = Object.keys(dict).sort().map(k => dict[k] === 1 ? k : `${k}^${dict[k]}`);
  return parts.join('·');
}
function nombreToFloat(nombre) {
  if (!nombre?.simplify) return NaN;
  const { a, b } = nombre.simplify().valeurNum ?? {};
  if (typeof a !== 'number' || typeof b !== 'number' || b === 0) return NaN;
  return a / b;
}
function areUnitsEqualDict(d1 = {}, d2 = {}) {
  const k1 = Object.keys(d1).sort(), k2 = Object.keys(d2).sort();
  if (k1.length !== k2.length) return false;
  for (let i = 0; i < k1.length; i++) {
    if (k1[i] !== k2[i]) return false;
    if (d1[k1[i]] !== d2[k1[i]]) return false;
  }
  return true;
}
function tryConvertToUnit(atome, uniteTexte) {
  try { return atome.convertirEn(uniteTexte) || atome; } catch { return atome; }
}
function getEvalResult(obj) {
  const res = obj?.calculer?.();
  const expr = res?.resultat;
  const isAtom = !!expr?.isAtome?.() && expr.isAtome();
  return { expr, isAtom };
}
function canCheckUnits(expr) {
  return !!expr?.isAtome?.() && expr.isAtome() && !!expr?.grandeur?.uniteDict;
}

function renderLatex(expr, opts) {
  try { return expr?.toLatex?.(opts) || ''; } catch { return ''; }
}

function renderText(expr, opts) {
  try { return expr?.toString?.(opts) || ''; } catch { return ''; }
}
function numericEqualWithUnits(aAtome, bAtome, rules) {
  const epsilon = rules?.egalite?.epsilon ?? 1e-9;
  const unitMode = rules?.egalite?.unite ?? 'exacte';
  const aDict = aAtome.grandeur?.uniteDict ?? {};
  const bDict = bAtome.grandeur?.uniteDict ?? {};
  if (unitMode === 'exacte' && !areUnitsEqualDict(aDict, bDict)) return false;

  let bComparable = bAtome;
  if (unitMode === 'convertible') {
    const cibleTexte = unitDictToText(aDict);
    try { bComparable = bAtome.convertirEn(cibleTexte) || bAtome; }
    catch { return false; }
  }
  const aVal = nombreToFloat(aAtome.grandeur?.valeur);
  const bVal = nombreToFloat(bComparable.grandeur?.valeur);
  if (!isFinite(aVal) || !isFinite(bVal)) return false;
  return Math.abs(aVal - bVal) <= epsilon;
}
function normalizePolicies(p) {
  const base = {...REGLES.strict};
  const out = {...base, ...(p||{})};
  out.egalite  = {...base.egalite,  ...(p?.egalite||{})};
  out.format   = {...base.format,   ...(p?.format||{})};
  out.suite    = {...base.suite,    ...(p?.suite||{})};
  return out;
}


function collectAtomsOpsFromAnalyser(objetString) {
  const toks = objetString?.analyserTokens?.() || [];
  const atoms = [];
  const ops = [];
  const unaries = [];

  for (const t of toks) {
    if (t.sigAtom) atoms.push(t.sigAtom);
    if (t.sigOp)   ops.push(t.sigOp);
    if (t.unarySign === '+' || t.unarySign === '-') unaries.push('u' + t.unarySign); // ex: 'u-'
  }
  return { atoms, ops, unaries };
}

function multiset(list) {
  const m = Object.create(null);
  for (const x of list) m[x] = (m[x] || 0) + 1;
  return m;
}
function multisetEqual(a, b) {
  const ma = multiset(a), mb = multiset(b);
  const ka = Object.keys(ma), kb = Object.keys(mb);
  if (ka.length !== kb.length) return false;
  for (const k of ka) if (ma[k] !== mb[k]) return false;
  return true;
}

function normalizeMatchMode(mode, legacyBool, legacyOrder) {
  // Normalize strings
  if (typeof mode === 'string') {
    const s = mode.toLowerCase().trim();
    if (s === 'sequence' || s === 'séquence') return 'sequence';
    if (s === 'multiset' || s === 'multi' || s === 'bag' || s === 'sac') return 'multiset';
    if (s === 'true') return 'multiset';
    if (s === 'false') return false;
  }
  // Booleans / truthy
  if (mode === true)  return 'multiset';
  if (mode === false || mode == null) {
    // Rétro-compat : anciens flags
    if (legacyBool === true)  return legacyOrder ? 'sequence' : 'multiset';
    return false;
  }
  return mode; // 'sequence' | 'multiset' déjà normalisé
}


// 3) Vérificateur (GRADER)
// ... début identique ...

// === Grader clair : statuts explicites + meta non écrasées ===
// === Grader simple : statuts {invalid_parse, wrong_nature, unequal, ok, correct} ===
window.verifier = function verifier(initialObj, answerObj, regles = {}) {
  const rules = normalizePolicies(regles);

  // ---------- Helpers locaux ----------
  const normalizeMatchMode = (mode, legacyBool, legacyOrder) => {
    if (typeof mode === 'string') {
      const s = mode.toLowerCase().trim();
      if (s === 'sequence' || s === 'séquence') return 'sequence';
      if (s === 'multiset' || s === 'multi' || s === 'bag' || s === 'sac') return 'multiset';
      if (s === 'true') return 'multiset';
      if (s === 'false') return false;
    }
    if (mode === true) return 'multiset';
    if (mode === false || mode == null) {
      // compat anciens flags : memeAtomes + ordreAtomes
      if (legacyBool === true) return legacyOrder ? 'sequence' : 'multiset';
      return false;
    }
    return mode; // 'sequence' | 'multiset'
  };

  const multiset = (list) => {
    const m = Object.create(null);
    for (const x of (list || [])) m[x] = (m[x] || 0) + 1;
    return m;
  };
  const multisetEqual = (a, b) => {
    const A = multiset(a), B = multiset(b);
    const ka = Object.keys(A), kb = Object.keys(B);
    if (ka.length !== kb.length) return false;
    for (const k of ka) if (A[k] !== B[k]) return false;
    return true;
  };
  const sequenceEqual = (a, b) =>
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);

  const collectAtomsOpsFromAnalyser = (objetString) => {
    const toks = objetString?.analyserTokens?.() || [];
    const atoms = [], ops = [], unaries = [];
    for (const t of toks) {
      if (t?.sigAtom) atoms.push(t.sigAtom);
      if (t?.sigOp)   ops.push(t.sigOp);
      if (t?.unarySign === '+' || t?.unarySign === '-') unaries.push('u' + t.unarySign);
    }
    return { atoms, ops, unaries };
  };

  // ---------- A) Entrées minimales ----------
  if (!answerObj || answerObj.valid !== true) {
    const message = (answerObj && typeof answerObj.erreur === 'string' && answerObj.erreur.trim())
      ? answerObj.erreur
      : 'Réponse invalide.';
    return { status: 'invalid_parse', message, meta: { isAtom: false, isAtomRaw: false } };
  }

  // ---------- B) Évaluation des deux expressions ----------
  const initRes = getEvalResult(initialObj);
  const ansRes0 = getEvalResult(answerObj);

  const isAtomRaw  = !!(answerObj?.arbre?.isAtome?.() && answerObj.arbre.isAtome());
  const isAtomEval = !!ansRes0.isAtom;

  if (!initRes.expr || !ansRes0.expr) {
    const message = (typeof answerObj.erreur === 'string' && answerObj.erreur.trim())
      ? answerObj.erreur
      : 'Évaluation impossible.';
    return { status: 'invalid_parse', message, meta: { isAtom: isAtomEval, isAtomRaw } };
  }

  // ---------- C) Nature (si exigée) ----------
  if (rules.memeType) {
    const n1 = initRes.expr.getNature?.();
    const n2 = ansRes0.expr.getNature?.();
    if (n1 !== n2) {
      return { status: 'wrong_nature', meta: { isAtom: isAtomEval, isAtomRaw, attendu: n1, obtenu: n2 } };
    }
  }

  // ---------- D) Égalité (numérique ou symbolique) ----------
  let equal = false;
  if (rules.egalite.mode === 'numerique') {
    if (initRes.isAtom && ansRes0.isAtom) {
      equal = numericEqualWithUnits(initRes.expr, ansRes0.expr, rules);
    } else {
      try { equal = initialObj.checkEqual(answerObj) === true; } catch { equal = false; }
    }
  } else { // 'symbolique'
    try { equal = initialObj.checkEqual(answerObj) === true; } catch { equal = false; }
  }
  if (!equal) {
    return { status: 'unequal', meta: { isAtom: isAtomEval, isAtomRaw } };
  }

  // ---------- GATING : exiger une EXPRESSION brute (pas un atome) ----------
  const fmt = rules.format || {};
  let meta = { isAtom: isAtomEval, isAtomRaw };
  if (fmt.exigerExpression === true && isAtomRaw) {
    // ex : on attend "7*4+1", l'élève tape "29"
    return { status: 'ok', meta: { ...meta, reason: 'need_expression_raw' } };
  }

  // ---------- E0) Forme sur SAISIE BRUTE : mêmes atomes / mêmes opérations ----------
  // compat anciens flags -> memesAtomes unifié
  const atomsMode = normalizeMatchMode(fmt.memesAtomes, fmt.memeAtomes, fmt.ordreAtomes);
  const opsMode   = normalizeMatchMode(fmt.memesOperations);
  let atomsOK = true, opsOK = true;

  try {
    if (atomsMode || opsMode) {
      const refAO = collectAtomsOpsFromAnalyser(initialObj); // référence = correction si fournie
      const ansAO = collectAtomsOpsFromAnalyser(answerObj);

      // A) mêmes atomes ?
      if (atomsMode) {
        atomsOK = (atomsMode === 'sequence')
          ? sequenceEqual(refAO.atoms, ansAO.atoms)
          : multisetEqual(refAO.atoms, ansAO.atoms);

        if (!atomsOK && fmt.expressionSuffit !== true) {
          return {
            status: 'ok',
            meta: { ...meta, reason: 'different_atoms', mode: atomsMode,
                    expectedAtoms: refAO.atoms, obtainedAtoms: ansAO.atoms }
          };
        }
      }

      // B) mêmes opérations ?
      if (opsMode) {
        const refOps = fmt.opsInclureUnaires ? refAO.ops.concat(refAO.unaries) : refAO.ops;
        const ansOps = fmt.opsInclureUnaires ? ansAO.ops.concat(ansAO.unaries) : ansAO.ops;

        opsOK = (opsMode === 'sequence')
          ? sequenceEqual(refOps, ansOps)
          : multisetEqual(refOps, ansOps);

        if (!opsOK && fmt.expressionSuffit !== true) {
          return {
            status: 'ok',
            meta: { ...meta, reason: 'different_ops', mode: opsMode, includeUnary: !!fmt.opsInclureUnaires,
                    expectedOps: refOps, obtainedOps: ansOps }
          };
        }
      }
    }

    // C) Raccourci : "expression suffisante"
    // égalité + formes demandées OK -> CORRECT immédiat (sans exiger atome/format/unité)
    if (fmt.expressionSuffit === true) {
      const formesOK = (atomsMode ? atomsOK : true) && (opsMode ? opsOK : true);
      if (formesOK) {
        return { status: 'correct',
                 meta: { ...meta, reason: 'expression_form_sufficient',
                         atomsMode: atomsMode || false, opsMode: opsMode || false } };
      }
    }
  } catch (e) {
    console.warn('forme (atomes/ops) check error:', e);
    // on n’éjecte pas, on laisse les contrôles de format/unité décider
  }

  // ---------- E1) Exigences de format / unités (sur le RÉSULTAT évalué) ----------
  let ansRes = ansRes0; // peut être mis à jour si autoConvertToTarget

// === GATING : on exige une EXPRESSION brute (pas un atome seul) ===
// -> ce test DOIT être placé avant E0 (mêmes atomes/ops) et avant expressionSuffit.


  // 1) Exiger un ATOME BRUT (pas d'opération dans la saisie)
  if (fmt.exigerAtome === true && !isAtomRaw) {
    return { status: 'ok', meta: { ...meta, reason: 'need_atom_raw' } };
  }

  // 2) Type de nombre (si atome évalué)
  if (fmt.nombre && fmt.nombre !== 'any' && ansRes.isAtom) {
    const nb = ansRes.expr?.nombre;
    const t  = nb?.typeEcriture;
    let okNombre = true;
    if (fmt.nombre === 'simple')   okNombre = nb?.isSimp?.() === true;
    if (fmt.nombre === 'fraction') okNombre = (t === 'frac');
    if (fmt.nombre === 'decimal')  okNombre = (t === 'dec');

    if (!okNombre) {
      return { status: 'ok', meta: { ...meta, reason: 'number_format_mismatch', expected: fmt.nombre } };
    }
  }

  // 3) Unité cible
  if (fmt.uniteCible) {
    if (ansRes.isAtom && canCheckUnits(ansRes.expr)) {
      const cibleDict = Atome.parseUniteTexte(fmt.uniteCible);
      const ansDict   = ansRes.expr?.grandeur?.uniteDict ?? {};

      if (!areUnitsEqualDict(ansDict, cibleDict)) {
        // proposer une conversion
        const converted = tryConvertToUnit(ansRes.expr, fmt.uniteCible);
        meta = {
          ...meta,
          targetUnit: fmt.uniteCible,
          suggestionText: renderText(converted, initialObj.options),
          suggestionLatex: renderLatex(converted, initialObj.options)
        };

        // auto-conversion autorisée ?
        if (fmt.autoConvertToTarget === true) {
          ansRes = { ...ansRes, expr: tryConvertToUnit(ansRes.expr, fmt.uniteCible) };
        }

        const finalDict = ansRes.expr?.grandeur?.uniteDict ?? {};
        const uniteOK = areUnitsEqualDict(finalDict, cibleDict);

        if (!uniteOK) {
          // valeur correcte mais unité pas celle demandée → OK (progression)
          return { status: 'ok', meta: { ...meta, reason: 'wrong_unit' } };
        }
      }
    } else {
      // pas un atome → impossible de vérifier l’unité maintenant, mais valeur correcte
      return { status: 'ok', meta: { ...meta, targetUnit: fmt.uniteCible, reason: 'need_atom_to_check_unit' } };
    }
  }

  // ---------- Si on arrive ici : tout est bon ----------
  return { status: 'correct', meta };
};




