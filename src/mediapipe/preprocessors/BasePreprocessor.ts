import type { MediaPipeFrame } from '../types';

export class Preprocessor {
    private enabled = true;

    readonly name = 'Preprocessor';

    preprocess(frame: MediaPipeFrame): MediaPipeFrame {
        if (!this.enabled) {
            return frame;
        }

        // TODO: Implémenter le preprocessing
        // - Smoothing des landmarks
        // - Normalisation des coordonnées
        // - Reconstruction des points manquants
        // - Unification main gauche/droite
        // - Resampling temporel

        console.log('🛠️ Preprocessing des landmarks...');

        // Pour l'instant, on retourne la frame telle quelle
        // Ici vous pourrez ajouter votre logique de preprocessing
        const processedFrame = {
            ...frame,
            hands: frame.hands.map(hand => ({
                ...hand,
                // Exemple: normalisation simple (à remplacer par votre logique)
                landmarks: hand.landmarks.map(landmark => ({
                    x: landmark.x,
                    y: landmark.y,
                    z: landmark.z
                }))
            }))
        };

        return processedFrame;
    }

    enable(): void {
        this.enabled = true;
    }

    disable(): void {
        this.enabled = false;
    }

    isEnabled(): boolean {
        return this.enabled;
    }
}