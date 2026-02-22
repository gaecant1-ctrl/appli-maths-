// Classe Prefixe — centralise l’affichage lettre + signe (=, ≠, ?) + ghost + a11y
class Prefixe {
  /**
   * @param {HTMLElement} container - Élément hôte (ex: .left-part)
   * @param {Object} options
   *   - zone: "initial" | "response" | "correction"
   *   - index: number (0 pour la première ligne de la section)
   *   - lettre: string|null
   *   - phase: "attente" | "evaluation" (par défaut "attente")
   *   - statut: "pending" | "correct" | "ok" | "incorrect" | "invalide" (par défaut "pending")
   */
  constructor(container, options = {}) {
    if (!container) throw new Error('Prefixe: container requis');
    this.container = container;

    // options avec défauts
    const {
      zone = 'response',
      index = 0,
      lettre = null,
      phase = 'attente',
      statut = 'pending',
    } = options;

    this.options = { zone, index, lettre, phase, statut };

    // éléments DOM
    this.root = null;
    this.letterEl = null;
    this.signEl = null;
  }

  // --- helpers internes ---
  _symbolForStatut(s) {
    if (s === 'incorrect') return '≠';
    if (s === 'invalide')  return '?';
    // pending, ok, correct → '='
    return '=';
  }

  _stateClassForStatut(s) {
    // retourne la classe d’état pour .equal-sign, ou null si pending
    if (s === 'incorrect') return 'state-incorrect';
    if (s === 'invalide')  return 'state-invalid';
    if (s === 'ok')        return 'state-ok';
    if (s === 'correct')   return 'state-correct';
    return null; // pending
  }

  _ariaLabelForStatut(s) {
    if (s === 'incorrect') return 'Réponse incorrecte';
    if (s === 'invalide')  return 'Réponse invalide';
    if (s === 'ok')        return 'Format non conforme';
    if (s === 'correct')   return 'Réponse correcte';
    return null; // pending
  }

  _shouldGhost(index, hasLetter) {
    // règle universelle : ghost si première ligne et pas de lettre
    return index === 0 && !hasLetter;
  }

  // --- cycle de vie ---
  mount() {
    // nettoyage défensif
    this.destroy();

    const { zone, index } = this.options;
    const rawLetter = (typeof this.options.lettre === 'string') ? this.options.lettre.trim() : null;
    const hasLetter = !!rawLetter;

    // racine
    const root = document.createElement('span');
    root.className = 'prefix';
    root.classList.add(`prefix-${zone}`);
    // style inline minimal (si tu préfères, gère ça en CSS globale)
    root.style.display = 'inline-flex';
    root.style.alignItems = 'baseline';

    // lettre
    if (hasLetter) {
      const letterEl = document.createElement('span');
      letterEl.className = 'lhs-letter';
      letterEl.textContent = rawLetter;
      // styles d’alignement
      letterEl.style.display = 'inline-block';
      letterEl.style.minWidth = '1ch';
      letterEl.style.marginRight = '.35rem';
      root.appendChild(letterEl);
      this.letterEl = letterEl;
    }

    // signe
    const signEl = document.createElement('span');
    signEl.className = 'equal-sign';
    // styles d’alignement
    signEl.style.display = 'inline-block';
    signEl.style.minWidth = '1ch';
    signEl.style.textAlign = 'center';
    signEl.style.marginRight = '.35rem';

    const symbol = this._symbolForStatut(this.options.statut);
    signEl.textContent = symbol;

    // classes d’état
    const stateClass = this._stateClassForStatut(this.options.statut);
    if (stateClass) signEl.classList.add(stateClass);

    // a11y label (pas pour pending)
    const aria = this._ariaLabelForStatut(this.options.statut);
    if (aria) signEl.setAttribute('aria-label', aria);

    // ghost si index===0 et pas de lettre
    const makeGhost = this._shouldGhost(index, hasLetter);
    if (makeGhost) {
      signEl.classList.add('ghost-equal');
      signEl.setAttribute('aria-hidden', 'true');
    } else {
      signEl.setAttribute('aria-hidden', 'false');
    }

    root.appendChild(signEl);

    // injecter
    this.container.insertBefore(root, this.container.firstChild || null);

    // refs
    this.root = root;
    this.signEl = signEl;
  }

