<template>
  <v-card class="ma-4" elevation="2">
    <v-card-title class="text-h5">
      <v-icon left>mdi-cube-outline</v-icon>
      Squelette 3D Préprocessé
    </v-card-title>

    <v-card-text>
      <div class="d-flex flex-column align-center">
        <div v-if="!isDetecting" class="text-center mb-4">
          <v-icon size="64" color="grey">mdi-hand-wave-outline</v-icon>
          <p class="text-body-2 mt-2">
            Démarrez la détection pour voir le squelette 3D
          </p>
        </div>

        <div class="canvas-container">
          <div ref="p5Container" class="p5-canvas"></div>
        </div>

        <div class="mt-4 text-center">
          <v-chip
            :color="hasPreprocessedData ? 'primary' : 'grey'"
            size="small"
            class="mb-2"
          >
            <v-icon left size="small">
              {{
                hasPreprocessedData ? "mdi-check-circle" : "mdi-circle-outline"
              }}
            </v-icon>
            {{
              hasPreprocessedData
                ? "Données préprocessées disponibles"
                : "En attente de données"
            }}
          </v-chip>

          <div class="d-flex align-center justify-center mb-2">
            <v-btn
              size="small"
              variant="outlined"
              @click="resetCameraView"
              class="me-2"
            >
              <v-icon left size="small">mdi-refresh</v-icon>
              Réinitialiser vue
            </v-btn>

            <v-chip
              v-if="cameraPositionSaved"
              color="success"
              size="small"
              class="fade-out"
            >
              <v-icon left size="small">mdi-content-save</v-icon>
              Position sauvegardée
            </v-chip>
          </div>

          <p class="text-caption">
            Cliquez et glissez pour faire tourner • Molette pour zoomer • Touche
            'G' pour afficher/masquer la grille<br />
            Position automatiquement sauvegardée en localStorage<br />
            poignet= {{ preprocessedLandmarks[0] }}
          </p>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { storeToRefs } from "pinia";
import { useMediaPipeStore } from "@/stores/mediapipe";
import p5 from "p5";

const mediaPipeStore = useMediaPipeStore();
const p5Container = ref<HTMLDivElement>();
const hasPreprocessedData = ref(false);
const cameraPositionSaved = ref(false);

let p5Instance: p5 | null = null;
let preprocessedLandmarks: any[] = [];
let resetCameraCallback: (() => void) | null = null;
let isP5Initialized = false;
let isMounted = false;
let updateInterval: number | null = null;

const { isDetecting } = storeToRefs(mediaPipeStore);

// Connexions des doigts pour MediaPipe Hands
const HAND_CONNECTIONS = [
  // Pouce
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  // Index
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  // Majeur
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  // Annulaire
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  // Auriculaire
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  // Palm
  [0, 5],
  [5, 9],
  [9, 13],
  [13, 17],
];

onMounted(async () => {
  isMounted = true;

  await nextTick();
  // Toujours réinitialiser l'état
  if (p5Instance) {
    try {
      p5Instance.remove();
    } catch (e) {}
    p5Instance = null;
    isP5Initialized = false;
  }
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  if (p5Container.value) {
    initP5();
  }
});

onUnmounted(() => {
  isMounted = false;
  console.log("Unmount p5js");
  cleanup();
});

const cleanup = () => {
  if (p5Instance) {
    try {
      p5Instance.remove();
    } catch (e) {
      console.warn("Erreur lors de la suppression de p5Instance:", e);
    }
    p5Instance = null;
  }
  isP5Initialized = false;
  resetCameraCallback = null;
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  preprocessedLandmarks = [];
  hasPreprocessedData.value = false;
};

// Clé pour localStorage
const CAMERA_STORAGE_KEY = "vue-mediapipe-3d-camera";

// Fonction pour sauvegarder la position de la caméra
const saveCameraPosition = (
  rotationX: number,
  rotationY: number,
  zoomLevel: number,
  showGrid: boolean
) => {
  const cameraData = { rotationX, rotationY, zoomLevel, showGrid };
  localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify(cameraData));

  // Afficher l'indicateur de sauvegarde
  cameraPositionSaved.value = true;
  setTimeout(() => {
    cameraPositionSaved.value = false;
  }, 2000);
};

// Fonction pour charger la position de la caméra
const loadCameraPosition = () => {
  try {
    const saved = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (saved) {
      const cameraData = JSON.parse(saved);
      return {
        rotationX: cameraData.rotationX || 0,
        rotationY: cameraData.rotationY || 0,
        zoomLevel: cameraData.zoomLevel || 0,
        showGrid:
          cameraData.showGrid !== undefined ? cameraData.showGrid : true,
      };
    }
  } catch (error) {
    console.warn("Erreur lors du chargement de la position de caméra:", error);
  }
  return { rotationX: 0, rotationY: 0, zoomLevel: 0, showGrid: true };
};

