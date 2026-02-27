

import { BaseGestureAnalyzer } from "./BaseGestureAnalyzer.js";
import { PeakManager } from "./PeakManager.js";

/**
 * TouchAnalyzer - Detecte un contact via un pattern de pic de vitesse
 * sur la distance pouce -> phalange (meme logique que TapAllDetection).
 *
 * - data.analysis.touches: evenements de touch detectes sur la frame courante
 */
export class TouchAnalyzer extends BaseGestureAnalyzer {
    constructor() {
        super();
        this.bufferSize = 10;
        this.fingers = ["index", "middle", "ring", "pinky"];
        // Harmonisation : base=1, middle=2, tip=3 (MCP ignoré)
        this.phalanxNames = ["base", "middle", "tip"];
        this.fingerBuffers = new Map();
        this.peakManager = new PeakManager(7); // fenêtre de 5 frames par défaut
        this.initializeBuffers();
    }

    initializeBuffers() {
        this.fingers.forEach((finger) => {
            this.fingerBuffers.set(finger, {
                // phalanxBuffers[0] = base (indice 1), [1]=middle (2), [2]=tip (3)
                phalanxBuffers: Array.from({ length: 3 }, () => ({
                    distanceSpeed: Array(this.bufferSize).fill(0),
                    distance: Array(this.bufferSize).fill(0),
                })),
            });
        });
    }

    handle(data) {
        if (!data.preprocessed || !data.analysis.distancesAndVelocities) {
            return data;
        }

        this.updateAllFingerBuffers(data.analysis.distancesAndVelocities);

        // Utilise detectTouches pour obtenir tous les peaks de la frame
        const { hasPeak } = this.detectTouches();
        let bestPeak = null;
        if (hasPeak && hasPeak.length > 0) {
            for (const peak of hasPeak) {
                // Ajoute timestamp pour compatibilité avec PeakManager
                const peakWithTime = { ...peak, timestamp: Date.now() };
                const result = this.peakManager.handlePeak(peakWithTime);
                if (result) bestPeak = result;
            }
        } else {
            // Tick pour avancer la fenêtre même sans nouveau peak
            const result = this.peakManager.tick();
            if (result) bestPeak = result;
        }

        if (bestPeak) {
            data.event = {
                type: "touch",
                finger: bestPeak.finger,
                phalanx: bestPeak.phalanx,
                distance: bestPeak.distance,
                speed: bestPeak.speed,
                score: bestPeak.score,
                timestamp: bestPeak.timestamp,
                expiresAt: bestPeak.timestamp + 1000,
            };
            data.hasPeak = this.peakManager.getWindowPeaks();
            console.log("[TouchAnalyzer] Detected touch , HasPeak Length:", data.hasPeak.length);
        } else {
            data.event = null;
            data.hasPeak = [];
        }
        return data;
    }

    updateAllFingerBuffers(distancesAndVelocities) {
        this.fingers.forEach((finger) => {
            for (let phalanxIndex = 0; phalanxIndex < 3; phalanxIndex++) {
                // phalanxIndex 0=base(1), 1=middle(2), 2=tip(3)
                const phalanxName = this.phalanxNames[phalanxIndex];
                const distanceSpeedFeatureName = `thumb_to_${finger}_${phalanxName}_distspeed`;
                const distanceFeatureName = `thumb_to_${finger}_${phalanxName}_dist`;

                const distanceSpeedFeature = distancesAndVelocities.find(
                    (f) => f && f.name === distanceSpeedFeatureName
                );
                const distanceFeature = distancesAndVelocities.find(
                    (f) => f && f.name === distanceFeatureName
                );

                const buffers = this.fingerBuffers.get(finger);
                if (!buffers) return;

                const phalanxBuffer = buffers.phalanxBuffers[phalanxIndex];
                if (!phalanxBuffer) return;

                if (distanceSpeedFeature && typeof distanceSpeedFeature.value === "number") {
                    this.updateBuffer(phalanxBuffer.distanceSpeed, distanceSpeedFeature.value);
                }
                if (distanceFeature && typeof distanceFeature.value === "number") {
                    this.updateBuffer(phalanxBuffer.distance, distanceFeature.value);
                }
            }
        });
    }

    updateBuffer(buffer, value) {
        buffer.shift();
        buffer.push(value);
    }

    getFingerSpeedMultiplier(finger) {
        switch (finger) {
            case "index":
                return 1.0;
            case "middle":
                return 1.0;
            case "ring":
                return 1.2;
            case "pinky":
                return 1.3;
            default:
                return 1.0;
        }
    };

    getFingerGlobalMultiplier(finger) {
        switch (finger) {
            case "index":
                return 1.0;
            case "middle":
                return 1.0;
            case "ring":
                return 1.0;
            case "pinky":
                return 1.0;
            default:
                return 1.0;
        }
    };

