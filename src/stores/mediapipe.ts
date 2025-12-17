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
    const frameCount = ref(0)
    processor.addExtractor(new AccelBaseFinger())
    processor.addExtractor(new HandSizeNormalise()) // Refait avec sécurité
    processor.addExtractor(new HandOrientationInSpace())
    processor.addExtractor(new DistanceFinger())


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
                // results.value = JSON.parse(JSON.stringify(handResults))
                results.value = { ...handResults }

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
        frameCount.value++
    }


    return {
        isInitialized,
        isDetecting,
        results,
        error,
        frameCount,
        getHandsInstance,
        initializeHands,
        startDetection,
        stopDetection,
        getFeatureStore,
        getProcessor,
        getCoreStore
    }
})