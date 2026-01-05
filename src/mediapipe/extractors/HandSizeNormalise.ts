import { BaseFeatureExtractor } from './BaseFeatureExtractor';
import type { MediaPipeFrame, Feature, HandData, HandLandmarks } from '../types';

export class HandSizeNormalise extends BaseFeatureExtractor {
    readonly name = 'HandSizeNormalise';

    extract(frame: MediaPipeFrame): Feature[] {
        const features: Feature[] = [];

        // Vérifier qu'il y a au moins une main détectée
        if (!frame.hands || frame.hands.length === 0) {
            return features; // Pas de main = pas de features
        }

        for (const hand of frame.hands) {
            // Vérifier que la main a suffisamment de landmarks
            if (!hand.landmarks || hand.landmarks.length < 21) {
                continue; // Skip cette main si pas assez de landmarks
            }

            // Points clés pour les mesures
            const wrist = hand.landmarks[0];           // Point 0 : poignet
            const middleBase = hand.landmarks[9];      // Point 9 : base du majeur (MCP)
            const indexBase = hand.landmarks[5];       // Point 5 : base de l'index (MCP)
            const indexBase2 = hand.landmarks[6];      // Point 6 : PIP de l'index
            const indexMid = hand.landmarks[7];        // Point 7 : DIP de l'index
            const indexTip = hand.landmarks[8];        // Point 8 : bout de l'index (TIP)

            // Vérifications strictes de validité des points
            if (!this.isValidPoint(wrist) || !wrist ||
                !this.isValidPoint(middleBase) || !middleBase ||
                !this.isValidPoint(indexBase) || !indexBase ||
                !this.isValidPoint(indexBase2) || !indexBase2 ||
                !this.isValidPoint(indexMid) || !indexMid ||
                !this.isValidPoint(indexTip) || !indexTip) {
                continue; // Skip si les points ne sont pas valides
            }

            // 1. Calculer la longueur de référence de la main (wrist -> base majeur)
            const handReferenceLength = this.calculateDistance3D(wrist, middleBase);

            // Vérifier que la longueur de référence est raisonnable
            if (handReferenceLength > 0.05 && handReferenceLength < 0.5) {
                features.push({
                    name: 'hand_reference_length',
                    type: 'number',
                    value: handReferenceLength,
                    parents: this.name,
                    display: 'Number',
                    minMax: [0.05, 0.3],
                    timestamp: frame.timestamp,
                    hand: hand.handedness
                });

                // 2. Calculer la longueur de l'index (base -> tip).
                // Non il faut ajouter chaque segment pour plus de précision
                let indexLength = this.calculateDistance3D(indexBase, indexBase2);
                indexLength += this.calculateDistance3D(indexBase2, indexMid);
                indexLength += this.calculateDistance3D(indexMid, indexTip);

                if (indexLength > 0.02 && indexLength < 0.3) {
                    features.push({
                        name: 'index_raw_length',
                        type: 'number',
                        value: indexLength,
                        parents: this.name,
                        display: 'Number',
                        minMax: [0.02, 0.5],
                        timestamp: frame.timestamp,
                        hand: hand.handedness,
                        finger: 'index'
                    });

                    // 3. Calculer la longueur normalisée de l'index
                    const normalizedIndexLength = indexLength / handReferenceLength;

                    // Vérifier que le ratio est dans une plage raisonnable
                    if (normalizedIndexLength > 0.2 && normalizedIndexLength < 1.0) {
                        features.push({
                            name: 'normalized_index_length',
                            type: 'number',
                            value: normalizedIndexLength,
                            parents: this.name,
                            display: 'Graph',
                            minMax: [0.2, 0.8],
                            timestamp: frame.timestamp,
                            hand: hand.handedness,
                            finger: 'index'
                        });
                    }
                }
            }
        }

        return features;
    }

    // Vérifier qu'un point est valide
    private isValidPoint(point: HandLandmarks | undefined): boolean {
        if (!point) return false;

        const { x, y, z } = point;

        // Vérifier que les coordonnées sont des nombres finis
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return false;

        // Vérifier que les coordonnées sont dans une plage raisonnable (MediaPipe utilise 0-1)
        if (x < -0.5 || x > 1.5 || y < -0.5 || y > 1.5) return false;

        // Le z peut être négatif mais pas trop extrême
        if (z < -1 || z > 1) return false;

        return true;
    }

    private calculateDistance3D(point1: HandLandmarks, point2: HandLandmarks): number {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        const dz = point1.z - point2.z;

        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Retourner 0 si la distance n'est pas valide
        return isFinite(distance) && distance >= 0 ? distance : 0;
    }

    // Méthode utilitaire pour obtenir la longueur de référence d'une main
    getHandReferenceLength(hand: HandData): number {
        if (!hand.landmarks || hand.landmarks.length < 10) return 0;

        const wrist = hand.landmarks[0];
        const middleBase = hand.landmarks[9];

        if (this.isValidPoint(wrist) && wrist && this.isValidPoint(middleBase) && middleBase) {
            return this.calculateDistance3D(wrist, middleBase);
        }

        return 0;
    }

    // Méthode utilitaire pour normaliser une distance par rapport à la main
    normalizeDistance(distance: number, hand: HandData): number {
        const referenceLength = this.getHandReferenceLength(hand);
        return referenceLength > 0.05 ? distance / referenceLength : 0;
    }
}