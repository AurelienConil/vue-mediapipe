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
            
            // Vérifier que le bout du pouce est valide
            if (!this.isValidPoint(thumbTip)) {
                continue;
            }

            // Calculer la distance entre le pouce et chaque autre doigt
            for (const [fingerName, tipIndex] of Object.entries(this.fingerTips)) {
                if (fingerName === 'thumb') continue; // Skip le pouce lui-même
                
                const fingerTip = hand.landmarks[tipIndex];
                
                if (!this.isValidPoint(fingerTip)) {
                    continue; // Skip si le bout du doigt n'est pas valide
                }

                // Calculer la distance 3D entre les deux points
                const distance = this.calculateDistance3D(thumbTip, fingerTip);
                
                // Normaliser la distance par rapport à la taille de la main
                const handSize = this.estimateHandSize(hand);
                const normalizedDistance = handSize > 0 ? distance / handSize : 0;

                // Feature: Distance brute entre pouce et doigt
                features.push({
                    name: `thumb_to_${fingerName}_distance`,
                    type: 'number',
                    value: distance,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [0, 0.3], // Distance maximale raisonnable en unités MediaPipe
                    timestamp: frame.timestamp,
                    hand: hand.handedness,
                    finger: fingerName as Finger
                });

                // Feature: Distance normalisée (pour comparaison entre mains de différentes tailles)
                features.push({
                    name: `thumb_to_${fingerName}_normalized`,
                    type: 'number',
                    value: normalizedDistance,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [0, 1.5], // Ratio maximal raisonnable
                    timestamp: frame.timestamp,
                    hand: hand.handedness,
                    finger: fingerName as Finger
                });
            }

            // Feature: Distance moyenne entre pouce et tous les doigts
            const averageDistance = this.calculateAverageThumbDistance(hand);
            if (averageDistance !== null) {
                features.push({
                    name: 'thumb_to_fingers_avg_distance',
                    type: 'number',
                    value: averageDistance,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [0, 0.25],
                    timestamp: frame.timestamp,
                    hand: hand.handedness
                });
            }
        }

        return features;
    }

    private calculateDistance3D(point1: HandLandmarks, point2: HandLandmarks): number {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        const dz = point1.z - point2.z;
        
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    private estimateHandSize(hand: HandData): number {
        // Estimer la taille de la main comme la distance entre le poignet et le bout du majeur
        if (hand.landmarks.length < 13) return 0;
        
        const wrist = hand.landmarks[0];
        const middleTip = hand.landmarks[12];
        
        if (!this.isValidPoint(wrist) || !this.isValidPoint(middleTip)) return 0;
        
        return this.calculateDistance3D(wrist, middleTip);
    }

    private calculateAverageThumbDistance(hand: HandData): number | null {
        const thumbTip = hand.landmarks[this.fingerTips.thumb];
        if (!this.isValidPoint(thumbTip)) return null;

        let totalDistance = 0;
        let validFingers = 0;

        for (const [fingerName, tipIndex] of Object.entries(this.fingerTips)) {
            if (fingerName === 'thumb') continue;
            
            const fingerTip = hand.landmarks[tipIndex];
            if (this.isValidPoint(fingerTip)) {
                totalDistance += this.calculateDistance3D(thumbTip, fingerTip);
                validFingers++;
            }
        }

        return validFingers > 0 ? totalDistance / validFingers : null;
    }

    private isValidPoint(point: HandLandmarks | undefined): boolean {
        if (!point) return false;

        const { x, y, z } = point;

        // Vérifier que les coordonnées sont des nombres finis
        if (!isFinite(x) || !isFinite(y) || !isFinite(z)) return false;

        // Vérifier que les coordonnées sont dans une plage raisonnable
        if (x < -0.5 || x > 1.5 || y < -0.5 || y > 1.5) return false;
        if (z < -1 || z > 1) return false;

        return true;
    }
}