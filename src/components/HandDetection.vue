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
type SwipeDirection = 'proximal' | 'distal' | 'exit';

interface TapFeedback {
  type: 'tap';
  finger: FingerName;
  phalanx: number;
  timestamp: number;
}

interface SwipeFeedback {
  type: 'swipe';
  finger: FingerName;
  phalanx: number | string; // Peut être un index numérique OU un type string
  direction: SwipeDirection;
  swipeCount: number;
  timestamp: number;
  isActive: boolean; // Pour distinguer les mini-swipes actifs du swipe terminé
}

const videoRef = ref<HTMLVideoElement>();
const canvasRef = ref<HTMLCanvasElement>();
const loading = ref(false);

// Feedback visuel pour les événements détectés
const visualFeedbacks = ref<(TapFeedback | SwipeFeedback)[]>([]);
const activeSwipes = ref<Map<string, SwipeFeedback>>(new Map()); // Pour tracker les swipes actifs

// Correspondance entre les noms des doigts et les index des landmarks MediaPipe
// phalanx=0 = 2e phalange (DIP), phalanx=1 = 1ere phalange (PIP), phalanx=2 = bout du doigt (tip)
const fingerLandmarkIndices: Record<FingerName, [number, number, number]> = {
  index: [6, 7, 8],    // [DIP, PIP, tip] pour l'index
  middle: [10, 11, 12], // [DIP, PIP, tip] pour le majeur  
  ring: [14, 15, 16],  // [DIP, PIP, tip] pour l'annulaire
  pinky: [18, 19, 20]  // [DIP, PIP, tip] pour l'auriculaire
};

// Mapping des types de phalanx vers les index numériques
const phalanxTypeToIndex: Record<string, number> = {
  'base': 0,   // DIP (articulation distale)
  'middle': 1, // PIP (articulation proximale)  
  'tip': 2     // Bout du doigt
};

let camera: any | null = null;

// Stocker la référence des handlers pour pouvoir les supprimer
const tapDetectionHandler = (event: any) => {
  console.log('Événement de tap détecté:', event);
  addTapFeedback(event.data.finger, event.data.phalanx);
};

const swipeDetectionHandler = (event: any) => {
  console.log('🎯 Événement de swipe détecté:', event);
  console.log('🎯 Data swipe:', {
    finger: event.data.finger,
    phalanx: event.data.phalanx, 
    direction: event.data.direction,
    swipeCount: event.data.swipeCount
  });
  addSwipeFeedback(event.data.finger, event.data.phalanx, event.data.direction, event.data.swipeCount);
};

const swipeEndedHandler = (event: any) => {
  console.log('Swipe terminé:', event);
  endSwipeFeedback(event.data.finger);
};

