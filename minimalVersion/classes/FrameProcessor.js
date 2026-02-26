import { ResizeCanvasProcessor } from "./processors/ResizeCanvasProcessor.js";
import { ClearCanvasProcessor } from "./processors/ClearCanvasProcessor.js";
import { DrawImageProcessor } from "./processors/DrawImageProcessor.js";
import { DrawLandmarksProcessor } from "./processors/DrawLandmarksProcessor.js";
import { RestoreContextProcessor } from "./processors/RestoreContextProcessor.js";
import { GestureAnalysisChain } from "./analyzers/GestureAnalysisChain.js";

/**
 * FrameProcessor - Orchestre deux pipelines parallèles :
 * 1. Pipeline de rendu : affiche les landmarks bruts
 * 2. Pipeline d'analyse : analyse les gestes et génère un feedback visuel
 */
export class FrameProcessor {
  constructor(canvasManager, landmarksRenderer) {
    this.canvasManager = canvasManager;
    this.landmarksRenderer = landmarksRenderer;

    // Initialiser la chaîne d'analyse des gestes
    this.gestureAnalysis = new GestureAnalysisChain();

    // Construire le pipeline de rendu
    this.processingChain = this.buildProcessingChain();
  }

  /**
   * Construit la chaîne de rendu
   */
  buildProcessingChain() {
    const resizeProcessor = new ResizeCanvasProcessor(this.canvasManager);
    const clearProcessor = new ClearCanvasProcessor(this.canvasManager);
    const drawImageProcessor = new DrawImageProcessor(this.canvasManager);
    const drawLandmarksProcessor = new DrawLandmarksProcessor(
      this.landmarksRenderer
    );
    const restoreProcessor = new RestoreContextProcessor(this.canvasManager);

    resizeProcessor
      .setNext(clearProcessor)
      .setNext(drawImageProcessor)
      .setNext(drawLandmarksProcessor)
      .setNext(restoreProcessor);

    return resizeProcessor;
  }

  /**
   * Traite les résultats de détection :
   * 1. Analyse les gestes
   * 2. Passe les données enrichies par le rendu
   * @param {Object} detectionResults - Les résultats de détection
   * @returns {Object} Les résultats traités et rendus
   */
  process(detectionResults) {
    if (!detectionResults || !detectionResults.image) {
      return detectionResults;
    }

    // ÉTAPE 1 : Appliquer la chaîne d'analyse des gestes
    const analyzedData = this.gestureAnalysis.analyze(detectionResults);

    // ÉTAPE 2 : Extraire le feedback visuel de l'analyse
    const visualFeedback =
      this.gestureAnalysis.extractVisualFeedback(analyzedData);
    analyzedData.analysis.visualFeedback = visualFeedback;

    // ÉTAPE 3 : Passer les données enrichies au pipeline de rendu
    return this.processingChain.process(analyzedData);
  }
}
