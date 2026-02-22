// Quiz.js — version claire, mêmes IDs/classes que l'original + support texts.readyImage
class Quiz {
  /**
   * @param {Object} options
   * @param {HTMLElement|string} options.mount              Conteneur (élément ou sélecteur)
   * @param {number} [options.nbQuestions=10]              Nombre total d'exercices
   * @param {(zone:HTMLElement, index:number)=>any} options.buildExercise
   * @param {Object} [options.texts]                       Libellés et options d'affichage
   *   - score: (bonnes,total)=>string
   *   - btnStart, btnNext, btnBilan, ready, ok(n), ko(n)
   *   - header: (n)=>string
   *   - readyImage: string|null (URL d'image pour la page d'accueil)
   */
  constructor({ mount, nbQuestions = 10, buildExercise, texts = {} }) {
    if (!mount) throw new Error("Quiz: l'option 'mount' est requise.");
    if (typeof buildExercise !== 'function') {
      throw new Error("Quiz: 'buildExercise(zone, index)' est requis.");
    }

    this.mount = (typeof mount === 'string') ? document.querySelector(mount) : mount;
    if (!this.mount) throw new Error("Quiz: élément 'mount' introuvable.");

    this.nbQuestions = nbQuestions;
    this.buildExercise = buildExercise;

    // Libellés (avec surcharges possibles)
    this.texts = {
      score: (b, t) => `Score : ${b}/${t}`,
      btnStart: 'Commencer',
      btnNext: 'Nouvel exercice',
      btnBilan: 'Bilan',
      header: n => `Exercice ${n}`,
      ready: 'Choisissez le niveau puis cliquez sur Commencer',
      ok: n => `Exercice ${n} réussi`,
      ko: n => `Vous avez échoué l’exercice ${n}`,
      readyImage: null, // ex: 'assets/accueil.png'
      ...texts,
    };

    // État
    this.total = 0;
    this.bonnes = 0;
    this.hasStarted = false;
    this.questionValidee = false;
    this.exercice = null;

    // UI & events
    this._onNextClick = this._onNextClick.bind(this);
    this._buildUi();
  }

  // --------- API publique ---------
start() {
  this._resetState();
  this._updateScore();
  this.hasStarted = false;
  this._unlockLevelUI();
  this._clearMessage();
  this.zone.innerHTML = '';
  this.nextButton.style.display = '';
  this._showReadyScreen();
  this._setNextLabel(this.texts.btnStart);
  this.nextButton.disabled = false;
  this.nextButton.focus();   // <-- focus dès le départ
}



  destroy() {
    if (this.root && this.root.parentNode) this.root.parentNode.removeChild(this.root);
    this.root = null;
  }

  /** Renvoie le slot <div id="niveau-slot"> pour y monter ton sélecteur de niveau */
  getLevelSlot() { return this.levelSlot; }
  
  _lockLevelUI() {
    try {
      const sel = this.levelSlot && this.levelSlot.querySelector('select');
      if (sel) sel.disabled = true;
      this.levelSlot?.classList.add('is-locked');
    } catch (_) {}
  }
  _unlockLevelUI() {
    try {
      const sel = this.levelSlot && this.levelSlot.querySelector('select');
      if (sel) sel.disabled = false;
      this.levelSlot?.classList.remove('is-locked');
    } catch (_) {}
  }

  // --------- UI ---------
  _buildUi() {
    // Racine
    this.root = document.createElement('div');
    this.root.id = 'container';

    // En-tête
    this.header = document.createElement('div');
    this.header.id = 'titre';

    this.scoreEl = document.createElement('div');
    this.scoreEl.id = 'score';
    this.scoreEl.textContent = this.texts.score(this.bonnes, this.total);

    this.levelSlot = document.createElement('div');
    this.levelSlot.id = 'niveau-slot';

    this.nextButton = document.createElement('button');
    this.nextButton.id = 'nextButton';
    this.nextButton.type = 'button';
    this.nextButton.textContent = this.texts.btnStart;
    this.nextButton.addEventListener('click', this._onNextClick);

    this.header.appendChild(this.scoreEl);
    this.header.appendChild(this.levelSlot);
    this.header.appendChild(this.nextButton);
    
    this.exerciceZone= document.createElement('div');
    this.exerciceZone.id = 'exercice-zone';
    this.exerciceZone.className = 'exercice-zone';
    
    // Zone résultat
    this.resultEl = document.createElement('div');
    this.resultEl.id = 'resultat';
    this.resultEl.className = 'resultat';
    this.resultEl.style.display = 'none';

    // Zone exercice
    this.zone = document.createElement('div');
    this.zone.id = 'exercice-container';

    // Injection
    this.exerciceZone.appendChild(this.resultEl);
    this.exerciceZone.appendChild(this.zone);
    this.root.appendChild(this.header);
    this.root.appendChild(this.exerciceZone);
    this.mount.appendChild(this.root);
  }

  _clearMessage() {
    this.resultEl.className = 'resultat';
    this.resultEl.textContent = '';
    this.resultEl.classList.remove('show');
    this.resultEl.style.display = 'none';
  }

