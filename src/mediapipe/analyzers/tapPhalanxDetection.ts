import { BaseAnalyzer } from './BaseAnalyzer';
import type { useFeatureStore } from '../../stores/FeatureStore';
import { eventBus, eventHistory } from '../../stores/eventBusStore';
import type { Event } from '../types';

type FeatureStore = ReturnType<typeof useFeatureStore>;
type FingerName = 'index' | 'middle' | 'ring' | 'pinky';
type PhalanxType = 'base' | 'middle' | 'tip';

/**
 * Represents a phalanx with its own buffers and peak detection logic
 */
class Phalanx {
    private speedBuffer: number[] = [];
    private distanceBuffer: number[] = [];
    private readonly bufferSize: number;
    
    constructor(
        public readonly type: PhalanxType,
        private readonly featureSuffix: string,
        bufferSize: number = 12
    ) {
        this.bufferSize = bufferSize;
        this.initializeBuffers();
    }

    private initializeBuffers(): void {
        this.speedBuffer = Array(this.bufferSize).fill(0);
        this.distanceBuffer = Array(this.bufferSize).fill(0);
    }

    /**
     * Update buffers with new sensor data
     */
    updateBuffers(speed: number, distance: number): void {
        this.speedBuffer.shift();
        this.speedBuffer.push(speed);
        
        this.distanceBuffer.shift();
        this.distanceBuffer.push(distance);
    }

    /**
     * Detect if this phalanx has a valid tap peak pattern
     * New pattern: 4-5 points for speed peak (a b c b a or a b c a) + 5 points for plateau
     * Buffer size = 10 points total
     */
    detectPeak(): PhalanxPeakResult {
        // Split buffer: first 5 points for peak analysis, last 5 for plateau
        const peakPeriod = this.speedBuffer.slice(0, 7);
        const plateauPeriod = this.speedBuffer.slice(7);
        const plateauDistances = this.distanceBuffer.slice(7);
        
        // Find max speed and its position in peak period
        const maxSpeedInPeak = Math.max(...peakPeriod);
        const maxSpeedIndex = peakPeriod.indexOf(maxSpeedInPeak);

        const hasValidStart = this.distanceBuffer[0] > 0.1; // Start with some distance
        
        // Detect speed peak pattern:
        const hasValidPeakPattern = this.detectSpeedPeakPattern(peakPeriod);
        
        // Analyze plateau: all points should have very low speed + low distance
        const plateauMaxSpeed = Math.max(...plateauPeriod);
        const plateauAvgSpeed = plateauPeriod.reduce((sum, val) => sum + val, 0) / plateauPeriod.length;
        const plateauMaxDistance = Math.max(...plateauDistances);
        const plateauAvgDistance = plateauDistances.reduce((sum, val) => sum + val, 0) / plateauDistances.length;
        
        const hasValidPlateau =  plateauAvgSpeed < 0.05 && plateauAvgDistance < 0.06;
        
        // Overall validation
        const hasBasicPattern = hasValidStart && hasValidPeakPattern && hasValidPlateau;
        //const hasBasicPattern = hasValidPeakPattern ;

        
        const hasPeak = hasBasicPattern;
        
        return {
            hasPeak,
            maxSpeed: maxSpeedInPeak,
            distanceAtMaxSpeed: plateauAvgDistance, // True contact distance is during plateau
            type: this.type,
            confidence: this.calculateConfidence(maxSpeedInPeak, plateauAvgDistance, plateauAvgDistance)
        };
    }

    /**
     * Calculate confidence score based on speed, distance and plateau quality
     */
    private calculateConfidence(speed: number, distance: number, plateauDistance?: number): number {
        if (distance <= 0 || speed <= 0) return 0;
        
        // Base confidence on speed and proximity (inverse of distance)
        const speedScore = Math.min(speed * 2, 2);
        const distanceScore = Math.min(1 / (distance * 10), 3);
        
        // Bonus for good plateau (low plateau distance indicates stable contact)
        const plateauBonus = plateauDistance !== undefined ? 
            Math.max(0, 1 - (plateauDistance * 15)) : 0;
        
        return speedScore + distanceScore + plateauBonus;
    }

    getFeatureSuffix(): string {
        return this.featureSuffix;
    }

    /**
     * Detect speed peak pattern in a 5-point array
     * Simple: first and last points are low, there's a peak in the middle
     */
    private detectSpeedPeakPattern(points: number[]): boolean {
        if (points.length !== 7) return false;
        
        const first = points[0];
        const last = points[6];
        const maxInMiddle = Math.max(...points);
        
        // Ultra simple: low start, low end, peak somewhere in the middle
        return first < 0.1 && last < 0.1 && maxInMiddle > 0.8;
    }

