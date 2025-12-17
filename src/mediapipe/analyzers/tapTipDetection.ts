import { BaseAnalyzer } from './BaseAnalyzer';
import type { FeatureStore } from '../../stores/FeatureStore';
import { eventBus, eventHistory } from '../../stores/eventBusStore';
import type { Feature, Event, HandSide } from '../types';

/**
 * Analyzer for detecting tap gestures using thumb-to-index distance speed.
 * Looks for a peak in a 500ms window: low at start, peak in middle, low at end.
 * Emits an event on EventBus when a tap is detected.
 */
export class TapTipDetection extends BaseAnalyzer {
    readonly name = 'TapTipDetection';
    private lastEmitTimestamp: number = 0;
    private bufferDistanceSpeed: number[] = [];
    private bufferAngularSpeed: number[] = [];
    private bufferSize: number = 7; // Corresponds to 500ms if analyze is called every 50ms

    constructor(featureStore: FeatureStore) {
        super(featureStore, eventBus, eventHistory);
        this.enable();

        // init Buffer with 10 zeros

        this.bufferDistanceSpeed = Array(this.bufferSize).fill(0);
        this.bufferAngularSpeed = Array(this.bufferSize).fill(0);

    }



    analyze() {
        // Simple debug: émet un événement à chaque appel
       
        const now = Date.now();
        this.lastEmitTimestamp = now;
        const valueDistanceSpeed = this.featureStore.getFeature('thumb_to_index_distance_speed')?.value;
        if (valueDistanceSpeed !== undefined) {
            this.updateBufferDistance(valueDistanceSpeed);

        }

        const valueAngularSpeed = this.featureStore.getFeature('index_angular_velocity')?.value;
        if (valueAngularSpeed !== undefined) {
            this.updateBufferAngular(valueAngularSpeed);
        }

        //this.printBufferAngular();

        // Check for tap pattern in buffer
        const midIndex1 = Math.floor(this.bufferDistanceSpeed.length / 2);
        const midValue1 = this.bufferDistanceSpeed[midIndex1];
        const startValue1 = this.bufferDistanceSpeed[0];
        const endValue1 = this.bufferDistanceSpeed[this.bufferDistanceSpeed.length - 1];

        const midValue2 = this.bufferAngularSpeed[midIndex1]; // Middle index is the same
        const startValue2 = this.bufferAngularSpeed[0];
        const endValue2 = this.bufferAngularSpeed[this.bufferAngularSpeed.length - 1];

        // Simple tap detection logic
        if (
            startValue1 < 0.3 && // Low at start
            midValue1 > 1.0 && // Peak in the middle
            endValue1 < 0.3 &&// Low at end

            Math.abs(startValue2) < 2.0 && // Peak in the middle
            midValue2 < -10  && // Low at start
            Math.abs(endValue2) < 2.0 // Low at end

        ) {
            this.emitTapEvent(now);
        }


    }

    private emitTapEvent(timestamp: number) {
        const event: Event = {
            type: 'tap_tip_detected',
            timestamp: timestamp,
            data: { value: 0.5 },
        };
        this.eventBus.emit(event);
    }

    private updateBufferDistance(value: number) {
        // Shift buffer and add new value
        this.bufferDistanceSpeed.shift();
        this.bufferDistanceSpeed.push(value);
    }

    private updateBufferAngular(value: number) {
        // Shift buffer and add new value
        this.bufferAngularSpeed.shift();
        this.bufferAngularSpeed.push(value);
    }

    printBufferAngular() {
        //print buffer in console.log with 2 decimal places
        const formattedBuffer = this.bufferAngularSpeed.map(v => v.toFixed(2));
        console.log('Angular Speed Buffer:', formattedBuffer.join(', '));
    }
}