  _showMessage(msg, css = '') {
    this.resultEl.className = 'resultat ' + css;
    this.resultEl.innerHTML = '';                // reset avant injection
    this.resultEl.textContent = msg || '';
    this.resultEl.style.display = 'flex';
    // si ton CSS utilise .show pour l'animation/affichage
    this.resultEl.classList.add('show');
  }

_showReadyScreen() {
  this._clearMessage();
  this.zone.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'quiz-ready';

  // IMAGE uniquement si vraie valeur
  if (
    typeof this.texts.readyImage === "string" &&
    this.texts.readyImage.trim() !== ""
  ) {
    const media = document.createElement('div');
    media.className = 'quiz-ready-media';

    const img = document.createElement('img');
    img.src = this.texts.readyImage;
    img.alt = 'Accueil';

    media.appendChild(img);
    wrap.appendChild(media);
  }

  // TEXTE
  if (
    typeof this.texts.ready === "string" &&
    this.texts.ready.trim() !== ""
  ) {
    const txt = document.createElement('div');
    txt.className = 'quiz-ready-text';
    txt.textContent = this.texts.ready;
    wrap.appendChild(txt);
  }

  this.zone.appendChild(wrap);
}


  _updateScore() {
    this.scoreEl.textContent = this.texts.score(this.bonnes, this.total);
  }

  _setNextLabel(label) {
    this.nextButton.textContent = label;
  }

  // --------- Flux ---------
  _resetState() {
    this.total = 0;
    this.bonnes =0;
    this.questionValidee = false;
    this.exercice = null;
  }

  _onNextClick() {
    if (!this.hasStarted) {
      this.hasStarted = true;
      this._lockLevelUI();  
      this._nouvelleQuestion();
      //this._finQuiz();
      return;
    }

    if (!this.questionValidee) {
      if (this.exercice && typeof this.exercice.valider === 'function') {
        this.exercice.valider();
      }
      return;
    }

    if (this.total < this.nbQuestions) {
      this._nouvelleQuestion();
    } else {
      this._finQuiz();
    }
  }

  _nouvelleQuestion() {
    this.questionValidee = false;
    this.zone.innerHTML = '';

    const index = this.total + 1;
    this._showMessage(this.texts.header(index));

    // Le builder ne reçoit PAS le niveau : il le capture de l'extérieur si nécessaire
    this.exercice = this.buildExercise(this.zone, index);

    this.nextButton.disabled = true;

    const handler = (e) => {
      const { status, points } = e.detail || {};
      const correct = status === 'correct';

      this._showMessage(
        correct ? this.texts.ok(index) : this.texts.ko(index),
        correct ? 'correct' : 'incorrect'
      );

      this.total++;
      this.bonnes += (typeof points === 'number') ? points : (correct ? 1 : 0);
      this._updateScore();

      this.questionValidee = true;
      this._setNextLabel(this.total === this.nbQuestions ? this.texts.btnBilan : this.texts.btnNext);
      this.nextButton.disabled = false;
      this.nextButton.focus();  

      this.zone.removeEventListener('reponseValidee', handler);
    };

    this.zone.addEventListener('reponseValidee', handler);
  }

_finQuiz() {
  // --- mémorise les styles pour restaurer ensuite
  this._finalRestore = {
    headerDisplay: this.header.style.display,
    resultDisplay: this.resultEl.style.display,
    exZoneStyle: this.exerciceZone.getAttribute('style') || '',
    zoneStyle: this.zone.getAttribute('style') || '',
    rootOverflow: document.documentElement.style.overflow || ''
  };

  // 1) Masquer l'en-tête + le message résultat (mais garder exerciceZone visible)
  this.header.style.display = 'none';
  this.resultEl.style.display = 'none';
  this.nextButton.style.display = 'none';

  // 2) Mettre exerciceZone en plein écran (fond noir) et centrer this.zone
  this.exerciceZone.setAttribute('style', `
    position: fixed;
    inset: 0;
    background: #002;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
    z-index: 1; /* confettis sont en fixed au-dessus, c'est ok */
  `);

  // Option : empêcher le scroll derrière pendant le final
  document.documentElement.style.overflow = 'hidden';

  // 3) Préparer la zone d'affichage du final
  this.zone.setAttribute('style', `
    max-width: min(720px, 92vw);
    color: #fff;
    border: none;
    background: #002;
  `);
  this.zone.innerHTML = '';

  // 4) Lancer l'animation finale
  const anim = new AnimationFinale({
    score: this.bonnes,
    total: this.total,
    nbQuestions: this.nbQuestions,
    resultat: this.zone,
    onRestart: () => {
      // --- Restauration de l'UI initiale
      this.header.style.display = this._finalRestore.headerDisplay;
      this.resultEl.style.display = this._finalRestore.resultDisplay;
      this.nextButton.style.display = '';

      // styles d'avant sur les conteneurs
      if (this._finalRestore.exZoneStyle) {
        this.exerciceZone.setAttribute('style', this._finalRestore.exZoneStyle);
      } else {
        this.exerciceZone.removeAttribute('style');
      }
      if (this._finalRestore.zoneStyle) {
        this.zone.setAttribute('style', this._finalRestore.zoneStyle);
      } else {
        this.zone.removeAttribute('style');
      }

      document.documentElement.style.overflow = this._finalRestore.rootOverflow;

      // relancer le quiz
      this.start();
    }
  });

  anim.afficher();
}


}

// Exposer globalement
window.Quiz = Quiz;
