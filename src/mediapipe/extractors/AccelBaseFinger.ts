import { BaseFeatureExtractor } from './BaseFeatureExtractor';
import type { MediaPipeFrame, Feature, HandData, HandLandmarks, Finger, HandSide } from '../types';
import type { FeatureStore } from '../../stores/FeatureStore';

interface FingerVelocityData {
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    speed: number;
    timestamp: number;
}

export class AccelBaseFinger extends BaseFeatureExtractor {
    readonly name = 'AccelBaseFinger';

    // Configuration des doigts : [base, tip]
    private readonly fingerConfig: Record<Finger, { base: number; tip: number }> = {
        thumb: { base: 1, tip: 4 },    // Pouce
        index: { base: 5, tip: 6 },    // Index
        middle: { base: 9, tip: 10 },  // Majeur
        ring: { base: 13, tip: 14 },   // Annulaire
        pinky: { base: 17, tip: 18 }   // Auriculaire
    };

    // Historique pour calculer vitesse et accélération
    private previousData = new Map<string, FingerVelocityData>();
    private previousVelocity = new Map<string, { velocity: number; acceleration: number; timestamp: number }>();

    extract(frame: MediaPipeFrame, featureStore: FeatureStore): Feature[] {
        const features: Feature[] = [];

        for (const hand of frame.hands) {
            for (const [fingerName, config] of Object.entries(this.fingerConfig)) {
                const basePoint = hand.landmarks[config.base];
                const tipPoint = hand.landmarks[config.tip];

                if (basePoint && tipPoint) {
                    const relativePosition = this.calculateRelativePosition(tipPoint, basePoint);
                    const velocityData = this.calculateVelocity(relativePosition, frame.timestamp, fingerName, hand.handedness);

                    if (velocityData) {
                        // Feature vitesse
                        features.push({
                            name: `${fingerName}_base_velocity`,
                            type: 'number',
                            value: velocityData.speed,
                            parents: this.name,
                            display: 'Graph',
                            minMax: [0, 2], // Vitesse normalisée
                            timestamp: frame.timestamp,
                            hand: hand.handedness,
                            finger: fingerName as Finger
                        });

                        // Calculer et ajouter l'accélération
                        const accelerationData = this.calculateAcceleration(velocityData.speed, frame.timestamp, fingerName, hand.handedness);
                        if (accelerationData !== null) {
                            features.push({
                                name: `${fingerName}_base_acceleration`,
                                type: 'number',
                                value: accelerationData,
                                parents: this.name,
                                display: 'Graph',
                                minMax: [-10, 10], // Accélération normalisée
                                timestamp: frame.timestamp,
                                hand: hand.handedness,
                                finger: fingerName as Finger
                            });
                        }
                    }
                }
            }
        }

        return features;
    }

    private calculateRelativePosition(tip: HandLandmarks, base: HandLandmarks): { x: number; y: number; z: number } {
        return {
            x: tip.x - base.x,
            y: tip.y - base.y,
            z: tip.z - base.z
        };
    }

    private calculateVelocity(
        position: { x: number; y: number; z: number },
        timestamp: number,
        fingerName: Finger,
        hand: HandSide
    ): FingerVelocityData | null {
        const key = `${fingerName}_${hand}`;
        const previousData = this.previousData.get(key);

        if (!previousData) {
            // Première frame, pas de vitesse calculable
            const newData: FingerVelocityData = {
                position,
                velocity: { x: 0, y: 0, z: 0 },
                speed: 0,
                timestamp
            };
            this.previousData.set(key, newData);
            return newData;
        }

        // Calculer le delta de temps en secondes
        const deltaTime = (timestamp - previousData.timestamp) / 1000;

        if (deltaTime <= 0) {
            return null; // Éviter division par zéro
        }

        // Calculer la vitesse
        const velocity = {
            x: (position.x - previousData.position.x) / deltaTime,
            y: (position.y - previousData.position.y) / deltaTime,
            z: (position.z - previousData.position.z) / deltaTime
        };

        // Calculer la vitesse scalaire (magnitude)
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2);

        const newData: FingerVelocityData = {
            position,
            velocity,
            speed,
            timestamp
        };

        this.previousData.set(key, newData);
        return newData;
    }

    private calculateAcceleration(
        currentSpeed: number,
        timestamp: number,
        fingerName: Finger,
        hand: HandSide
    ): number | null {
        const key = `${fingerName}_${hand}`;
        const previousVel = this.previousVelocity.get(key);

        if (!previousVel) {
            // Première mesure de vitesse, pas d'accélération calculable
            this.previousVelocity.set(key, {
                velocity: currentSpeed,
                acceleration: 0,
                timestamp
            });
            return 0;
        }

        // Calculer le delta de temps en secondes
        const deltaTime = (timestamp - previousVel.timestamp) / 1000;

        if (deltaTime <= 0) {
            return null; // Éviter division par zéro
        }

        // Calculer l'accélération
        const acceleration = (currentSpeed - previousVel.velocity) / deltaTime;

        // Mettre à jour l'historique
        this.previousVelocity.set(key, {
            velocity: currentSpeed,
            acceleration,
            timestamp
        });

        return acceleration;
    }

    // Méthode pour réinitialiser l'historique si nécessaire
    clearHistory(): void {
        this.previousData.clear();
        this.previousVelocity.clear();
    }
}