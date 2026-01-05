import type { useFeatureStore } from '../../stores/FeatureStore';
type FeatureStore = ReturnType<typeof useFeatureStore>;
import type { EventBus } from '../core/EventBus';
import type { EventHistory } from '../core/EventHistory';

export abstract class BaseAnalyzer {
    protected enabled = true;
    protected featureStore: FeatureStore;
    protected eventBus: EventBus;
    protected eventHistory: EventHistory;

    constructor(featureStore: FeatureStore, eventBus: EventBus, eventHistory: EventHistory) {
        this.featureStore = featureStore;
        this.eventBus = eventBus;
        this.eventHistory = eventHistory;
    }

    abstract readonly name: string;

    abstract analyze(): void;

    enable(): void {
        this.enabled = true;
    }

    disable(): void {
        this.enabled = false;
    }

    isEnabled(): boolean {
        return this.enabled;
    }
}