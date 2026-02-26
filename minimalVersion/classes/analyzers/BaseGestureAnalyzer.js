/**
 * BaseGestureAnalyzer - Classe abstraite pour les analyseurs de gestes
 * Implémente le pattern Chain of Responsibility pour analyser les gestes
 */
export class BaseGestureAnalyzer {
  constructor() {
    this.next = null;
  }

  /**
   * Défini le prochain analyseur dans la chaîne
   * @param {BaseGestureAnalyzer} analyzer - L'analyseur suivant
   * @returns {BaseGestureAnalyzer} Retourne this pour permettre le chaînage
   */
  setNext(analyzer) {
    this.next = analyzer;
    return analyzer;
  }

  /**
   * Analyse les données et passe au suivant
   * @param {Object} data - Les données à analyser
   * @returns {Object} Les données enrichies avec les résultats d'analyse
   */
  analyze(data) {
    // Effectuer l'analyse spécifique
    const analyzedData = this.handle(data);

    // Passer au suivant dans la chaîne
    if (this.next) {
      return this.next.analyze(analyzedData);
    }

    return analyzedData;
  }

  /**
   * À implémenter dans les sous-classes
   * @param {Object} data - Les données à analyser
   * @returns {Object} Les données enrichies
   */
  handle(data) {
    throw new Error("handle() must be implemented in subclass");
  }
}
