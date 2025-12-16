import { BaseFeatureExtractor } from './BaseFeatureExtractor';
import type { MediaPipeFrame, Feature, HandData, HandLandmarks, HandSide } from '../types';
import type { FeatureStore } from '../../stores/FeatureStore';

export class HandOrientationInSpace extends BaseFeatureExtractor {
    readonly name = 'HandOrientationInSpace';

    extract(frame: MediaPipeFrame, featureStore: FeatureStore): Feature[] {
        const features: Feature[] = [];

        for (const hand of frame.hands) {
            if (!hand.landmarks || hand.landmarks.length < 21) {
                continue; // Skip si pas assez de landmarks
            }

            const wrist = hand.landmarks[0];           // Point 0 : poignet
            const indexBase = hand.landmarks[5];       // Point 5 : base de l'index (MCP)
            const middleBase = hand.landmarks[9];      // Point 9 : base du majeur (MCP)
            const pinkyBase = hand.landmarks[17];      // Point 17 : base de l'auriculaire (MCP)
            const indexTip = hand.landmarks[8];        // Point 8 : bout de l'index

            // Vérifier que tous les points nécessaires sont valides
            if (!this.isValidPoint(wrist) || !this.isValidPoint(indexBase) ||
                !this.isValidPoint(middleBase) || !this.isValidPoint(pinkyBase) ||
                !this.isValidPoint(indexTip)) {
                continue; // Skip si les points ne sont pas valides
            }

            // Calculer l'orientation de la main dans l'espace 3D
            const orientation = this.calculateHandOrientation(
                wrist, indexBase, middleBase, pinkyBase, indexTip
            );

            if (orientation) {
                // Feature: Tilt (inclinaison avant/arrière - axe X)
                features.push({
                    name: 'hand_tilt',
                    type: 'number',
                    value: orientation.tilt,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [-1, 1], // Normalisé entre -1 et 1
                    timestamp: frame.timestamp,
                    hand: hand.handedness
                });

                // Feature: Pan (inclinaison gauche/droite - axe Y)
                features.push({
                    name: 'hand_pan',
                    type: 'number',
                    value: orientation.pan,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [-1, 1], // Normalisé entre -1 et 1
                    timestamp: frame.timestamp,
                    hand: hand.handedness
                });

                // Feature: Roll (rotation autour de l'axe principal - axe Z)
                features.push({
                    name: 'hand_roll',
                    type: 'number',
                    value: orientation.roll,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [-1, 1], // Normalisé entre -1 et 1
                    timestamp: frame.timestamp,
                    hand: hand.handedness
                });

                // Feature: Orientation combinée (pour analyse globale)
                const combinedOrientation = Math.sqrt(
                    orientation.tilt ** 2 + 
                    orientation.pan ** 2 + 
                    orientation.roll ** 2
                );
                features.push({
                    name: 'hand_orientation_magnitude',
                    type: 'number',
                    value: combinedOrientation,
                    parents: this.name,
                    display: 'Graph',
                    minMax: [0, 1.73], // Max théorique: sqrt(1+1+1) ≈ 1.73
                    timestamp: frame.timestamp,
                    hand: hand.handedness
                });
            }
        }

        return features;
    }

    private calculateHandOrientation(
        wrist: HandLandmarks,
        indexBase: HandLandmarks,
        middleBase: HandLandmarks,
        pinkyBase: HandLandmarks,
        indexTip: HandLandmarks
    ): { tilt: number; pan: number; roll: number } | null {
        // 1. Calculer le vecteur normal à la paume (pour déterminer l'orientation)
        // Utiliser les bases de l'index, majeur et auriculaire pour définir le plan de la paume
        const palmVector1 = this.vectorFromTo(indexBase, middleBase);
        const palmVector2 = this.vectorFromTo(indexBase, pinkyBase);

        // Produit vectoriel pour obtenir la normale à la paume
        const palmNormal = this.crossProduct(palmVector1, palmVector2);
        const palmNormalNormalized = this.normalizeVector(palmNormal);

        if (!palmNormalNormalized) {
            return null;
        }

        // 2. Calculer le vecteur principal de la main (du poignet vers l'index)
        const handDirection = this.vectorFromTo(wrist, indexTip);
        const handDirectionNormalized = this.normalizeVector(handDirection);

        if (!handDirectionNormalized) {
            return null;
        }

        // 3. Calculer les angles d'orientation
        // Tilt: inclinaison avant/arrière (autour de l'axe X)
        // Représente l'angle entre la normale de la paume et l'axe Y
        const tilt = palmNormalNormalized.y;

        // Pan: inclinaison gauche/droite (autour de l'axe Y)
        // Représente l'angle entre la normale de la paume et l'axe X
        const pan = -palmNormalNormalized.x; // Inversé pour correspondre à l'intuition

        // Roll: rotation autour de l'axe principal de la main
        // Calculé à partir de l'angle entre la direction de la main et le plan horizontal
        const roll = Math.atan2(handDirectionNormalized.z, 
                               Math.sqrt(handDirectionNormalized.x ** 2 + handDirectionNormalized.y ** 2));

        // Normaliser les valeurs entre -1 et 1 pour cohérence avec d'autres features
        return {
            tilt: this.clampAndNormalize(tilt, -1, 1),
            pan: this.clampAndNormalize(pan, -1, 1),
            roll: this.clampAndNormalize(roll / (Math.PI / 2), -1, 1) // Normaliser l'angle
        };
    }

    private vectorFromTo(from: HandLandmarks, to: HandLandmarks): { x: number; y: number; z: number } {
        return {
            x: to.x - from.x,
            y: to.y - from.y,
            z: to.z - from.z
        };
    }

    private crossProduct(v1: { x: number; y: number; z: number }, v2: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
        return {
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x
        };
    }

    private normalizeVector(v: { x: number; y: number; z: number }): { x: number; y: number; z: number } | null {
        const length = Math.sqrt(v.x ** 2 + v.y ** 2 + v.z ** 2);
        
        if (length === 0) {
            return null;
        }
        
        return {
            x: v.x / length,
            y: v.y / length,
            z: v.z / length
        };
    }

    private clampAndNormalize(value: number, min: number, max: number): number {
        // Clamp la valeur dans la plage
        const clamped = Math.max(min, Math.min(max, value));
        
        // Normaliser entre -1 et 1 si nécessaire
        if (clamped > max) return max;
        if (clamped < min) return min;
        
        return clamped;
    }

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
}