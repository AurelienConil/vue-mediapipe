import type { MediaPipeFrame, Feature } from '../types';

export abstract class BaseFeatureExtractor {
    protected enabled = true;

    abstract readonly name: string;

    abstract extract(frame: MediaPipeFrame): Feature[];

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