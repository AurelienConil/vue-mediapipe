import { BaseAnalyzer } from './BaseAnalyzer';
import type { useFeatureStore } from '../../stores/FeatureStore';
import { eventBus, eventHistory } from '../../stores/eventBusStore';
import type { Event } from '../types';

type FeatureStore = ReturnType<typeof useFeatureStore>;

type FingerName = 'index' | 'middle' | 'ring' | 'pinky';

interface FingerBuffers {
    phalanxBuffers: {
        distanceSpeed: number[];
        distance: number[];
    }[]; // 3 éléments, un par phalange
}


interface FingerPeak {
    isPeak: boolean[];
    peakValuesDist: number[];
    peakValuesSpeed: number[];
}

interface PeakResult {
    hasPeak: boolean;
    peakValueDist: number;
    peakValueSpeed: number;
}

/**
 * Analyzer for detecting tap gestures using thumb-to-finger distance speed.
 * Looks for a peak in a 500ms window: low at start, peak in middle, low at end.
 * Supports detection for index, middle, ring, and pinky fingers.
 * Emits an event on EventBus when a tap is detected with finger identification.
 */
export class TapAllDetection extends BaseAnalyzer {
    readonly name = 'TapAllDetection';
    private bufferSize: number = 10; // Corresponds to 500ms if analyze is called every 50ms
    private fingers: FingerName[] = ['index', 'middle', 'ring', 'pinky'];
    private fingerBuffers: Map<FingerName, FingerBuffers> = new Map();
    private lastPeakDetectedTime: number = 0;
    private cooldownPeriod: number = 500; // 500ms cooldown instead of 250ms
    private isInCooldown: boolean = false; // Additional flag to prevent multiple emissions
    private fingerPeakStates: Map<FingerName, FingerPeak> = new Map(); // Track peak state for each finger


    constructor(featureStore: FeatureStore) {
        super(featureStore, eventBus, eventHistory);
        this.enable();
        this.initializeBuffers();
        this.initializePeakStates();
    }



    /**
     * Initialize buffers for all fingers with zeros
     */
    private initializeBuffers(): void {
        this.fingers.forEach(finger => {
            this.fingerBuffers.set(finger, {
                phalanxBuffers: Array.from({ length: 3 }, () => ({
                    distanceSpeed: Array(this.bufferSize).fill(0),
                    distance: Array(this.bufferSize).fill(0)
                }))
            });
        });
    }

    private initializePeakStates(): void {
        this.fingers.forEach(finger => {
            this.fingerPeakStates.set(finger, {
                isPeak: Array(3).fill(false),
                peakValuesDist: Array(3).fill(0),
                peakValuesSpeed: Array(3).fill(0)
            });
        });
    }



    analyze() {
        const now = Date.now();

        //Reset peak states
        this.initializePeakStates();

        // Update buffers and check for peaks for all fingers
        this.fingers.forEach(finger => {
            this.updateFingerBuffers(finger);

            for (let phalanxIndex = 0; phalanxIndex < 3; phalanxIndex++) {
                // calculate peak for each phalanx of each finger

                const peakResult: PeakResult = this.detectTapPattern(finger, phalanxIndex);

                const currentPeakState = this.fingerPeakStates.get(finger);
                if (currentPeakState) {
                    currentPeakState.isPeak[phalanxIndex] = peakResult.hasPeak;
                    currentPeakState.peakValuesDist[phalanxIndex] = parseFloat(peakResult.peakValueDist.toFixed(3));
                    currentPeakState.peakValuesSpeed[phalanxIndex] = parseFloat(peakResult.peakValueSpeed.toFixed(3));
                }

            }


        });

        // Manage peak sequence and detect maximum
        this.deductePeakInFrame();
    }