  destroy() {
    if (this.root && this.root.parentNode) {
      try { this.root.parentNode.removeChild(this.root); } catch (_) {}
    }
    this.root = null;
    this.letterEl = null;
    this.signEl = null;
  }
}




// ===== Classe abstraite mère =====
class Exercice {
  constructor(container) {
    if (new.target === Exercice) throw new Error("Classe abstraite !");
    this.container = container;
    this.status = null;
    this.reponseCorrecte = null;
    this.feedback = {
      "correct": "✅ Bonne réponse !",
      "incorrect": "❌ Mauvaise réponse.",
      "invalide": "⛔ Format invalide."
    };
  }

  _render() {
    throw new Error("_render() doit être implémentée dans la sous-classe.");
  }

  _setupEvents() {}
  _genererQuestion() {
    throw new Error("_genererQuestion() doit être implémentée dans la sous-classe.");
  }

  valider() {
    throw new Error("valider() doit être implémentée dans la sous-classe.");
  }

  points() {
    return this.status === "correct" ? 1 : 0;
  }

  test(reponse) {
    throw new Error("test() doit être implémentée dans la sous-classe.");
  }

  _emitValidation() {
    const event = new CustomEvent("reponseValidee", {
      detail: {
        status: this.status,
        points: this.points ? this.points() : 0,
        exercice: this
      }
    });
    this.container.dispatchEvent(event);
  }
}

class ExerciceExpression extends Exercice {
  constructor(container, questionData) {
    super(container);
    this.questionData = questionData;
    this.policies = normalizePolicies(this.questionData?.options?.policies || (window.REGLES?.strict || {}));
    this._prefixLetter = null;

    this.question = questionData.question;
    this.expressionInitiale = questionData.expressionInitiale;
    try {
      this.objetInitial = new ObjetString(
        this.expressionInitiale,
        this.questionData.options.modeCorrection
      );
    } catch (e) { console.error("Erreur ObjetString :", e); }

    this.status = null;
    this._render();
    this._genererQuestion();
  }

  // --------- helpers ---------
_getLHSLetter() {
  const raw = this.questionData?.options?.affichageAvecLettre;
  return (typeof raw === 'string' && raw.trim() !== '') ? raw.trim() : null;
}


  _getReferenceObjetForGrading() {
    const mc   = this.questionData?.options?.modeCorrection || {};
    const corr = mc.correction || {};
    const exprStr = (typeof corr.expression === 'string' && corr.expression.trim()) ? corr.expression : null;
    if (exprStr) {
      try { return new ObjetString(exprStr, mc); } catch {}
    }
    return this.objetInitial;
  }

