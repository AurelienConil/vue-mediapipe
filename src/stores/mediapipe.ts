import { defineStore } from 'pinia'
import { ref } from 'vue'
import { MediaPipeProcessor } from '@/mediapipe'
import { AccelBaseFinger } from '@/mediapipe/extractors/AccelBaseFinger'
import { HandSizeNormalise } from '@/mediapipe/extractors/HandSizeNormalise'
import { HandOrientationInSpace } from '@/mediapipe/extractors/HandOrientationInSpace'
import { DistanceFinger } from '@/mediapipe/extractors/DistanceFinger'
import { useCoreStore } from '@/stores/CoreStore'

export const useMediaPipeStore = defineStore('mediaPipe', () => {
    const isInitialized = ref(false)
    const isDetecting = ref(false)
    const results = ref<any | null>(null)
    const error = ref<string | null>(null)

    // Utilisation du CoreStore
    const coreStore = useCoreStore()

    // Utiliser une variable non-reactive pour l'instance MediaPipe
    let handsInstance: any | null = null

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
            
            // Vérifier que MediaPipe est chargé via le script global
            if (typeof (window as any).Hands === 'undefined') {
                throw new Error('MediaPipe Hands n\'est pas chargé. Vérifiez que le script CDN est bien inclus.');
            }

            // Utiliser la classe globale Hands
            const HandsClass = (window as any).Hands;
            
            // Créer l'instance
            const newHandsInstance = new HandsClass({
                locateFile: (file: string) => {
                    // En production, utiliser le CDN avec version spécifique
                    const baseUrl = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240';
                    console.log(`Chargement fichier MediaPipe: ${baseUrl}/${file}`);
                    return `${baseUrl}/${file}`;
                }
            })

            console.log('Configuration des options...');
            newHandsInstance.setOptions({
                maxNumHands: 2,
                modelComplexity: 1,
                minDetectionConfidence: 0.7,
                minTrackingConfidence: 0.5,
                selfieMode: false
            })

            // Définir le callback onResults
            newHandsInstance.onResults((handResults: any) => {

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
    const processCurrentFrame = (handResults: any) => {
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