onMounted(async () => {
  console.log("Composant monté, initialisation de MediaPipe...");
  
  // Écouter les événements de détection
  eventBus.on('phalanx_tap_detected', tapDetectionHandler);
  eventBus.on('finger_swipe_detected', swipeDetectionHandler);
  eventBus.on('swipe_ended', swipeEndedHandler);
  
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

// Ajouter un feedback visuel pour un tap
const addTapFeedback = (finger: FingerName, phalanx: number) => {
  const feedback: TapFeedback = {
    type: 'tap',
    finger,
    phalanx,
    timestamp: Date.now()
  };
  
  visualFeedbacks.value.push(feedback);
};

// Ajouter un feedback visuel pour un swipe
const addSwipeFeedback = (finger: FingerName, phalanx: number | string, direction: SwipeDirection, swipeCount: number) => {
  // Convertir phalanx string en index si nécessaire
  const phalanxIndex = typeof phalanx === 'string' ? phalanxTypeToIndex[phalanx] : phalanx;
  
  console.log('🔥 Ajout swipe feedback:', { finger, phalanx, phalanxIndex, direction, swipeCount });
  
  const key = `${finger}_${phalanxIndex}`;
  
  // Supprimer les anciens feedbacks du même doigt/phalanx pour éviter l'empilement
  visualFeedbacks.value = visualFeedbacks.value.filter(fb => 
    !(fb.type === 'swipe' && fb.finger === finger && fb.phalanx === phalanxIndex)
  );
  
  const feedback: SwipeFeedback = {
    type: 'swipe',
    finger,
    phalanx: phalanxIndex, // Toujours stocker comme numérique
    direction,
    swipeCount,
    timestamp: Date.now(),
    isActive: true
  };
  
  // Mettre à jour ou créer le swipe actif
  activeSwipes.value.set(key, feedback);
  visualFeedbacks.value.push(feedback);
  
  console.log('🔥 Feedbacks actuels après nettoyage:', visualFeedbacks.value.length);
  console.log('🔥 Swipes actifs:', activeSwipes.value.size);
};

// Terminer un swipe actif
const endSwipeFeedback = (finger: FingerName) => {
  console.log('🏁 Fin de swipe pour:', finger);
  
  // Trouver le swipe actif pour ce doigt
  let endedSwipe = null;
  activeSwipes.value.forEach((swipe, key) => {
    if (swipe.finger === finger) {
      endedSwipe = swipe;
      swipe.isActive = false;
      activeSwipes.value.delete(key);
    }
  });
  
  // Créer un feedback visuel spécial pour montrer la fin du swipe
  if (endedSwipe) {
    const endFeedback: SwipeFeedback = {
      type: 'swipe',
      finger: endedSwipe.finger,
      phalanx: endedSwipe.phalanx,
      direction: 'exit', // Toujours EXIT pour la fin
      swipeCount: endedSwipe.swipeCount,
      timestamp: Date.now(),
      isActive: false
    };
    
    // Supprimer les anciens feedbacks de ce doigt et ajouter le feedback de fin
    visualFeedbacks.value = visualFeedbacks.value.filter(fb => 
      !(fb.type === 'swipe' && fb.finger === finger && fb.phalanx === endedSwipe.phalanx)
    );
    visualFeedbacks.value.push(endFeedback);
    
    console.log('🏁 Ajouté feedback de fin pour:', finger, 'avec', endedSwipe.swipeCount, 'swipes');
  }
};

const drawVisualFeedback = (canvasCtx: CanvasRenderingContext2D, landmarks: any[]) => {
  const currentTime = Date.now();
  const duration = 2000; // 2 secondes pour les taps et swipes terminés
  
  console.log(`🖼️ Drawing feedbacks: ${visualFeedbacks.value.length} total`);
  
  // Nettoyer les feedbacks expirés et dessiner les actifs
  for (let i = visualFeedbacks.value.length - 1; i >= 0; i--) {
    const feedback = visualFeedbacks.value[i];
    const elapsed = currentTime - feedback.timestamp;
    
    let opacity = 1;
    let shouldRemove = false;
    
    if (feedback.type === 'tap') {
      // Les taps disparaissent normalement après 2 secondes
      opacity = Math.max(0, 1 - (elapsed / duration));
      shouldRemove = opacity <= 0;
    } else if (feedback.type === 'swipe') {
      if (feedback.isActive) {
        // Les swipes ACTIFS restent à opacité 1 et ne disparaissent PAS
        opacity = 1;
        shouldRemove = false;
        console.log(`🔥 Swipe actif maintenu: ${feedback.finger} ${feedback.direction}`);
      } else {
        // Les swipes TERMINÉS (EXIT) disparaissent après 2 secondes
        opacity = Math.max(0, 1 - (elapsed / duration));
        shouldRemove = opacity <= 0;
        console.log(`🏁 Swipe terminé fade: ${feedback.finger} opacity=${opacity.toFixed(2)}`);
      }
    }
    
    // Supprimer les feedbacks expirés
    if (shouldRemove) {
      console.log(`🗑️ Suppression feedback expiré: ${feedback.type} ${feedback.finger}`);
      visualFeedbacks.value.splice(i, 1);
      continue;
    }
    
    // S'assurer que phalanx est numérique
    const phalanxIndex = typeof feedback.phalanx === 'number' ? feedback.phalanx : 0;
    
    const fingerIndices = fingerLandmarkIndices[feedback.finger];
    const landmarkIndex = fingerIndices[phalanxIndex];
    
    console.log(`🔍 Looking for ${feedback.finger}[${phalanxIndex}] → landmark ${landmarkIndex}`);
    
    if (landmarks[landmarkIndex]) {
      const landmark = landmarks[landmarkIndex];
      const x = landmark.x * canvasRef.value!.width;
      const y = landmark.y * canvasRef.value!.height;
      
      console.log(`🖼️ Drawing ${feedback.type} for ${feedback.finger} at (${x.toFixed(0)}, ${y.toFixed(0)}) opacity=${opacity.toFixed(2)}`);
      
      if (feedback.type === 'tap') {
        drawTapFeedback(canvasCtx, x, y, feedback, opacity);
      } else if (feedback.type === 'swipe') {
        drawSwipeFeedback(canvasCtx, x, y, feedback, opacity, landmarks);
      }
    } else {
      console.log(`❌ Landmark ${landmarkIndex} not found for ${feedback.finger}[${phalanxIndex}]`);
    }
  }
};

// Dessiner un feedback de tap (cercle pulsant)
const drawTapFeedback = (canvasCtx: CanvasRenderingContext2D, x: number, y: number, feedback: TapFeedback, opacity: number) => {
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
};

// Dessiner un feedback de swipe (flèche directionnelle)
const drawSwipeFeedback = (canvasCtx: CanvasRenderingContext2D, x: number, y: number, feedback: SwipeFeedback, opacity: number, landmarks: any[]) => {
  console.log('🎨 Drawing swipe feedback:', { finger: feedback.finger, direction: feedback.direction, x, y, opacity });
  
  canvasCtx.save();
  canvasCtx.globalAlpha = opacity;
  
  // Couleurs selon la direction
  const directionColors = {
    distal: '#4CAF50',   // Vert pour vers la pointe
    proximal: '#2196F3', // Bleu pour vers la base
    exit: '#F44336'      // Rouge pour sortie
  };
  
  canvasCtx.strokeStyle = directionColors[feedback.direction];
  canvasCtx.fillStyle = directionColors[feedback.direction];
  canvasCtx.lineWidth = 4;
  
  if (feedback.direction === 'exit') {
    // Animation EXIT: X pulsant qui grossit ENTRE la phalange et le pouce
    const thumbTipLandmark = landmarks[4]; // Pouce (tip)
    
    if (thumbTipLandmark) {
      // Coordonnées du pouce
      const thumbX = thumbTipLandmark.x * canvasRef.value!.width;
      const thumbY = thumbTipLandmark.y * canvasRef.value!.height;
      
      // Point milieu entre la phalange et le pouce
      const midX = (x + thumbX) / 2;
      const midY = (y + thumbY) / 2;
      
      const elapsed = Date.now() - feedback.timestamp;
      const pulsePhase = (elapsed % 800) / 800; // Cycle de 800ms
      const pulseFactor = 1 + Math.sin(pulsePhase * Math.PI * 2) * 0.3; // Oscillation ±30%
      const size = 25 * pulseFactor;
      
      canvasCtx.lineWidth = 5 * pulseFactor;
      
      // Dessiner le X animé au point milieu
      canvasCtx.beginPath();
      canvasCtx.moveTo(midX - size, midY - size);
      canvasCtx.lineTo(midX + size, midY + size);
      canvasCtx.moveTo(midX + size, midY - size);
      canvasCtx.lineTo(midX - size, midY + size);
      canvasCtx.stroke();
      
      // Cercle externe pulsant
      canvasCtx.globalAlpha = opacity * 0.2;
      canvasCtx.beginPath();
      canvasCtx.arc(midX, midY, size * 1.5, 0, 2 * Math.PI);
      canvasCtx.fill();
      
      // Ligne de connexion subtile entre phalange et pouce (optionnel)
      canvasCtx.globalAlpha = opacity * 0.15;
      canvasCtx.lineWidth = 2;
      canvasCtx.setLineDash([5, 5]); // Ligne pointillée
      canvasCtx.beginPath();
      canvasCtx.moveTo(x, y);
      canvasCtx.lineTo(thumbX, thumbY);
      canvasCtx.stroke();
      canvasCtx.setLineDash([]); // Remettre ligne continue
      
      console.log(`🎨 Drew EXIT X between finger (${x}, ${y}) and thumb (${thumbX}, ${thumbY}) at mid (${midX}, ${midY})`);
    } else {
      // Fallback: dessiner au niveau de la phalange si le pouce n'est pas détecté
      const elapsed = Date.now() - feedback.timestamp;
      const pulsePhase = (elapsed % 800) / 800;
      const pulseFactor = 1 + Math.sin(pulsePhase * Math.PI * 2) * 0.3;
      const size = 25 * pulseFactor;
      
      canvasCtx.lineWidth = 5 * pulseFactor;
      
      canvasCtx.beginPath();
      canvasCtx.moveTo(x - size, y - size);
      canvasCtx.lineTo(x + size, y + size);
      canvasCtx.moveTo(x + size, y - size);
      canvasCtx.lineTo(x - size, y + size);
      canvasCtx.stroke();
      
      console.log(`🎨 Drew EXIT X fallback at finger position (thumb not detected)`);
    }
  } else {
    // Dessiner une vraie flèche directionnelle
    const fingerIndices = fingerLandmarkIndices[feedback.finger];
    const baseLandmark = landmarks[fingerIndices[0]]; // Base du doigt
    const tipLandmark = landmarks[fingerIndices[2]];  // Pointe du doigt
    
    if (baseLandmark && tipLandmark) {
      const baseX = baseLandmark.x * canvasRef.value!.width;
      const baseY = baseLandmark.y * canvasRef.value!.height;
      const tipX = tipLandmark.x * canvasRef.value!.width;
      const tipY = tipLandmark.y * canvasRef.value!.height;
      
      // Calculer la direction du doigt
      const fingerDx = tipX - baseX;
      const fingerDy = tipY - baseY;
      const fingerLength = Math.sqrt(fingerDx * fingerDx + fingerDy * fingerDy);
      
      if (fingerLength > 0) {
        // Normaliser le vecteur direction du doigt
        const unitX = fingerDx / fingerLength;
        const unitY = fingerDy / fingerLength;
        
        // Direction de la flèche selon le swipe
        const arrowDirection = feedback.direction === 'distal' ? 1 : -1;
        const baseArrowLength = 35;
        const swipeBonus = Math.min(feedback.swipeCount * 4, 20); // Max +20px
        const arrowLength = baseArrowLength + swipeBonus;
        
        const endX = x + (unitX * arrowLength * arrowDirection);
        const endY = y + (unitY * arrowLength * arrowDirection);
        
        // Animation: légère pulsation pour les swipes actifs
        let lineWidth = 4;
        if (feedback.isActive) {
          const elapsed = Date.now() - feedback.timestamp;
          const pulseFactor = 1 + Math.sin((elapsed % 600) / 600 * Math.PI * 2) * 0.2;
          lineWidth = 4 * pulseFactor;
        }
        canvasCtx.lineWidth = lineWidth;
        
        // Dessiner la ligne principale de la flèche
        canvasCtx.beginPath();
        canvasCtx.moveTo(x, y);
        canvasCtx.lineTo(endX, endY);
        canvasCtx.stroke();
        
        // Dessiner la pointe de la flèche
        const arrowHeadSize = 12 + (feedback.swipeCount * 2); // Pointe grandit aussi
        const angle = Math.atan2(endY - y, endX - x);
        const arrowAngle = Math.PI / 6; // 30 degrés
        
        canvasCtx.beginPath();
        canvasCtx.moveTo(endX, endY);
        canvasCtx.lineTo(
          endX - arrowHeadSize * Math.cos(angle - arrowAngle),
          endY - arrowHeadSize * Math.sin(angle - arrowAngle)
        );
        canvasCtx.moveTo(endX, endY);
        canvasCtx.lineTo(
          endX - arrowHeadSize * Math.cos(angle + arrowAngle),
          endY - arrowHeadSize * Math.sin(angle + arrowAngle)
        );
        canvasCtx.stroke();
        
        // Remplir la pointe pour la rendre plus visible
        canvasCtx.beginPath();
        canvasCtx.moveTo(endX, endY);
        canvasCtx.lineTo(
          endX - arrowHeadSize * Math.cos(angle - arrowAngle),
          endY - arrowHeadSize * Math.sin(angle - arrowAngle)
        );
        canvasCtx.lineTo(
          endX - arrowHeadSize * Math.cos(angle + arrowAngle),
          endY - arrowHeadSize * Math.sin(angle + arrowAngle)
        );
        canvasCtx.closePath();
        canvasCtx.fill();
        
        // Cercle de base semi-transparent
        canvasCtx.globalAlpha = opacity * 0.3;
        const baseRadius = 8 + feedback.swipeCount;
        canvasCtx.beginPath();
        canvasCtx.arc(x, y, baseRadius, 0, 2 * Math.PI);
        canvasCtx.fill();
        
        // Afficher le compteur près de la pointe
        if (feedback.swipeCount > 1) {
          canvasCtx.globalAlpha = 1;
          canvasCtx.font = 'bold 14px Arial';
          canvasCtx.fillStyle = '#FFFFFF';
          canvasCtx.strokeStyle = '#000000';
          canvasCtx.lineWidth = 3;
          const counterText = `${feedback.swipeCount}`;
          
          // Position du compteur près de la pointe
          const counterX = endX + (unitX * 15);
          const counterY = endY + (unitY * 15);
          
          canvasCtx.strokeText(counterText, counterX, counterY);
          canvasCtx.fillText(counterText, counterX, counterY);
        }
        
        // Effet de traînée pour les swipes actifs
        if (feedback.isActive) {
          canvasCtx.globalAlpha = opacity * 0.1;
          canvasCtx.lineWidth = 8;
          canvasCtx.beginPath();
          canvasCtx.moveTo(x, y);
          canvasCtx.lineTo(endX, endY);
          canvasCtx.stroke();
          
          // Ligne de connexion entre le pouce et la phalange pendant le swipe
          const thumbTipLandmark = landmarks[4]; // Pouce (tip)
          if (thumbTipLandmark) {
            const thumbX = thumbTipLandmark.x * canvasRef.value!.width;
            const thumbY = thumbTipLandmark.y * canvasRef.value!.height;
            
            canvasCtx.globalAlpha = opacity * 0.4;
            canvasCtx.strokeStyle = '#FFFFFF'; // Blanc pour contraster
            canvasCtx.lineWidth = 3;
            canvasCtx.setLineDash([8, 6]); // Ligne pointillée plus visible
            canvasCtx.beginPath();
            canvasCtx.moveTo(x, y);
            canvasCtx.lineTo(thumbX, thumbY);
            canvasCtx.stroke();
            canvasCtx.setLineDash([]); // Remettre ligne continue
            
            // Petit cercle sur le pouce pour marquer la connexion
            canvasCtx.globalAlpha = opacity * 0.6;
            canvasCtx.fillStyle = '#FFFFFF';
            canvasCtx.beginPath();
            canvasCtx.arc(thumbX, thumbY, 4, 0, 2 * Math.PI);
            canvasCtx.fill();
            
            console.log(`🔗 Drew connection line between active swipe and thumb at (${thumbX}, ${thumbY})`);
          }
        }
        
        console.log(`🎨 Drew ${feedback.direction} arrow, length=${arrowLength}, count=${feedback.swipeCount}`);
      }
    } else {
      // Fallback: flèche basique si les landmarks ne sont pas disponibles
      const arrowLength = 40 + (feedback.swipeCount * 5);
      const arrowAngle = feedback.direction === 'distal' ? 0 : Math.PI; // 0° pour droite, 180° pour gauche
      
      const endX = x + Math.cos(arrowAngle) * arrowLength;
      const endY = y + Math.sin(arrowAngle) * arrowLength;
      
      // Ligne principale
      canvasCtx.beginPath();
      canvasCtx.moveTo(x, y);
      canvasCtx.lineTo(endX, endY);
      canvasCtx.stroke();
      
      // Pointe
      const headSize = 15;
      canvasCtx.beginPath();
      canvasCtx.moveTo(endX, endY);
      canvasCtx.lineTo(endX - headSize * Math.cos(arrowAngle - Math.PI/6), endY - headSize * Math.sin(arrowAngle - Math.PI/6));
      canvasCtx.moveTo(endX, endY);
      canvasCtx.lineTo(endX - headSize * Math.cos(arrowAngle + Math.PI/6), endY - headSize * Math.sin(arrowAngle + Math.PI/6));
      canvasCtx.stroke();
      
      console.log('🎨 Drew fallback arrow');
    }
  }
  
  canvasCtx.restore();
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
  // Nettoyer les listeners d'événements pour éviter les fuites mémoire
  eventBus.off('phalanx_tap_detected', tapDetectionHandler);
  eventBus.off('finger_swipe_detected', swipeDetectionHandler);
  eventBus.off('swipe_ended', swipeEndedHandler);
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