
// PeakManager.js
// Gère la détection et la sélection du meilleur peak sur une fenêtre de N frames
// Cette classe ne fait pas partie du pattern de chaîne de responsabilité, mais est utilisée par TouchAnalyzer pour gérer les pics de vitesse

export class PeakManager {
    constructor(windowSize = 5, cooldownMs = 500) {
        this.windowSize = windowSize;
        this.cooldownMs = cooldownMs;
        this.state = 'idle'; // 'idle', 'recording', 'cooldown'
        this.peaks = [];
        this.framesLeft = 0;
        this.lastWindowPeaks = [];
        this.cooldownUntil = 0;
    }

    // Retourne tous les peaks de la fenêtre courante (en mode recording) ou la dernière fenêtre terminée
    getWindowPeaks() {
        if (this.state === 'recording') {
            return [...this.peaks];
        } else if (this.lastWindowPeaks && this.lastWindowPeaks.length > 0) {
            return [...this.lastWindowPeaks];
        } else {
            return [];
        }
    }

    handlePeak(peak) {
        const now = Date.now();
        if (this.state === 'cooldown') {
            if (now >= this.cooldownUntil) {
                this.state = 'idle';
            } else {
                return null; // Ignore tout peak pendant le cooldown
            }
        }
        if (this.state === 'idle') {
            // Premier peak détecté, on démarre l'enregistrement
            this.state = 'recording';
            this.peaks = [peak];
            this.framesLeft = this.windowSize - 1;
            return null; // On attend la fin de la fenêtre
        } else if (this.state === 'recording') {
            // Vérifie s'il existe déjà un peak pour ce couple finger/phalange
            const idx = this.peaks.findIndex(
                p => p.finger === peak.finger && p.phalanx === peak.phalanx
            );
            if (idx !== -1) {
                // Remplace si le nouveau score est meilleur
                if (peak.totalScore > this.peaks[idx].totalScore) {
                    this.peaks[idx] = peak;
                }
            } else {
                this.peaks.push(peak);
            }
            this.framesLeft--;
            if (this.framesLeft <= 0) {
                const bestPeak = this._finalizeWindow();
                this.state = 'cooldown';
                this.cooldownUntil = now + this.cooldownMs;
                return bestPeak;
            }
            return null; // Toujours en attente
        }
    }

    // À appeler à chaque frame même sans peak pour gérer la fenêtre
    tick() {
        const now = Date.now();
        if (this.state === 'cooldown') {
            if (now >= this.cooldownUntil) {
                this.state = 'idle';
            }
            return null;
        }
        if (this.state === 'recording') {
            this.framesLeft--;
            if (this.framesLeft <= 0) {
                const bestPeak = this._finalizeWindow();
                this.state = 'cooldown';
                this.cooldownUntil = now + this.cooldownMs;
                return bestPeak;
            }
        }
        return null;
    }

    // Sélectionne le meilleur peak et reset la fenêtre
    _finalizeWindow() {
        const bestPeak = this._getBestPeak();
        //console.log the list of scores for debugging
        let list = ""
        this.peaks.forEach(p => {
            list += `TotalScore: ${p.totalScore.toFixed(2)} | `
        });
        console.log("[PeakManager] Window finalized. Peaks:", list);


        // Stocke les peaks de la fenêtre avant de reset

        this.lastWindowPeaks = [...this.peaks];
        this.reset();
        return bestPeak;
    }

    // Retourne le meilleur peak de la fenêtre courante
    _getBestPeak() {
        if (!this.peaks.length) return null;
        return this.peaks.reduce((best, p) => (p.totalScore > best.totalScore ? p : best), this.peaks[0]);
    }

    reset() {
        this.state = 'idle';
        this.peaks = [];
        this.framesLeft = 0;
        this.cooldownUntil = 0;
        // On ne touche pas à lastWindowPeaks ici pour garder la dernière fenêtre
    }
}

