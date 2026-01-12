import { BaseFeatureExtractor } from './BaseFeatureExtractor';
import type { MediaPipeFrame, Feature, Finger, HandSide } from '../types';

export class CurvatureFinger extends BaseFeatureExtractor {
    readonly name = 'CurvatureFinger';

    // Pour chaque doigt, indices des segments base et tip : [baseStart, baseEnd, tipStart, tipEnd]
    private readonly fingerSegments: Record<Finger, [number, number, number, number]> = {
        thumb: [1, 2, 3, 4],
        index: [5, 6, 7, 8],
        middle: [9, 10, 11, 12],
        ring: [13, 14, 15, 16],
        pinky: [17, 18, 19, 20]
    };


    extract(frame: MediaPipeFrame): Feature[] {
        const features: Feature[] = [];

        for (const hand of frame.hands) {
            for (const [fingerName, segmentIdxs] of Object.entries(this.fingerSegments)) {
                const [baseStartIdx, baseEndIdx, tipStartIdx, tipEndIdx] = segmentIdxs;
                const zeroHand = hand.landmarks[0];
                const baseStart = hand.landmarks[baseStartIdx];
                const baseEnd = hand.landmarks[baseEndIdx];
                const tipStart = hand.landmarks[tipStartIdx];
                const tipEnd = hand.landmarks[tipEndIdx];

                // On va calculer angle1 entes les segment zeroHand=>baseSart et baseStart=>baseEnd. ( on considérant que ces 2 segments forment un plan)
                const v1 = {
                    x: baseStart.x - zeroHand.x,
                    y: baseStart.y - zeroHand.y
                };
                const v2 = {
                    x: baseEnd.x - baseStart.x,
                    y: baseEnd.y - baseStart.y
                };
                const v3 = {
                    x: tipStart.x - baseEnd.x,
                    y: tipStart.y - baseEnd.y
                };
                const v4 = {
                    x: tipEnd.x - tipStart.x,
                    y: tipEnd.y - tipStart.y
                };

                // Calcul des angles en 2D
                let angle1 = this.calculateAngle2D(v1, v2);
                let angle2 = this.calculateAngle2D(v2, v3);
                let angle3 = this.calculateAngle2D(v3, v4);

                let finalAngle = angle1 + angle2 + angle3;

                // Normalisation de l'angle selon le type de main
                const angle = this.normalizeAngleForHand(finalAngle, hand.handedness);



                const maxAng = fingerName === 'thumb' ? 0.6 : 2.8;
                const minAng = fingerName === 'thumb' ? -1 : -0.4;

                // Ajout de la feature valeur angulaire (angle en rad)
                features.push({
                    name: `${fingerName}_curvature_value`,
                    type: 'number',
                    value: angle,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [minAng, maxAng],
                    timestamp: frame.timestamp,
                    hand: hand.handedness,
                    finger: fingerName as Finger
                });


            }
        }

        return features;
    }


    // Calcule l'angle entre deux vecteurs 2D (en radians, entre -PI et PI)
    private calculateAngle2D(
        v1: { x: number; y: number },
        v2: { x: number; y: number }
    ): number {
        const dot = v1.x * v2.x + v1.y * v2.y;
        const det = v1.x * v2.y - v1.y * v2.x;
        return Math.atan2(det, dot);
    }

    // Normalise l'angle selon le type de main pour avoir des valeurs cohérentes
    private normalizeAngleForHand(angle: number, handedness: HandSide): number {
        // Pour la main gauche, on inverse le signe de l'angle pour avoir
        // des valeurs cohérentes avec la main droite
        if (handedness === 'Left') {
            return angle;
        }
        return -angle;
    }


}