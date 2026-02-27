import { PreProcessingAnalyzer } from "./PreProcessingAnalyzer.js";
import { FeatureExtractingAnalyzer } from "./FeatureExtractingAnalyzer.js";
import { TouchAnalyzer } from "./TouchAnalyzer.js";
import { SwipeAnalyzer } from "./SwipeAnalyzer.js";
import { ReleaseAnalyzer } from "./ReleaseAnalyzer.js";

/**
 * GestureAnalysisChain - Orchestre la chaîne complète d'analyse des gestes
 */
export class GestureAnalysisChain {
  constructor() {
    // Construire la chaîne d'analyseurs
    this.analysisChain = this.buildAnalysisChain();
  }

  /**
   * Construit la chaîne d'analyse des gestes
   */
  buildAnalysisChain() {
    const preProcessor = new PreProcessingAnalyzer();
    const featureExtractor = new FeatureExtractingAnalyzer();
    const touchAnalyzer = new TouchAnalyzer();
    const releaseAnalyzer = new ReleaseAnalyzer();
    const swipeAnalyzer = new SwipeAnalyzer();

    // Chaîner les analyseurs
    preProcessor
      .setNext(featureExtractor)
      .setNext(touchAnalyzer)
      .setNext(releaseAnalyzer)
      .setNext(swipeAnalyzer);

    return preProcessor;
  }

  /**
   * Analyse les données détectées pour extraire les gestes
   * @param {Object} detectionResults - Les résultats de MediaPipe
   * @returns {Object} Les résultats avec les informations d'analyse
   */
  analyze(detectionResults) {
    // Passer les données à travers la chaîne d'analyse
    return this.analysisChain.analyze(detectionResults);
  }

  
}
