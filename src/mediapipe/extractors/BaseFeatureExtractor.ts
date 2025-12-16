import type { MediaPipeFrame, Feature } from '../types';
import type { FeatureStore } from '../../stores/FeatureStore';

export abstract class BaseFeatureExtractor {
    protected enabled = true;

    abstract readonly name: string;

    abstract extract(frame: MediaPipeFrame, featureStore: FeatureStore): Feature[];

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