
/**
 * LandmarksRenderer - Dessine les landmarks bruts des mains
 */
export class LandmarksRenderer {
  constructor(canvasManager) {
    const { drawLandmarks, drawConnectors } = window;
    this.drawLandmarks = drawLandmarks;
    this.drawConnectors = drawConnectors;
    this.canvasManager = canvasManager;

    // Index des doigts pour le mapping feedback
    this.FINGER_INDICES = {
      thumb: [0, 2, 3, 4],
      index: [5, 6, 7, 8],
      middle: [9, 10, 11, 12],
      ring: [13, 14, 15, 16],
      pinky: [17, 18, 19, 20],
    };

    this.HAND_CONNECTIONS = [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [0, 5], [5, 6], [6, 7], [7, 8],
      [5, 9], [9, 10], [10, 11], [11, 12],
      [9, 13], [13, 14], [14, 15], [15, 16],
      [13, 17], [17, 18], [18, 19], [19, 20],
      [17, 0], [0, 5], [5, 9], [9, 13], [13, 17],
    ];

    // Liste interne des feedbacks actifs
    this.activeFeedbacks = [];

    // associate state "touch" , "release" to colors for visual feedback
    this.connectorColorList = [
      { state: "touch", color: "#192396" },
      { state: "release", color: "#00ff00" }
    ]
    this.actualConnectorColors = "#00ff00";

    this.hasPeak = [];
    this.peakDuration = 900; // ms
  }

  /**
   * Dessine les landmarks bruts
   */
  render(multiHandLandmarks) {
    const ctx = this.canvasManager.getContext();

    if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
      return;
    }

