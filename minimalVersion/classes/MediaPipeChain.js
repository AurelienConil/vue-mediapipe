import { HandsDetector } from "./HandsDetector.js";
import { CanvasManager } from "./CanvasManager.js";
import { LandmarksRenderer } from "./LandmarksRenderer.js";
import { CameraCapture } from "./CameraCapture.js";
import { GestureAnalysisChain } from "./analyzers/GestureAnalysisChain.js";

/**
 * MediaPipeChain - Simple orchestration
 * 1. Capture vidéo
 * 2. Détection mains
 * 3. Affichage landmarks bruts
 * 4. Analyse via chaîne de responsabilité (analyzers)
 * 5. Feedback visuel
 */
export class MediaPipeChain {
  constructor(videoElement, canvasElement) {
    this.handsDetector = new HandsDetector();
    this.canvasManager = new CanvasManager(canvasElement);
    this.landmarksRenderer = new LandmarksRenderer(this.canvasManager);
    this.cameraCapture = new CameraCapture(videoElement);
    this.gestureAnalysis = new GestureAnalysisChain();

    this.setupPipeline();
  }

  setupPipeline() {
    this.cameraCapture.setFrameCallback(async (videoElement) => {
      // 1. Détection mains
      const detectionResults = await this.handsDetector.process(videoElement);

      if (!detectionResults.image) {
        return;
      }

      // 2. Redimensionner et afficher la vidéo
      this.canvasManager.resize(
        detectionResults.image.width,
        detectionResults.image.height
      );
      this.canvasManager.clear();
      this.canvasManager.drawImage(detectionResults.image);

      // 3. Afficher landmarks bruts
      this.landmarksRenderer.render(detectionResults.multiHandLandmarks);

      // 4. Analyser les gestes via la chaîne
      const analyzedData = this.gestureAnalysis.analyze(detectionResults);

      const touchEvent = analyzedData?.analysis?.touchEvent;
      if (touchEvent) {
        console.log("[MediaPipeChain] touchEvent:", touchEvent);
      }

      // 5. Extraire et appliquer le feedback visuel
      // const visualFeedback =
      //   this.gestureAnalysis.extractVisualFeedback(analyzedData);

      // if (
      //   visualFeedback.highlightedPoints.size > 0 &&
      //   detectionResults.multiHandLandmarks
      // ) {
      //   this.landmarksRenderer.applyFeedback(
      //     detectionResults.multiHandLandmarks,
      //     visualFeedback
      //   );
      // }
    });
  }

  async start() {
    try {
      await this.cameraCapture.start();
      console.log("MediaPipe chain started");
    } catch (error) {
      console.error("Error starting MediaPipe chain:", error);
      throw error;
    }
  }

  async stop() {
    try {
      await this.cameraCapture.stop();
      console.log("MediaPipe chain stopped");
    } catch (error) {
      console.error("Error stopping MediaPipe chain:", error);
      throw error;
    }
  }
}