  // --------- render ---------
_render() {
  this.container.innerHTML = '';

  // Question
  this.questionDiv = document.createElement('div');
  this.questionDiv.className = 'question';
  this.container.appendChild(this.questionDiv);

  // Énoncé initial
  this.initialDiv = document.createElement('div');
  this.initialDiv.className = 'initial-zone';
  this.container.appendChild(this.initialDiv);

  // Zone réponses (wrappers)
  this.reponseDiv = document.createElement('div');
  this.reponseDiv.className = 'reponse';
  this.container.appendChild(this.reponseDiv);

  // Bouton correction
  this.actionsDiv = document.createElement('div');
  this.actionsDiv.className = 'bouton-correction';
  this.container.appendChild(this.actionsDiv);

  this.btnCorrection = document.createElement('button');
  this.btnCorrection.textContent = 'Correction';
  this.btnCorrection.className = 'btn-correction';
  this.btnCorrection.addEventListener('click', () => {
   
    this._correction();  // supprime le bouton + affiche avec animation
    if (!this.status) this._finish('incorrect', { status: 'forced_by_correction' });
  });
  this.actionsDiv.appendChild(this.btnCorrection);

  // Conteneur unique de correction (vide au départ, donc masqué par :empty)
  this.correctionDiv = document.createElement('div');
  this.correctionDiv.className = 'correction-content';
  // S'assure qu'il n'est pas en état ouvert au départ
  this.correctionDiv.classList.remove('is-open');
  this.container.appendChild(this.correctionDiv);

  // Écoutes internes
this.reponseDiv.addEventListener('wrapperRemoved', () => this._reindexPrefixes());
this.reponseDiv.addEventListener('equalSignsMaybeUpdate', () => this._reindexPrefixes());
this.reponseDiv.addEventListener('gradeResult', (e) => this._onGradeResult(e));
}



_genererQuestion() {
  // 1) Titre + reset zones
  this.questionDiv.textContent = this.questionData?.question || '';
  this.initialDiv.innerHTML = '';
  this.reponseDiv.innerHTML = '';

  // 2) Lettre commune (juste lue depuis les options pour l’initiale et à passer aux wrappers)
  this._prefixLetter = (
    typeof this.questionData?.options?.affichageAvecLettre === 'string' &&
    this.questionData.options.affichageAvecLettre.trim() !== ''
  ) ? this.questionData.options.affichageAvecLettre.trim() : null;

  // Marqueur pour l’indexation globale (0 réservé si initiale affichée)
  this.initialWrapper = null;

  // 3) Énoncé initial (avec Prefixe)
  if (this.questionData?.options?.affichage?.initial?.expression === true ||
      this.questionData?.options?.affichageInitial?.expressionInitiale === true) {

    const wrap = document.createElement('div');
    wrap.className = 'initial-wrapper';

    const left = document.createElement('div');
    left.className = 'left-part';
    wrap.appendChild(left);

    // Prefixe gère lettre, signe, ghost, a11y
    const initialPrefix = new Prefixe(left, {
      zone: 'initial',
      index: 0,
      lettre: this._prefixLetter,
      phase: 'attente',
      statut: 'pending',
    });
    initialPrefix.mount();

    // Expression LaTeX
    const expr = document.createElement('div');
    expr.className = 'latex-formula';
    left.appendChild(expr);

    this.initialDiv.appendChild(wrap);

    try {
      const affInit = this.questionData?.options?.affichageInitial
                   ?? this.questionData?.options?.affichage?.initial
                   ?? {};
      const latex = this.objetInitial?.arbre?.toLatex?.(affInit) || '';
      expr.innerHTML = latex ? `$${latex}$` : '';
      if (window.MathJax?.typeset) MathJax.typeset([expr]);
    } catch (e) {
      console.error('Erreur LaTeX :', e);
    }

    // indique qu'une initiale occupe l'index 0 pour _reindexPrefixes()
    this.initialWrapper = { index: 0 };
  }

  // 4) Première ligne de réponse
  this._createInputWrapper();
  // transmet la lettre commune au wrapper fraîchement créé
  if (this.inputWrapper) this.inputWrapper._prefixLetter = this._prefixLetter;

}

/**
 * Réattribue les index de l’expression initiale et des InputWrapper.
 * L’initiale, si elle existe, prend toujours l’index 0.
 * Les wrappers sont ensuite numérotés séquentiellement.
 */
// Dans ta classe ExerciceExpression

_reindexPrefixes() {
  let base = 0;

  // 1) Expression initiale : toujours index 0 si présente
  if (this.initialWrapper) {
    this.initialWrapper.index = 0;
    base = 1;
    // (optionnel debug) this.initialDiv?.dataset.prefixIndex = "0";
  }

  // 2) Wrappers de réponse : indexation séquentielle puis (re)build du préfixe
  const wrappers = Array.from(this.reponseDiv?.querySelectorAll('.input-wrapper') || []);
  wrappers.forEach((w, i) => {
    const inst = w.instance;
    if (!inst) return;
    inst.index = base + i;
    if (typeof inst._buildPrefixe === 'function') inst._buildPrefixe();
    // (optionnel debug)
    w.dataset.prefixIndex = String(base + i);
  });
}




  _createInputWrapper() {
    if (this.inputWrapper) this.inputWrapper.disable();
    const refObj = this._getReferenceObjetForGrading();
    this.inputWrapper = new InputWrapper(refObj, this.reponseDiv, this.questionData.options);
    this.inputWrapper._prefixLetter = this._prefixLetter;   // injecte la lettre commune
    this._reindexPrefixes();
  }

