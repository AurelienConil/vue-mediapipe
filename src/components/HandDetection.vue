<template>
  <v-card class="ma-4" elevation="2">
    <v-card-title class="text-h5">
      <v-icon left>mdi-hand-wave</v-icon>
      Détection de Main - Preuve de Concept
    </v-card-title>

    <v-card-text>
      <div class="d-flex flex-column align-center">
        <div v-if="error" class="text-error mb-4">
          <v-icon>mdi-alert</v-icon>
          {{ error }}
        </div>

        <div class="video-container position-relative">
          <video
            ref="videoRef"
            :width="640"
            :height="480"
            autoplay
            muted
          ></video>

          <canvas
            ref="canvasRef"
            :width="640"
            :height="480"
            class="overlay-canvas"
            style="position: absolute; top: 0; left: 0"
          ></canvas>
        </div>

        <div class="mt-4">
          <v-btn
            v-if="!isDetecting"
            @click="startCamera"
            color="primary"
            :loading="loading"
          >
            <v-icon left>mdi-camera</v-icon>
            Démarrer la Détection
          </v-btn>

          <v-btn v-else @click="stopCamera" color="error">
            <v-icon left>mdi-stop</v-icon>
            Arrêter
          </v-btn>
        </div>

        <div v-if="results && results.multiHandLandmarks" class="mt-4">
          <v-chip color="success">
            <v-icon left>mdi-check</v-icon>
            {{ results.multiHandLandmarks.length }} main(s) détectée(s)
          </v-chip>
          <v-chip color="success" v-if="results.multiHandedness">
            Première main :
            {{ results.multiHandedness[0]?.label }}
          </v-chip>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
// import { Camera } from "@mediapipe/camera_utils";
// import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
// import { HAND_CONNECTIONS } from "@mediapipe/hands";
// Utiliser les variables globales à la place
const Camera = (window as any).Camera;
const drawConnectors = (window as any).drawConnectors;
const drawLandmarks = (window as any).drawLandmarks;
const HAND_CONNECTIONS = (window as any).HAND_CONNECTIONS;
import { useMediaPipeStore } from "../stores/mediapipe";
import { storeToRefs } from "pinia";
import { useEventBusStore } from "../stores/eventBusStore";
import { eventBus } from "../stores/eventBusStore";

const eventBusStore = useEventBusStore();

const mediaPipeStore = useMediaPipeStore();
const { isDetecting, results, error, isInitialized } =
  storeToRefs(mediaPipeStore);

// Types pour le feedback visuel
type FingerName = 'index' | 'middle' | 'ring' | 'pinky';

interface VisualFeedback {
  finger: FingerName;
  phalanx: number;
  timestamp: number;
}

const videoRef = ref<HTMLVideoElement>();
const canvasRef = ref<HTMLCanvasElement>();
const loading = ref(false);

// Feedback visuel pour les événements détectés
const visualFeedbacks = ref<VisualFeedback[]>([]);

// Correspondance entre les noms des doigts et les index des landmarks MediaPipe
// phalanx=0 = 2e phalange (DIP), phalanx=1 = 1ere phalange (PIP), phalanx=2 = bout du doigt (tip)
const fingerLandmarkIndices: Record<FingerName, [number, number, number]> = {
  index: [6, 7, 8],    // [DIP, PIP, tip] pour l'index
  middle: [10, 11, 12], // [DIP, PIP, tip] pour le majeur  
  ring: [14, 15, 16],  // [DIP, PIP, tip] pour l'annulaire
  pinky: [18, 19, 20]  // [DIP, PIP, tip] pour l'auriculaire
};

let camera: any | null = null;

// Stocker la référence du handler pour pouvoir le supprimer
const peakDetectionHandler = (event: any) => {
  console.log('Événement de pic détecté:', event);
  addVisualFeedback(event.data.finger, event.data.phalanx);
};

onMounted(async () => {
  console.log("Composant monté, initialisation de MediaPipe...");
  
  // Écouter les événements de détection de pic sur les doigts
  eventBus.on('max_finger_peak_detected', peakDetectionHandler);
  
  //store the promise of initialization
  const initializationPromise = mediaPipeStore.initializeHands();
  //start camera after initialization is complete
  initializationPromise.then(() => {
    startCamera();
  });
  //fix async because we delete the await

  console.log("MediaPipe initialisé:", isInitialized.value);
  //start camera  when mediapipe is initialized
});

