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
import { Camera } from "@mediapipe/camera_utils";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import { HAND_CONNECTIONS } from "@mediapipe/hands";
import { useMediaPipeStore } from "@/stores/mediapipe";
import { storeToRefs } from "pinia";

const mediaPipeStore = useMediaPipeStore();
const { isDetecting, results, error, isInitialized } =
  storeToRefs(mediaPipeStore);

const videoRef = ref<HTMLVideoElement>();
const canvasRef = ref<HTMLCanvasElement>();
const loading = ref(false);

let camera: Camera | null = null;

onMounted(async () => {
  console.log("Composant monté, initialisation de MediaPipe...");
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

  if (!isInitialized.value || !videoRef.value || !handsInstance) {
    console.log("Conditions non remplies:", {
      isInitialized: isInitialized.value,
      video: !!videoRef.value,
      hands: !!handsInstance,
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

// Dessiner les landmarks de la main
watch(results, (newResults) => {
  if (newResults && canvasRef.value) {
    const canvasCtx = canvasRef.value.getContext("2d")!;
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
    if (
      newResults.multiHandLandmarks &&
      newResults.multiHandLandmarks.length > 0
    ) {
      for (const landmarks of newResults.multiHandLandmarks) {
        drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 3,
        });
        drawLandmarks(canvasCtx, landmarks, {
          color: "#FF0000",
          lineWidth: 2,
          radius: 4,
        });
      }
    }
    canvasCtx.restore();
  }
});

onUnmounted(() => {
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