    /**
     * Update buffers for a specific finger with new sensor data
     */
    private updateFingerBuffers(finger: FingerName): void {
        for (let phalanxIndex = 0; phalanxIndex < 3; phalanxIndex++) {

            // phalanxIndex: 0 = Base, 1 = Middle, 2 = Tip
            // Base : thumb_to_${finger}B_distspeed
            // Middle : thumb_to_${finger}M_distspeed
            // Tip : thumb_to_${finger}T_distspeed

            const phalanxSuffix = phalanxIndex === 0 ? 'B' : phalanxIndex === 1 ? 'M' : 'T';
            const distanceSpeedFeatureName = `thumb_to_${finger}${phalanxSuffix}_distspeed`;
            const distanceFeatureName = `thumb_to_${finger}${phalanxSuffix}_dist`;

            const distanceSpeed = this.featureStore.getFeature(distanceSpeedFeatureName)?.value;
            const distance = this.featureStore.getFeature(distanceFeatureName)?.value;

            const buffers = this.fingerBuffers.get(finger);
            if (!buffers) return;

            const phalanxBuffer = buffers.phalanxBuffers[phalanxIndex];
            if (!phalanxBuffer) return;

            if (distanceSpeed !== undefined && typeof distanceSpeed === 'number') {
                this.updateBuffer(phalanxBuffer.distanceSpeed, distanceSpeed);
            }
            if (distance !== undefined && typeof distance === 'number') {
                this.updateBuffer(phalanxBuffer.distance, distance);
            }
        }
    }

    /**
     * Generic buffer update method
     */
    private updateBuffer(buffer: number[], value: number): void {
        buffer.shift();
        buffer.push(value);
    }

    /**
     * Detect tap pattern for a specific finger
     */
    private detectTapPattern(finger: FingerName, phalanxIndex: number): PeakResult {
        const buffers = this.fingerBuffers.get(finger);

        if (!buffers || !buffers.phalanxBuffers[phalanxIndex]) {
            return { hasPeak: false, peakValueDist: 0, peakValueSpeed: 0 };
        }

        const phalanxBuffer = buffers.phalanxBuffers[phalanxIndex];
        const midIndex = Math.floor(this.bufferSize / 2);

        // Distance speed pattern: low -> peak -> low
        const distanceSStart = phalanxBuffer.distanceSpeed[0];
        const distanceSPeak = phalanxBuffer.distanceSpeed[midIndex];
        const distanceSEnd = phalanxBuffer.distanceSpeed[this.bufferSize - 1];

        const maxSpeedIndex = this.findMaximumInBufferReturnIndex(phalanxBuffer.distanceSpeed);
        const maxSpeed = phalanxBuffer.distanceSpeed[maxSpeedIndex];
        const distanceAtMaxSpeed = phalanxBuffer.distance[maxSpeedIndex];

        // Speed pattern condition: low -> peak -> low
        const distanceCondition =
            distanceSStart !== undefined && distanceSPeak !== undefined && distanceSEnd !== undefined &&
            distanceSStart < 0.1 &&
            distanceSPeak > 0.6 &&
            distanceSEnd < 0.1;


        return {
            hasPeak: distanceCondition,
            peakValueDist: typeof distanceAtMaxSpeed === 'number' ? (distanceAtMaxSpeed) : 0,
            peakValueSpeed: typeof maxSpeed === 'number' ? maxSpeed : 0
        };


    }

