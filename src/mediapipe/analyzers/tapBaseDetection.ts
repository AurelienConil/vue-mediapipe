import { BaseAnalyzer } from './BaseAnalyzer';
import type { useFeatureStore } from '../../stores/FeatureStore';
import { eventBus, eventHistory } from '../../stores/eventBusStore';
import type { Event } from '../types';

type FeatureStore = ReturnType<typeof useFeatureStore>;

type FingerName = 'index' | 'middle' | 'ring' | 'pinky';

interface FingerBuffers {
    distanceSpeed: number[];
    angularSpeed: number[];
}

/**
 * Analyzer for detecting tap gestures using thumb-to-finger distance speed.
 * Looks for a peak in a 500ms window: low at start, peak in middle, low at end.
 * Supports detection for index, middle, ring, and pinky fingers.
 * Emits an event on EventBus when a tap is detected with finger identification.
 */
export class TapBaseDetection extends BaseAnalyzer {
    readonly name = 'TapBaseDetection';
    private bufferSize: number = 10; // Corresponds to 500ms if analyze is called every 50ms
    private fingers: FingerName[] = ['index', 'middle', 'ring', 'pinky'];
    private fingerBuffers: Map<FingerName, FingerBuffers> = new Map();
    private lastFingerTapTimestamps: Map<FingerName, number> = new Map();
    private cooldownPeriod: number = 250; // 7 frames * 50ms = 350ms cooldown
    private fingerPeakStates: Map<FingerName, boolean> = new Map(); // Track peak state for each finger
    private fingerPeaksHistory: Map<FingerName, number[]> = new Map(); // Store individual peaks for each finger during sequence
    private isInPeakSequence: boolean = false; // Track if we're currently in a peak sequence

    constructor(featureStore: FeatureStore) {
        super(featureStore, eventBus, eventHistory);
        this.enable();
        this.initializeBuffers();
        this.initializeTapTimestamps();
        this.initializePeakStates();
        this.initializePeakHistory();
    }



    /**
     * Initialize buffers for all fingers with zeros
     */
    private initializeBuffers(): void {
        this.fingers.forEach(finger => {
            this.fingerBuffers.set(finger, {
                distanceSpeed: Array(this.bufferSize).fill(0),
                angularSpeed: Array(this.bufferSize).fill(0)
            });
        });
    }

    /**
     * Initialize tap timestamps for all fingers
     */
    private initializeTapTimestamps(): void {
        this.fingers.forEach(finger => {
            this.lastFingerTapTimestamps.set(finger, 0);
        });
    }

    /**
     * Initialize peak states for all fingers
     */
    private initializePeakStates(): void {
        this.fingers.forEach(finger => {
            this.fingerPeakStates.set(finger, false);
        });
    }

    /**
     * Initialize peak history for all fingers
     */
    private initializePeakHistory(): void {
        this.fingers.forEach(finger => {
            this.fingerPeaksHistory.set(finger, []);
        });
    }

    analyze() {
        const now = Date.now();

        // Reset peak states for this frame
        this.fingerPeakStates.forEach((_, finger) => {
            this.fingerPeakStates.set(finger, false);
        });

        // Update buffers and check for peaks for all fingers
        const fingerPeakValues: Map<FingerName, number> = new Map();
        this.fingers.forEach(finger => {
            this.updateFingerBuffers(finger);
            const peakResult = this.detectTapPattern(finger);
            this.fingerPeakStates.set(finger, peakResult.hasPeak);
            if (peakResult.hasPeak) {
                fingerPeakValues.set(finger, peakResult.peakValue);
            }
        });

        // Manage peak sequence and detect maximum
        this.managePeakSequence(fingerPeakValues, now);
    }


