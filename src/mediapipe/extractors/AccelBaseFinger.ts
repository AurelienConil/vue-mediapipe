import { BaseFeatureExtractor } from './BaseFeatureExtractor';
import type { MediaPipeFrame, Feature, HandData, HandLandmarks, Finger, HandSide } from '../types';
import type { useFeatureStore } from '../../stores/FeatureStore';

interface FingerVelocityData {
    position: { x: number; y: number; z: number };
    velocity: { x: number; y: number; z: number };
    speed: number;
    timestamp: number;
}

export class AccelBaseFinger extends BaseFeatureExtractor {
    readonly name = 'AccelBaseFinger';

    // Pour chaque doigt, indices des segments base et tip : [baseStart, baseEnd, tipStart, tipEnd]
    private readonly fingerSegments: Record<Finger, [number, number, number, number]> = {
        thumb: [1, 2, 3, 4],
        index: [5, 6, 7, 8],
        middle: [9, 10, 11, 12],
        ring: [13, 14, 15, 16],
        pinky: [17, 18, 19, 20]
    };

    // Historique pour calculer angle, vitesse angulaire et accélération angulaire
    private previousAngle = new Map<string, { angle: number; timestamp: number }>();
    private previousAngularVelocity = new Map<string, { velocity: number; acceleration: number; timestamp: number }>();

    extract(frame: MediaPipeFrame, featureStore: FeatureStore): Feature[] {
        const features: Feature[] = [];

        for (const hand of frame.hands) {
            for (const [fingerName, segmentIdxs] of Object.entries(this.fingerSegments)) {
                const [baseStartIdx, baseEndIdx, tipStartIdx, tipEndIdx] = segmentIdxs;
                const baseStart = hand.landmarks[baseStartIdx];
                const baseEnd = hand.landmarks[baseEndIdx];
                const tipStart = hand.landmarks[tipStartIdx];
                const tipEnd = hand.landmarks[tipEndIdx];

                if (baseStart && baseEnd && tipStart && tipEnd) {
                    // Vecteurs des segments projetés sur le plan XY
                    const baseVec = {
                        x: baseEnd.x - baseStart.x,
                        y: baseEnd.y - baseStart.y
                    };
                    const tipVec = {
                        x: tipEnd.x - tipStart.x,
                        y: tipEnd.y - tipStart.y
                    };

                    // Calcul de l'angle entre les deux segments (en radians)
                    const rawAngle = this.calculateAngle2D(baseVec, tipVec);

                    // Normalisation de l'angle selon le type de main pour avoir des valeurs cohérentes
                    const angle = this.normalizeAngleForHand(rawAngle, hand.handedness);

                    // Calcul vitesse angulaire
                    const angularVelocity = this.calculateAngularVelocity(angle, frame.timestamp, fingerName, hand.handedness);

                    // min and max à 20 pour la vitesse angulaire (ajustable)
                    const maxVel = fingerName === 'thumb' ? 10 : 20;
                    const minVel = -maxVel;

                    const maxAng = fingerName === 'thumb' ? 1.5 : 0.1;
                    const minAng = fingerName === 'thumb' ? -0.4 : -2;

                    // Ajout de la feature valeur angulaire (angle en rad)
                    features.push({
                        name: `${fingerName}_angular_value`,
                        type: 'number',
                        value: angle,
                        parents: this.name,
                        display: 'Graph',
                        minMax: [maxAng, minAng],
                        timestamp: frame.timestamp,
                        hand: hand.handedness,
                        finger: fingerName as Finger
                    });

                    // Ajout de la feature vitesse angulaire (en rad/s)
                    features.push({
                        name: `${fingerName}_angular_velocity`,
                        type: 'number',
                        value: angularVelocity,
                        parents: this.name,
                        display: 'Graph',
                        minMax: [minVel, maxVel],
                        timestamp: frame.timestamp,
                        hand: hand.handedness,
                        finger: fingerName as Finger
                    });
                }
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


    // Calcule la vitesse angulaire (rad/s)
    private calculateAngularVelocity(
        angle: number,
        timestamp: number,
        fingerName: string,
        hand: HandSide
    ): number {
        const key = `${fingerName}_${hand}`;
        const prev = this.previousAngle.get(key);
        let velocity = 0;
        if (prev) {
            const deltaTime = (timestamp - prev.timestamp) / 1000;
            if (deltaTime > 0) {
                // Gestion du passage -PI/PI
                let deltaAngle = angle - prev.angle;
                if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
                if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
                velocity = deltaAngle / deltaTime;
            }
        }
        this.previousAngle.set(key, { angle, timestamp });
        return velocity;
    }


    // Calcule l'accélération angulaire (rad/s²)
    private calculateAngularAcceleration(
        currentVelocity: number,
        timestamp: number,
        fingerName: string,
        hand: HandSide
    ): number | null {
        const key = `${fingerName}_${hand}`;
        const prev = this.previousAngularVelocity.get(key);
        if (!prev) {
            this.previousAngularVelocity.set(key, {
                velocity: currentVelocity,
                acceleration: 0,
                timestamp
            });
            return 0;
        }
        const deltaTime = (timestamp - prev.timestamp) / 1000;
        if (deltaTime <= 0) return null;
        const acceleration = (currentVelocity - prev.velocity) / deltaTime;
        this.previousAngularVelocity.set(key, {
            velocity: currentVelocity,
            acceleration,
            timestamp
        });
        return acceleration;
    }

    // Méthode pour réinitialiser l'historique si nécessaire
    clearHistory(): void {
        this.previousAngle.clear();
        this.previousAngularVelocity.clear();
    }
}