const startCamera = async () => {
  const handsInstance = mediaPipeStore.getHandsInstance();

  if (!isInitialized.value || !videoRef.value || !handsInstance || !Camera) {
    console.log("Conditions non remplies:", {
      isInitialized: isInitialized.value,
      video: !!videoRef.value,
      hands: !!handsInstance,
      camera: !!Camera,
    });
    return;
  }

  loading.value = true;

  try {
    console.log("Initialisation de la caméra...");

    camera = new Camera(videoRef.value, {
      onFrame: async () => {
        const currentHands = mediaPipeStore.getHandsInstance();
        if (currentHands && videoRef.value) {
          await currentHands.send({ image: videoRef.value });
        }
      },
      width: 640,
      height: 480,
    });

    console.log("Démarrage de la caméra...");
    await camera.start();
    console.log("Caméra démarrée avec succès");

    mediaPipeStore.startDetection();
  } catch (err) {
    console.error("Erreur lors du démarrage de la caméra:", err);
    error.value = "Impossible d'accéder à la caméra";
  } finally {
    loading.value = false;
  }
};

const stopCamera = () => {
  if (camera) {
    camera.stop();
    camera = null;
  }
  mediaPipeStore.stopDetection();
};

// Ajouter un feedback visuel pour un doigt et une phalange
const addVisualFeedback = (finger: FingerName, phalanx: number) => {
  const feedback: VisualFeedback = {
    finger,
    phalanx,
    timestamp: Date.now()
  };
  
  visualFeedbacks.value.push(feedback);
};

// Dessiner le feedback visuel sur le canvas
const drawVisualFeedback = (canvasCtx: CanvasRenderingContext2D, landmarks: any[]) => {
  const currentTime = Date.now();
  const duration = 2000; // 2 secondes
  
  // Nettoyer les feedbacks expirés et dessiner les actifs
  for (let i = visualFeedbacks.value.length - 1; i >= 0; i--) {
    const feedback = visualFeedbacks.value[i];
    const elapsed = currentTime - feedback.timestamp;
    const opacity = Math.max(0, 1 - (elapsed / duration));
    
    // Supprimer les feedbacks expirés
    if (opacity <= 0) {
      visualFeedbacks.value.splice(i, 1);
      continue;
    }
    
    const fingerIndices = fingerLandmarkIndices[feedback.finger];
    const landmarkIndex = fingerIndices[feedback.phalanx];
    
    if (landmarks[landmarkIndex]) {
      const landmark = landmarks[landmarkIndex];
      const x = landmark.x * canvasRef.value!.width;
      const y = landmark.y * canvasRef.value!.height;
      
      // Dessiner un cercle pulsant coloré
      canvasCtx.save();
      canvasCtx.globalAlpha = opacity;
      
      // Couleur différente pour chaque doigt
      const colors = {
        index: '#FF4081',    // Rose
        middle: '#00BCD4',   // Cyan
        ring: '#FF9800',     // Orange
        pinky: '#9C27B0'     // Violet
      };
      
      canvasCtx.fillStyle = colors[feedback.finger];
      canvasCtx.strokeStyle = '#FFFFFF';
      canvasCtx.lineWidth = 2;
      
      // Effet pulsant basé sur l'opacité
      const pulseScale = 1 + (1 - opacity) * 0.5;
      const radius = 15 * pulseScale;
      
      canvasCtx.beginPath();
      canvasCtx.arc(x, y, radius, 0, 2 * Math.PI);
      canvasCtx.fill();
      canvasCtx.stroke();
      
      canvasCtx.restore();
    }
  }
};

// Dessiner les landmarks de la main et les feedbacks visuels
watch(results, (newResults) => {
  if (newResults && canvasRef.value) {
    const canvasCtx = canvasRef.value.getContext("2d")!;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    
    if (newResults.multiHandLandmarks && newResults.multiHandLandmarks.length > 0) {
      for (const landmarks of newResults.multiHandLandmarks) {
        // Dessiner les connexions et landmarks de base
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 3,
        });
        drawLandmarks(canvasCtx, landmarks, {
          color: "#FF0000",
          lineWidth: 2,
          radius: 4,
        });
        
        // Dessiner les feedbacks visuels par-dessus
        drawVisualFeedback(canvasCtx, landmarks);
      }
    }
    canvasCtx.restore();
  }
});

onUnmounted(() => {
  // Nettoyer le listener d'événements pour éviter les fuites mémoire
  eventBus.off('max_finger_peak_detected', peakDetectionHandler);
  stopCamera();
});
</script>

<style scoped>
.video-container {
  position: relative;
  display: inline-block;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
}

.overlay-canvas {
  pointer-events: none;
}
</style>