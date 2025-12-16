import { BasePreprocessor } from './BasePreprocessor';
import type { MediaPipeFrame, HandData, HandLandmarks } from '../types';

export class CenterPreprocessor extends BasePreprocessor {

    readonly name = 'Center Preprocessor';
    readonly id = 'center';

    constructor() {
        super();
        this.description = 'Center on 0,0,0 origin';
    }

    preprocess(frame: MediaPipeFrame): MediaPipeFrame {
        if (!this.isEnabled()) {
            return frame;
        }

        const processedHands: HandData[] = [];

        for (const hand of frame.hands) {
            if (!hand.landmarks || hand.landmarks.length === 0) {
                processedHands.push(hand);
                continue;
            }

            const wrist = hand.landmarks[0];

            const offsetX = wrist.x;
            const offsetY = wrist.y;
            const offsetZ = wrist.z;

            // Apply offset to all landmarks to center wrist at origin
            const centeredLandmarks: HandLandmarks[] = hand.landmarks.map((landmark) => {
                return {
                    x: landmark.x - offsetX,
                    y: landmark.y - offsetY,
                    z: landmark.z - offsetZ
                };
            });

            const centeredHand: HandData = {
                landmarks: centeredLandmarks,
                handedness: hand.handedness,
                confidence: hand.confidence
            };

            processedHands.push(centeredHand);
        }

        return {
            hands: processedHands,
            timestamp: frame.timestamp
        };
    }


}