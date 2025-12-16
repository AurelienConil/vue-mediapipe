import type { Feature } from '../mediapipe/types';

export class FeatureStore {
    private features = new Map<string, Feature>();
    private history = new Map<string, Feature[]>();
    private maxHistorySize = 100;
    private subscribers = new Map<string, ((feature: Feature) => void)[]>();

    setFeature(feature: Feature): void {
        const key = this.getFeatureKey(feature);

        // Store current value
        this.features.set(key, feature);

        // Store in history
        if (!this.history.has(key)) {
            this.history.set(key, []);
        }

        const featureHistory = this.history.get(key)!;
        featureHistory.push({ ...feature }); // Clone pour éviter les mutations

        // Limit history size
        if (featureHistory.length > this.maxHistorySize) {
            featureHistory.shift();
        }

        // Notify subscribers
        this.notifySubscribers(key, feature);
    }

    getFeature(name: string, hand?: 'Left' | 'Right'): Feature | null {
        const key = hand ? `${name}_${hand}` : name;
        return this.features.get(key) || null;
    }

    getFeatureHistory(name: string, hand?: 'Left' | 'Right', count?: number): Feature[] {
        const key = hand ? `${name}_${hand}` : name;
        const history = this.history.get(key) || [];
        return count ? history.slice(-count) : [...history]; // Clone pour éviter les mutations
    }

    getAllFeatures(): Map<string, Feature> {
        return new Map(this.features); // Clone pour éviter les mutations
    }

    getFeaturesByType(type: 'string' | 'bool' | 'number'): Map<string, Feature> {
        const result = new Map<string, Feature>();
        for (const [key, feature] of this.features) {
            if (feature.type === type) {
                result.set(key, feature);
            }
        }
        return result;
    }

    getFeaturesByParent(parent: string): Map<string, Feature> {
        const result = new Map<string, Feature>();
        for (const [key, feature] of this.features) {
            if (feature.parents === parent) {
                result.set(key, feature);
            }
        }
        return result;
    }

    getFeaturesByHand(hand: 'Left' | 'Right'): Map<string, Feature> {
        const result = new Map<string, Feature>();
        for (const [key, feature] of this.features) {
            if (feature.hand === hand) {
                result.set(key, feature);
            }
        }
        return result;
    }

    getGraphableFeatures(): Map<string, Feature> {
        const result = new Map<string, Feature>();
        for (const [key, feature] of this.features) {
            if (feature.display === 'Graph') {
                result.set(key, feature);
            }
        }
        return result;
    }

    subscribe(featureName: string, callback: (feature: Feature) => void, hand?: 'Left' | 'Right'): void {
        const key = hand ? `${featureName}_${hand}` : featureName;
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }
        this.subscribers.get(key)!.push(callback);
    }

    unsubscribe(featureName: string, callback: (feature: Feature) => void, hand?: 'Left' | 'Right'): void {
        const key = hand ? `${featureName}_${hand}` : featureName;
        const callbacks = this.subscribers.get(key) || [];
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    clear(): void {
        this.features.clear();
        this.history.clear();
    }

    getStats(): { totalFeatures: number; totalHistoryEntries: number } {
        let totalHistoryEntries = 0;
        for (const history of this.history.values()) {
            totalHistoryEntries += history.length;
        }
        return {
            totalFeatures: this.features.size,
            totalHistoryEntries
        };
    }

    private getFeatureKey(feature: Feature): string {
        return feature.hand ? `${feature.name}_${feature.hand}` : feature.name;
    }

    private notifySubscribers(key: string, feature: Feature): void {
        const callbacks = this.subscribers.get(key) || [];
        callbacks.forEach(callback => {
            try {
                callback(feature);
            } catch (error) {
                console.warn('Error in FeatureStore subscriber callback:', error);
            }
        });
    }
}