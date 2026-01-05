/**
 * Préprocesseur utilisant un filtre de Kalman pour lisser les landmarks
 * Objectif: Réduire le bruit et stabiliser les mouvements des landmarks
 * Approche: Appliquer un filtre de Kalman à chaque landmark individuellement
 */

import { BasePreprocessor } from './BasePreprocessor';
import type { MediaPipeFrame, HandData, HandLandmarks } from '../types';

// Interface pour l'état du filtre Kalman 3D
interface KalmanState3D {
    x: { pos: number; vel: number; cov: number }; // État pour x
    y: { pos: number; vel: number; cov: number }; // État pour y
    z: { pos: number; vel: number; cov: number }; // État pour z
}

// Interface pour le filtre Kalman 3D
interface KalmanFilter3D {
    state: KalmanState3D;
    processNoise: number; // Bruit du processus
    measurementNoise: number; // Bruit de mesure
}

export class KalmanFilterPreprocessor extends BasePreprocessor {
    readonly name = 'Kalman Filter Preprocessor';
    readonly id = 'kalman-filter';

    // Indices des fingertips (bouts des doigts) - optimisation performance
    private static readonly FINGERTIP_INDICES = [4, 8, 12, 16, 20]; // THUMB_TIP, INDEX_TIP, MIDDLE_TIP, RING_TIP, PINKY_TIP

    // Filtres Kalman uniquement pour les fingertips (5 au lieu de 21 landmarks)
    private filters: Map<string, Map<number, KalmanFilter3D>> = new Map();

    constructor() {
        super();
        this.description = 'Filtre Kalman optimisé - lisse uniquement les fingertips (5 points au lieu de 21)';
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

            // Créer une clé unique pour cette main
            const handKey = `${hand.handedness}_${hand.landmarks.length}`;

            // Initialiser les filtres si nécessaire
            if (!this.filters.has(handKey)) {
                this.initializeFiltersForHand(hand.landmarks, handKey);
            }

            // Appliquer le filtre de Kalman uniquement aux fingertips
            const filteredLandmarks = hand.landmarks.map((landmark, index) => {
                // Ne filtrer que les fingertips pour optimiser les performances
                if (KalmanFilterPreprocessor.FINGERTIP_INDICES.includes(index)) {
                    const handFilters = this.filters.get(handKey);
                    const filter = handFilters?.get(index);
                    if (filter) {
                        return this.applyKalmanFilter(landmark, filter);
                    }
                }
                return landmark; // Retourner sans filtrage pour les autres landmarks
            });

            processedHands.push({
                ...hand,
                landmarks: filteredLandmarks
            });
        }

        return {
            hands: processedHands,
            timestamp: frame.timestamp
        };
    }

    /**
     * Initialiser les filtres de Kalman pour les fingertips d'une main
     */
    private initializeFiltersForHand(landmarks: HandLandmarks[], handKey: string): void {
        const handFilters = new Map<number, KalmanFilter3D>();

        // Initialiser uniquement les filtres pour les fingertips
        KalmanFilterPreprocessor.FINGERTIP_INDICES.forEach(index => {
            if (index < landmarks.length) {
                const landmark = landmarks[index];
                if (!landmark) return;
                handFilters.set(index, {
                    state: {
                        x: { pos: landmark.x, vel: 0, cov: 1 },
                        y: { pos: landmark.y, vel: 0, cov: 1 },
                        z: { pos: landmark.z, vel: 0, cov: 1 }
                    },
                    processNoise: 0.01,  // Bruit du processus (ajustable)
                    measurementNoise: 0.1 // Bruit de mesure (ajustable)
                });
            }
        });

        this.filters.set(handKey, handFilters);
        console.log(`Filtres Kalman optimisés initialisés pour ${handFilters.size} fingertips (clé: ${handKey})`);
    }

    /**
     * Appliquer le filtre de Kalman 3D à un landmark
     */
    private applyKalmanFilter(landmark: HandLandmarks, filter: KalmanFilter3D): HandLandmarks {
        // Fonction helper pour filtrer une dimension
        const filterDimension = (measurement: number, state: { pos: number; vel: number; cov: number }) => {
            // Prédiction
            const predictedPos = state.pos + state.vel;
            const predictedVel = state.vel;
            const predictedCov = state.cov + filter.processNoise;

            // Mise à jour
            const residual = measurement - predictedPos;
            const gain = predictedCov / (predictedCov + filter.measurementNoise);

            return {
                pos: predictedPos + gain * residual,
                vel: predictedVel + gain * residual,
                cov: (1 - gain) * predictedCov
            };
        };

        // Appliquer le filtre à chaque dimension
        filter.state.x = filterDimension(landmark.x, filter.state.x);
        filter.state.y = filterDimension(landmark.y, filter.state.y);
        filter.state.z = filterDimension(landmark.z, filter.state.z);

        // Retourner le landmark filtré
        return {
            x: filter.state.x.pos,
            y: filter.state.y.pos,
            z: filter.state.z.pos
        };
    }

    /**
     * Réinitialiser tous les filtres de Kalman
     */
    override reset(): void {
        this.filters.clear();
        console.log('Tous les filtres de Kalman réinitialisés');
    }

    /**
     * Configurer les paramètres du filtre de Kalman pour tous les fingertips
     */
    public configureFilter(processNoise: number = 0.1, measurementNoise: number = 0.1): void {
        this.filters.forEach(handFilters => {
            handFilters.forEach(filter => {
                filter.processNoise = processNoise;
                filter.measurementNoise = measurementNoise;
            });
        });
        console.log(`Filtres Kalman fingertips configurés (processNoise: ${processNoise}, measurementNoise: ${measurementNoise})`);
    }
}