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
    private cooldownPeriod: number = 250; // 7 frames * 50ms = 350ms cooldown
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

        // Speed of the distance
        const distanceCondition =
            distanceSStart !== undefined && distanceSPeak !== undefined && distanceSEnd !== undefined &&
            distanceSStart < 0.1 &&
            distanceSPeak > 0.6 &&
            distanceSEnd < 0.1;

        const maxSpeedIndex = this.findMaximumInBufferReturnIndex(phalanxBuffer.distanceSpeed);
        const maxSpeed = phalanxBuffer.distanceSpeed[maxSpeedIndex];
        const distanceAtMaxSpeed = phalanxBuffer.distance[maxSpeedIndex];


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
        // Count how many fingers have peaks this frame
        if (Date.now() - this.lastPeakDetectedTime < this.cooldownPeriod) {
            return; // Still in cooldown period
        }

        //First, analyze for each finger, and each phalanx who has peak, which is the smalled distance value.
        // Return the finger and the phalanx index

        let maxFinger: FingerName | null = null;
        let maxPhalanxIndex: number = -1;
        let minDistValue: number = 100; // Be careful, the maxPeak is the smalled distance value.

        this.fingers.forEach(finger => {
            const peakState = this.fingerPeakStates.get(finger);
            if (!peakState) return;

            const peakNumberSingleFinger = peakState.isPeak.filter(v => v).length;
            if (peakNumberSingleFinger > 1) {
                // considering there is a peak.
                const distB = peakState.peakValuesDist[0] || 100;
                const distM = peakState.peakValuesDist[1] || 100;
                const distT = peakState.peakValuesDist[2] || 100;

                const winningPhalanx = this.deductWinningPhalanx(finger, distB, distM, distT);
                const winningDistValue = peakState.peakValuesDist[winningPhalanx];

                if (winningDistValue && winningDistValue < minDistValue) {
                    minDistValue = winningDistValue;
                    maxFinger = finger;
                    maxPhalanxIndex = winningPhalanx;
                }


            }

        });



        if (maxFinger && maxPhalanxIndex !== -1) {
            this.emitTapEvent(maxFinger, maxPhalanxIndex, Date.now(), minDistValue || 0);

            this.lastPeakDetectedTime = Date.now();
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

    private deductWinningPhalanx(finger: FingerName, distB: number, distM: number, distT: number) {
        // When a peak in considered on the finger, we need to deduce which phalanx is the winning one.

        if (distT <= distM && distM <= distB) {
            return 2; // Tip
        } else if (distB <= distM && distM <= distT) {
            return 0; // Middle
        } else {
            return 1; // Base
        }


    }


}