    getPhalanxWeights(phalanxIdx) {
        switch (phalanxIdx) {
            case 0: // base ( indice 1)
                return { speedWeight: 1.5, distanceWeight: 1.2, minSpeed: 0.4 };
            case 1: // middle ( indice 2)
                return { speedWeight: 1.3, distanceWeight: 1.1, minSpeed: 0.5 };
            case 2: // tip ( indice 3)
                return { speedWeight: 1.0, distanceWeight: 1.0, minSpeed: 0.6 };
            default:
                return { speedWeight: 1.0, distanceWeight: 1.0, minSpeed: 0.4 };
        }
    };



    detectTouches() {
        let event = {};
        let hasPeak = []



        let bestFinger = null;
        let bestPhalanxIndex = -1;
        let bestScore = 0;
        let bestDistance = 100;
        let bestSpeed = 0;

        this.fingers.forEach((finger) => {
            for (let phalanxIdx = 0; phalanxIdx < 3; phalanxIdx++) {
                // phalanxIdx 0=base(1), 1=middle(2), 2=tip(3)
                const peakResult = this.detectTapPattern(finger, phalanxIdx);
                const weights = this.getPhalanxWeights(phalanxIdx);

                if (peakResult.hasPeak) {
                    const fingerSpeedMultiplier = this.getFingerSpeedMultiplier(finger);
                    const fingerGlobalMultiplier = this.getFingerGlobalMultiplier(finger);

                    const adaptiveSpeedScore = weights.speedWeight * peakResult.peakValueSpeed * fingerSpeedMultiplier;
                    const distanceScore = peakResult.peakValueDist > 0 ? weights.distanceWeight * (1 / peakResult.peakValueDist) : 0;
                    //const baseScore = adaptiveSpeedScore + distanceScore;
                    const baseScore = distanceScore; // multiplication pour renforcer le besoin d'avoir les 2
                    const totalScore = baseScore * fingerGlobalMultiplier;

                    if (totalScore > bestScore) {
                        bestScore = totalScore;
                        bestFinger = finger;
                        bestPhalanxIndex = phalanxIdx;
                        bestDistance = peakResult.peakValueDist;
                        bestSpeed = peakResult.peakValueSpeed;
                    }

                    hasPeak.push({
                        finger,
                        phalanx: phalanxIdx + 1,  // Unification : base=1, middle=2, tip=3
                        adaptiveSpeedScore: parseFloat(adaptiveSpeedScore.toFixed(3)),
                        distanceScore: parseFloat(distanceScore.toFixed(3)),
                        totalScore: parseFloat(totalScore.toFixed(3))
                    });
                }
            }
        });

        if (bestFinger !== null && bestPhalanxIndex !== -1) {
            const now = Date.now();
            // Harmonisation : le tip est toujours l'indice 3 (donc phalanxIdx+1)
            event = {
                type: "touch",
                finger: bestFinger,
                phalanx: bestPhalanxIndex + 1, // 1=base, 2=middle, 3=tip
                distance: parseFloat(bestDistance.toFixed(3)),
                speed: parseFloat(bestSpeed.toFixed(3)),
                score: parseFloat(bestScore.toFixed(2)),
                timestamp: now,
                expiresAt: now + 1000, // feedback valable 1 seconde
            }
        }

        return { event, hasPeak };
    }

    detectTapPattern(finger, phalanxIndex) {
        const buffers = this.fingerBuffers.get(finger);
        if (!buffers || !buffers.phalanxBuffers[phalanxIndex]) {
            return { hasPeak: false, peakValueDist: 0, peakValueSpeed: 0 };
        }

        const weights = this.getPhalanxWeights(phalanxIndex);

        const phalanxBuffer = buffers.phalanxBuffers[phalanxIndex];
        const midIndex = Math.floor(this.bufferSize / 2);

        const distanceStart = phalanxBuffer.distance[0];
        const distanceEnd = phalanxBuffer.distance[this.bufferSize - 1];
        const minDistance = Math.min(...phalanxBuffer.distance);

        const distanceSStart = phalanxBuffer.distanceSpeed[0];
        const distanceSEnd = phalanxBuffer.distanceSpeed[this.bufferSize - 1];

        const maxSpeedIndex = this.findMaximumInBufferReturnIndex(phalanxBuffer.distanceSpeed);
        const maxSpeed = phalanxBuffer.distanceSpeed[maxSpeedIndex];
        const distanceAtMaxSpeed = phalanxBuffer.distance[maxSpeedIndex];

        const distanceCondition =
            distanceStart > 0.15 &&
            minDistance < 0.09 &&
            distanceEnd < 0.12;

        const speedCondition =
            distanceSStart < 0.1 &&
            maxSpeed > weights.minSpeed &&
            distanceSEnd < 0.1;

        return {
            hasPeak: distanceCondition && speedCondition,
            peakValueDist: minDistance,
            peakValueSpeed: typeof maxSpeed === "number" ? maxSpeed : 0,
        };
    }

    findMaximumInBufferReturnIndex(buffer) {
        return buffer.indexOf(Math.max(...buffer));
    }
}
