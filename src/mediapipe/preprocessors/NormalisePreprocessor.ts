import { BasePreprocessor } from './BasePreprocessor';
import type { MediaPipeFrame, HandData, HandLandmarks } from '../types';

/**
 * NormalisePreprocessor
 * Redimensionne la main centrée (poignet à l'origine) pour que la distance entre les points 5 et 17 soit constante (norme = 1).
 */
export class NormalisePreprocessor extends BasePreprocessor {
    readonly name = 'Normalise Preprocessor';
    readonly id = 'normalise';

    constructor() {
        super();
        this.description = 'Normalise la taille de la main (distance 5-17 = 1)';
    }

    preprocess(frame: MediaPipeFrame): MediaPipeFrame {
        if (!this.isEnabled()) {
            return frame;
        }

        const processedHands: HandData[] = [];

        for (const hand of frame.hands) {
            if (!hand.landmarks || hand.landmarks.length < 18) {
                processedHands.push(hand);
                continue;
            }

            // Points 5 et 17 (index MCP et pinky MCP)
            const p5 = hand.landmarks[5];
            const p17 = hand.landmarks[17];
            const dx = p17.x - p5.x;
            const dy = p17.y - p5.y;
            const dz = p17.z - p5.z;
            const norm = (Math.sqrt(dx * dx + dy * dy + dz * dz)) * 4.0;
            if (norm === 0) {
                processedHands.push(hand);
                continue;
            }
            // Redimensionner tous les points
            const normalisedLandmarks: HandLandmarks[] = hand.landmarks.map((landmark) => ({
                x: landmark.x / norm,
                y: landmark.y / norm,
                z: landmark.z / norm
            }));

            const normalisedHand: HandData = {
                landmarks: normalisedLandmarks,
                handedness: hand.handedness,
                confidence: hand.confidence
            };
            processedHands.push(normalisedHand);
        }

        return {
            hands: processedHands,
            timestamp: frame.timestamp
        };
    }
}
