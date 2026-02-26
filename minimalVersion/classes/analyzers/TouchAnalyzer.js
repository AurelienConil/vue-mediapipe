import { BaseGestureAnalyzer } from "./BaseGestureAnalyzer.js";

/**
 * TouchAnalyzer - Detecte un contact via un pattern de pic de vitesse
 * sur la distance pouce -> phalange (meme logique que TapAllDetection).
 *
 * - data.analysis.touches: evenements de touch detectes sur la frame courante
 */
export class TouchAnalyzer extends BaseGestureAnalyzer {
    constructor() {
        super();
        this.bufferSize = 10; // ~500ms
        this.fingers = ["index", "middle", "ring", "pinky"];
        this.phalanxNames = ["mcp", "pip", "tip"];
        this.fingerBuffers = new Map();
        this.lastPeakDetectedTime = 0;
        this.cooldownPeriod = 500; // 500ms cooldown
        this.isInCooldown = false;
        this.initializeBuffers();
    }

    initializeBuffers() {
        this.fingers.forEach((finger) => {
            this.fingerBuffers.set(finger, {
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

        const touches = this.detectTouches();

        // if touches is not empoty, console.log
        if (touches.length > 0) {
            console.log("[TouchAnalyzer] Detected touches:", touches[0]);
        }

        data.analysis.touches = touches;

        return data;
    }

    updateAllFingerBuffers(distancesAndVelocities) {
        this.fingers.forEach((finger) => {
            for (let phalanxIndex = 0; phalanxIndex < 3; phalanxIndex++) {
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

    detectTouches() {
        const touches = [];

        const getFingerSpeedMultiplier = (finger) => {
            switch (finger) {
                case "index":
                    return 1.0;
                case "middle":
                    return 1.0;
                case "ring":
                    return 1.3;
                case "pinky":
                    return 1.5;
                default:
                    return 1.0;
            }
        };

        const getFingerGlobalMultiplier = (finger) => {
            switch (finger) {
                case "index":
                    return 1.0;
                case "middle":
                    return 1.0;
                case "ring":
                    return 1.4;
                case "pinky":
                    return 1.6;
                default:
                    return 1.0;
            }
        };

        const getPhalanxWeights = (phalanxIdx) => {
            switch (phalanxIdx) {
                case 0:
                    return { speedWeight: 1.3, distanceWeight: 2.5, minSpeed: 0.4 };
                case 1:
                    return { speedWeight: 1.0, distanceWeight: 2.0, minSpeed: 0.5 };
                case 2:
                    return { speedWeight: 0.8, distanceWeight: 1.5, minSpeed: 0.8 };
                default:
                    return { speedWeight: 1.0, distanceWeight: 2.0, minSpeed: 0.5 };
            }
        };

        let bestFinger = null;
        let bestPhalanxIndex = -1;
        let bestScore = 0;
        let bestDistance = 100;
        let bestSpeed = 0;

        this.fingers.forEach((finger) => {
            for (let phalanxIdx = 0; phalanxIdx < 3; phalanxIdx++) {
                const peakResult = this.detectTapPattern(finger, phalanxIdx);
                const weights = getPhalanxWeights(phalanxIdx);

                if (peakResult.hasPeak && peakResult.peakValueSpeed > weights.minSpeed && peakResult.peakValueDist < 0.12) {
                    const fingerSpeedMultiplier = getFingerSpeedMultiplier(finger);
                    const fingerGlobalMultiplier = getFingerGlobalMultiplier(finger);

                    const adaptiveSpeedScore = weights.speedWeight * peakResult.peakValueSpeed * fingerSpeedMultiplier;
                    const distanceScore = peakResult.peakValueDist > 0 ? weights.distanceWeight * (1 / peakResult.peakValueDist) : 0;
                    const baseScore = adaptiveSpeedScore + distanceScore;
                    const totalScore = baseScore * fingerGlobalMultiplier;

                    if (totalScore > bestScore) {
                        bestScore = totalScore;
                        bestFinger = finger;
                        bestPhalanxIndex = phalanxIdx;
                        bestDistance = peakResult.peakValueDist;
                        bestSpeed = peakResult.peakValueSpeed;
                    }
                }
            }
        });

        if (bestFinger !== null && bestPhalanxIndex !== -1 && bestDistance < 0.08) {
            const now = Date.now();
            if (this.isInCooldown || now - this.lastPeakDetectedTime < this.cooldownPeriod) {
                return touches;
            }

            this.isInCooldown = true;
            this.lastPeakDetectedTime = now;

            setTimeout(() => {
                this.isInCooldown = false;
            }, this.cooldownPeriod);

            touches.push({
                finger: bestFinger,
                phalanx: bestPhalanxIndex,
                distance: parseFloat(bestDistance.toFixed(3)),
                speed: parseFloat(bestSpeed.toFixed(3)),
                score: parseFloat(bestScore.toFixed(2)),
                isActive: true,
            });
        }

        return touches;
    }

    detectTapPattern(finger, phalanxIndex) {
        const buffers = this.fingerBuffers.get(finger);
        if (!buffers || !buffers.phalanxBuffers[phalanxIndex]) {
            return { hasPeak: false, peakValueDist: 0, peakValueSpeed: 0 };
        }

        const phalanxBuffer = buffers.phalanxBuffers[phalanxIndex];
        const midIndex = Math.floor(this.bufferSize / 2);

        const distanceSStart = phalanxBuffer.distanceSpeed[0];
        const distanceSPeak = phalanxBuffer.distanceSpeed[midIndex];
        const distanceSEnd = phalanxBuffer.distanceSpeed[this.bufferSize - 1];

        const maxSpeedIndex = this.findMaximumInBufferReturnIndex(phalanxBuffer.distanceSpeed);
        const maxSpeed = phalanxBuffer.distanceSpeed[maxSpeedIndex];
        const distanceAtMaxSpeed = phalanxBuffer.distance[maxSpeedIndex];

        const distanceCondition =
            distanceSStart !== undefined &&
            distanceSPeak !== undefined &&
            distanceSEnd !== undefined &&
            distanceSStart < 0.1 &&
            distanceSPeak > 0.6 &&
            distanceSEnd < 0.1;

        return {
            hasPeak: distanceCondition,
            peakValueDist: typeof distanceAtMaxSpeed === "number" ? distanceAtMaxSpeed : 0,
            peakValueSpeed: typeof maxSpeed === "number" ? maxSpeed : 0,
        };
    }

    findMaximumInBufferReturnIndex(buffer) {
        return buffer.indexOf(Math.max(...buffer));
    }
}