  // --------- correction ---------
// Dans class ExerciceExpression
// Dans class ExerciceExpression
_correction() {
  
  // --- 0) nettoyage éventuel de l'input en cours ---
  if (this.inputWrapper && !this.inputWrapper._disabled) {
    // soit on le retire complètement :
    try {
      this.inputWrapper.wrapper.remove();
    } catch(_) {}
    this.inputWrapper = null;

    // ⚡ notifie le container qu'un wrapper est retiré (pour reindexPrefixes)
    this.reponseDiv.dispatchEvent(
      new CustomEvent('wrapperRemoved', { bubbles: true, composed: true })
    );
  }
  
  // 1) Retirer le bouton/ligne pour libérer l’espace
  if (this.btnCorrection) { try { this.btnCorrection.remove(); } catch {} this.btnCorrection = null; }
  if (this.actionsDiv && this.actionsDiv.parentNode) {
    this.actionsDiv.parentNode.removeChild(this.actionsDiv);
  }
  this.actionsDiv = null;

  // 2) Conteneur unique de correction (créé si besoin)
  const host = this.correctionDiv || (() => {
    const d = document.createElement('div');
    d.className = 'correction-content';
    this.container.appendChild(d);
    this.correctionDiv = d;
    return d;
  })();

  // >>> Désactive toute animation/transition et force l’affichage complet
  host.classList.remove('is-open');      // au cas où
  host.style.transition = 'none';
  host.style.animation = 'none';
  host.style.maxHeight = 'none';
  host.style.opacity = '1';
  host.style.transform = 'none';
  host.style.display = 'block';          // visible même si :empty retiré
  host.style.padding = '14px';           // padding normal
  host.innerHTML = '';

  // 3) Options
  const mc   = this.questionData?.options?.modeCorrection || {};
  const corr = mc.correction || {};

  const hasExpr = (typeof corr.expression === 'string' && corr.expression.trim().length > 0);
  const exprStr = hasExpr ? corr.expression.trim() : this.expressionInitiale;

  // Fallback : si AUCUNE des 3 clés n’est fournie → (etapes:true, result:true)
  const hasEtapes = Object.prototype.hasOwnProperty.call(corr, 'etapes');
  const hasResult = Object.prototype.hasOwnProperty.call(corr, 'result');
  const noCustom  = !hasExpr && !hasEtapes && !hasResult;

  const showSteps = noCustom ? true : !!corr.etapes;
  const showRes   = noCustom ? true : !!corr.result;

  const labels = {
    steps:  corr.labelEtapes   || 'Correction étape par étape',
    result: corr.labelResultat || corr.labelReponse || 'Réponse'
  };

  // 4) Objet de référence
  let refObj;
  try { refObj = new ObjetString(exprStr, mc); }
  catch { refObj = this.objetInitial; }

  // 5) Helpers (écrivent directement dans host)
  const addH3 = (txt) => {
    const h = document.createElement('h3');
    h.textContent = txt;
    h.style.margin = '6px 0 8px';
    h.style.textAlign = 'center';
    host.appendChild(h);
  };

  const lhs =
    (typeof this._getLHSLetter === 'function')
      ? this._getLHSLetter()
      : ((t => (typeof t === 'string' && t.trim() !== '') ? t.trim() : null)
          (this.questionData?.options?.affichageAvecLettre));

  // Une ligne = préfixe ("A =" ou "=") + expression
  const addLine = (latex, showEqual) => {
    const tex = String(latex || '').trim();
    if (!tex) return;

    const line = document.createElement('div');
    line.className = 'etape';

    const prefix = document.createElement('span');
    prefix.className = 'etape-egal equal-sign';
    const show = lhs ? true : !!showEqual;          // avec lettre → toujours visible
    prefix.textContent = lhs ? `${lhs}\u00A0=` : '='; // espace insécable
    if (!show) prefix.classList.add('is-hidden');
    line.appendChild(prefix);

    const expr = document.createElement('span');
    expr.className = 'etape-expr';
    expr.innerHTML = `\\(${tex}\\)`;
    line.appendChild(expr);

    host.appendChild(line);
  };

  // 6) Remplissage
  let somethingAdded = false;

  if (showSteps) {
    addH3(labels.steps);
    let etapesLatex = [];
    try {
      const out = refObj.calculerLatex();
      etapesLatex = Array.isArray(out?.etapes) ? out.etapes : [];
    } catch {
      etapesLatex = [ refObj?.arbre?.toLatex?.(mc) || '' ];
      const warn = document.createElement('div');
      warn.className = 'resultat invalide';
      warn.textContent = '(Étapes indisponibles)';
      host.appendChild(warn);
    }
    etapesLatex.forEach((latex, idx) => { addLine(latex, idx !== 0); somethingAdded = true; });
  }

  if (showRes) {
    addH3(labels.result);
    let finalLatex = '';
    try { finalLatex = refObj.calculer().resultat?.toLatex?.(mc) || ''; } catch {}
    if (!finalLatex) finalLatex = refObj?.arbre?.toLatex?.(mc) || '';
    addLine(finalLatex, !!showSteps);
    somethingAdded = true;
  }

  if (!somethingAdded) {
    addH3(labels.result);
    const initLatex = refObj?.arbre?.toLatex?.(mc) || '';
    addLine(initLatex, false);
  }

  // 7) Typeset (sans animation, sans reflow spécial)
  try {
    if (window.MathJax?.typesetPromise) MathJax.typesetPromise([host]).catch(()=>{});
    else if (window.MathJax?.typeset)   MathJax.typeset([host]);
  } catch {}
}





