import { BaseAnalyzer } from './BaseAnalyzer';
import type { FeatureStore } from '../../stores/FeatureStore';
import type { EventBus } from '../core/EventBus';
import type { EventHistory } from '../core/EventHistory';
import type { Feature, Event, HandSide } from '../types';

/**
 * Analyzer for detecting tap gestures using thumb-to-index distance speed.
 * Looks for a peak in a 500ms window: low at start, peak in middle, low at end.
 * Emits an event on EventBus when a tap is detected.
 */
export class TapTipDetection extends BaseAnalyzer {
    readonly name = 'TapTipDetection';
    private windowMs = 500;
    private buffer: Feature[] = [];
    private lastEmitTimestamp: number = 0;

    constructor(featureStore: FeatureStore, eventBus: EventBus, eventHistory: EventHistory) {
        super(featureStore, eventBus, eventHistory);
        this.featureStore.subscribe('thumb_to_index_distance_speed', this.onFeature.bind(this));
        // change to debug basic console.log callback

    }

    private onFeature(feature: Feature) {
        this.buffer.push(feature);
        // Remove old features outside the window
        const minTimestamp = feature.timestamp - this.windowMs;
        this.buffer = this.buffer.filter(f => f.timestamp >= minTimestamp);
        this.analyze();
    }

    analyze() {
        if (this.buffer.length < 3) return;
        // Simple state machine: low-high-low pattern
        //console.log('Analyzing tap tip detection with buffer:', this.buffer);
        const values = this.buffer.map(f => f.value as number);
        const timestamps = this.buffer.map(f => f.timestamp);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const maxIdx = values.indexOf(max);
        // Check for low-high-low: min at start, max in middle, min at end
        if (
            maxIdx > 0 && maxIdx < values.length - 1 &&
            values[0] < max * 0.5 &&
            values[values.length - 1] < max * 0.5 &&
            max > 0.1 && // threshold for a real peak
            (timestamps[timestamps.length - 1] - timestamps[0]) <= this.windowMs
        ) {
            // Debounce: avoid multiple emits for same tap
            if (timestamps[timestamps.length - 1] - this.lastEmitTimestamp > this.windowMs) {
                this.emitTapEvent(this.buffer[maxIdx]);
                this.lastEmitTimestamp = timestamps[timestamps.length - 1];
            }
        }
    }

    private emitTapEvent(feature: Feature) {
        const event: Event = {
            type: 'tap_tip_detected',
            data: {
                value: feature.value,
                hand: feature.hand,
                timestamp: feature.timestamp
            },
            timestamp: feature.timestamp,
            hand: feature.hand as HandSide
        };
        this.eventBus.emit(event);
    }
}
