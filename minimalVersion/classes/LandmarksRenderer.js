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
          color: "#00FF00",
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
    }
  }

  /**
   * Applique le feedback visuel sur les landmarks
   */
  applyFeedback(multiHandLandmarks, visualFeedback) {
    const ctx = this.canvasManager.getContext();

    if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
      return;
    }

    for (const landmarks of multiHandLandmarks) {
      landmarks.forEach((landmark, index) => {
        // Trouver le doigt correspondant
        let fingerName = null;
        for (const [name, indices] of Object.entries(this.FINGER_INDICES)) {
          if (indices.includes(index)) {
            fingerName = name;
            break;
          }
        }

        // Appliquer le style du feedback
        const color = visualFeedback.colors[fingerName] || null;
        const size = visualFeedback.sizes[fingerName] || null;

        if (color || size) {
          const x = landmark.x * this.canvasManager.canvas.width;
          const y = landmark.y * this.canvasManager.canvas.height;
          const radius = size || 2;

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, 2 * Math.PI);
          ctx.fillStyle = color || "#00FF00";
          ctx.fill();
          ctx.strokeStyle = color || "#00FF00";
          ctx.lineWidth = size ? 2 : 1;
          ctx.stroke();
        }
      });
    }
  }
}
