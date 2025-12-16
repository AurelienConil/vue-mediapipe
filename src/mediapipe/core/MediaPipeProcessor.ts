import type { MediaPipeFrame, HandData } from '../types';
import { FeatureStore } from '../../stores/FeatureStore';
import { useCoreStore } from '../../stores/CoreStore';
import { EventBus } from './EventBus';
import { EventHistory } from './EventHistory';
import type { BaseFeatureExtractor } from '../extractors/BaseFeatureExtractor';
import type { BaseAnalyzer } from '../analyzers/BaseAnalyzer';
import { BasePreprocessor } from '../preprocessors/BasePreprocessor';

export class MediaPipeProcessor {
    private featureStore = new FeatureStore();
    private eventHistory = new EventHistory();
    private eventBus = new EventBus(this.eventHistory);
    private coreStore = useCoreStore();
    private preprocessors: BasePreprocessor[] = [];
    private extractors: BaseFeatureExtractor[] = [];
    private analyzers: BaseAnalyzer[] = [];
    private currentFrame: MediaPipeFrame | null = null;

    addPreprocessor(preprocessor: BasePreprocessor): void {
        this.preprocessors.push(preprocessor);
    }

    clearPreprocessors(): void {
        this.preprocessors = [];
    }

    addExtractor(extractor: BaseFeatureExtractor): void {
        this.extractors.push(extractor);
        console.log(`✅ Extractor ajouté: ${extractor.name} (${extractor.id})`);
    }

    // Info sur les extractors (tous sont toujours actifs pour les calculs)
    getExtractorStats(): { total: number; extractors: string[] } {
        return {
            total: this.extractors.length,
            extractors: this.extractors.map(e => e.name)
        };
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

    getCurrentFrame(): MediaPipeFrame | null {
        return this.currentFrame;
    }

    processFrame(results: any): void {
        // 1. Convert MediaPipe results to MediaPipeFrame
        let frame: MediaPipeFrame = this.convertToMediaPipeFrame(results);
        //console.log('📊 Frame converti:', frame);

        // 2. Update CoreStore with basic hand detection info
        this.coreStore.updateFrame(frame.hands);

        // 3. Preprocessing (optionnel)
        if (this.preprocessors.length > 0) {
            this.preprocessors.forEach(preprocessor => {
                if (preprocessor.isEnabled()) {
                    frame = preprocessor.preprocess(frame);
                }
            });
        } else {
            console.log('Aucun preprocessor configuré');
        }

        // Stocker la frame actuelle (après preprocessing)
        this.currentFrame = frame;

        // 4. Run extractors (seulement si exactement 1 main détectée)
        if (frame.hands.length === 0) {
            console.log('Aucune main détectée - extraction annulée');
        } else if (frame.hands.length > 1) {
            console.log(`${frame.hands.length} mains détectées - extraction annulée (seulement 1 main supportée)`);
        } else {
            // Exécuter TOUS les extractors - calculs toujours actifs
            //console.log(`🔍 Exécution de ${this.extractors.length} extractors (1 main détectée)`);

            this.extractors.forEach(extractor => {
                //console.log(`⚙️ Exécution extractor: ${extractor.name}`);
                const features = extractor.extract(frame, this.featureStore);
                //console.log(`✨ Features extraites (${features.length}):`, features);

                features.forEach(feature => {
                    this.featureStore.setFeature(feature);
                    //console.log(`💾 Feature stockée: ${feature.name} = ${feature.value}`);
                });
            });

            // 5. Run analyzers
            //console.log(`🧠 Exécution de ${this.analyzers.length} analyzers`);
            this.analyzers.forEach(analyzer => {
                if (analyzer.isEnabled()) {
                    analyzer.analyze();
                }
            });
        }
    }

    private convertToMediaPipeFrame(results: any): MediaPipeFrame {
        const hands: HandData[] = [];
        const useWorldLandmarks = false;

        if (useWorldLandmarks) {

            // Vérifiez si `world_landmarks` et `handedness` existent
            if (results.multiHandWorldLandmarks && results.multiHandedness) {
                for (let i = 0; i < results.multiHandWorldLandmarks.length; i++) {
                    const worldLandmarks = results.multiHandWorldLandmarks[i];
                    const handedness = results.multiHandedness[i];

                    // Utilisation des world_landmarks (référentiel indépendant de la caméra)
                    hands.push({
                        landmarks: worldLandmarks.map((worldLandmark: any) => ({
                            x: worldLandmark.x,
                            y: worldLandmark.y,
                            z: worldLandmark.z
                        })),
                        handedness: handedness.label as 'Left' | 'Right',
                        confidence: handedness.score || 0
                    });
                }
            }

        } else {
            // Utilisation des landmarks standards (référentiel caméra)
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
        }

        return {
            hands,
            timestamp: Date.now()
        };
    }
}