import { defineStore } from 'pinia';
import { reactive } from 'vue';
import type { Feature } from '../mediapipe/types';

export const useFeatureStore = defineStore('feature', () => {
    // State
    const features = reactive(new Map<string, Feature>());
    const history = reactive(new Map<string, Feature[]>());
    const maxHistorySize = 100;
    const subscribers = reactive(new Map<string, ((feature: Feature) => void)[]>());

    // Actions
    function setFeature(feature: Feature): void {
        const key = feature.name;
        features.set(key, feature);

        // Store in history
        if (!history.has(key)) {
            history.set(key, []);
        }
        const featureHistory = history.get(key)!;
        featureHistory.push({ ...feature });
        if (featureHistory.length > maxHistorySize) {
            featureHistory.shift();
        }

        // Notify subscribers
        notifySubscribers(key, feature);
    }

    function getFeature(name: string): Feature | null {
        return features.get(name) || null;
    }

    function getFeatureHistory(name: string, count?: number): Feature[] {
        const h = history.get(name) || [];
        return count ? h.slice(-count) : [...h];
    }

    function getAllFeatures(): Map<string, Feature> {
        return new Map(features);
    }

    function getFeaturesByType(type: 'string' | 'bool' | 'number'): Map<string, Feature> {
        const result = new Map<string, Feature>();
        for (const [key, feature] of features) {
            if (feature.type === type) {
                result.set(key, feature);
            }
        }
        return result;
    }

    function getFeaturesByParent(parent: string): Map<string, Feature> {
        const result = new Map<string, Feature>();
        for (const [key, feature] of features) {
            if (feature.parents === parent) {
                result.set(key, feature);
            }
        }
        return result;
    }

    function getFeaturesByHand(hand: 'Left' | 'Right'): Map<string, Feature> {
        const result = new Map<string, Feature>();
        for (const [key, feature] of features) {
            if (feature.hand === hand) {
                result.set(key, feature);
            }
        }
        return result;
    }

    function getGraphableFeatures(): Map<string, Feature> {
        const result = new Map<string, Feature>();
        for (const [key, feature] of features) {
            if (feature.display === 'Graph') {
                result.set(key, feature);
            }
        }
        return result;
    }

    function subscribe(featureName: string, callback: (feature: Feature) => void): void {
        if (!subscribers.has(featureName)) {
            console.log('Creating new subscriber list for feature:', featureName);
            subscribers.set(featureName, []);
        }
        subscribers.get(featureName)!.push(callback);
    }

    function unsubscribe(featureName: string, callback: (feature: Feature) => void): void {
        const callbacks = subscribers.get(featureName) || [];
        const index = callbacks.indexOf(callback);
        if (index > -1) {
            callbacks.splice(index, 1);
        }
    }

    function clear(): void {
        features.clear();
        history.clear();
    }

    function getStats(): { totalFeatures: number; totalHistoryEntries: number } {
        let totalHistoryEntries = 0;
        for (const h of history.values()) {
            totalHistoryEntries += h.length;
        }
        return {
            totalFeatures: features.size,
            totalHistoryEntries
        };
    }

    function notifySubscribers(key: string, feature: Feature): void {
        const callbacks = subscribers.get(key) || [];
        callbacks.forEach(callback => {
            try {
                callback(feature);
            } catch (error) {
                console.warn('Error in FeatureStore subscriber callback:', error);
            }
        });
    }

    return {
        features,
        setFeature,
        getFeature,
        getFeatureHistory,
        getAllFeatures,
        getFeaturesByType,
        getFeaturesByParent,
        getFeaturesByHand,
        getGraphableFeatures,
        subscribe,
        unsubscribe,
        clear,
        getStats
    };
});