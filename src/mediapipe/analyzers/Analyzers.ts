import { eventBus, eventHistory } from '../../stores/eventBusStore';
import { TapTipDetection } from './tapTipDetection';
import { TapBaseDetection } from './tapBaseDetection';
import { TapAllDetection } from './tapAllDetection';
import { TapPhalanxDetection } from './tapPhalanxDetection';
import { SwipeDetection } from './swipeDetection';
import type { useFeatureStore } from '../../stores/FeatureStore';

type FeatureStore = ReturnType<typeof useFeatureStore>;

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
        //this.analyzers.push(new TapTipDetection(featureStore));
        //this.analyzers.push(new TapBaseDetection(featureStore));
        
        // Ancien analyzer pour comparaison
        //this.analyzers.push(new TapAllDetection(featureStore));
        
        // Nouveau analyzer avec architecture refactorisée
        this.analyzers.push(new TapPhalanxDetection(featureStore));
        
        // Swipe detection analyzer
        this.analyzers.push(new SwipeDetection(featureStore));
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