  // --------- verdict / suite ---------
  _shouldContinue(verdictStatus) {
    const s = this.policies?.suite || {};
    const contFmt = (typeof s.continuerSiFormatIncorrect === 'boolean')
      ? s.continuerSiFormatIncorrect
      : true;

    if (verdictStatus === 'correct')       return false;
    if (verdictStatus === 'invalid_parse') return !!s.continuerSiInvalide;
    if (verdictStatus === 'wrong_nature')  return !!s.continuerSiMauvaiseNature;
    if (verdictStatus === 'unequal')       return !!s.continuerSiInegale;
    if (verdictStatus === 'ok')            return contFmt;
    return false;
  }

  _finish(finalStatus, verdict) {
    this.status = finalStatus;
    this.inputWrapper?.disable();
    this._emitValidationWithVerdict(verdict);
  }

  _emitValidationWithVerdict(verdict) {
    const event = new CustomEvent("reponseValidee", {
      detail: {
        status: this.status,
        points: this.points ? this.points() : 0,
        exercice: this,
        verdict: verdict || null
      },
      bubbles: true,
      composed: true
    });
    this.container.dispatchEvent(event);
  }

  _onGradeResult(e) {
    const verdict = e.detail || {};
    const status  = verdict.status || 'invalid_parse';

    if (status === 'correct') {
      this._finish('correct', verdict);
      return;
    }

    const continuer = this._shouldContinue(status);
    if (continuer) {
      this._createInputWrapper();
    } else {
      this._finish('incorrect', verdict);
    }
  }
}


class InputWrapper {
constructor(expressionObj, container, options) {
  this.expressionObj = expressionObj;
  this.container = container;
  this.options = options || {};
  this.policies = normalizePolicies(this.options.policies || (window.REGLES?.strict || {}));

  this.wrapper = document.createElement('div');
  this.wrapper.classList.add('input-wrapper');
  


  // === gauche: lettre + signe + (input/latex) ===
  this.left = document.createElement('div');
  this.left.classList.add('left-part');
  this.wrapper.appendChild(this.left);
     // ⚡ lien instance → DOM
  this.wrapper.instance = this;
    // ⚡ index sera réattribué plus tard par _reindexPrefixes()
  this.index = null;

    // Construction du préfixe
  this._buildPrefixe();
  
  // Champ de saisie
  this.input = document.createElement('input');
  this.input.type = "text";
  this.input.placeholder = "Écris ta réponse ici";
  this.input.classList.add('input-wrapper-input');
  this.left.appendChild(this.input);

  // === droite: commentaire ===
  this.comment = document.createElement('div');
  this.comment.classList.add('comment');
  this.comment.setAttribute('role', 'status');
  this.comment.setAttribute('aria-live', 'polite');
  this.wrapper.appendChild(this.comment);

  this.container.appendChild(this.wrapper);

  // debug / état
  this.answer = null;
  this.lastIsAtom = false;
  this._composing = false;
  this._disabled = false;

  // Handlers
  this._keydownHandler = (e) => this.handleKeydown(e);
  this._inputHandler = () => this.input?.classList.remove('input-error');
  this._compositionStart = () => { this._composing = true; };
  this._compositionEnd = () => { this._composing = false; };

  // Events
  this.input.addEventListener("keydown", this._keydownHandler);
  this.input.addEventListener("input", this._inputHandler);
  this.input.addEventListener("compositionstart", this._compositionStart);
  this.input.addEventListener("compositionend", this._compositionEnd);

  this.input.focus();
}