    /**
     * Manage peak sequence and detect maximum peak across all fingers
     */
    private deductePeakInFrame(): void {
        // STRATEGY: "Maximum Intent" - Prioritize the finger that moved the MOST (highest speed)
        // A tap implies intentional movement, the finger with max speed is the intended target
        
        let maxFinger: FingerName | null = null;
        let maxPhalanxIndex: number = -1;
        let minDistValue: number = 100;
        let maxSpeedValue: number = 0; // Track the MAXIMUM speed to find most intentional movement

        // STRATEGY: "Adaptive Global Competition" - Each phalanx with finger/phalanx-specific weights
        // Accounts for physiological differences: pinky/ring are slower, tips need high speed
        
        let bestFinger: FingerName | null = null;
        let bestPhalanxIndex: number = -1;
        let bestScore: number = 0;
        let bestDistance: number = 100;
        let bestSpeed: number = 0;

        // Adaptive weights based on finger difficulty and phalanx sensitivity
        const getFingerSpeedMultiplier = (finger: FingerName): number => {
            switch(finger) {
                case 'index':  return 1.0;   // Easy to move fast
                case 'middle': return 1.0;   // Easy to move fast  
                case 'ring':   return 1.3;   // Harder to move fast -> boost score
                case 'pinky':  return 1.5;   // Hardest to move fast -> bigger boost
                default: return 1.0;
            }
        };

        const getFingerGlobalMultiplier = (finger: FingerName): number => {
            // Global score boost for harder-to-move fingers 
            switch(finger) {
                case 'index':  return 1.0;   // No boost needed
                case 'middle': return 1.0;   // No boost needed  
                case 'ring':   return 1.4;   // Global boost to compete with index/middle proximity
                case 'pinky':  return 1.6;   // Bigger global boost for hardest finger
                default: return 1.0;
            }
        };

        const getPhalanxWeights = (phalanxIdx: number): {speedWeight: number, distanceWeight: number, minSpeed: number} => {
            switch(phalanxIdx) {
                case 0: // Base - less speed sensitive = accepts lower speeds + bonus to compensate
                    return { speedWeight: 1.3, distanceWeight: 2.5, minSpeed: 0.4 };
                case 1: // Middle - balanced sensitivity
                    return { speedWeight: 1.0, distanceWeight: 2.0, minSpeed: 0.5 };
                case 2: // Tip - VERY speed sensitive = demands high speed, no bonus needed
                    return { speedWeight: 0.8, distanceWeight: 1.5, minSpeed: 0.8 };
                default:
                    return { speedWeight: 1.0, distanceWeight: 2.0, minSpeed: 0.5 };
            }
        };

        this.fingers.forEach(finger => {
            const peakState = this.fingerPeakStates.get(finger);
            if (!peakState) return;

            const fingerSpeedMultiplier = getFingerSpeedMultiplier(finger);
            const fingerGlobalMultiplier = getFingerGlobalMultiplier(finger);

            // Evaluate each phalanx individually with adaptive weights
            for (let phalanxIdx = 0; phalanxIdx < 3; phalanxIdx++) {
                const hasPeak = peakState.isPeak[phalanxIdx];
                const speed = peakState.peakValuesSpeed[phalanxIdx];
                const distance = peakState.peakValuesDist[phalanxIdx];

                const weights = getPhalanxWeights(phalanxIdx);

                // Apply adaptive thresholds and scoring
                if (hasPeak && speed > weights.minSpeed && distance < 0.12) {
                    // Calculate adaptive score with GLOBAL finger boost
                    const adaptiveSpeedScore = weights.speedWeight * speed * fingerSpeedMultiplier;
                    const distanceScore = distance > 0 ? weights.distanceWeight * (1/distance) : 0;
                    const baseScore = adaptiveSpeedScore + distanceScore;
                    const totalScore = baseScore * fingerGlobalMultiplier; // GLOBAL BOOST HERE

                    // Track the best candidate globally
                    if (totalScore > bestScore) {
                        bestScore = totalScore;
                        bestFinger = finger;
                        bestPhalanxIndex = phalanxIdx;
                        bestDistance = distance;
                        bestSpeed = speed;
                    }
                }
            }
        });

        // Update global variables for compatibility
        maxFinger = bestFinger;
        maxPhalanxIndex = bestPhalanxIndex;
        minDistValue = bestDistance;
        maxSpeedValue = bestSpeed;

        // Debug: Show detailed scores of ALL candidates when a tap is detected
        const hasAnyCandidate = maxFinger !== null;
        if (hasAnyCandidate) {
            console.log(`[TapAllDetection] 🏆 DETAILED CANDIDATE SCORES:`);
            
            // Collect and sort all candidates by score
            const allCandidates: Array<{
                finger: FingerName;
                phalanx: number;
                speed: number;
                distance: number;
                speedScore: number;
                distScore: number;
                totalScore: number;
                isWinner: boolean;
                qualified: string;
            }> = [];

            this.fingers.forEach(finger => {
                const peakState = this.fingerPeakStates.get(finger);
                if (!peakState) return;

                const fingerSpeedMultiplier = getFingerSpeedMultiplier(finger);
                const fingerGlobalMultiplier = getFingerGlobalMultiplier(finger);

                for (let phalanxIdx = 0; phalanxIdx < 3; phalanxIdx++) {
                    const hasPeak = peakState.isPeak[phalanxIdx];
                    const speed = peakState.peakValuesSpeed[phalanxIdx];
                    const distance = peakState.peakValuesDist[phalanxIdx];
                    const weights = getPhalanxWeights(phalanxIdx);

                    if (hasPeak && speed > 0.3 && distance < 0.15) { // Broader criteria for debug display
                        const speedScore = weights.speedWeight * speed * fingerSpeedMultiplier;
                        const distScore = distance > 0 ? weights.distanceWeight * (1/distance) : 0;
                        const baseScore = speedScore + distScore;
                        const totalScore = baseScore * fingerGlobalMultiplier; // Apply global boost
                        
                        const qualified = (speed > weights.minSpeed && distance < 0.12) ? '✅' : 
                                        (speed <= weights.minSpeed) ? '❌speed' : '❌dist';

                        allCandidates.push({
                            finger,
                            phalanx: phalanxIdx,
                            speed,
                            distance,
                            speedScore,
                            distScore,
                            totalScore,
                            isWinner: finger === maxFinger && phalanxIdx === maxPhalanxIndex,
                            qualified
                        });
                    }
                }
            });

            // Sort by total score (highest first)
            allCandidates.sort((a, b) => b.totalScore - a.totalScore);

            // Display all candidates with detailed breakdown
            allCandidates.forEach(candidate => {
                const winner = candidate.isWinner ? '🏆 WINNER' : '';
                const globalBoost = getFingerGlobalMultiplier(candidate.finger);
                const boostInfo = globalBoost > 1.0 ? ` (×${globalBoost})` : '';
                console.log(`    ${candidate.finger}[${candidate.phalanx}]: ` +
                          `speed=${candidate.speed.toFixed(3)} dist=${candidate.distance.toFixed(3)} | ` +
                          `sScore=${candidate.speedScore.toFixed(2)} dScore=${candidate.distScore.toFixed(2)} | ` +
                          `TOTAL=${candidate.totalScore.toFixed(2)}${boostInfo} ${candidate.qualified} ${winner}`);
            });
        }

        // Apply final distance threshold: only emit if the closest finger is actually close enough
        if (maxFinger && maxPhalanxIndex !== -1 && minDistValue < 0.08) {
            // CRITICAL: Check cooldown right before emission to prevent multiple events
            if (this.isInCooldown || Date.now() - this.lastPeakDetectedTime < this.cooldownPeriod) {
                return; // Skip this emission due to cooldown
            }
            
            // Set cooldown immediately to prevent multiple emissions
            this.isInCooldown = true;
            this.lastPeakDetectedTime = Date.now();
            
            console.log(`[TapAllDetection] ✅ VALID TAP: ${maxFinger}[${maxPhalanxIndex}] distance=${minDistValue.toFixed(3)} speed=${maxSpeedValue.toFixed(3)}`);
            this.emitTapEvent(maxFinger, maxPhalanxIndex, Date.now(), minDistValue || 0);
            
            // Reset cooldown after delay
            setTimeout(() => {
                this.isInCooldown = false;
            }, this.cooldownPeriod);
        } else if (maxFinger && minDistValue >= 0.08) {
            console.log(`[TapAllDetection] ❌ Peak detected on ${maxFinger} but too far (${minDistValue.toFixed(3)}) to be considered a touch`);
        }

    }



