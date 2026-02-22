class Grille {
    constructor(containerId, width = 300, height = 300) {
        this.container = document.getElementById(containerId);
        this.width = width;
        this.height = height;
        this.pas = 20;  // Pas pour les déplacements et le quadrillage
        this.container.style.position = "relative";
        this.container.style.width = `${this.width}px`;
        this.container.style.height = `${this.height}px`;

        // Canevas pour le quadrillage (arrière-plan)
        this.canvasQuadrillage = document.createElement("canvas");
        this.canvasQuadrillage.width = this.width;
        this.canvasQuadrillage.height = this.height;
        this.container.appendChild(this.canvasQuadrillage);
        this.ctxQuadrillage = this.canvasQuadrillage.getContext("2d");

        // Canevas pour le tracé fantôme (objectif)
        this.canvasFantome = document.createElement("canvas");
        this.canvasFantome.width = this.width;
        this.canvasFantome.height = this.height;
        this.container.appendChild(this.canvasFantome);
        this.ctxFantome = this.canvasFantome.getContext("2d");

        // Canevas pour les dessins de la tortue
        this.canvasFond = document.createElement("canvas");
        this.canvasFond.width = this.width;
        this.canvasFond.height = this.height;
        this.container.appendChild(this.canvasFond);
        this.ctxFond = this.canvasFond.getContext("2d");

        // Canevas pour la tortue
        this.canvasTortue = document.createElement("canvas");
        this.canvasTortue.width = this.width;
        this.canvasTortue.height = this.height;
        this.container.appendChild(this.canvasTortue);
        this.ctxTortue = this.canvasTortue.getContext("2d");

        // Positionnement absolu des canevas
        [this.canvasQuadrillage, this.canvasFantome, this.canvasFond, this.canvasTortue].forEach(canvas => {
            canvas.style.position = "absolute";
            canvas.style.top = "0";
            canvas.style.left = "0";
        });

        // Position et orientation initiale de la tortue
        this.xd = width / 2;  // Position de départ X
        this.yd = height / 2; // Position de départ Y
        this.angleDeDepart = 0; // Angle de départ
        this.x = this.xd;     // Position courante X
        this.y = this.yd;     // Position courante Y
        this.angle = this.angleDeDepart; // L'angle initial

        // Stylo activé/désactivé
        this.penDown = true;

        // Chargement de l'image de la tortue
        this.imgTortue = new Image();
        this.imgTortue.src = 'tortue.png';  // Remplacez par le bon chemin

        this.imgTortue.onload = () => {
            this.dessinerTortue();
        };

        // Dessiner le quadrillage
        this.dessinerQuadrillage();

        // Initialiser le canevas actif (par défaut, canevas de fond)
        this.canvasActif = this.canvasFond;
        this.ctxActif = this.ctxFond;
    }

    // Fonction pour définir le canevas actif
    definirCanevasActif(canevas) {
        this.canvasActif = canevas;
        this.ctxActif = canevas.getContext("2d");
    }

    // Dessiner le quadrillage
    dessinerQuadrillage() {
        this.ctxQuadrillage.clearRect(0, 0, this.width, this.height);
        this.ctxQuadrillage.strokeStyle = 'lightgray';
        this.ctxQuadrillage.lineWidth = 1;

        for (let i = 0; i <= this.width; i += this.pas) {
            this.ctxQuadrillage.beginPath();
            this.ctxQuadrillage.moveTo(i, 0);
            this.ctxQuadrillage.lineTo(i, this.height);
            this.ctxQuadrillage.stroke();
        }

        for (let i = 0; i <= this.height; i += this.pas) {
            this.ctxQuadrillage.beginPath();
            this.ctxQuadrillage.moveTo(0, i);
            this.ctxQuadrillage.lineTo(this.width, i);
            this.ctxQuadrillage.stroke();
        }
    }

    // Fonction générique pour tracer une ligne sur un canevas donné
    tracerLigne(x1, y1, x2, y2, couleur = "black") {
        this.ctxActif.strokeStyle = couleur;
        this.ctxActif.lineWidth = 2;
        this.ctxActif.beginPath();
        this.ctxActif.moveTo(x1, y1);
        this.ctxActif.lineTo(x2, y2);
        this.ctxActif.stroke();
    }

    // Fonction pour dessiner la tortue
    dessinerTortue() {
        this.ctxTortue.clearRect(0, 0, this.width, this.height);

        // Dessiner l'image de la tortue
        this.ctxTortue.save();
        this.ctxTortue.translate(this.x, this.y);
        this.ctxTortue.rotate((-this.angle * Math.PI) / 180);
        this.ctxTortue.drawImage(this.imgTortue, -15, -15, 30, 30);
        this.ctxTortue.restore();

        // Dessiner le petit cercle pour visualiser le stylo
        if (this.penDown) {
            this.ctxTortue.beginPath();
            this.ctxTortue.arc(this.x, this.y, 3, 0, 2 * Math.PI);
            this.ctxTortue.fillStyle = 'black';
            this.ctxTortue.fill();
        }
    }

    // Fonction pour avancer
    avancer(distance) {
        distance *= this.pas;
        const rad = (this.angle * Math.PI) / 180;
        const newX = this.x + distance * Math.cos(rad);
        const newY = this.y - distance * Math.sin(rad);

        if (this.penDown) {
            this.tracerLigne(this.x, this.y, newX, newY, this.canvasActif === this.canvasFantome ? "blue" : "black");
        }

        this.x = newX;
        this.y = newY;
        this.dessinerTortue();
    }

    // Fonction pour tourner
    tourner(angle) {
        this.angle = (this.angle + angle) % 360;
        this.dessinerTortue();
    }

    // Fonction pour effacer un canevas donné
    effacer() {
        this.ctxActif.clearRect(0, 0, this.width, this.height);
        if (this.canvasActif === this.canvasFond) {
            this.x = this.xd;
            this.y = this.yd;
            this.angle = this.angleDeDepart;
            this.dessinerTortue();
        }
    }

    // Fonction pour tracer un dessin fantôme comme objectif
    tracerFantome(trajet) {
        //console.log("tracerFantome appelé");

        // Effacer le canevas fantôme
        this.ctxFantome.clearRect(0, 0, this.width, this.height);

        // Sauvegarde des valeurs actuelles
        const tempX = this.x;
        const tempY = this.y;
        const tempAngle = this.angle;
        const tempPenDown = this.penDown;

        //console.log("Position avant tracé fantôme :", this.x, this.y);

        // Position initiale pour le tracé fantôme
        this.x = this.xd;  // ← Vérifier ici
        this.y = this.yd;
        this.angle = this.angleDeDepart;
        this.penDown = true;

        // Changer le canevas actif pour `canvasFantome`
        this.definirCanevasActif(this.canvasFantome);

        // Style du fantôme (pointillé)
        this.ctxActif.strokeStyle = "blue";
        this.ctxActif.setLineDash([5, 5]); // Tracé en pointillés

        // Exécuter la fonction trajet (ex: un carré)
        //console.log("Exécution de la fonction trajet...");
        trajet.call(this);
        //console.log("Fonction trajet exécutée.");

        // Restauration des valeurs initiales
        this.x = tempX;
        this.y = tempY;
        this.angle = tempAngle;
        this.penDown = tempPenDown;

        // Désactiver les pointillés après le tracé fantôme
        this.ctxActif.setLineDash([]);
        
        // Changer le canevas actif pour `canvasFond`
        this.definirCanevasActif(this.canvasFond);
        
        this.reinitialiser();
    }
    
      leverStylo() {
        this.penDown = false;
    }

    baisserStylo() {
        this.penDown = true;
    }

    // Réinitialiser la tortue à sa position de départ
    reinitialiser() {
        this.x = this.xd;
        this.y = this.yd;
        this.angle = this.angleDeDepart;
        this.dessinerTortue();
    }

    setPosition(newX, newY) {
        this.x = newX;
        this.y = newY;
        this.xd = newX;
        this.yd = newY;
        this.dessinerTortue();
    }

    setOrientation(newAngle) {
        this.angle = newAngle % 360;
        this.angleDeDepart = this.angle;
        this.dessinerTortue();
    }
}