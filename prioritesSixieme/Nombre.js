
class Nombre {
  constructor(s) {
    if (typeof s !== 'string') s = String(s);
    this.initial = s;
    this.valeurNum = this.parse(s);
    this.valeur = s;
    this.typeEcriture = s.includes('/') ? 'frac' : 'dec';
  }

  // ———————————————————
  // Construction & normalisation
  // ———————————————————
  static fromParts(a, b = 1) {
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      throw new Error("Paramètres non finis");
    }
    if (b === 0) throw new Error("Dénominateur nul");
    if (b < 0) { a = -a; b = -b; } // normalise: dénominateur > 0
    const n = Object.create(Nombre.prototype);
    n.initial = `${a}/${b}`;
    n.valeurNum = { a, b };
    n.valeur = n.initial;
    n.typeEcriture = 'frac';
    return n;
  }

  // ———————————————————
  // Parsing robuste
  // ———————————————————
  parse(s) {
    s = s.replace(/,/g, '.').replace(/\s+/g, ' ').trim();

    // entier
    if (/^[+-]?\d+$/.test(s)) return { a: parseInt(s, 10), b: 1 };

    // décimal (accepte "12.3", "-.5", ".75")
    if (/^[+-]?\d*\.\d+$/.test(s)) {
      const sign = s[0] === '-' ? -1 : 1;
      const absStr = s.replace(/^[+-]/, '');
      const [intPartRaw, decPart] = absStr.split('.');
      const intPart = intPartRaw === '' ? 0 : parseInt(intPartRaw, 10);
      const denom = 10 ** decPart.length;
      const numerAbs = intPart * denom + parseInt(decPart, 10);
      return { a: sign * numerAbs, b: denom };
    }

    // fraction simple "a/b" (signe possible sur les deux — on normalise ensuite)
    if (/^[+-]?\d+\/[+-]?\d+$/.test(s)) {
      let [a, b] = s.split('/').map(Number);
      if (b === 0) throw new Error("Dénominateur nul");
      if (b < 0) { a = -a; b = -b; }
      return { a, b };
    }

    // nombre mixte: "ent + num/den" (signe uniquement sur la partie entière)
    const mixte = /^([+-]?\d+)\s*(?:\+)?\s*(\d+)\/(\d+)$/;
    if (mixte.test(s)) {
      const [, entStr, numStr, denStr] = s.match(mixte);
      const ent = parseInt(entStr, 10);
      const num = parseInt(numStr, 10);
      const den = parseInt(denStr, 10);
      if (den === 0) throw new Error("Dénominateur nul");
      // si ent < 0, le numérateur total est ent*den - num
      const a = ent >= 0 ? ent * den + num : ent * den - num;
      const b = den;
      return { a, b };
    }

    throw new Error("Format invalide : " + s);
  }

  // ———————————————————
  // Propriétés
  // ———————————————————
  isSimp() {
    if (this.typeEcriture === "dec") return true;
    const { a, b } = this.valeurNum;
    return gcd(a, b) === 1;
  }

  isDecimal() {
    const { a, b } = this.valeurNum;
    let den = b / gcd(a, b);
    while (den % 2 === 0) den /= 2;
    while (den % 5 === 0) den /= 5;
    return den === 1;
  }

  isEntier() {
    const { a, b } = this.simplify().valeurNum;
    return b === 1;
  }

  isFractionMixte() {
    const { a, b } = this.simplify().valeurNum;
    return b !== 1 && abs(a) > b;
  }

  // ———————————————————
  // Mixtes
  // ———————————————————
  scinderMixte() {
    const { a, b } = this.simplify().valeurNum;
    // partie entière vers 0 si positif, vers 0 si négatif ? On veut: a = ent*b + reste, avec 0 <= reste < b
    // Choix: ent = floor(a/b) pour a>=0, et ent = -ceil(|a|/b) pour a<0 (ex: -7/3 -> ent=-3, reste=2)
    const ent = a >= 0 ? Math.floor(a / b) : -Math.ceil(Math.abs(a) / b);
    const reste = Math.abs(a - ent * b); // 0 <= reste < b
    return [
      Nombre.fromParts(ent, 1),
      Nombre.fromParts(reste, b)
    ];
  }

  // ———————————————————
  // Affichages
  // ———————————————————
  getValDec(precisionMax = 10, arrondi = false) {
    let { a, b } = this.valeurNum;
    const sign = a < 0 ? -1 : 1;
    a = Math.abs(a);
    b = Math.abs(b);

    if (b === 1) return (sign * a).toString();

    const entierAbs = Math.trunc(a / b);
    let reste = a % b;

    if (arrondi) {
      if (reste === 0) return (sign * entierAbs).toString();
      const numer = reste * (10 ** precisionMax);
      let arrondiNum = Math.round(numer / b);
      let ent = entierAbs;

      if (arrondiNum >= 10 ** precisionMax) {
        ent += 1;
        arrondiNum = 0;
      }

      let decStr = arrondiNum.toString().padStart(precisionMax, '0').replace(/0+$/, '');
      const entStr = (sign < 0 ? '-' : '') + String(ent);
      return decStr.length === 0 ? entStr : `${entStr}.${decStr}`;
    }

    // Sans arrondi : division longue
    let decimals = "";
    for (let i = 0; i < precisionMax && reste !== 0; i++) {
      reste *= 10;
      const chiffre = Math.trunc(reste / b);
      decimals += String(chiffre);
      reste = reste % b;
    }
    const entStr = (sign < 0 ? '-' : '') + String(entierAbs);
    return decimals.length === 0 ? entStr : `${entStr}.${decimals}`;
  }

  toString(opts = {}) {
    const simp = this.simplify().valeurNum;
    const { nombreAff = "auto", precision = 10, arrondi = false } = opts;

    if (nombreAff === "fraction") {
      const { a, b } = this.valeurNum;
      return `${a}/${b}`;
    }

    if (nombreAff === "fractionSimple") {
      return simp.b === 1 ? `${simp.a}` : `${simp.a}/${simp.b}`;
    }

    if (nombreAff === "fractionMixte") {
      const [E, F] = this.scinderMixte();
      const { a: ent } = E.valeurNum;
      const { a: r, b: d } = F.valeurNum;
      return r === 0 ? `${ent}` : `${ent} + ${r}/${d}`;
    }

    if (nombreAff === "decimal") {
      return this.getValDec(precision, arrondi);
    }

    // auto
    if (simp.b === 1) return `${simp.a}`;
    if (this.typeEcriture === "dec") return this.getValDec(precision, arrondi);
    return `${simp.a}/${simp.b}`;
  }

  toLatex(opts = {}) {
    const { a, b } = this.valeurNum;
    const simp = this.simplify().valeurNum;
    const {
      nombreAff = "auto",
      precision = 10,
      parentheseObligatoire = false,
      arrondi = false
    } = opts;

    const wrap = (s) => parentheseObligatoire ? `\\left(${s}\\right)` : s;

    if (nombreAff === "decimal") return this.getValDec(precision, arrondi);
    if (nombreAff === "fraction") return `\\frac{${a}}{${b}}`;
    if (nombreAff === "fractionSimple")
      return simp.b === 1 ? `${simp.a}` : `\\frac{${simp.a}}{${simp.b}}`;
    if (nombreAff === "fractionMixte") {
      const [E, F] = this.scinderMixte();
      const { a: ent } = E.valeurNum;
      const { a: r, b: d } = F.valeurNum;
      return r === 0 ? `${ent}` : wrap(`${ent} + \\frac{${r}}{${d}}`);
    }

    // auto
    if (simp.b === 1) return `${simp.a}`;
    return this.typeEcriture === "dec"
      ? this.getValDec(precision, arrondi)
      : `\\frac{${simp.a}}{${simp.b}}`;
  }

  // ———————————————————
  // Arithmétique
  // ———————————————————
  simplify() {
    let { a, b } = this.valeurNum;
    const d = gcd(a, b);
    a /= d; b /= d;
    if (b < 0) { a = -a; b = -b; } // sécurité
    return Nombre.fromParts(a, b);
  }

  inverse() {
    const { a, b } = this.valeurNum;
    if (a === 0) throw new Error("Impossible d'inverser zéro");
    return Nombre.fromParts(b, a);
  }

  equal(other) {
    if (!(other instanceof Nombre)) return false;
    const a1 = this.simplify().valeurNum;
    const a2 = other.simplify().valeurNum;
    return a1.a === a2.a && a1.b === a2.b;
  }

  static determineResultType(t1, t2, isDec) {
    return (t1 === 'dec' && t2 === 'dec' && isDec) ? 'dec' : 'frac';
  }

  add(other) {
    const { a: a1, b: b1 } = this.valeurNum;
    const { a: a2, b: b2 } = other.valeurNum;
    const denom = lcm(b1, b2);
    const num = a1 * (denom / b1) + a2 * (denom / b2);
    const isDec = Nombre.fromParts(num, denom).isDecimal();
    const type = Nombre.determineResultType(this.typeEcriture, other.typeEcriture, isDec);
    return Nombre.fromParts(num, denom).setTypeEcriture(type);
  }

  sub(other) {
    const { a: a1, b: b1 } = this.valeurNum;
    const { a: a2, b: b2 } = other.valeurNum;
    const denom = lcm(b1, b2);
    const num = a1 * (denom / b1) - a2 * (denom / b2);
    const isDec = Nombre.fromParts(num, denom).isDecimal();
    const type = Nombre.determineResultType(this.typeEcriture, other.typeEcriture, isDec);
    return Nombre.fromParts(num, denom).setTypeEcriture(type);
  }

  mul(other) {
    const { a: a1, b: b1 } = this.valeurNum;
    const { a: a2, b: b2 } = other.valeurNum;
    const num = a1 * a2, denom = b1 * b2;
    const isDec = Nombre.fromParts(num, denom).isDecimal();
    const type = Nombre.determineResultType(this.typeEcriture, other.typeEcriture, isDec);
    return Nombre.fromParts(num, denom).setTypeEcriture(type);
  }

  div(other) {
    const { a: a1, b: b1 } = this.valeurNum;
    const { a: a2, b: b2 } = other.valeurNum;
    if (a2 === 0) throw new Error("Division par zéro");
    const num = a1 * b2, denom = b1 * a2;
    const isDec = Nombre.fromParts(num, denom).isDecimal();
    const type = Nombre.determineResultType(this.typeEcriture, other.typeEcriture, isDec);
    return Nombre.fromParts(num, denom).setTypeEcriture(type);
  }

  pow(e) {
    if (!Number.isInteger(e)) throw new Error("Exposant non entier");
    if (e === 0) return new Nombre("1");
    let base = this;
    let exp = Math.abs(e);
    let res = Nombre.fromParts(1, 1);
    while (exp > 0) {
      if (exp & 1) res = res.mul(base);
      base = base.mul(base);
      exp >>= 1;
    }
    return e > 0 ? res : Nombre.fromParts(1, 1).div(res);
  }

  setTypeEcriture(type) {
    this.typeEcriture = type;
    return this;
  }
}
