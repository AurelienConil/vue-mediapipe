import { BaseGestureAnalyzer } from "./BaseGestureAnalyzer.js";

/**
 * FeatureExtractingAnalyzer - Calcule les distances et vitesses
 * pour tous les doigts et les 3 phalanges (MCP, PIP, TIP)
 */
export class FeatureExtractingAnalyzer extends BaseGestureAnalyzer {
  constructor() {
    super();

    // Mapping des landmarks pour chaque doigt (MCP, PIP, TIP)
    this.FINGER_LANDMARKS = {
      thumb: { mcp: 2, pip: 3, tip: 4 },
      index: { mcp: 5, pip: 6, tip: 8 },
      middle: { mcp: 9, pip: 10, tip: 12 },
      ring: { mcp: 13, pip: 14, tip: 16 },
      pinky: { mcp: 17, pip: 18, tip: 20 }
    };

    // Cache pour stocker les valeurs précédentes pour le calcul de vélocité
    this.previousValues = new Map();
  }

  handle(data) {
    if (!data.preprocessed) {
      return data;
    }

    data.analysis.features = [];
    data.analysis.distancesAndVelocities = [];

    data.preprocessed.hands.forEach((hand) => {
      const features = {
        handIndex: hand.handIndex,
        distancesAndVelocities: this.calculateDistancesAndVelocities(hand),
      };

      data.analysis.features.push(features);
      data.analysis.distancesAndVelocities.push(...features.distancesAndVelocities);
    });

    return data;
  }

  /**
   * Calcule les distances et vélocités pour tous les doigts et leurs 3 phalanges
   */
  calculateDistancesAndVelocities(hand) {
    const features = [];

    if (!hand.landmarks || hand.landmarks.length < 21) {
      return features;
    }

    // 1. Distances inter-doigts: pouce vers chaque phalange des autres doigts
    const thumbTip = hand.landmarks[this.FINGER_LANDMARKS.thumb.tip];

    for (const [fingerName, landmarks] of Object.entries(this.FINGER_LANDMARKS)) {
      if (fingerName === 'thumb') continue;

      // Distance du TIP du pouce vers chaque phalange
      for (const [phalangeName, landmarkIdx] of Object.entries(landmarks)) {
        const fingerLandmark = hand.landmarks[landmarkIdx];

        if (!this.isValidPoint(thumbTip) || !this.isValidPoint(fingerLandmark)) {
          continue;
        }

        const distance = this.calculateDistance3D(thumbTip, fingerLandmark);

        // Calcul de la vélocité de la distance
        const featureKey = `thumb_to_${fingerName}_${phalangeName}_dist`;
        const prevValue = this.previousValues.get(featureKey);

        if (prevValue && prevValue.timestamp !== undefined) {
          const dt = (hand.timestamp - prevValue.timestamp) / 1000; // en secondes
          if (dt > 0) {
            const distanceSpeed = Math.abs(distance - prevValue.value) / dt;
            features.push({
              name: `thumb_to_${fingerName}_${phalangeName}_distspeed`,
              value: distanceSpeed,
              timestamp: hand.timestamp,
              handIndex: hand.handIndex,
            });
          }
        }

        // Ajouter la feature de distance
        features.push({
          name: `thumb_to_${fingerName}_${phalangeName}_dist`,
          value: distance,
          timestamp: hand.timestamp,
          handIndex: hand.handIndex,
        });

        // Mettre à jour le cache
        this.previousValues.set(featureKey, {
          value: distance,
          timestamp: hand.timestamp
        });
      }
    }

    // 2. Distances intra-doigt: mesure de flexion pour chaque doigt
    for (const [fingerName, landmarks] of Object.entries(this.FINGER_LANDMARKS)) {
      const mcpLandmark = hand.landmarks[landmarks.mcp];
      const pipLandmark = hand.landmarks[landmarks.pip];
      const tipLandmark = hand.landmarks[landmarks.tip];

      // Distance MCP-PIP (phalange basse)
      if (this.isValidPoint(mcpLandmark) && this.isValidPoint(pipLandmark)) {
        const distance = this.calculateDistance3D(mcpLandmark, pipLandmark);
        const featureKey = `${fingerName}_mcp_pip_dist`;
        const prevValue = this.previousValues.get(featureKey);

        if (prevValue && prevValue.timestamp !== undefined) {
          const dt = (hand.timestamp - prevValue.timestamp) / 1000;
          if (dt > 0) {
            const distanceSpeed = Math.abs(distance - prevValue.value) / dt;
            features.push({
              name: `${fingerName}_mcp_pip_distspeed`,
              value: distanceSpeed,
              timestamp: hand.timestamp,
              handIndex: hand.handIndex,
            });
          }
        }

        features.push({
          name: `${fingerName}_mcp_pip_dist`,
          value: distance,
          timestamp: hand.timestamp,
          handIndex: hand.handIndex,
        });

        this.previousValues.set(featureKey, {
          value: distance,
          timestamp: hand.timestamp
        });
      }

      // Distance PIP-TIP (phalange du milieu)
      if (this.isValidPoint(pipLandmark) && this.isValidPoint(tipLandmark)) {
        const distance = this.calculateDistance3D(pipLandmark, tipLandmark);
        const featureKey = `${fingerName}_pip_tip_dist`;
        const prevValue = this.previousValues.get(featureKey);

        if (prevValue && prevValue.timestamp !== undefined) {
          const dt = (hand.timestamp - prevValue.timestamp) / 1000;
          if (dt > 0) {
            const distanceSpeed = Math.abs(distance - prevValue.value) / dt;
            features.push({
              name: `${fingerName}_pip_tip_distspeed`,
              value: distanceSpeed,
              timestamp: hand.timestamp,
              handIndex: hand.handIndex,
            });
          }
        }

        features.push({
          name: `${fingerName}_pip_tip_dist`,
          value: distance,
          timestamp: hand.timestamp,
          handIndex: hand.handIndex,
        });

        this.previousValues.set(featureKey, {
          value: distance,
          timestamp: hand.timestamp
        });
      }
    }

    return features;
  }

  /**
   * Calcule la distance euclidienne 3D entre deux points
   */
  calculateDistance3D(point1, point2) {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    const dz = (point1.z || 0) - (point2.z || 0);

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Valide qu'un point est valide (coordonnées finies et dans la plage raisonnable)
   */
  isValidPoint(point) {
    if (!point) return false;

    const { x, y, z } = point;

    // Vérifier que les coordonnées sont des nombres finis
    if (!isFinite(x) || !isFinite(y) || !isFinite(z || 0)) return false;

    // Vérifier que les coordonnées sont dans une plage raisonnable
    if (x < -5 || x > 5 || y < -5 || y > 5) return false;
    if ((z || 0) < -5 || (z || 0) > 5) return false;

    return true;
  }
}
