/**
 * Préprocesseur utilisant un filtre de Kalman pour lisser les landmarks
 * Objectif: Réduire le bruit et stabiliser les mouvements des landmarks
 * Approche: Appliquer un filtre de Kalman à chaque landmark individuellement
 */

import { BasePreprocessor } from './BasePreprocessor';
import type { MediaPipeFrame, HandData, HandLandmarks } from '../types';

// Interface pour l'état du filtre Kalman
interface KalmanState {
    x: number; // Position estimée
    v: number; // Vitesse estimée
    p: number; // Covariance de l'erreur d'estimation
}

// Interface pour le filtre Kalman
interface KalmanFilter {
    state: KalmanState;
    processNoise: number; // Bruit du processus
    measurementNoise: number; // Bruit de mesure
}

export class KalmanFilterPreprocessor extends BasePreprocessor {
    readonly name = 'Kalman Filter Preprocessor';
    readonly id = 'kalman-filter';

    // Filtres Kalman pour chaque landmark de chaque main
    private filters: Map<string, KalmanFilter[]> = new Map();

    constructor() {
        super();
        this.description = 'Applique un filtre de Kalman pour lisser les mouvements et réduire le bruit';
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
                this.initializeFiltersForHand(hand.landmarks);
            }

            // Appliquer le filtre de Kalman à chaque landmark
            const filteredLandmarks = hand.landmarks.map((landmark, index) => {
                const filter = this.filters.get(handKey)?.[index];
                if (filter) {
                    return this.applyKalmanFilter(landmark, filter);
                }
                return landmark;
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
     * Initialiser les filtres de Kalman pour une main
     */
    private initializeFiltersForHand(landmarks: HandLandmarks[]): void {
        const handKey = `initializing_${landmarks.length}`;

        const filters: KalmanFilter[] = landmarks.map(landmark => ({
            state: {
                x: landmark.x, // Position initiale
                v: 0,          // Vitesse initiale (0)
                p: 1           // Covariance initiale (incertitude élevée)
            },
            processNoise: 0.01,  // Bruit du processus (ajustable)
            measurementNoise: 0.1 // Bruit de mesure (ajustable)
        }));

        this.filters.set(handKey, filters);
        console.log(`Filtres de Kalman initialisés pour ${landmarks.length} landmarks`);
    }

    /**
     * Appliquer le filtre de Kalman à un landmark
     */
    private applyKalmanFilter(landmark: HandLandmarks, filter: KalmanFilter): HandLandmarks {
        // Prédiction
        const predictedState = {
            x: filter.state.x + filter.state.v,
            v: filter.state.v,
            p: filter.state.p + filter.processNoise
        };

        // Mise à jour
        const residual = landmark.x - predictedState.x;
        const gain = predictedState.p / (predictedState.p + filter.measurementNoise);

        const updatedState = {
            x: predictedState.x + gain * residual,
            v: predictedState.v + gain * residual,
            p: (1 - gain) * predictedState.p
        };

        // Mettre à jour l'état du filtre
        filter.state = updatedState;

        // Retourner le landmark filtré (on filtre seulement x pour l'exemple)
        // Note: Pour une implémentation complète, il faudrait filtrer x, y et z séparément
        return {
            x: updatedState.x,
            y: landmark.y,
            z: landmark.z
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
     * Configurer les paramètres du filtre de Kalman
     */
    public configureFilter(processNoise: number = 0.01, measurementNoise: number = 0.1): void {
        this.filters.forEach(filters => {
            filters.forEach(filter => {
                filter.processNoise = processNoise;
                filter.measurementNoise = measurementNoise;
            });
        });
        console.log(`Filtres de Kalman configurés (processNoise: ${processNoise}, measurementNoise: ${measurementNoise})`);
    }
}