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

    constructor(featureStore: FeatureStore) {
        super(featureStore, eventBus, eventHistory);
        this.enable();

    }



    analyze() {
        // Simple debug: émet un événement à chaque appel
        const now = Date.now();
        this.lastEmitTimestamp = now;

        if (Math.random() < 0.05) {
            this.emitTapEvent(now);
            console.log('TapTipDetection.analyze() called, event emitted at', new Date(now).toISOString());
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
}
