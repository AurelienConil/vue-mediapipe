import { BaseGestureAnalyzer } from "./BaseGestureAnalyzer.js";

/**
 * FeatureExtractingAnalyzer - Calcule les distances et vitesses
 * pour tous les doigts et les 3 phalanges (MCP, PIP, TIP)
 */
export class FeatureExtractingAnalyzer extends BaseGestureAnalyzer {
  constructor() {
    super();

    // Mapping des landmarks pour chaque doigt (base, middle, tip) : indices 1,2,3
    // MCP (phalange 0) ignorée !
    this.FINGER_LANDMARKS = {
      thumb: { base: 2, middle: 3, tip: 4 },
      index: { base: 6, middle: 7, tip: 8 },
      middle: { base: 10, middle: 11, tip: 12 },
      ring: { base: 14, middle: 15, tip: 16 },
      pinky: { base: 18, middle: 19, tip: 20 }
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

    // 1. Distances inter-doigts: pouce vers chaque phalange (base, middle, tip) des autres doigts
    const thumbTip = hand.landmarks[this.FINGER_LANDMARKS.thumb.tip];

    for (const [fingerName, landmarks] of Object.entries(this.FINGER_LANDMARKS)) {
      if (fingerName === 'thumb') continue;

      // Distance du TIP du pouce vers chaque phalange (base, middle, tip)
      for (const [phalangeName, landmarkIdx] of Object.entries(landmarks)) {
        // phalangeName: base, middle, tip (indices 1,2,3)
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

    // 2. Distances intra-doigt: mesure de flexion pour chaque doigt (base, middle, tip)
    for (const [fingerName, landmarks] of Object.entries(this.FINGER_LANDMARKS)) {
      const baseLandmark = hand.landmarks[landmarks.base];
      const middleLandmark = hand.landmarks[landmarks.middle];
      const tipLandmark = hand.landmarks[landmarks.tip];

      // Distance base-middle (phalange basse)
      if (this.isValidPoint(baseLandmark) && this.isValidPoint(middleLandmark)) {
        const distance = this.calculateDistance3D(baseLandmark, middleLandmark);
        const featureKey = `${fingerName}_base_middle_dist`;
        const prevValue = this.previousValues.get(featureKey);
        if (prevValue && prevValue.timestamp !== undefined) {
          const dt = (hand.timestamp - prevValue.timestamp) / 1000;
          if (dt > 0) {
            const distanceSpeed = Math.abs(distance - prevValue.value) / dt;
            features.push({
              name: `${fingerName}_base_middle_distspeed`,
              value: distanceSpeed,
              timestamp: hand.timestamp,
              handIndex: hand.handIndex,
            });
          }
        }
        features.push({
          name: `${fingerName}_base_middle_dist`,
          value: distance,
          timestamp: hand.timestamp,
          handIndex: hand.handIndex,
        });
        this.previousValues.set(featureKey, {
          value: distance,
          timestamp: hand.timestamp
        });
      }

      // Distance middle-tip (phalange du milieu)
      if (this.isValidPoint(middleLandmark) && this.isValidPoint(tipLandmark)) {
        const distance = this.calculateDistance3D(middleLandmark, tipLandmark);
        const featureKey = `${fingerName}_middle_tip_dist`;
        const prevValue = this.previousValues.get(featureKey);
        if (prevValue && prevValue.timestamp !== undefined) {
          const dt = (hand.timestamp - prevValue.timestamp) / 1000;
          if (dt > 0) {
            const distanceSpeed = Math.abs(distance - prevValue.value) / dt;
            features.push({
              name: `${fingerName}_middle_tip_distspeed`,
              value: distanceSpeed,
              timestamp: hand.timestamp,
              handIndex: hand.handIndex,
            });
          }
        }
        features.push({
          name: `${fingerName}_middle_tip_dist`,
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
