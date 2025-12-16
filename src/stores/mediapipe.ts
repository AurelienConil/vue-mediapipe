import { defineStore } from 'pinia'
import { ref, markRaw, watch } from 'vue'
import { Hands, type Results } from '@mediapipe/hands'
import { MediaPipeProcessor } from '@/mediapipe'
import { AccelBaseFinger } from '@/mediapipe/extractors/AccelBaseFinger'
import { HandSizeNormalise } from '@/mediapipe/extractors/HandSizeNormalise'
import { HandOrientationInSpace } from '@/mediapipe/extractors/HandOrientationInSpace'
import { DistanceFinger } from '@/mediapipe/extractors/DistanceFinger'
import { useCoreStore } from '@/stores/CoreStore'

export const useMediaPipeStore = defineStore('mediaPipe', () => {
    const isInitialized = ref(false)
    const isDetecting = ref(false)
    const results = ref<Results | null>(null)
    const error = ref<string | null>(null)

    // Utilisation du CoreStore
    const coreStore = useCoreStore()

    // Utiliser une variable non-reactive pour l'instance MediaPipe
    let handsInstance: Hands | null = null

    // Utiliser une variable mutable pour le processor (pour permettre le reinitialisation)
    let processor = new MediaPipeProcessor()

    // Compteur pour forcer la réactivité lorsque le processor change
    const processorVersion = ref(0)
    processor.addExtractor(new AccelBaseFinger())
    processor.addExtractor(new HandSizeNormalise()) // Refait avec sécurité
    processor.addExtractor(new HandOrientationInSpace())
    processor.addExtractor(new DistanceFinger())

    // Méthode pour traiter les frames avec le processor actuel
    const processFrameWithCurrentProcessor = (handResults: Results) => {
        processor.processFrame(handResults)
    }

    const initializeHands = async () => {
        try {
            console.log('Création de l\'instance Hands...');

            // Créer l'instance sans reactive wrapper pour éviter les conflits de proxy
            const newHandsInstance = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
                }
            })

            console.log('Configuration des options...');
            newHandsInstance.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5,
                staticImageMode: false,
                selfieMode: coreStore.getCoordinateSystem() === 'selfie'
            })

            // Définir le callback onResults
            newHandsInstance.onResults((handResults: Results) => {

                if (handResults.multiHandLandmarks) {


                    // Traiter avec notre architecture !
                    // Utiliser la méthode qui a toujours accès au processor actuel
                    processCurrentFrame(handResults)
                }
                // Cloner l'objet pour éviter les problèmes de proxy
                results.value = JSON.parse(JSON.stringify(handResults))
            })

            // Attendre que MediaPipe soit initialisé
            await new Promise(resolve => setTimeout(resolve, 500))

            // Assigner l'instance à la variable non-reactive
            handsInstance = newHandsInstance
            isInitialized.value = true
            error.value = null
            console.log('MediaPipe initialisé avec succès');
        } catch (err) {
            error.value = 'Erreur lors de l\'initialisation de MediaPipe'
            console.error('Erreur MediaPipe:', err)
        }
    }

    const startDetection = () => {
        isDetecting.value = true
        coreStore.startDetection()
    }

    const stopDetection = () => {
        isDetecting.value = false
        coreStore.stopDetection()
    }

    const getHandsInstance = () => handsInstance

    const getFeatureStore = () => {
        return processor.getFeatureStore()
    }

    const getProcessor = () => {
        return processor
    }

    const getCoreStore = () => {
        return coreStore
    }

    // Méthode pour traiter une frame avec le processor actuel
    const processCurrentFrame = (handResults: Results) => {
        processor.processFrame(handResults)
    }

    // Watcher pour redémarrer MediaPipe lorsque le système de coordonnées change
    watch(
        () => coreStore.currentCoordinateSystem,
        async (newSystem, oldSystem) => {
            if (newSystem !== oldSystem) {
                console.log(`Système de coordonnées changé: ${oldSystem} → ${newSystem}`);

                // Arrêter la détection actuelle
                if (isDetecting.value) {
                    stopDetection();
                }

                // Réinitialiser l'instance MediaPipe
                if (handsInstance) {
                    try {
                        handsInstance.close();
                    } catch (e) {
                        console.warn('Erreur lors de la fermeture de l\'instance MediaPipe:', e);
                    }
                    handsInstance = null;
                }

                isInitialized.value = false;

                // Réinitialiser le processor avec les extracteurs
                processor = new MediaPipeProcessor();
                processor.addExtractor(new AccelBaseFinger());
                processor.addExtractor(new HandSizeNormalise());
                processor.addExtractor(new HandOrientationInSpace());
                processor.addExtractor(new DistanceFinger());
                processor.clearPreprocessors();

                // Incrémenter la version du processor pour forcer la réactivité
                processorVersion.value++;
                console.log('Processor réinitialisé avec le nouveau système de coordonnées (version:', processorVersion.value + ')');

                // Réinitialiser MediaPipe avec le nouveau système de coordonnées
                try {
                    await initializeHands();
                    console.log('MediaPipe réinitialisé avec le nouveau système de coordonnées');

                    // Redémarrer la détection si elle était active
                    if (oldSystem !== undefined) { // Ne pas redémarrer au premier chargement
                        startDetection();
                    }
                } catch (err) {
                    error.value = 'Erreur lors du redémarrage de MediaPipe avec le nouveau système de coordonnées';
                    console.error('❌ Erreur de réinitialisation:', err);
                }
            }
        }
    );

    return {
        isInitialized,
        isDetecting,
        results,
        error,
        processorVersion,
        getHandsInstance,
        initializeHands,
        startDetection,
        stopDetection,
        getFeatureStore,
        getProcessor,
        getCoreStore
    }
})