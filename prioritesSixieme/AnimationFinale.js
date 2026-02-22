/* ==============================================
   AnimationFinale — utilise AnimationConfetti
================================================ */
class AnimationFinale {
  /**
   * @param {Object} options - { score, total, nbQuestions, resultat, onRestart, scoreSender, identifiant }
   * resultat : div DOM obligatoire pour afficher le bilan
   */
  constructor(options) {
    this.score = Number(options.score || 0);
    this.total = Number(options.total || 0);          // optionnel (non utilisé pour le ratio si 0)
    this.nbQuestions = Math.max(0, Number(options.nbQuestions || 0));
    this.resultat = options.resultat;                 // <--- div DOM OBLIGATOIRE
    if (!this.resultat) throw new Error("Le div resultat doit être fourni à AnimationFinale !");
    this.onRestart = options.onRestart;
    this.scoreSender = options.scoreSender;           // optionnel (doit exposer .send(value, id, meta))
    this.identifiant = options.identifiant || "anonyme";

    this._timeouts = [];
    this._confettiEnd = 0;

    // confettis autonomes (canvas-confetti wrapper)
    this.confetti = new AnimationConfetti();
  }

  _installKeyframesOnce() {
    if (document.getElementById("popfin-keyframes")) return;
    const style = document.createElement('style');
    style.id = "popfin-keyframes";
    style.textContent = `
      @keyframes popfin {
        0% { transform: scale(0.7); opacity: 0; }
        70% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  _clearTimers() {
    for (const id of this._timeouts) clearTimeout(id);
    this._timeouts.length = 0;
    this._confettiEnd = 0;
  }

  _schedule(fn, delay) {
    const id = setTimeout(fn, delay);
    this._timeouts.push(id);
  }

  // mémorise la fin estimée des effets confettis pour déclencher le retour de fond + bouton
  _scheduleConfetti(fn, delay, estimatedMs = 2000) {
    this._confettiEnd = Math.max(this._confettiEnd || 0, delay + estimatedMs);
    this._schedule(fn, delay);
  }

  teardown() {
    this._clearTimers();
    this.confetti.stop(); // on conserve le canvas pour ré-usage (rapide)
    // si tu veux tout retirer :
    // this.confetti.teardown();
  }

  afficher() {
    this._clearTimers();
    this._installKeyframesOnce();

    const denom = this.total > 0 ? this.total : 1;
    const ratio = Math.max(0, Math.min(1, this.score / denom));
    const pct   = Math.round(ratio * 100);

    let message, emoji, color, bg, nbSalves = 0, interval = 350;
    if (ratio === 1) {
      emoji = "🏆";
      message = "Score parfait !";
      color = "#27ae60"; bg = "#eafaf1"; nbSalves = 7; interval = 250;
    } else if (ratio >= 0.8) {
      emoji = "🎉";
      message = "Excellent !";
      color = "#2980b9"; bg = "#eaf6ff"; nbSalves = 4; interval = 400;
    } else if (ratio >= 0.6) {
      emoji = "👍";
      message = "Pas mal !";
      color = "#f39c12"; bg = "#fffbe6"; nbSalves = 10; interval = 400;
    } else {
      emoji = "💡";
      message = "Entraîne-toi encore !";
      color = "#e74c3c"; bg = "#fff3f3"; nbSalves = 10;
    }

    // Accessibilité : live region
    this.resultat.className = "";
    this.resultat.setAttribute("role", "status");
    this.resultat.setAttribute("aria-live", "polite");

    this.resultat.innerHTML = `
      <div id="finJeu" style="
        animation: popfin 0.6s cubic-bezier(.68,-0.55,.27,1.55) both;
        font-size: 2em;
        color: ${color};
        background: ${bg};
        margin-top: 0.5em;
        margin-bottom: 0.5em;
        font-weight: bold;
        border-radius: 18px;
        padding: 22px 12px;
        text-align: center;
      ">
        <div style="font-size:2em;line-height:1">${emoji}</div>
        ${message}<br>
        <span style="font-size:0.9em;color:#333;">
          Score final : ${this.score} / ${this.total} (${pct}%)
        </span>
      </div>
      <div style="width:100%;display:flex;justify-content:center;">
        <button id="restartButton" style="
          margin-top: 0.5em;
          padding: 12px 28px;
          font-size: 1.05em;
          border-radius: 30px;
          background: linear-gradient(90deg, #27ae60 60%, #6dd5fa 100%);
          color: white;
          border: none;
          cursor: pointer;
          transition: transform 0.2s;
          font-weight: 600;
        ">Recommencer</button>
      </div>
    `;

    // Typeset si MathJax est chargé
    try {
      if (window.MathJax?.typesetPromise) window.MathJax.typesetPromise([this.resultat]);
      else if (window.MathJax?.typeset) window.MathJax.typeset([this.resultat]);
    } catch {}

    // --- DURANT L’ANIMATION : forcer tous les fonds en #002 ---
    const finCard = this.resultat.querySelector('#finJeu');
    const btn = document.getElementById('restartButton');

    // cacher le bouton pendant les confettis
    if (btn) btn.style.display = 'none';

    // mémoriser le bg final (celui calculé ci-dessus) et forcer #002 pendant l’anim
    const finalBg = bg;
    this.resultat.style.background = '#002';
    if (finCard) finCard.style.background = '#002';

    // ---------------- Confettis (utiliser _scheduleConfetti) ----------------
    if (nbSalves > 0) {
      const S_PERFECT = 1.8;
      const S_BRAVO   = 1.4;
      const S_BIEN    = 1.6;
      const S_SOFT    = 1.6;

      if (ratio === 1) {
        // 1) salves (4 salves / 500ms) — ticks:100 ≈ 1.7s
        this._scheduleConfetti(() => {
          this.confetti.salvos(5, 500, {
            x: 0.5, y: 0.4,
            angle: 90, spread: 180,
            startVelocity: 30, particleCount: 140,
            ticks: 100, scalar: 2, flat: true,
            shapes: [ ...this.confetti.shapesFromText("😎🥳🤩", { scalar: S_PERFECT }) ]
          });
        }, 700, (4 - 1) * 500 + 1700);


      } else if (ratio >= 0.8) {
        // très bon score — ticks:240 ≈ 4s
        this._scheduleConfetti(() => {
          this.confetti.salvos(nbSalves, interval, {
            x: 0.5, y: 0.35, angle: 60, spread: 90,
            startVelocity: 32, particleCount: 90,
            ticks: 240, scalar: 1,
            shapes: [ "rect","star","circle" ]
          });
        }, 800, (nbSalves - 1) * interval + 4000);

      } else if (ratio >= 0.6) {
        // score moyen — ticks:220 ≈ 3.7s
        this._scheduleConfetti(() => {
          this.confetti.salvos(nbSalves, interval, {
            y: 0.5, spread: 100, startVelocity: 40, particleCount: 100,
            ticks: 220, scalar: S_BIEN,
            shapes: [ ...this.confetti.shapesFromText("👍", { scalar: S_BIEN }) ]
          });
        }, 900, (nbSalves - 1) * interval + 3700);

      } else {
      // 👉 Pluie de 🙏 pendant 10s, une “goutte” toutes les 140 ms
this._scheduleConfetti(() => {
  this.confetti.rain(
    10000,        // durationMs
    100,          // freqMs (intervalle entre gouttes)
    {
      angle: 270,           // ⬇️ vers le bas
      gravity: 0.95,        // chute lisible
      ticks: 320,           // durée de vie des particules
      scalar: S_SOFT,       // doit matcher le scalar de shapeFromText
      flat: true,           // (optionnel) pas de rotation/tilt 3D
      particleCount: 2,     // par “goutte” (évite 50 sinon ça sature)
      shapes: this.confetti.shapesFromText("💡", { scalar: S_SOFT })
      // ⚠️ les couleurs n'affectent pas les emoji : ils gardent leur rendu natif
    }
  );
}, 1000, 10000); // ← estimatedMs = même durée que la pluie (10s)

      }
    }

    // --- Après la dernière confettis : restaurer le bg final + afficher le bouton ---
    const revealAt = (this._confettiEnd || 0) + 400; // petite marge
    this._schedule(() => {
      if (finCard) finCard.style.background = finalBg;   // la carte repasse à son fond final
      this.resultat.style.background = '';               // le conteneur redevient neutre
      if (btn) { btn.style.display = ''; try { btn.focus(); } catch {} }
    }, revealAt);

    // Envoi du score si demandé
    if (this.scoreSender && typeof this.scoreSender.send === "function") {
      try {
        this.scoreSender.send(
          `${this.score}/${this.nbQuestions || this.total}`,
          this.identifiant,
          { date: new Date().toISOString(), percent: pct }
        );
      } catch (e) { /* silencieux */ }
    }

    // Wiring bouton (handlers)
    if (btn) {
      btn.onclick = () => { this._clearTimers(); if (typeof this.onRestart === "function") this.onRestart(); };
      btn.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); } };
      btn.onpointerdown = () => { btn.style.transform = "scale(0.98)"; };
      btn.onpointerup = btn.onpointerleave = () => { btn.style.transform = "scale(1)"; };
    }
  }
}
