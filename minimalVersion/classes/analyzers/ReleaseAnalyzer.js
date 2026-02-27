// ReleaseAnalyzer.js
// Ce maillon analyse le "release" d'un doigt et gère l'état dans data

import { BaseGestureAnalyzer } from "./BaseGestureAnalyzer.js";

export class ReleaseAnalyzer extends BaseGestureAnalyzer {
    constructor() {
        super();
        this.stateTouch = {
            finger: null,
            phalanx: null,
            timestamp: null,
            state: 'idle' // 'idle', 'touch', 'release'
        };
    }


    handle(data) {

        if (!data.preprocessed || !data.analysis.distancesAndVelocities) {
            if (this.stateTouch.state === 'touch') {
                // Si on était en état de touch mais qu'on perd les données, on considère que c'est un release (perte de tracking)
                this.stateTouch.state = 'release';
            }
            return data;
        }




        // Si un touch est détecté, on met à jour le state
        const exitDistanceThreshold = 0.10;
        let releaseInfo = null;


        if (data.event && data.event.type === 'touch') {
            // Un evement touch est detecté. 
            const touch = data.event;
            this.stateTouch.state = 'touch';
            this.stateTouch.finger = touch.finger;
            this.stateTouch.phalanx = touch.phalanx;
            this.stateTouch.timestamp = Date.now();

        }

        if (this.stateTouch.state === 'touch') {

            let releaseDetected = false;
            // Chercher le min des distances de phalange pour ce doigt
            const phalanges = ['base', 'middle', 'tip'];
            let minDistance = Infinity;
            let minPhalanx = null;
            for (const phalanx of phalanges) {
                const featureName = `thumb_to_${this.stateTouch.finger}_${phalanx}_dist`;
                const feature = data.analysis.distancesAndVelocities?.find(f => f.name === featureName);
                if (feature && typeof feature.value === 'number' && feature.value < minDistance) {
                    minDistance = feature.value;
                    minPhalanx = phalanx;
                }
            }
            // Si le min dépasse le seuil, on déclare un release
            if (minDistance > exitDistanceThreshold) {
                releaseDetected = true;
                releaseInfo = {
                    type: "release",
                    finger: this.stateTouch.finger,
                    phalanx: minPhalanx,
                    reason: 'distance_exit',
                    distance: minDistance,
                    threshold: exitDistanceThreshold,
                    timestamp: Date.now(),
                    expiresAt: Date.now() + 500, // feedback valable 0.5 seconde
                };

            }

            if (releaseDetected) {
                this.stateTouch.state = 'release';
                console.log("[ReleaseAnalyzer] Detected release:", releaseInfo);
                data.event = releaseInfo;

            }
        }


        data.state = this.stateTouch.state;
        return data;
    }
}