    /**
     * Emit tap event for the finger with maximum peak
     */
    private emitTapEvent(finger: FingerName, phalanxIndex: number, timestamp: number, maxDistValue: number): void {
        const event: Event = {
            type: 'max_finger_peak_detected',
            timestamp: timestamp,
            data: {
                finger: finger,
                phalanx: phalanxIndex,
                peak: this.fingerPeakStates.get(finger)
            },
        };
        this.eventBus.emit(event);
        console.log(`[TapBaseDetection] Tap detected on ${finger} finger at phalanx ${phalanxIndex} with peak distance value: ${maxDistValue}`);
    }

    private findMaximumInBufferReturnIndex(buffer: number[]): number {
        return buffer.indexOf(Math.max(...buffer));
    }

    private deductWinningPhalanx(finger: FingerName, distB: number, distM: number, distT: number, isPeakArray: boolean[]) {
        // When a peak in considered on the finger, we need to deduce which phalanx is the winning one.
        // Only consider phalanges that actually have peaks
        
        const candidates = [];
        if (isPeakArray[0]) candidates.push({ index: 0, distance: distB }); // Base
        if (isPeakArray[1]) candidates.push({ index: 1, distance: distM }); // Middle
        if (isPeakArray[2]) candidates.push({ index: 2, distance: distT }); // Tip
        
        // Return the phalanx with the smallest distance among those with peaks
        if (candidates.length > 0) {
            const winner = candidates.reduce((min, current) => 
                current.distance < min.distance ? current : min
            );
            return winner.index;
        }
        
        // Fallback: return the phalanx with smallest distance overall
        if (distT <= distM && distT <= distB) {
            return 2; // Tip
        } else if (distB <= distM && distB <= distT) {
            return 0; // Base
        } else {
            return 1; // Middle
        }
    }


}




