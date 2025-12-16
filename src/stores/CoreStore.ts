import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { HandData, HandSide } from '@/mediapipe/types'

export interface CoreStatus {
    isDetecting: boolean
    fps: number
    frameCount: number
    lastFrameTime: number
    averageProcessingTime: number
}

export interface HandInfo {
    isDetected: boolean
    confidence: number
    side: HandSide
    landmarkCount: number
}

// Types pour le système de coordonnées
export type CoordinateSystem = 'camera' | 'selfie'

export const useCoreStore = defineStore('mediapipeCore', () => {
    // États de base
    const status = ref<CoreStatus>({
        isDetecting: false,
        fps: 0,
        frameCount: 0,
        lastFrameTime: Date.now(),
        averageProcessingTime: 0
    })

    const hands = ref<Map<HandSide, HandInfo>>(new Map())
    const error = ref<string | null>(null)

    // Option pour le système de coordonnées
    const coordinateSystem = ref<CoordinateSystem>('camera')



    // Historique FPS pour calcul de moyenne
    const fpsHistory = ref<number[]>([])
    const processingTimeHistory = ref<number[]>([])
    const maxHistorySize = 30

    // Getters computed
    const hasHands = computed(() => hands.value.size > 0)

    const hasLeftHand = computed(() => hands.value.has('Left'))

    const hasRightHand = computed(() => hands.value.has('Right'))

    const handCount = computed(() => hands.value.size)

    const leftHandInfo = computed(() => hands.value.get('Left') || null)

    const rightHandInfo = computed(() => hands.value.get('Right') || null)

    const bothHands = computed(() => hands.value.size === 2)

    const singleHand = computed(() => hands.value.size === 1)

    const averageFps = computed(() => {
        if (fpsHistory.value.length === 0) return 0
        const sum = fpsHistory.value.reduce((a, b) => a + b, 0)
        return Math.round(sum / fpsHistory.value.length)
    })

    // Actions
    const startDetection = () => {
        status.value.isDetecting = true
        status.value.frameCount = 0
        status.value.lastFrameTime = Date.now()
        error.value = null
        console.log('CoreStore: Détection démarrée')
    }

    const stopDetection = () => {
        status.value.isDetecting = false
        hands.value.clear()
        console.log('CoreStore: Détection arrêtée')
    }

    const updateFrame = (handsData: HandData[]) => {
        const frameStartTime = Date.now()

        // Mise à jour du status général
        status.value.frameCount++
        const timeSinceLastFrame = frameStartTime - status.value.lastFrameTime

        if (timeSinceLastFrame > 0) {
            const currentFps = 1000 / timeSinceLastFrame
            status.value.fps = Math.round(currentFps)

            // Mise à jour de l'historique FPS
            fpsHistory.value.push(currentFps)
            if (fpsHistory.value.length > maxHistorySize) {
                fpsHistory.value.shift()
            }
        }

        status.value.lastFrameTime = frameStartTime

        // Mise à jour des informations des mains
        const newHands = new Map<HandSide, HandInfo>()

        handsData.forEach(hand => {
            newHands.set(hand.handedness, {
                isDetected: true,
                confidence: hand.confidence,
                side: hand.handedness,
                landmarkCount: hand.landmarks.length
            })
        })

        hands.value = newHands

        // Calcul du temps de traitement
        const processingTime = Date.now() - frameStartTime
        processingTimeHistory.value.push(processingTime)
        if (processingTimeHistory.value.length > maxHistorySize) {
            processingTimeHistory.value.shift()
        }

        if (processingTimeHistory.value.length > 0) {
            const avgProcessingTime = processingTimeHistory.value.reduce((a, b) => a + b, 0) / processingTimeHistory.value.length
            status.value.averageProcessingTime = Math.round(avgProcessingTime * 100) / 100
        }

        //console.log(` CoreStore: Frame ${status.value.frameCount}, ${handCount.value} main(s), ${status.value.fps} FPS`)
    }

    const setError = (message: string) => {
        error.value = message
        console.error('❌ CoreStore: Erreur -', message)
    }

    const clearError = () => {
        error.value = null
    }

    const reset = () => {
        status.value = {
            isDetecting: false,
            fps: 0,
            frameCount: 0,
            lastFrameTime: Date.now(),
            averageProcessingTime: 0
        }
        hands.value.clear()
        error.value = null
        fpsHistory.value = []
        processingTimeHistory.value = []
        console.log('CoreStore: Reset effectué')
    }

    // Méthodes utilitaires pour les tests/conditions
    const getHandInfo = (side: HandSide): HandInfo | null => {
        return hands.value.get(side) || null
    }

    const isHandConfident = (side: HandSide, minConfidence = 0.7): boolean => {
        const hand = hands.value.get(side)
        return hand ? hand.confidence >= minConfidence : false
    }

    const getBothHandsConfidence = (): { left: number; right: number } | null => {
        const left = hands.value.get('Left')
        const right = hands.value.get('Right')

        if (!left || !right) return null

        return {
            left: left.confidence,
            right: right.confidence
        }
    }

    // Méthodes pour le système de coordonnées
    const setCoordinateSystem = (system: CoordinateSystem) => {
        console.log(`Changement de système de coordonnées: ${coordinateSystem.value} → ${system}`)
        coordinateSystem.value = system
    }

    const getCoordinateSystem = (): CoordinateSystem => {
        return coordinateSystem.value
    }



    // Getter pour le système de coordonnées actuel
    const currentCoordinateSystem = computed(() => coordinateSystem.value)

    return {
        // State
        status,
        hands,
        error,
        coordinateSystem,

        // Computed
        hasHands,
        hasLeftHand,
        hasRightHand,
        handCount,
        leftHandInfo,
        rightHandInfo,
        bothHands,
        singleHand,
        averageFps,
        currentCoordinateSystem,

        // Actions
        startDetection,
        stopDetection,
        updateFrame,
        setError,
        clearError,
        reset,
        getHandInfo,
        isHandConfident,
        getBothHandsConfidence,
        setCoordinateSystem,
        getCoordinateSystem
    }
})