// Fonction pour réinitialiser la vue de la caméra
const resetCameraView = () => {
  if (resetCameraCallback) {
    resetCameraCallback();
  }
};

const initP5 = () => {
  if (isP5Initialized || !p5Container.value) {
    return;
  }

  const sketch = (p: p5) => {
    // Charger la position sauvegardée
    const savedCamera = loadCameraPosition();
    let rotationX = savedCamera.rotationX;
    let rotationY = savedCamera.rotationY;
    let zoomLevel = savedCamera.zoomLevel;
    let mousePressed = false;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let showGrid = savedCamera.showGrid;

    p.setup = () => {
      const canvas = p.createCanvas(640, 480, p.WEBGL);
      canvas.parent(p5Container.value!);
      p.strokeWeight(2);
    };

    p.draw = () => {
      p.background(20, 25, 35);

      // Application du zoom
      p.translate(0, 0, zoomLevel);

      // Contrôles souris manuels pour la rotation
      p.rotateX(rotationX);
      p.rotateY(rotationY);

      // Grid de référence (désactivable avec 'g')
      if (showGrid) {
        drawGrid(p);
      }

      // Axes de référence
      drawAxes(p);

      // Dessiner les landmarks préprocessés si disponibles
      if (preprocessedLandmarks.length > 0) {
        drawHand3D(p, preprocessedLandmarks);
      }
    };

    p.mousePressed = () => {
      if (
        p.mouseX >= 0 &&
        p.mouseX <= p.width &&
        p.mouseY >= 0 &&
        p.mouseY <= p.height
      ) {
        mousePressed = true;
        lastMouseX = p.mouseX;
        lastMouseY = p.mouseY;
        return false;
      }
    };

    p.mouseReleased = () => {
      mousePressed = false;
      return false;
    };

    p.mouseDragged = () => {
      if (mousePressed) {
        const deltaX = p.mouseY - lastMouseY;
        const deltaY = p.mouseX - lastMouseX;
        rotationX += deltaX * 0.01;
        rotationY += deltaY * 0.01;
        lastMouseX = p.mouseX;
        lastMouseY = p.mouseY;

        // Sauvegarder la position automatiquement
        saveCameraPosition(rotationX, rotationY, zoomLevel, showGrid);

        return false;
      }
    };

    p.mouseWheel = (event: any) => {
      if (
        p.mouseX >= 0 &&
        p.mouseX <= p.width &&
        p.mouseY >= 0 &&
        p.mouseY <= p.height
      ) {
        // Zoom avec la molette
        zoomLevel += event.delta * 2;
        // Limiter le zoom
        zoomLevel = p.constrain(zoomLevel, -800, 400);

        // Sauvegarder la position automatiquement
        saveCameraPosition(rotationX, rotationY, zoomLevel, showGrid);

        return false; // Empêcher le scroll de la page
      }
    };

    p.keyPressed = () => {
      if (p.key === "g" || p.key === "G") {
        showGrid = !showGrid;

        // Sauvegarder la position automatiquement
        saveCameraPosition(rotationX, rotationY, zoomLevel, showGrid);

        return false; // Empêcher le comportement par défaut
      }
    };

    // Fonction de réinitialisation accessible depuis l'extérieur
    resetCameraCallback = () => {
      rotationX = 0;
      rotationY = 0;
      zoomLevel = 0;
      showGrid = true;
      saveCameraPosition(rotationX, rotationY, zoomLevel, showGrid);
    };
  };

  try {
    p5Instance = new p5(sketch);
    isP5Initialized = true;
  } catch (error) {
    console.error("Erreur lors de l'initialisation de p5:", error);
    isP5Initialized = false;
  }
};

const drawGrid = (p: p5) => {
  p.stroke(40, 50, 60);
  p.strokeWeight(1);

  const size = 400;
  const step = 50;

  // Grille horizontale
  for (let i = -size; i <= size; i += step) {
    p.line(-size, 0, i, size, 0, i);
    p.line(i, 0, -size, i, 0, size);
  }
};

const drawAxes = (p: p5) => {
  p.strokeWeight(3);

  // Axe X (rouge) - gauche → droite
  p.stroke(255, 0, 0);
  p.line(0, 0, 0, 100, 0, 0);

  // Axe Y (vert) - haut → bas (MediaPipe standard)
  p.stroke(0, 255, 0);
  p.line(0, 0, 0, 0, 100, 0);

  // Axe Z (bleu) - avant → arrière (caméra → utilisateur)
  p.stroke(0, 0, 255);
  p.line(0, 0, 0, 0, 0, -100);
};

