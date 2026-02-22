
class Animation {
  constructor(){ this._timers = new Set(); }
  _schedule(fn, delay){
    const id = setTimeout(() => { this._timers.delete(id); fn(); }, delay);
    this._timers.add(id);
    return id;
  }
  clear(){
    for(const id of this._timers) clearTimeout(id);
    this._timers.clear();
  }
}

class AnimationSmiley extends Animation {
  constructor(){
    super();
    this._installCSS();
  }

  _installCSS(){
    if (document.getElementById("reward-css")) return;
    const style = document.createElement("style");
    style.id = "reward-css";
    style.textContent = `
      .reward{
        position:fixed;
        left:50%; top:50%;
        transform:translate(-50%, -50%);
        font-size:6rem;
        line-height:1;
        pointer-events:none; user-select:none;
        z-index:999999;
      }
      @keyframes rw-spin{
        0%{ transform: translate(-50%, -50%) rotate(0deg) scale(1);}
        100%{ transform: translate(-50%, -50%) rotate(360deg) scale(1);}
      }
      .reward.rotate{ animation: rw-spin 1s linear infinite; }
      @keyframes rw-pulse{
        0%{ transform: translate(-50%, -50%) scale(0.7);}
        100%{ transform: translate(-50%, -50%) scale(1.5);}
      }
      .reward.pulse{ animation: rw-pulse .5s ease-in-out infinite alternate; }
      @keyframes rw-spiral{
        0%{ transform: translate(-50%, -50%) scale(.5) rotate(0deg); opacity:1;}
        50%{ transform: translate(calc(-50% + 80px), calc(-50% - 80px)) scale(1.2) rotate(360deg); opacity:1;}
        100%{ transform: translate(calc(-50% + 160px), calc(-50% - 160px)) scale(.8) rotate(720deg); opacity:0;}
      }
      .reward.spiral{ animation: rw-spiral 2s ease-out forwards; }
      .reward.costume{ width:1em; height:1em; }
      .reward.costume span{
        position:absolute;
        top:50%; left:50%;
        transform:translate(-50%, -50%);
        opacity:0; transition:opacity .12s;
        font-size:1em; line-height:1;
      }
      .reward.costume span.active{ opacity:1; }
    `;
    document.head.appendChild(style);
  }

  /**
   * @param {"rotate"|"pulse"|"spiral"|"costume"} type
   * @param {string|string[]} emoji
   * @param {object} opts { duration?:number, sizeRem?:number }
   */
  launch(type, emoji, opts = {}){
    const duration = opts.duration ?? (type === 'pulse' ? 1500 : 2000);
    const sizeRem  = opts.sizeRem ?? 6;

    const el = document.createElement('div');
    el.className = 'reward';
    el.style.fontSize = `${sizeRem}rem`;

    if (type === 'costume') {
      el.classList.add('costume');
      const faces = Array.isArray(emoji) ? emoji : [String(emoji || '😀')];
      faces.forEach((face, i) => {
        const span = document.createElement('span');
        span.textContent = face;
        if (i === 0) span.classList.add('active');
        el.appendChild(span);
      });

      document.body.appendChild(el);

      let idx = 0;
      const spans = el.querySelectorAll('span');
      const interval = setInterval(() => {
        spans[idx].classList.remove('active');
        idx = (idx + 1) % spans.length;
        spans[idx].classList.add('active');
      }, 180);

      this._schedule(() => { clearInterval(interval); el.remove(); }, duration);

    } else {
      el.textContent = Array.isArray(emoji) ? emoji[0] : (emoji || '😀');
      el.classList.add(type);
      document.body.appendChild(el);
      this._schedule(() => el.remove(), duration);
    }
  }
}

/* ==============================================
   Confettis autonomes plein écran (sans package)
   API publique:
     - burst(opts)
     - salvos(nb, interval, optsFactory?)
     - rain(durationMs, ratePerSec?)
     - stop()
     - teardown()
================================================ */
// ==============================================
// AnimationConfetti — wrapper canvas-confetti
// ==============================================
 class AnimationConfetti {
    constructor(options = {}) {
      const canvas = document.createElement("canvas");
      Object.assign(canvas.style, {
        position: "fixed", inset: "0",
        pointerEvents: "none", width: "100%", height: "100%",
        zIndex: options.zIndex || 2147483647
      });
      document.body.appendChild(canvas);

      this._confetti = confetti.create(canvas, { resize: true, useWorker: false });
      this.colors  = options.colors  || ["#e74c3c","#f1c40f","#2ecc71","#3498db","#9b59b6","#ff6f61"];
      this.gravity = options.gravity ?? 1;
      this.ticks   = options.ticks   ?? 250;
      this.scalar  = options.scalar  ?? 1.0;
      this.reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
      this._textShapeCache = new Map();
      this._rainTimer = null;
      this.flat   = options.flat ?? false;
    }

    shapesFromText(str, { scalar = 1.6 } = {}) {
      return [...str].map(ch => {
        const key = ch + "::" + scalar;
        if (!this._textShapeCache.has(key)) {
          this._textShapeCache.set(key, confetti.shapeFromText({ text: ch, scalar }));
        }
        return this._textShapeCache.get(key);
      });
    }

    burst(opts = {}) {
      const reduce = this.reduceMotion || opts.reduceMotion;
      const {
        x = 0.5, y = 0.5,
        particleCount = reduce ? 25 : 80,
        angle = 90, spread = 120,
        startVelocity = reduce ? 18 : 32,
        gravity = this.gravity, ticks = this.ticks,
        scalar = this.scalar,
        shapes = ["square","circle","star"],
        colors = this.colors,
        flat = (opts.flat ?? this.flat) 
      } = opts;

      this._confetti({
        particleCount, angle, spread, startVelocity,
        gravity, ticks, scalar, colors,
        origin: { x, y }, shapes,
        flat
      });
    }

    salvos(nb = 3, interval = 280, base = {}) {
      for (let i = 0; i < nb; i++) {
        setTimeout(() => {
          const leftSide = Math.random() < 0.5;
          this.burst({
            x: leftSide ? (0.18 + Math.random()*0.12) : (0.70 + Math.random()*0.12),
            y: 0.8,
            spread: 100, startVelocity: 30,
            particleCount: 100,
            flat: (base.flat ?? this.flat),
            ...base
          });
        }, i * interval);
      }
    }

    rain(durationMs = 2500, freqMs = 160, base = {}) {
      if (this._rainTimer) clearInterval(this._rainTimer);
      const endAt = performance.now() + durationMs;
      this._rainTimer = setInterval(() => {
        if (performance.now() > endAt) {
          clearInterval(this._rainTimer);
          this._rainTimer = null;
          return;
        }
        this.burst({
          x: Math.random(), y: -0.05,
          angle: 90, spread: 30,
          particleCount: 3, startVelocity: 20,
          gravity: 0.7, ticks: 350,
          flat: (base.flat ?? this.flat),
          ...base
        });
      }, freqMs);
    }

    celebrate(base = {}) {
      this.burst({ particleCount: 120, spread: 100, startVelocity: 35, ...base });
      this.salvos(3, 280, base);
      flat: (base.flat ?? this.flat),
      setTimeout(() => this.rain(2500, 120, base), 500);
    }

    stop() {
      if (this._rainTimer) { clearInterval(this._rainTimer); this._rainTimer = null; }
    }

    teardown() {
      this.stop();
      if (this._confetti?.reset) this._confetti.reset();
      this._textShapeCache.clear();
    }
  }
