import { BaseFeatureExtractor } from './BaseFeatureExtractor';
import type { MediaPipeFrame, Feature, HandLandmarks, Finger } from '../types';

export class DistanceFingerMiddle extends BaseFeatureExtractor {
    readonly name = 'DistanceFingerMiddle';

    // Cache local pour stocker les valeurs précédentes
    private previousValues = new Map<string, { value: number; timestamp: number }>();

    // Mapping des bouts de doigts (TIP landmarks)
    private readonly fingerMid: Record<Finger, number> = {
        thumb: 4,    // Bout du pouce : c'est toujours le bout du pouce.
        index: 7,    // Milieu de l'index
        middle: 11,  // Milieu du majeur
        ring: 15,    // Milieu de l'annulaire
        pinky: 19    // Milieu de l'auriculaire
    };

    extract(frame: MediaPipeFrame): Feature[] {
        const features: Feature[] = [];

        for (const hand of frame.hands) {
            if (!hand.landmarks || hand.landmarks.length < 21) {
                continue; // Skip si pas assez de landmarks
            }

            const thumbTip = hand.landmarks[this.fingerMid.thumb];
            if (!this.isValidPoint(thumbTip) || !thumbTip) {
                console.log("Invalid thumb tip point, skipping hand.");
                continue;
            }

            // Calculer la distance 3D entre le bout pouce ( thumbTip) et chaque base d'un autre doigt
            for (const [fingerName, baseIndex] of Object.entries(this.fingerMid)) {
                if (fingerName === 'thumb') continue;
                const fingerBase = hand.landmarks[baseIndex];
                if (!this.isValidPoint(fingerBase) || !fingerBase) {
                    console.log("Invalid finger base point, skipping hand.");
                    continue;
                }
                const distance = this.calculateDistance3D(thumbTip, fingerBase);

                // --- Ajout de la vitesse de la distance ---
                // On récupère la dernière valeur de distance pour ce doigt et cette main AVANT d'ajouter la nouvelle
                const featureKey = `thumb_to_${fingerName}_distance`;
                const prevValue = this.previousValues.get(featureKey);
                if (prevValue && prevValue.timestamp !== undefined) {
                    const dt = (frame.timestamp - prevValue.timestamp) / 1000; // en secondes
                    if (dt > 0) {
                        const speed = Math.abs(distance - prevValue.value) / dt;
                        features.push({
                            name: `thumb_to_${fingerName}M_distspeed`,
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

                // Ajouter la feature de distance de base
                features.push({
                    name: `thumb_to_${fingerName}M_dist`,
                    type: 'number',
                    value: distance,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [0, 0.3],
                    timestamp: frame.timestamp,
                    hand: hand.handedness,
                    finger: fingerName as Finger
                });

                // Mettre à jour le cache avec la nouvelle valeur (après avoir calculé la vitesse)
                this.previousValues.set(featureKey, {
                    value: distance,
                    timestamp: frame.timestamp
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