    /**
     * Update buffers for a specific finger with new sensor data
     */
    private updateFingerBuffers(finger: FingerName): void {
        const distanceSFeatureName = `thumb_to_${finger}B_distspeed`;
        const distanceSpeed = this.featureStore.getFeature(distanceSFeatureName)?.value;

        const buffers = this.fingerBuffers.get(finger);
        if (!buffers) return;

        if (distanceSpeed !== undefined) {
            if (typeof distanceSpeed === 'number') {
                this.updateBuffer(buffers.distanceSpeed, distanceSpeed);
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
    private detectTapPattern(finger: FingerName): { hasPeak: boolean; peakValue: number } {
        const buffers = this.fingerBuffers.get(finger);
        if (!buffers) return { hasPeak: false, peakValue: 0 };

        const midIndex = Math.floor(this.bufferSize / 2);

        // Distance speed pattern: low -> peak -> low
        const distanceSStart = buffers.distanceSpeed[0];
        const distanceSPeak = buffers.distanceSpeed[midIndex];
        const distanceSEnd = buffers.distanceSpeed[this.bufferSize - 1];

        // Speed of the distance
        const distanceCondition =
            distanceSStart !== undefined && distanceSPeak !== undefined && distanceSEnd !== undefined &&
            distanceSStart < 0.1 &&
            distanceSPeak > 0.4 &&
            distanceSEnd < 0.1;

        const curvatureFeature = this.featureStore.getFeature(`${finger}_curvature_value`);
        const curvatureValue = curvatureFeature?.value;
        const curvatureCondition = typeof curvatureValue === 'number' && curvatureValue < 0.5;

        const finalPeakCondition = distanceCondition && curvatureCondition;

        const distancePureFeature = this.featureStore.getFeature(`thumb_to_${finger}B_dist`)?.value;
        const distancePureValue = typeof distancePureFeature === 'number' ? (1.0 - distancePureFeature) : undefined;



        // Debug pour l'index seulement
        if (finger === 'middle' && finalPeakCondition) {
            console.log("Speed peak =", distanceSPeak.toFixed(3));
            console.log("Distance pure =", distancePureFeature?.toFixed(3));

        }

        return {
            hasPeak: finalPeakCondition,
            peakValue: typeof distancePureValue === 'number' ? distancePureValue : 0
        };
    }

    /**
     * Manage peak sequence and detect maximum peak across all fingers
     */
    private managePeakSequence(fingerPeakValues: Map<FingerName, number>, timestamp: number): void {
        // Count how many fingers have peaks this frame
        let numberOfPeaks = 0;
        this.fingerPeakStates.forEach((hasPeak) => {
            if (hasPeak) numberOfPeaks++;
        });

        const hasValidPeaks = numberOfPeaks >= 2;

        if (hasValidPeaks) {
            // We're in peak sequence - record all individual finger peaks
            if (!this.isInPeakSequence) {
                console.log(`Starting peak sequence with ${numberOfPeaks} fingers`);
                this.isInPeakSequence = true;
                // Clear previous history when starting new sequence
                this.fingers.forEach(finger => {
                    this.fingerPeaksHistory.set(finger, []);
                });
            }

            // Record peaks for each finger that has one
            this.fingers.forEach(finger => {
                if (this.fingerPeakStates.get(finger)) {
                    const peakValue = fingerPeakValues.get(finger) || 0;
                    const history = this.fingerPeaksHistory.get(finger) || [];
                    history.push(peakValue);
                    this.fingerPeaksHistory.set(finger, history);
                }
            });

        } else {
            // No valid peaks this frame
            if (this.isInPeakSequence) {
                // End of peak sequence - find the maximum peak across all fingers and frames
                this.findAndEmitMaximumPeak(timestamp);
            }
            this.isInPeakSequence = false;
        }
    }

    /**
     * Find maximum peak across all fingers and all frames, then emit event for that finger
     */
    private findAndEmitMaximumPeak(timestamp: number): void {
        let maxPeakValue = 0;
        let maxPeakFinger: FingerName | null = null;
        let totalPeaksRecorded = 0;

        // Find the maximum peak value across all fingers and all their recorded peaks
        this.fingers.forEach(finger => {
            const history = this.fingerPeaksHistory.get(finger) || [];
            totalPeaksRecorded += history.length;

            if (history.length > 0) {
                const fingerMax = Math.max(...history);
                if (fingerMax > maxPeakValue) {
                    maxPeakValue = fingerMax;
                    maxPeakFinger = finger;
                }
                console.log(`${finger}: ${history.length} peaks, max = ${fingerMax.toFixed(3)}`);
            }
        });

        if (maxPeakFinger !== null) {
            console.log(`Peak sequence ended. Maximum peak: ${maxPeakValue.toFixed(3)} from ${maxPeakFinger} finger (${totalPeaksRecorded} total peaks recorded)`);
            this.emitTapEvent(maxPeakFinger, timestamp, maxPeakValue);
        }

        // Reset all histories
        this.fingers.forEach(finger => {
            this.fingerPeaksHistory.set(finger, []);
        });
    }

    /**
     * Emit tap event for the finger with maximum peak
     */
    private emitTapEvent(finger: FingerName, timestamp: number, maxPeakValue: number): void {
        const event: Event = {
            type: 'max_finger_peak_detected',
            timestamp: timestamp,
            data: {
                finger: finger,
                maxPeakValue: maxPeakValue
            },
        };
        this.eventBus.emit(event);
        console.log(`Maximum peak finger tap detected: ${finger} with value ${maxPeakValue.toFixed(3)} at ${timestamp}`);
    }

    /**
 * Debug method to print angular buffer for a specific finger
 */
    printBufferAngular(finger: FingerName): void {
        const buffers = this.fingerBuffers.get(finger);
        if (!buffers) return;

        const formattedBuffer = buffers.angularSpeed.map(v => v.toFixed(2));
        console.log(`${finger} Angular Speed Buffer:`, formattedBuffer.join(', '));
    }

    /**
     * Debug method to print all finger buffers
     */
    printAllBuffers(): void {
        this.fingers.forEach(finger => {
            this.printBufferAngular(finger);
        });
    }
}




