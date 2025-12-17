import { BaseAnalyzer } from './BaseAnalyzer';
import type { FeatureStore } from '../../stores/FeatureStore';
import { eventBus, eventHistory } from '../../stores/eventBusStore';
import type { Feature, Event, HandSide } from '../types';

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
export class TapTipDetection extends BaseAnalyzer {
    readonly name = 'TapTipDetection';
    private lastEmitTimestamp: number = 0;
    private bufferSize: number = 7; // Corresponds to 500ms if analyze is called every 50ms
    private fingers: FingerName[] = ['index', 'middle', 'ring', 'pinky'];
    private fingerBuffers: Map<FingerName, FingerBuffers> = new Map();
    private lastFingerTapTimestamps: Map<FingerName, number> = new Map();
    private cooldownPeriod: number = 250; // 7 frames * 50ms = 350ms cooldown

    constructor(featureStore: FeatureStore) {
        super(featureStore, eventBus, eventHistory);
        this.enable();
        this.initializeBuffers();
        this.initializeTapTimestamps();
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

    analyze() {
        const now = Date.now();
        this.lastEmitTimestamp = now;

        // Update buffers for all fingers
        this.fingers.forEach(finger => {
            this.updateFingerBuffers(finger);
        });

        // Find the finger closest to thumb first
        const closestFinger = this.findClosestFingerToThumb();

        // Check if enough time has passed since last tap for this finger (double tap prevention)
        if (closestFinger && this.isFingerReadyForTap(closestFinger, now)) {
            // Only check tap pattern for the closest finger if it's ready
            if (this.detectTapPattern(closestFinger)) {
                this.emitTapEvent(closestFinger, now);
                // Update the last tap timestamp for this finger
                this.lastFingerTapTimestamps.set(closestFinger, now);
            }
        }
    }

    /**
     * Check if enough time has passed since last tap for the given finger
     */
    private isFingerReadyForTap(finger: FingerName, currentTime: number): boolean {
        const lastTapTime = this.lastFingerTapTimestamps.get(finger) || 0;
        const timeSinceLastTap = currentTime - lastTapTime;
        return timeSinceLastTap >= this.cooldownPeriod;
    }

    /**
     * Find which finger is currently closest to the thumb
     */
    private findClosestFingerToThumb(): FingerName | null {
        let closestFinger: FingerName | null = null;
        let minDistance = Number.MAX_VALUE;

        this.fingers.forEach(finger => {
            const distanceFeature = this.featureStore.getFeature(`thumb_to_${finger}_distance`);
            const distance = distanceFeature?.value;

            if (distance !== undefined && distance < minDistance) {
                minDistance = distance;
                closestFinger = finger;
            }
        });

        // Always return the closest finger (there's always one)
        return closestFinger;
    }

    /**
     * Update buffers for a specific finger with new sensor data
     */
    private updateFingerBuffers(finger: FingerName): void {
        const distanceFeatureName = `thumb_to_${finger}_distance_speed`;
        const angularFeatureName = `${finger}_angular_velocity`;

        const distanceSpeed = this.featureStore.getFeature(distanceFeatureName)?.value;
        const angularSpeed = this.featureStore.getFeature(angularFeatureName)?.value;

        const buffers = this.fingerBuffers.get(finger);
        if (!buffers) return;

        if (distanceSpeed !== undefined) {
            this.updateBuffer(buffers.distanceSpeed, distanceSpeed);
        }

        if (angularSpeed !== undefined) {
            this.updateBuffer(buffers.angularSpeed, angularSpeed);
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
    private detectTapPattern(finger: FingerName): boolean {
        const buffers = this.fingerBuffers.get(finger);
        if (!buffers) return false;

        const midIndex = Math.floor(this.bufferSize / 2);

        // Distance speed pattern: low -> peak -> low
        const distanceStart = buffers.distanceSpeed[0];
        const distancePeak = buffers.distanceSpeed[midIndex];
        const distanceEnd = buffers.distanceSpeed[this.bufferSize - 1];

        // Angular speed pattern: stable -> dip -> stable
        const angularStart = buffers.angularSpeed[0];
        const angularDip = buffers.angularSpeed[midIndex];
        const angularEnd = buffers.angularSpeed[this.bufferSize - 1];

        // Get current thumb to finger distance for proximity validation
        const thumbToFingerDistanceFeature = this.featureStore.getFeature(`thumb_to_${finger}_distance`);
        const thumbToFingerDistance = thumbToFingerDistanceFeature?.value || 1.0;

        // Speed of the distance
        const distanceCondition =
            distanceStart < 0.3 &&
            distancePeak > 0.5 &&
            distanceEnd < 0.3;
        // Angular speed condition
        const angularCondition =
            Math.abs(angularStart) < 4.0 &&
            angularDip < -6 &&
            Math.abs(angularEnd) < 4.0;

        // Proximity condition: thumb must be very close to finger
        const proximityCondition = thumbToFingerDistance < 0.05;

        //il faut au moins 2 conditions vraies pour valider le tap
        const conditionsMet = [distanceCondition, angularCondition, proximityCondition].filter(Boolean).length >= 3;

        return conditionsMet;
    }

    /**
     * Emit tap event with finger identification
     */
    private emitTapEvent(finger: FingerName, timestamp: number): void {
        const event: Event = {
            type: 'tap_tip_detected',
            timestamp: timestamp,
            data: {
                finger: finger,
            },
        };
        this.eventBus.emit(event);
        console.log(`Tap detected on ${finger} finger at ${timestamp}`);
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
