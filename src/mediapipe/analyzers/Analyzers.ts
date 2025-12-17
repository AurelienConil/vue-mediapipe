import { eventBus, eventHistory } from '../../stores/eventBusStore';
import { TapTipDetection } from './tapTipDetection';
import type { FeatureStore } from '../../stores/FeatureStore';

/**
 * Classe centralisant l'instanciation des analyzers.
 * Appeler `init(featureStore)` une fois que le FeatureStore est prêt.
 */
export class Analyzers {
    private analyzers: any[] = [];
    private eventBus = eventBus;
    private eventHistory = eventHistory;

    constructor() { }

    /**
     * Initialise tous les analyzers avec le FeatureStore fourni.
     */
    init(featureStore: FeatureStore) {
        // Instancie ici tous les analyzers
        console.log('Initializing Analyzers...');
        this.analyzers.push(new TapTipDetection(featureStore, this.eventBus, this.eventHistory));
        // ...ajoute d'autres analyzers ici si besoin
    }

    getEventBus() {
        return this.eventBus;
    }

    getEventHistory() {
        return this.eventHistory;
    }

    getAnalyzers() {
        return this.analyzers;
    }
}
