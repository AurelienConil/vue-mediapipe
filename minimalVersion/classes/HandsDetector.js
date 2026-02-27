/**
 * HandsDetector - Initialise et gère la détection des mains MediaPipe
 */
export class HandsDetector {
    constructor() {
        const { Hands } = window;
        this.hands = new Hands({
            locateFile: (file) => `./node_modules/@mediapipe/hands/${file}`,
        });

        this.hands.setOptions({
            maxNumHands: 2,
            modelComplexity: 1,
            minDetectionConfidence: 0.7,
            minTrackingConfidence: 0.5,
        });
    }

    /**
     * Traite l'image vidéo et retourne les résultats de détection
     * @param {HTMLVideoElement} videoElement - L'élément vidéo source
     * @returns {Promise<Object>} Les résultats de détection (landmarks, etc)
     */
    async process(videoElement) {
        return new Promise((resolve) => {
            const onResultsHandler = (results) => {
                // Désabonner après avoir reçu les résultats
                this.hands.onResults(() => { });
                resolve(results);
            };

            this.hands.onResults(onResultsHandler);
            this.hands.send({ image: videoElement });
        });
    }

    getHands() {
        return this.hands;
    }
}
