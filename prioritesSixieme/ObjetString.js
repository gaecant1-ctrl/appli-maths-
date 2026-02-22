class ObjetString {
  constructor(expression, options) {
    this.expression = expression;
    this.options = options;
    this.erreur = null;
    this.tokens = this.tokeniser(expression);
    try {
      this.arbre = this.construireArbre();
      console.log(this.arbre);
    } catch (e) {
      this.arbre = null;
      this.erreur = e.message;
      console.warn("ErreurConstructionArbre:", this.erreur);
    }

    // ✅ état explicite
    this.valid = (this.erreur === null && !!this.arbre);
  }

  isValid() {
    // ✅ ne relance pas le parse, retourne l’état calculé au ctor
    return !!this.valid;
  }



tokeniser(expr) {
  const s = String(expr);
  const out = [];

  const isSpace      = c => /\s/.test(c);
  const isParen      = c => c === '(' || c === ')';
  const isOp         = c => c === '+' || c === '-' || c === '*' || c === ':';
  const isAtomStart  = c => /[0-9a-zA-Z€]/.test(c);           // début d’atome
  const isAtomChar   = c => /[0-9a-zA-Z€.,/^·]/.test(c);      // suite d’atome

  let i = 0;
  let prev = 'start'; // 'start' | 'atom' | 'op' | 'parenL' | 'parenR'

  while (i < s.length) {
    // sauter espaces
    while (i < s.length && isSpace(s[i])) i++;
    if (i >= s.length) break;

    const c = s[i];

    // Parenthèses
    if (isParen(c)) {
      out.push(c);
      prev = (c === '(') ? 'parenL' : 'parenR';
      i++;
      continue;
    }

    // Opérateurs
    if (isOp(c)) {
      const unaryContext = (prev === 'start' || prev === 'op' || prev === 'parenL');

      if ((c === '+' || c === '-') && unaryContext) {
        // on tente de coller le signe à un littéral juste après
        let j = i + 1;
        while (j < s.length && isSpace(s[j])) j++;
        if (j < s.length && isAtomStart(s[j])) {
          const sign = c;
          let k = j + 1;
          while (k < s.length && isAtomChar(s[k])) k++;
          out.push(sign + s.slice(j, k)); // ex: "-4", "-x", "-2m"
          i = k;
          prev = 'atom';
          continue;
        }
        // sinon (ex: "-(") → garder le signe séparé
      }

      out.push(c);   // opérateur binaire (ou unaire non collable)
      prev = 'op';
      i++;
      continue;
    }

    // Atome générique (nombre/unité/ident)
    if (isAtomChar(c)) {
      let k = i + 1;
      while (k < s.length && isAtomChar(s[k])) k++;
      out.push(s.slice(i, k));
      prev = 'atom';
      i = k;
      continue;
    }

    // Caractère inconnu → on le pousse tel quel (ou lever une erreur)
    out.push(s[i++]);
    prev = 'op';
  }

  return out;
}


analyserTokens() {
  const tokens = this.tokens || [];
  const options = this.options || {};

  const isOp = (t) => t === '+' || t === '-' || t === '*' || t === ':';
  const isParen = (t) => t === '(' || t === ')';

  const normOp = (t) => (t === ':' ? '/' : t); // normalise la division

  const out = [];

  for (const raw of tokens) {
    // 1) Parenthèses
    if (isParen(raw)) {
      out.push({
        token: raw,
        nature: 'parenthèse',
        paren: raw
      });
      continue;
    }

    // 2) Opérateurs (binaires/isolés)
    if (isOp(raw)) {
      out.push({
        token: raw,
        nature: 'opération',
        op: raw,
        sigOp: normOp(raw)
      });
      continue;
    }

    // 3) Atomes / autres
    try {
      const atome = Atome.from(raw, {}); // parse métier de l'atome

      // signature stricte: on utilise toString(options) pour rester cohérent
      let sigAtom = '';
      try { sigAtom = atome?.toString?.(options) || String(raw); }
      catch { sigAtom = String(raw); }

      // signe unaire fusionné ? (ex: "-2m", "-x", "+3")
      let unarySign = null;
      if (typeof raw === 'string' && /^[+-]/.test(raw)) {
        unarySign = raw[0];
      }

      out.push({
        token: raw,
        nature: atome.getNature(), // ex: 'nombre', 'grandeur', 'ident'
        objet: atome,
        sigAtom,
        unarySign // '+', '-' ou null
      });
    } catch (e) {
      if (e && (e.code === "UNITE_INVALIDE" || e.name === "UniteInvalideError")) {
        out.push({
          token: raw,
          nature: 'unite-invalide',
          invalidUnits: e.invalidUnits,
          erreur: e.message
        });
      } else {
        out.push({
          token: raw,
          nature: 'inconnu',
          erreur: e?.message || 'inconnu'
        });
      }
    }
  }
 console.log(out);
  return out;
}




construireArbre() {
  const tokensAnalyses = this.analyserTokens();

  // 1) PRIORITÉ : unité invalide -> message unique et clair
  const errUnits = tokensAnalyses.filter(t => t.nature === 'unite-invalide');
  if (errUnits.length > 0) {
    const invalidUnits = [...new Set(errUnits.flatMap(t => t.invalidUnits || []))];
    const msg = invalidUnits.length
      ? `Unité invalide : ${invalidUnits.join(', ')}`
      : `Unité invalide`;
    const e = new Error(msg);
    e.code = "UNITE_INVALIDE";
    e.invalidUnits = invalidUnits;
    throw e;
  }

  // 2) Autres erreurs de token -> message court, pas de "Tokens invalides : ..."
  const erreurs = tokensAnalyses.filter(t => t.nature === "inconnu");
  if (erreurs.length > 0) {
    const e = new Error("Réponse invalide.");
    e.code = "PARSE_ERROR";
    throw e;
  }

  // 3) Parsing normal (inchangé)
  let index = 0;

  const parseExpression = (options) => parseAddSub(options);

  const parseAtom = (options) => {
    if (index >= tokensAnalyses.length) throw new Error("Réponse invalide.");

    const token = tokensAnalyses[index++];

    if (token.token === '(') {
      const expr = parseExpression(options);
      if (index >= tokensAnalyses.length || tokensAnalyses[index++].token !== ')') {
        throw new Error("Réponse invalide.");
      }
      expr.instanceOptions = { ...(expr.instanceOptions || {}), parenthese: true };
      return expr;
    }

    if (token.objet) return token.objet;
    throw new Error("Réponse invalide.");
  };

  const parseMulDiv = (options) => {
    let left = parseAtom(options);
    while (index < tokensAnalyses.length && ['*', ':'].includes(tokensAnalyses[index].token)) {
      const op = tokensAnalyses[index++].token;
      const right = parseAtom(options);
      left = (op === '*') ? new Produit([left, right], {}) : new Quotient([left, right], {});
    }
    return left;
  };

  const parseAddSub = (options) => {
    let left = parseMulDiv(options);
    while (index < tokensAnalyses.length && ['+', '-'].includes(tokensAnalyses[index].token)) {
      const op = tokensAnalyses[index++].token;
      const right = parseMulDiv(options);
      if (op === '+') {
        left = (left instanceof Somme && !left.instanceOptions?.parenthese)
          ? new Somme([...left.termes, right], {})
          : new Somme([left, right], {});
      } else {
        left = new Difference([left, right], {});
      }
    }
    if (left instanceof Somme && left.termes.length === 1) return left.termes[0];
    return left;
  };

  this.arbre = parseExpression(this.options);
  if (index < tokensAnalyses.length) throw new Error("Réponse invalide.");
  return this.arbre;
}


 calculer() {
  let arbre = this.arbre;
  const etapes = [arbre.toString(this.options)];
  let iterations = 0;
  const max = 100;

  while (iterations++ < max) {
    const suivant = arbre.evaluer(this.options);
    console.log("suivant",suivant);
    // Si l'étape suivante est un atome, on ajoute sa représentation finale et on arrête
    if (typeof suivant?.isAtome === "function" && suivant.isAtome()) {
      const finalStr = suivant.toString(this.options);
      if (finalStr !== etapes[etapes.length - 1]&&suivant.instanceOptions.affiche) {
        etapes.push(finalStr);
      }
      arbre=suivant;
      break;
    }

    // Comparer les chaînes textuelles
    const suivantStr = suivant.toString(this.options);
    const dernier = etapes[etapes.length - 1];

    if (suivantStr !== dernier) {
      etapes.push(suivantStr);
    }

    arbre = suivant;
    
  }

  if (iterations === max) {
    console.warn("Max itérations atteint dans calculer()");
  }
try {
  console.log("suivant JSON:", JSON.stringify(arbre));
} catch (e) {
  console.error("Erreur JSON.stringify :", e);
}

  return {
    resultat: arbre,
    etapes
  };
}


calculerLatex() {
  
  let arbre = this.arbre;
  const etapes = [arbre.toLatex(this.options)];
  let iterations = 0;
  const max = 10;
  
  try {
    while (iterations++ < max) {
      const suivant = arbre.evaluerPasAPas(this.options)
      //console.log(suivant);
      // Protection contre boucle infinie ou absence de progrès
      //if (!suivant || suivant === arbre) break;

      // Si on atteint un atome
      
      if (typeof suivant.isAtome === "function" && suivant.isAtome()) {
     
        const latex = suivant.toLatex(this.options);
        if (latex !== etapes[etapes.length - 1]) {
          etapes.push(latex);
     }
        arbre=suivant;
        break;
      }

      // Vérifie si toLatex change
      
      const latexSuivant = suivant.toLatex(this.options);
      const dernierLatex = etapes[etapes.length - 1];

      if (latexSuivant != dernierLatex) {
        etapes.push(latexSuivant);
      }

      arbre = suivant;
      console.log("nouvelleEtape");
    }

    if (iterations === max) {
      console.warn("⚠️ Max itérations atteint dans calculerLatex");
      etapes.push("\\text{\\color{red}{\\text{Limite d'itérations atteinte}}}");
    }
  } catch (e) {
    console.error("Erreur pendant calculerLatex :", e);
    etapes.push("\\text{\\color{red}{\\text{Erreur : " + e.message + "}}}");
  }

  return {
    resultat: arbre.toLatex(this.options),
    etapes
  };
}



  checkEqual(other) {
    console.log(this,other);
    try{
     
      const r1 = this.calculer().resultat;
      const r2 = other.calculer().resultat;
      
      return r1.equals(r2);
    }catch (e){
      this.erreur = e.message;
      console.log(this.erreur)
      return false;
    }
  }

  result() {
    try {
      return this.calculer().resultat;
    } catch {
      return null;
    }
  }
}


