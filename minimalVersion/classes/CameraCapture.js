/**
 * CameraCapture - Gère la capture des frames vidéo depuis la webcam
 */
export class CameraCapture {
    constructor(videoElement) {
        const { Camera } = window;
        this.videoElement = videoElement;
        this.camera = new Camera(videoElement, {
            onFrame: async () => {
                // Le callback sera défini par le chain
            },
            width: 640,
            height: 480,
        });
        this.frameCallback = null;
    }

    /**
     * Définit le callback appelé à chaque frame
     * @param {Function} callback - Fonction appelée avec le videoElement
     */
    setFrameCallback(callback) {
        this.frameCallback = callback;

        // Créer une nouvelle caméra avec le bon callback
        const { Camera } = window;
        this.camera = new Camera(this.videoElement, {
            onFrame: async () => {
                if (this.frameCallback) {
                    await this.frameCallback(this.videoElement);
                }
            },
            width: 640,
            height: 480,
        });
    }

    /**
     * Démarre la capture vidéo
     */
    async start() {
        await this.camera.start();
    }

    /**
     * Arrête la capture vidéo
     */
    async stop() {
        await this.camera.stop();
    }

    getVideoElement() {
        return this.videoElement;
    }
}
