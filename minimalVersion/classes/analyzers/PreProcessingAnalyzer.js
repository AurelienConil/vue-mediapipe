import { BaseGestureAnalyzer } from "./BaseGestureAnalyzer.js";

/**
 * PreProcessingAnalyzer - Normalise et prépare les données
 * Applique le centrage et la normalisation inspirées des PreProcessors
 */
export class PreProcessingAnalyzer extends BaseGestureAnalyzer {
  constructor() {
    super();
    this.previousFrame = null;
    this.centeringEnabled = true;
    this.normalisationEnabled = true;
  }

  /**
   * Centre les landmarks sur l'origine (0,0,0)
   * Soustrait la position du poignet (landmark[0]) de tous les points
   */
  centerLandmarks(landmarks) {
    if (!landmarks || landmarks.length === 0) {
      return landmarks;
    }

    const wrist = landmarks[0];
    if (!wrist) return landmarks;

    const offsetX = wrist.x;
    const offsetY = wrist.y;
    const offsetZ = wrist.z;

    return landmarks.map((landmark) => ({
      ...landmark,
      x: landmark.x - offsetX,
      y: landmark.y - offsetY,
      z: (landmark.z || 0) - offsetZ,
    }));
  }

  /**
   * Normalise la taille de la main
   * Utilise la distance entre les points 5 et 17 (index MCP et pinky MCP) comme référence
   */
  normaliseLandmarks(landmarks) {
    if (!landmarks || landmarks.length < 18) {
      return landmarks;
    }

    const p5 = landmarks[5];
    const p17 = landmarks[17];

    if (!p5 || !p17) {
      return landmarks;
    }

    const dx = p17.x - p5.x;
    const dy = p17.y - p5.y;
    const dz = (p17.z || 0) - (p5.z || 0);
    const norm = Math.sqrt(dx * dx + dy * dy + dz * dz) * 8.0;

    if (norm === 0) {
      return landmarks;
    }

    return landmarks.map((landmark) => ({
      ...landmark,
      x: landmark.x / norm,
      y: landmark.y / norm,
      z: (landmark.z || 0) / norm,
    }));
  }

  handle(data) {
    if (!data || !data.multiHandLandmarks || data.multiHandLandmarks.length === 0) {
      return data;
    }

    // Stocker le frame précédent pour calculer la vélocité
    const normalized = {
      ...data,
      analysis: data.analysis || {},
      preprocessed: {
        hands: data.multiHandLandmarks.map((landmarks, handIndex) => {
          // Convertir les landmarks en format standard
          let processedLandmarks = landmarks.map((lm, idx) => ({
            originalIndex: idx,
            x: lm.x,
            y: lm.y,
            z: lm.z || 0,
            visibility: lm.visibility || 1,
          }));

          // Appliquer le centrage
          if (this.centeringEnabled) {
            processedLandmarks = this.centerLandmarks(processedLandmarks);
          }

          // Appliquer la normalisation
          if (this.normalisationEnabled) {
            processedLandmarks = this.normaliseLandmarks(processedLandmarks);
          }

          return {
            handIndex,
            landmarks: processedLandmarks,
            timestamp: data.timestamp || Date.now(),
            previousFrame: this.previousFrame?.[handIndex] || null,
          };
        }),
      },
    };

    // Sauvegarder ce frame pour le prochain
    this.previousFrame = normalized.preprocessed.hands;

    return normalized;
  }
}
