import { BaseFeatureExtractor } from './BaseFeatureExtractor';
import type { MediaPipeFrame, Feature, HandData, HandLandmarks, HandSide, Finger } from '../types';
import type { FeatureStore } from '../../stores/FeatureStore';

export class DistanceFinger extends BaseFeatureExtractor {
    readonly name = 'DistanceFinger';

    // Mapping des bouts de doigts (TIP landmarks)
    private readonly fingerTips: Record<Finger, number> = {
        thumb: 4,    // Bout du pouce
        index: 8,    // Bout de l'index
        middle: 12,  // Bout du majeur
        ring: 16,    // Bout de l'annulaire
        pinky: 20    // Bout de l'auriculaire
    };

    extract(frame: MediaPipeFrame, featureStore: FeatureStore): Feature[] {
        const features: Feature[] = [];

        for (const hand of frame.hands) {
            if (!hand.landmarks || hand.landmarks.length < 21) {
                continue; // Skip si pas assez de landmarks
            }

            const thumbTip = hand.landmarks[this.fingerTips.thumb];
            if (!this.isValidPoint(thumbTip)) {
                console.log("Invalid thumb tip point, skipping hand.");
                continue;
            }

            // Calculer la distance 3D entre le pouce et chaque autre doigt
            for (const [fingerName, tipIndex] of Object.entries(this.fingerTips)) {
                if (fingerName === 'thumb') continue;
                const fingerTip = hand.landmarks[tipIndex];
                if (!this.isValidPoint(fingerTip)) {
                    console.log("Invalid finger tip point, skipping hand.");
                    continue;
                }
                const distance = this.calculateDistance3D(thumbTip, fingerTip);

                // --- Ajout de la vitesse de la distance ---
                // On récupère la dernière feature de distance pour ce doigt et cette main AVANT d'ajouter la nouvelle
                const prevFeature = featureStore.getFeature(
                    `thumb_to_${fingerName}_distance`,
                    hand.handedness,
                    fingerName as Finger
                );
                if (prevFeature && typeof prevFeature.value === 'number' && prevFeature.timestamp !== undefined) {
                    const dt = (frame.timestamp - prevFeature.timestamp) / 1000; // en secondes
                    if (dt > 0) {
                        const speed = Math.abs(distance - prevFeature.value) / dt;
                        features.push({
                            name: `thumb_to_${fingerName}_distance_speed`,
                            type: 'number',
                            value: speed,
                            parents: this.name,
                            display: 'Graph',
                            minMax: [0, 2],
                            timestamp: frame.timestamp,
                            hand: hand.handedness,
                            finger: fingerName as Finger
                        });
                    }
                }
                // --- Fin ajout vitesse ---

                features.push({
                    name: `thumb_to_${fingerName}_distance`,
                    type: 'number',
                    value: distance,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [0, 0.3],
                    timestamp: frame.timestamp,
                    hand: hand.handedness,
                    finger: fingerName as Finger
                });
            }

            // ... pas de moyenne, uniquement distances réelles ...
        }

        return features;
    }

    private calculateDistance3D(point1: HandLandmarks, point2: HandLandmarks): number {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        const dz = point1.z - point2.z;

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }


    // estimateHandSize supprimé car plus nécessaire (landmarks déjà normalisés)

    // calculateAverageThumbDistance supprimé : plus de moyenne, uniquement distances réelles

    private isValidPoint(point: HandLandmarks | undefined): boolean {
        if (!point) return false;

        const { x, y, z } = point;

        // Vérifier que les coordonnées sont des nombres finis
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return false;

        // Vérifier que les coordonnées sont dans une plage raisonnable
        if (x < -5 || x > 5 || y < -5 || y > 5) return false;
        if (z < -5 || z > 5) return false;

        return true;
    }
}