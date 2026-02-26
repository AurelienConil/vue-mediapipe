/**
 * CanvasManager - Gère le canvas et son contexte de rendu
 */
export class CanvasManager {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = canvasElement.getContext("2d");
    }

    /**
     * Redimensionne le canvas selon les dimensions de l'image
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }

    /**
     * Efface le canvas
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Dessine l'image source
     * @param {ImageData|CanvasImageSource} image - L'image à dessiner
     */
    drawImage(image) {
        this.ctx.drawImage(image, 0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * Sauvegarde le contexte graphique
     */
    save() {
        this.ctx.save();
    }

    /**
     * Restaure le contexte graphique
     */
    restore() {
        this.ctx.restore();
    }

    getContext() {
        return this.ctx;
    }

    getCanvas() {
        return this.canvas;
    }
}