    /**
     * Get minimum speed threshold based on phalanx type
     */
    private getMinSpeedThreshold(): number {
        const thresholds = {
            base: 0.4,
            middle: 0.5,
            tip: 0.8
        };
        return thresholds[this.type];
    }
}

/**
 * Represents a finger with its three phalanges
 */
class Finger {
    private phalanges: Phalanx[];
    
    constructor(
        public readonly name: FingerName,
        bufferSize: number = 10
    ) {
        this.phalanges = [
            new Phalanx('base', 'B', bufferSize),
            new Phalanx('middle', 'M', bufferSize),
            new Phalanx('tip', 'T', bufferSize)
        ];
    }

    /**
     * Update all phalanges with sensor data
     */
    updatePhalanges(featureStore: FeatureStore): void {
        this.phalanges.forEach(phalanx => {
            const speedFeature = `thumb_to_${this.name}${phalanx.getFeatureSuffix()}_distspeed`;
            const distanceFeature = `thumb_to_${this.name}${phalanx.getFeatureSuffix()}_dist`;
            
            const speed = featureStore.getFeature(speedFeature)?.value;
            const distance = featureStore.getFeature(distanceFeature)?.value;
            
            if (typeof speed === 'number' && typeof distance === 'number') {
                phalanx.updateBuffers(speed, distance);
            }
        });
    }

    /**
     * Analyze all phalanges and return the best candidate
     * Simplified since validation is now done in Phalanx.detectPeak()
     */
    analyzePhalanges(): FingerAnalysisResult {
        const phalanxResults = this.phalanges.map(phalanx => phalanx.detectPeak());
        const validResults = phalanxResults.filter(result => result.hasPeak);

        // Debug: Log detected peaks
        const detectedPeaks = phalanxResults.filter(result => result.hasPeak);
        // if (detectedPeaks.length > 0) {
        //     console.log(`[${this.name}] 🔍 DETECTED PEAKS:`);
        //     detectedPeaks.forEach(peak => {
        //         console.log(`    ${peak.type}: speed=${peak.maxSpeed.toFixed(3)} dist=${peak.distanceAtMaxSpeed.toFixed(3)} conf=${peak.confidence.toFixed(2)}`);
        //     });
        // }

        if (validResults.length === 0) {
            return { finger: this.name, bestPhalanx: null, score: 0 };
        }

        // Find the best phalanx based on confidence and finger-specific weights
        const bestPhalanx = validResults.reduce((best, current) => {
            const currentScore = this.calculateWeightedScore(current);
            const bestScore = this.calculateWeightedScore(best);
            return currentScore > bestScore ? current : best;
        });

        const weightedScore = this.calculateWeightedScore(bestPhalanx) * this.getFingerMultiplier();

        //console.log(`[${this.name}] ✅ BEST CANDIDATE: ${bestPhalanx.type} score=${weightedScore.toFixed(2)}`);

        return {
            finger: this.name,
            bestPhalanx,
            score: weightedScore,
            allResults: phalanxResults
        };
    }



    /**
     * Calculate weighted score for a phalanx result
     */
    private calculateWeightedScore(result: PhalanxPeakResult): number {
        const weights = {
            base: { speed: 1.3, distance: 2.5 },
            middle: { speed: 1.0, distance: 2.0 },
            tip: { speed: 0.8, distance: 1.5 }
        };
        
        const weight = weights[result.type];
        const speedScore = weight.speed * result.maxSpeed;
        const distanceScore = result.distanceAtMaxSpeed > 0 ? weight.distance / result.distanceAtMaxSpeed : 0;
        
        return speedScore + distanceScore;
    }

    /**
     * Get finger-specific multiplier for difficulty compensation
     */
    private getFingerMultiplier(): number {
        const multipliers = {
            index: 1.0,
            middle: 1.0,
            ring: 1.4,
            pinky: 1.6
        };
        return multipliers[this.name];
    }
}

/**
 * Result interfaces
 */
interface PhalanxPeakResult {
    hasPeak: boolean;
    maxSpeed: number;
    distanceAtMaxSpeed: number; // Actually plateau distance - keeping name for compatibility
    type: PhalanxType;
    confidence: number;
}

interface FingerAnalysisResult {
    finger: FingerName;
    bestPhalanx: PhalanxPeakResult | null;
    score: number;
    allResults?: PhalanxPeakResult[];
}

/**
 * Clean and modular tap detection analyzer using object-oriented architecture.
 * Each phalanx manages its own buffers and peak detection logic.
 * Fingers coordinate their phalanges and apply finger-specific scoring.
 * The analyzer selects the best candidate across all fingers and phalanges.
 */
export class TapPhalanxDetection extends BaseAnalyzer {
    readonly name = 'TapPhalanxDetection';
    