    for (const landmarks of multiHandLandmarks) {
      // Connexions
      try {
        this.drawConnectors(ctx, landmarks, this.HAND_CONNECTIONS, {
          color: this.actualConnectorColors,
          lineWidth: 2,
        });
      } catch (e) {
        // drawConnectors non disponible
      }

      // Points
      this.drawLandmarks(ctx, landmarks, {
        color: "#00FF00",
        lineWidth: 1,
        radius: 2,
      });

      //Peaks
      this.renderPeaks(multiHandLandmarks);
    }
  }

  renderPeaks(multiHandLandmarks) {
    const ctx = this.canvasManager.getContext();
    if (!multiHandLandmarks || multiHandLandmarks.length === 0) return;
    const now = Date.now();
    // Nettoyer les peaks expirés
    this.hasPeak = this.hasPeak.filter(peak => peak.expiresAt > now);
    if (this.hasPeak.length === 0) return;
    this.hasPeak.forEach(peak => {
      const { finger, phalanx } = peak;
      for (const landmarks of multiHandLandmarks) {
        const indices = this.FINGER_INDICES[finger];
        if (!indices) continue;
        const pointIdx = indices[phalanx];
        if (typeof pointIdx !== "number") continue;
        const landmark = landmarks[pointIdx];
        if (!landmark) continue;
        const x = landmark.x * this.canvasManager.canvas.width;
        const y = landmark.y * this.canvasManager.canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fillStyle = "#eb1241";
        ctx.globalAlpha = 0.7;
        ctx.fill();
        ctx.globalAlpha = 0.2;
        ctx.strokeStyle = "#000909";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = "12px Arial";
        ctx.fillStyle = "#000909";
        ctx.globalAlpha = 1.0;
        ctx.fillText(Math.floor(peak.totalScore), x - 10, y - 15);
        //ctx.fillText(Math.floor(peak.adaptiveSpeedScore), x - 10, y - 30);
      }
    });
  }

  /**
   * Applique le feedback visuel sur les landmarks
   */
  applyFeedback(state, feedbacks, hasPeak) {
    const now = Date.now();

    // if (hasPeak && Array.isArray(hasPeak) && hasPeak.length > 0) {
    //   // Ajoute chaque nouveau peak avec une date d'expiration
    //   hasPeak.forEach(peak => {
    //     // Empêche les doublons exacts (même finger/phalanx)
    //     const already = this.hasPeak.find(p => p.finger === peak.finger && p.phalanx === peak.phalanx);
    //     if (!already) {
    //       this.hasPeak.push({ ...peak, expiresAt: now + this.peakDuration });
    //     }
    //   });
    // }
    // Ne pas vider this.hasPeak ici, ils expirent d'eux-mêmes

    this.actualConnectorColors = this.connectorColorList.find(c => c.state === state)?.color || "#00ff00";

    // Ajoute simplement les nouveaux feedbacks à la liste interne
    if (!Array.isArray(feedbacks)) return;
    feedbacks.forEach(newFb => {

      // deactive feedback
      this.activeFeedbacks.push(newFb);
      console.log("[LandmarksRenderer] New feedback applied:", newFb.type);
    });
  }

  renderActiveFeedbacks(multiHandLandmarks) {
    const ctx = this.canvasManager.getContext();
    if (!multiHandLandmarks || multiHandLandmarks.length === 0) return;
    const now = Date.now();
    // Nettoyer les feedbacks expirés
    this.activeFeedbacks = this.activeFeedbacks.filter(fb => fb.expiresAt > now);
    // Rendu de tous les feedbacks actifs
    this.activeFeedbacks.forEach(fb => {
      if (fb.type === "touch") {
        for (const landmarks of multiHandLandmarks) {
          const indices = this.FINGER_INDICES[fb.finger];
          if (!indices) continue;
          const phalanxIdx = typeof fb.phalanx === "number" ? fb.phalanx : 2;
          const pointIdx = indices[phalanxIdx];
          if (typeof pointIdx !== "number") continue;
          const landmark = landmarks[pointIdx];
          if (!landmark) continue;
          const x = landmark.x * this.canvasManager.canvas.width;
          const y = landmark.y * this.canvasManager.canvas.height;
          ctx.beginPath();
          ctx.arc(x, y, 20, 0, 2 * Math.PI);
          ctx.fillStyle = "#FFD600";
          ctx.globalAlpha = 0.3;
          ctx.fill();
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = "#ff0000";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else if (fb.type === "swipe") {
        console.log("[LandmarksRenderer] Rendering swipe feedback:", fb);
        for (const landmarks of multiHandLandmarks) {
          const indices = this.FINGER_INDICES[fb.finger];
          if (!indices) continue;
          // Déterminer le sens de la flèche selon la direction du swipe
          let fromIdx, toIdx;
          if (fb.direction === "distal") {
            // base → tip
            fromIdx = indices[fb.phalanx];
            toIdx = indices[fb.phalanx+1];
          } else if (fb.direction === "proximal") {
            // tip → base
            fromIdx = indices[fb.phalanx];
            toIdx = indices[fb.phalanx-1];
          } else {
            // fallback : phalanx → base
            fromIdx = indices[fb.phalanx] || indices[2];
            toIdx = indices[0];
          }
          const from = landmarks[fromIdx];
          const to = landmarks[toIdx];
          if (!from || !to) continue;
          const x1 = from.x * this.canvasManager.canvas.width;
          const y1 = from.y * this.canvasManager.canvas.height;
          const x2 = to.x * this.canvasManager.canvas.width;
          const y2 = to.y * this.canvasManager.canvas.height;
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = "#00B8FF";
          ctx.lineWidth = 2;
          ctx.stroke();
          // Dessiner la tête de flèche
          const angle = Math.atan2(y2 - y1, x2 - x1);
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 - 9 * Math.cos(angle - 0.3), y2 - 9 * Math.sin(angle - 0.3));
          ctx.lineTo(x2 - 9 * Math.cos(angle + 0.3), y2 - 9 * Math.sin(angle + 0.3));
          ctx.lineTo(x2, y2);
          ctx.fillStyle = "#00B8FF";
          ctx.fill();
          ctx.restore();
        }
      } else if (fb.type === "release") {
        for (const landmarks of multiHandLandmarks) {
          const indices = this.FINGER_INDICES[fb.finger];
          const thumbIdx = this.FINGER_INDICES.thumb[2];
          const fingerIdx = indices ? indices[typeof fb.phalanx === "number" ? fb.phalanx : 2] : null;
          if (typeof fingerIdx !== "number" || typeof thumbIdx !== "number") continue;
          const p1 = landmarks[thumbIdx];
          const p2 = landmarks[fingerIdx];
          if (!p1 || !p2) continue;
          const x1 = p1.x * this.canvasManager.canvas.width;
          const y1 = p1.y * this.canvasManager.canvas.height;
          const x2 = p2.x * this.canvasManager.canvas.width;
          const y2 = p2.y * this.canvasManager.canvas.height;
          const cx = (x1 + x2) / 2;
          const cy = (y1 + y2) / 2;
          ctx.save();
          ctx.strokeStyle = "#FF1744";
          ctx.lineWidth = 6;
          ctx.beginPath();
          ctx.moveTo(cx - 18, cy - 18);
          ctx.lineTo(cx + 18, cy + 18);
          ctx.moveTo(cx + 18, cy - 18);
          ctx.lineTo(cx - 18, cy + 18);
          ctx.stroke();
          ctx.restore();
        }
      }
    });
  }
}