const drawHand3D = (p: p5, landmarks: any[]) => {
  if (!landmarks || landmarks.length === 0) return;

  // Les coordonnées sont déjà préprocessées (centrées), pas besoin de normaliser
  const scale = 300;
  const points3D = landmarks.map((landmark) => ({
    x: -landmark.x * scale, // X: gauche → droite
    y: landmark.y * scale, // Y: haut → bas (MediaPipe) = haut → bas (3D)
    z: -landmark.z * scale, // Z: caméra → utilisateur (MediaPipe) → utilisateur → caméra (3D)
  }));

  // Dessiner les connexions
  p.stroke(0, 255, 150);
  p.strokeWeight(2);

  for (const [start, end] of HAND_CONNECTIONS) {
    //check start and end are not undefined
    if (start !== undefined && end !== undefined) {
      const startPoint = points3D[start];
      const endPoint = points3D[end];
      if (startPoint && endPoint) {
        p.line(
          startPoint.x,
          startPoint.y,
          startPoint.z,
          endPoint.x,
          endPoint.y,
          endPoint.z
        );
      }
    }
  }

  // Dessiner les landmarks
  p.fill(255, 100, 100);
  p.noStroke();

  for (const point of points3D) {
    p.push();
    p.translate(point.x, point.y, point.z);
    p.sphere(2);
    p.pop();
  }

  // Dessiner le poignet en plus gros et d'une couleur différente
  if (points3D[0]) {
    p.fill(255, 255, 0); // Jaune pour le poignet (origine)
    p.push();
    p.translate(points3D[0].x, points3D[0].y, points3D[0].z);
    p.sphere(2);
    p.pop();
  }
};

// Surveiller les données préprocessées
const updatePreprocessedData = () => {
  // Vérifier que le composant est encore monté
  if (!isMounted || !isP5Initialized || !p5Container.value) {
    return;
  }

  try {
    // Récupérer le processor depuis le mediaPipeStore
    const processor = mediaPipeStore.getProcessor();

    if (processor && processor.getCurrentFrame) {
      const currentFrame = processor.getCurrentFrame();

      if (currentFrame && currentFrame.hands && currentFrame.hands.length > 0) {
        // Prendre la première main détectée
        const firstHand = currentFrame.hands[0];

        if (firstHand && firstHand.landmarks) {
          preprocessedLandmarks = firstHand.landmarks;
          hasPreprocessedData.value = true;
          return;
        }
      }
    }

    preprocessedLandmarks = [];
    hasPreprocessedData.value = false;
  } catch (error) {
    console.warn(
      "Erreur lors de la mise à jour des données préprocessées:",
      error
    );
    preprocessedLandmarks = [];
    hasPreprocessedData.value = false;
  }
};

// Surveiller les changements de frame (nouvelle frame = nouvelle main potentielle)
watch(() => mediaPipeStore.frameCount, updatePreprocessedData, {
  flush: "post",
});

// Watcher pour démarrer/arrêter l'intervalle de mise à jour selon isDetecting
watch(
  isDetecting,
  (detecting) => {
    try {
      if (detecting && isMounted && isP5Initialized && p5Container.value) {
        if (updateInterval) {
          clearInterval(updateInterval);
        }
        updateInterval = window.setInterval(() => {
          if (isMounted && isP5Initialized && p5Container.value) {
            updatePreprocessedData();
          } else if (updateInterval) {
            clearInterval(updateInterval);
            updateInterval = null;
          }
        }, 50);
      } else {
        if (updateInterval) {
          clearInterval(updateInterval);
          updateInterval = null;
        }
        preprocessedLandmarks = [];
        hasPreprocessedData.value = false;
      }
    } catch (error) {
      console.warn("Erreur dans le watcher isDetecting:", error);
      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    }
  },
  { flush: "post" }
);

// Watcher pour réinitialiser p5 si nécessaire
watch(
  () => p5Container.value,
  async (newContainer) => {
    try {
      if (isMounted && newContainer && !isP5Initialized) {
        await nextTick();
        initP5();
      }
    } catch (error) {
      console.warn("Erreur lors de la réinitialisation p5:", error);
    }
  },
  { flush: "post" }
);
</script>

<style scoped>
.canvas-container {
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: linear-gradient(135deg, #141925 0%, #1a1f2e 100%);
  position: relative;
}

.p5-canvas {
  display: block;
  position: relative;
  width: 640px;
  height: 480px;
}

.p5-canvas canvas {
  display: block !important;
  position: relative !important;
}

.fade-out {
  animation: fadeOut 2s ease-out forwards;
}

@keyframes fadeOut {
  0% {
    opacity: 1;
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}
</style>