    private fingers: Finger[];
    private lastDetectionTime: number = 0;
    private readonly cooldownPeriod: number = 100;
    private isInCooldown: boolean = false;

    constructor(featureStore: FeatureStore) {
        super(featureStore, eventBus, eventHistory);
        
        this.fingers = [
            new Finger('index'),
            new Finger('middle'),
            new Finger('ring'),
            new Finger('pinky')
        ];
        
        this.enable();
    }

    analyze(): void {
        // Update all fingers with fresh sensor data
        this.fingers.forEach(finger => {
            finger.updatePhalanges(this.featureStore);
        });

        // Analyze each finger and get best candidates
        const fingerResults = this.fingers.map(finger => finger.analyzePhalanges());
        
        // Find the overall best candidate
        const bestCandidate = this.selectBestCandidate(fingerResults);
        
        if (bestCandidate) {
            this.handleTapDetection(bestCandidate);
        }
    }

    /**
     * Select the best tap candidate from all finger results
     * Simplified: if hasPeak = true, we guarantee an event
     */
    private selectBestCandidate(results: FingerAnalysisResult[]): FingerAnalysisResult | null {
        // Debug: Log all candidates before filtering
        const candidatesWithPeaks = results.filter(result => result.bestPhalanx);
        // if (candidatesWithPeaks.length > 0) {
        //     console.log(`[TapPhalanxDetection] 📋 ALL CANDIDATES:`);
        //     candidatesWithPeaks.forEach(candidate => {
        //         const p = candidate.bestPhalanx!;
        //         console.log(`    ${candidate.finger}[${p.type}]: dist=${p.distanceAtMaxSpeed.toFixed(3)} score=${candidate.score.toFixed(2)}`);
        //     });
        // }

        // Only filter on existence of bestPhalanx (hasPeak = true) - no additional thresholds
        const validCandidates = results.filter(result => result.bestPhalanx);

        if (validCandidates.length === 0) {
            //console.log(`[TapPhalanxDetection] ❌ NO PEAKS DETECTED`);
            return null;
        }

        // Sort by score and return the best
        validCandidates.sort((a, b) => b.score - a.score);
        
        // Log candidates for debugging
        //this.logCandidates(validCandidates);
        
        return validCandidates[0];
    }

    /**
     * Handle tap detection with cooldown management
     */
    private handleTapDetection(candidate: FingerAnalysisResult): void {
        if (this.isInCooldown || Date.now() - this.lastDetectionTime < this.cooldownPeriod) {
            return;
        }

        this.isInCooldown = true;
        this.lastDetectionTime = Date.now();

        const phalanx = candidate.bestPhalanx!;
        console.log(`[TapPhalanxDetection] ✅ TAP DETECTED: ${candidate.finger}[${phalanx.type}] ` +
                   `distance=${phalanx.distanceAtMaxSpeed.toFixed(3)} speed=${phalanx.maxSpeed.toFixed(3)} ` +
                   `score=${candidate.score.toFixed(2)}`);

        this.emitTapEvent(candidate);

        // Reset cooldown
        setTimeout(() => {
            this.isInCooldown = false;
        }, this.cooldownPeriod);
    }

    /**
     * Emit tap event
     */
    private emitTapEvent(candidate: FingerAnalysisResult): void {
        const phalanxTypeToIndex = { base: 0, middle: 1, tip: 2 };
        
        const event: Event = {
            type: 'phalanx_tap_detected',
            timestamp: Date.now(),
            data: {
                finger: candidate.finger,
                phalanx: phalanxTypeToIndex[candidate.bestPhalanx!.type],
                phalanxType: candidate.bestPhalanx!.type,
                speed: candidate.bestPhalanx!.maxSpeed,
                distance: candidate.bestPhalanx!.distanceAtMaxSpeed,
                confidence: candidate.bestPhalanx!.confidence,
                score: candidate.score
            }
        };
        
        this.eventBus.emit(event);
    }

    /**
     * Log debug information about candidates
     */
    private logCandidates(candidates: FingerAnalysisResult[]): void {
        console.log(`[TapPhalanxDetection] 🏆 TAP CANDIDATES:`);
        candidates.forEach((candidate, index) => {
            const phalanx = candidate.bestPhalanx!;
            const winner = index === 0 ? '🏆 WINNER' : '';
            console.log(`    ${candidate.finger}[${phalanx.type}]: ` +
                       `speed=${phalanx.maxSpeed.toFixed(3)} dist=${phalanx.distanceAtMaxSpeed.toFixed(3)} ` +
                       `conf=${phalanx.confidence.toFixed(2)} score=${candidate.score.toFixed(2)} ${winner}`);
        });
    }
}