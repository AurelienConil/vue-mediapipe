import type { MediaPipeFrame, HandData } from '../types';
import { FeatureStore } from '../../stores/FeatureStore';
import { useCoreStore } from '../../stores/CoreStore';
import { EventBus } from './EventBus';
import { EventHistory } from './EventHistory';
import type { BaseFeatureExtractor } from '../extractors/BaseFeatureExtractor';
import type { BaseAnalyzer } from '../analyzers/BaseAnalyzer';
import { Preprocessor } from '../preprocessors/BasePreprocessor';

export class MediaPipeProcessor {
    private featureStore = new FeatureStore();
    private eventHistory = new EventHistory();
    private eventBus = new EventBus(this.eventHistory);
    private coreStore = useCoreStore();
    private preprocessor: Preprocessor | null = null;
    private extractors: BaseFeatureExtractor[] = [];
    private analyzers: BaseAnalyzer[] = [];

    setPreprocessor(preprocessor: Preprocessor): void {
        this.preprocessor = preprocessor;
    }

    addExtractor(extractor: BaseFeatureExtractor): void {
        this.extractors.push(extractor);
    }

    addAnalyzer(analyzer: BaseAnalyzer): void {
        this.analyzers.push(analyzer);
    }

    getFeatureStore(): FeatureStore {
        return this.featureStore;
    }

    getEventBus(): EventBus {
        return this.eventBus;
    }

    getEventHistory(): EventHistory {
        return this.eventHistory;
    }

    getCoreStore() {
        return this.coreStore;
    }

    processFrame(results: any): void {
        console.log('🎯 MediaPipeProcessor.processFrame() appelé');

        // 1. Convert MediaPipe results to MediaPipeFrame
        let frame: MediaPipeFrame = this.convertToMediaPipeFrame(results);
        console.log('📊 Frame converti:', frame);

        // 2. Update CoreStore with basic hand detection info
        this.coreStore.updateFrame(frame.hands);

        // 3. Preprocessing (optionnel)
        if (this.preprocessor && this.preprocessor.isEnabled()) {
            console.log(`🔧 Exécution preprocessor: ${this.preprocessor.name}`);
            frame = this.preprocessor.preprocess(frame);
            console.log('🛠️ Frame après preprocessing:', frame);
        } else {
            console.log('⏭️ Aucun preprocessor configuré ou activé');
        }

        // 4. Run extractors (seulement si exactement 1 main détectée)
        if (frame.hands.length === 0) {
            console.log('⚠️ Aucune main détectée - extraction annulée');
        } else if (frame.hands.length > 1) {
            console.log(`⚠️ ${frame.hands.length} mains détectées - extraction annulée (seulement 1 main supportée)`);
        } else {
            console.log(`🔍 Exécution de ${this.extractors.length} extractors (1 main détectée)`);
            this.extractors.forEach(extractor => {
                if (extractor.isEnabled()) {
                    console.log(`⚙️ Exécution extractor: ${extractor.name}`);
                    const features = extractor.extract(frame, this.featureStore);
                    console.log(`✨ Features extraites (${features.length}):`, features);

                    features.forEach(feature => {
                        this.featureStore.setFeature(feature);
                        console.log(`💾 Feature stockée: ${feature.name} = ${feature.value}`);
                    });
                }
            });

            // 5. Run analyzers
            console.log(`🧠 Exécution de ${this.analyzers.length} analyzers`);
            this.analyzers.forEach(analyzer => {
                if (analyzer.isEnabled()) {
                    console.log(`🔬 Exécution analyzer: ${analyzer.name}`);
                    analyzer.analyze();
                }
            });

            const totalFeatures = this.featureStore.getAllFeatures().size;
            console.log(`📈 Total features dans le store: ${totalFeatures}`);
        }
    }

    private convertToMediaPipeFrame(results: any): MediaPipeFrame {
        const hands: HandData[] = [];

        if (results.multiHandLandmarks && results.multiHandedness) {
            for (let i = 0; i < results.multiHandLandmarks.length; i++) {
                const landmarks = results.multiHandLandmarks[i];
                const handedness = results.multiHandedness[i];

                hands.push({
                    landmarks: landmarks.map((landmark: any) => ({
                        x: landmark.x,
                        y: landmark.y,
                        z: landmark.z
                    })),
                    handedness: handedness.label as 'Left' | 'Right',
                    confidence: handedness.score || 0
                });
            }
        }

        return {
            hands,
            timestamp: Date.now()
        };
    }
}