  // ---------- utils visuels ----------
  
  // --- InputWrapper: méthode _buildPrefixe (version qui lit le statut depuis this.prefix.options.statut)
_buildPrefixe() {

  // ⚡ récupérer le statut désiré avant destruction (ou 'pending' par défaut)
  const wantedStatut = (this.prefix?.options?.statut) || 'pending';
  const wantedPhase  = (wantedStatut === 'pending') ? 'attente' : 'evaluation';

  // 2) détruire l’ancien préfixe (s’il existe)
  if (this.prefix && typeof this.prefix.destroy === 'function') {
    try { this.prefix.destroy(); } catch (_) {}
  } else if (this.left) {
    const old = this.left.querySelector('.prefix');
    if (old) old.remove();
  }
  this.prefix = null;

  // 3) créer le nouveau préfixe avec le statut/phase souhaités
  this.prefix = new Prefixe(this.left, {
    zone: 'response',
    index: (typeof this.index === 'number' ? this.index : 0),
    lettre: this._prefixLetter ?? null,
    phase: wantedPhase,
    statut: wantedStatut,
  });

  this.prefix.mount();
}




  createCloseButton() {
    const closeButton = document.createElement('span');
    closeButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      </svg>`;
    closeButton.setAttribute('aria-label', 'Fermer');
    closeButton.setAttribute('title', 'Fermer');
    closeButton.setAttribute('role', 'button');
    closeButton.tabIndex = 0;
    closeButton.classList.add('close-button');

    const remove = () => {
      this.wrapper.remove();
      this.container.dispatchEvent(new CustomEvent('wrapperRemoved', { bubbles: true, composed: true }));
    };

    closeButton.addEventListener('click', remove);
    closeButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        remove();
      }
    });

    return closeButton;
  }

  disable() {
    this._disabled = true;
    if (this.input) {
      this.input.disabled = true;
      this.input.setAttribute('aria-disabled', 'true');
      this.input.classList.add('is-disabled');
      this.input.removeEventListener("keydown", this._keydownHandler);
      this.input.removeEventListener("input", this._inputHandler);
      this.input.removeEventListener("compositionstart", this._compositionStart);
      this.input.removeEventListener("compositionend", this._compositionEnd);
    }
  }

  // ---------- saisie ----------
  handleKeydown(event) {
    if (this._disabled) return;
    if (this._composing) return;

    const isEnter = (event.key === "Enter");
    const isCtrlEnter = (event.key === "Enter" && (event.ctrlKey || event.metaKey));
    if (!isEnter && !isCtrlEnter) return;

    event.preventDefault();
    const raw = (this.input?.value ?? '').trim();
    if (!raw) return;

    let answer = null;
    try {
      const baseOpts = (this.expressionObj && this.expressionObj.options) || {};
      const opts = Object.assign({}, baseOpts, this.options?.modeCorrection || {});
      answer = new ObjetString(raw, opts);
    } catch {}

    this.answer = answer;

    try {
      const maybePromise = window.verifier(this.expressionObj, answer, this.policies);
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then((v) => this.processVerdict(v))
                    .catch((err) => this.processVerdict({ status: 'invalid_parse', message: err?.message || 'Erreur' }));
      } else {
        this.processVerdict(maybePromise);
      }
    } catch (err) {
      this.processVerdict({ status: 'invalid_parse', message: err?.message || 'Erreur' });
    }
  }

 // --- InputWrapper: méthode processVerdict (utilise Prefixe pour refléter le signe)
processVerdict(verdict) {
  const status = verdict?.status || 'invalid_parse';

  // 1) normaliser en "statut" pour Prefixe
  const newStatut =
    (status === 'invalid_parse') ? 'invalide' :
    (status === 'wrong_nature' || status === 'unequal') ? 'incorrect' :
    (status === 'ok') ? 'ok' :
    'correct';

  // 2) si le statut change, on le pose sur this.prefix.options puis on reconstruit le préfixe
  const currentStatut = this.prefix?.options?.statut || 'pending';
  if (newStatut !== currentStatut) {
    if (this.prefix?.options) this.prefix.options.statut = newStatut;
    this._buildPrefixe();
  }

  // 3) remplacement input -> LaTeX si la réponse est valide
  if (this.answer?.valid === true) {
    try {
      let latex = this.answer?.arbre?.toLatex?.(this.options?.modeCorrection || {}) || '';
      latex = latex.replace(/\\cdot\s*(?=\{?\d)/g, '\\times').replace(/\\cdot/g, '');
      const latexDiv = document.createElement('div');
      latexDiv.className = 'latex-formula';
      // sécurité : pas d'innerHTML direct
      latexDiv.textContent = `$${latex}$`;

      if (this.input && this.input.parentNode) {
        this.left.insertBefore(latexDiv, this.input);
        this.input.remove();
        this.input = null;
      }
      if (window.MathJax?.typesetPromise) MathJax.typesetPromise([latexDiv]);
      else if (window.MathJax?.typeset)   MathJax.typeset([latexDiv]);
    } catch (e) {
      console.error("Erreur de rendu LaTeX :", e.message);
    }
  } else {
    if (this.input) {
      this.input.focus();
      this.input.select();
      this.input.classList.add('input-error');
    }
  }

  // 4) commentaire (inchangé)
  this.displayComment(status, verdict);

  // 5) events (inchangé)
  this.container.dispatchEvent(new CustomEvent('gradeResult',  { detail: verdict, bubbles: true, composed: true }));
  this.container.dispatchEvent(new CustomEvent('equalSignsMaybeUpdate', { bubbles: true, composed: true }));
}


  displayComment(status, verdict) {
    const meta = verdict?.meta || {};
    const reason = meta.reason;

    const className =
      (status === 'correct') ? 'success' :
      (status === 'ok')      ? 'info' :
                               'error';

    let txt = '';
    if (status === 'invalid_parse') {
      txt = verdict?.message || "Réponse invalide.";
    } else if (status === 'wrong_nature') {
      const attendu = meta.attendu ?? '—';
      const obtenu  = meta.obtenu  ?? '—';
      txt = `Nature incorrecte (attendu : ${attendu}, obtenu : ${obtenu}).`;
    } else if (status === 'unequal') {
      txt = "Valeur incorrecte.";
    } else if (status === 'ok') {
      switch (reason) {
        case 'need_expression_raw':     txt = "ok, mais relis l'énoncé"; break;
        case 'need_atom_raw':           txt = "ok, continue."; break;
        case 'number_format_mismatch':  txt = "Format du nombre non conforme."; break;
        case 'wrong_unit':              txt = "Unité attendue non respectée."; break;
        case 'need_atom_to_check_unit': txt = "ok, continue."; break;
        case 'different_atoms':         txt = "ok, mais relis l'énoncé"; break;
        case 'different_ops':           txt = "ok, mais relis l'énoncé"; break;
        default:                        txt = "ok, mais format non conforme.";
      }
    } else if (status === 'correct') {
      txt = "✅ Bravo !";
    }

    this.comment.innerHTML = '';
    this.comment.className = "comment " + className;

    if (status !== 'correct') {
      const closeButton = this.createCloseButton();
      this.comment.appendChild(closeButton);
    }

    const feedbackSpan = document.createElement('span');
    feedbackSpan.textContent = txt;
    this.comment.appendChild(feedbackSpan);

    if (reason === 'wrong_unit' && (meta.suggestionLatex || meta.suggestionText)) {
      const sug = document.createElement('div');
      sug.style.marginTop = '4px';
      if (meta.suggestionLatex) {
        sug.textContent = `$${meta.suggestionLatex}$`;
        this.comment.appendChild(sug);
        if (window.MathJax?.typesetPromise) MathJax.typesetPromise([sug]);
        else if (window.MathJax?.typeset)   MathJax.typeset([sug]);
      } else {
        sug.textContent = meta.suggestionText;
        this.comment.appendChild(sug);
      }
    }
  }
}




