import { BaseAnalyzer } from './BaseAnalyzer';
import type { useFeatureStore } from '../../stores/FeatureStore';
import { eventBus, eventHistory } from '../../stores/eventBusStore';
import type { Event } from '../types';

type FeatureStore = ReturnType<typeof useFeatureStore>;
type FingerName = 'index' | 'middle' | 'ring' | 'pinky';
type PhalanxType = 'base' | 'middle' | 'tip';
type SwipeState = 'IDLE' | 'MONITORING' | 'SWIPE_ACTIVE';
type SwipeDirection = 'proximal' | 'distal' | 'exit';

/**
 * Manages distance buffers for a specific phalanx during swipe detection
 */
class SwipeBuffer {
    private distanceBuffer: number[] = [];
    private readonly bufferSize: number;
    private readonly featureName: string;

    constructor(finger: FingerName, phalanx: PhalanxType, bufferSize: number = 18) {
        this.bufferSize = bufferSize; // 18 frames = 600ms à 30fps (fenêtre d'analyse plus large)
        this.featureName = this.buildFeatureName(finger, phalanx);
        this.initializeBuffer();
    }

    private buildFeatureName(finger: FingerName, phalanx: PhalanxType): string {
        const phalanxSuffix = phalanx === 'base' ? 'B' : phalanx === 'middle' ? 'M' : 'T';
        return `thumb_to_${finger}${phalanxSuffix}_dist`;
    }

    private initializeBuffer(): void {
        this.distanceBuffer = Array(this.bufferSize).fill(0);
    }

    updateBuffer(distance: number): void {
        this.distanceBuffer.shift();
        this.distanceBuffer.push(distance);
        // console.log(`[${this.featureName}] Updated buffer: ${distance.toFixed(3)}`);
    }

    getFeatureName(): string {
        return this.featureName;
    }

    /**
     * Calculate the trend (slope) of distances over time
     * Positive = increasing distance, Negative = decreasing distance
     */
    calculateTrend(): number {
        const n = this.distanceBuffer.length;
        if (n < 3) {
            //console.log(`[${this.featureName}] Trend calc: buffer too small (${n})`);
            return 0;
        }

        // Simple linear regression slope calculation
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (let i = 0; i < n; i++) {
            const distance = this.distanceBuffer[i];
            if (distance !== undefined) {
                sumX += i;
                sumY += distance;
                sumXY += i * distance;
                sumX2 += i * i;
            }
        }

        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const result = isNaN(slope) ? 0 : slope;
        
        if (Math.abs(result) > 0.001) {
           // console.log(`[${this.featureName}] Trend: ${result.toFixed(5)} | Last 3: [${this.distanceBuffer.slice(-3).map(d => d.toFixed(3)).join(', ')}]`);
        }
        
        return result;
    }

    /**
     * Get current average distance over last few samples
     */
    getCurrentAverage(samples: number = 3): number {
        const recentSamples = this.distanceBuffer.slice(-samples);
        return recentSamples.reduce((sum, val) => sum + val, 0) / recentSamples.length;
    }

    /**
     * Check if distances are stable (low variance)
     */
    isStable(threshold: number = 0.01): boolean {
        const avg = this.getCurrentAverage(5);
        const variance = this.distanceBuffer.slice(-5)
            .reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / 5;
        return variance < threshold;
    }

    getBuffer(): number[] {
        return [...this.distanceBuffer];
    }
}

/**
 * Manages swipe detection for a specific finger
 */
class SwipeFinger {
    public readonly name: FingerName;
    private baseBuffer: SwipeBuffer;
    private middleBuffer: SwipeBuffer;
    private tipBuffer: SwipeBuffer;

    constructor(name: FingerName) {
        this.name = name;
        this.baseBuffer = new SwipeBuffer(name, 'base');
        this.middleBuffer = new SwipeBuffer(name, 'middle');
        this.tipBuffer = new SwipeBuffer(name, 'tip');
    }

    /**
     * Update all buffers with current distance values
     */
    updateBuffers(featureStore: FeatureStore): void {
        const baseFeature = featureStore.getFeature(this.baseBuffer.getFeatureName());
        const middleFeature = featureStore.getFeature(this.middleBuffer.getFeatureName());
        const tipFeature = featureStore.getFeature(this.tipBuffer.getFeatureName());

        let updateCount = 0;
        if (baseFeature && typeof baseFeature.value === 'number') {
            this.baseBuffer.updateBuffer(baseFeature.value);
            updateCount++;
        }
        if (middleFeature && typeof middleFeature.value === 'number') {
            this.middleBuffer.updateBuffer(middleFeature.value);
            updateCount++;
        }
        if (tipFeature && typeof tipFeature.value === 'number') {
            this.tipBuffer.updateBuffer(tipFeature.value);
            updateCount++;
        }
        
        if (updateCount > 0) {
            console.log(`[${this.name}] Updated ${updateCount}/3 buffers`);
        } else {
            console.log(`[${this.name}] ⚠️ No feature updates - features missing?`);
        }
    }

    /**
     * Analyze movement patterns in sliding 300ms windows for mini-swipes
     */
    analyzeMovement(elapsedSinceStart: number): SwipeAnalysisResult {
        const baseTrend = this.baseBuffer.calculateTrend();
        const middleTrend = this.middleBuffer.calculateTrend();
        const tipTrend = this.tipBuffer.calculateTrend();

        // Seuils pour mini-swipes (plus permissifs)
        const isEarlyPhase = elapsedSinceStart < 500; // Première 500ms = stabilisation initiale
        
        // Seuils plus permissifs pour détecter des micro-mouvements
        const trendThreshold = 0.0012; // Plus sensible (réduit de 0.002)
        const stabilityThreshold = 0.0025; // Plus tolérant (augmenté de 0.0015)
        const exitThreshold = isEarlyPhase ? 0.006 : 0.004; // EXIT plus strict au début
        const exitGracePeriod = 400; // Grace period

        // Log trends pour debug
        if (Math.abs(baseTrend) > 0.001 || Math.abs(middleTrend) > 0.001 || Math.abs(tipTrend) > 0.001) {
            console.log(`[${this.name}] 📊 Mini-trends (${elapsedSinceStart}ms): base=${baseTrend.toFixed(4)}, middle=${middleTrend.toFixed(4)}, tip=${tipTrend.toFixed(4)}`);
        }

        // Vérifier buffer minimum (plus petit pour réactivité)
        const minBufferFill = Math.min(
            this.baseBuffer.getBuffer().filter(v => v > 0).length,
            this.middleBuffer.getBuffer().filter(v => v > 0).length,
            this.tipBuffer.getBuffer().filter(v => v > 0).length
        );
        
        if (minBufferFill < 8) { // Réduit de 6 à 8 mais avec buffer plus grand
            console.log(`[${this.name}] ⏳ Buffer filling: ${minBufferFill}/8 samples`);
            return { direction: null, confidence: 0, baseTrend, middleTrend, tipTrend };
        }

        // Grace period pour EXIT (plus court)
        if (elapsedSinceStart < exitGracePeriod) {
            // Pendant grace period, seulement détecter les swipes, pas EXIT
            if (elapsedSinceStart % 200 < 50) { // Log tous les 200ms
                console.log(`[${this.name}] 🛡️ Grace period: ${elapsedSinceStart}ms < ${exitGracePeriod}ms`);
            }
        } else {
            // Check for exit pattern: all distances increasing (thumb moving away)
            if (baseTrend > exitThreshold && 
                middleTrend > exitThreshold && 
                tipTrend > exitThreshold) {
                console.log(`[${this.name}] 🚪 EXIT PATTERN: base+${baseTrend.toFixed(4)}, middle+${middleTrend.toFixed(4)}, tip+${tipTrend.toFixed(4)}`);
                return {
                    direction: 'exit',
                    confidence: Math.min((baseTrend + middleTrend + tipTrend) * 8, 1.0),
                    baseTrend,
                    middleTrend,
                    tipTrend
                };
            }
        }

        // Check for mini-swipe towards tip (proximal → distal)
        // DISTAL: base distance increases (thumb moves away from base) AND tip distance decreases (thumb approaches tip)
        const isDistalCandidate = baseTrend > trendThreshold;
        const isDistalTipCondition = tipTrend < -trendThreshold;
        const isDistalMiddleCondition = Math.abs(middleTrend) < stabilityThreshold;
        
        if (Math.abs(baseTrend) > 0.001 || Math.abs(tipTrend) > 0.001) {
            console.log(`[${this.name}] 🔍 DISTAL CHECK: base=${baseTrend.toFixed(4)}>${trendThreshold.toFixed(4)}=${isDistalCandidate}, tip=${tipTrend.toFixed(4)}<-${trendThreshold.toFixed(4)}=${isDistalTipCondition}, middle=${Math.abs(middleTrend).toFixed(4)}<${stabilityThreshold.toFixed(4)}=${isDistalMiddleCondition}`);
        }
        
        if (isDistalCandidate && isDistalTipCondition && isDistalMiddleCondition) {
            console.log(`[${this.name}] ➡️ MINI-SWIPE DISTAL: base+${baseTrend.toFixed(4)}, tip-${Math.abs(tipTrend).toFixed(4)}, middle${middleTrend.toFixed(4)}`);
            return {
                direction: 'distal',
                confidence: Math.min((baseTrend + Math.abs(tipTrend)) * 2, 1.0),
                baseTrend,
                middleTrend,
                tipTrend
            };
        }

        // Check for mini-swipe towards base (distal → proximal) 
        // PROXIMAL: tip distance increases (thumb moves away from tip) AND base distance decreases (thumb approaches base)
        const isProximalCandidate = tipTrend > trendThreshold;
        const isProximalBaseCondition = baseTrend < -trendThreshold;
        const isProximalMiddleCondition = Math.abs(middleTrend) < stabilityThreshold;
        
        if (Math.abs(tipTrend) > 0.001 || Math.abs(baseTrend) > 0.001) {
            console.log(`[${this.name}] 🔍 PROXIMAL CHECK: tip=${tipTrend.toFixed(4)}>${trendThreshold.toFixed(4)}=${isProximalCandidate}, base=${baseTrend.toFixed(4)}<-${trendThreshold.toFixed(4)}=${isProximalBaseCondition}, middle=${Math.abs(middleTrend).toFixed(4)}<${stabilityThreshold.toFixed(4)}=${isProximalMiddleCondition}`);
        }
        
        if (isProximalCandidate && isProximalBaseCondition && isProximalMiddleCondition) {
            console.log(`[${this.name}] ⬅️ MINI-SWIPE PROXIMAL: tip+${tipTrend.toFixed(4)}, base-${Math.abs(baseTrend).toFixed(4)}, middle${middleTrend.toFixed(4)}`);
            return {
                direction: 'proximal',
                confidence: Math.min((tipTrend + Math.abs(baseTrend)) * 2, 1.0),
                baseTrend,
                middleTrend,
                tipTrend
            };
        }

        return {
            direction: null,
            confidence: 0,
            baseTrend,
            middleTrend,
            tipTrend
        };
    }

    /**
     * Get current distance values for debugging
     */
    getCurrentDistances(): { base: number; middle: number; tip: number } {
        return {
            base: this.baseBuffer.getCurrentAverage(),
            middle: this.middleBuffer.getCurrentAverage(),
            tip: this.tipBuffer.getCurrentAverage()
        };
    }
}

/**
 * Result interfaces
 */
interface SwipeAnalysisResult {
    direction: SwipeDirection | null;
    confidence: number;
    baseTrend: number;
    middleTrend: number;
    tipTrend: number;
}

interface MonitoringContext {
    finger: FingerName;
    phalanx: PhalanxType;
    startTime: number;
    tapData: any;
    lastSwipeTime: number; // Pour limiter la fréquence des mini-swipes
    swipeCount: number; // Compteur de mini-swipes
    totalSwipeDistance: number; // Distance totale swipée
    currentDirection: SwipeDirection | null; // Direction courante
}

/**
 * Swipe detection analyzer that monitors thumb movement after tap detection
 * 
 * State machine:
 * - IDLE: Waiting for tap events
 * - MONITORING: Analyzing movement after tap
 * - SWIPE_ACTIVE: Swipe detected, continuing to track
 */
export class SwipeDetection extends BaseAnalyzer {
    readonly name = 'SwipeDetection';
    
    private state: SwipeState = 'IDLE';
    private monitoringContext: MonitoringContext | null = null;
    private swipeFinger: SwipeFinger | null = null;
    private monitoringStartTime: number = 0;
    
    // Configuration pour mini-swipes
    private readonly monitoringTimeout: number = 6000; // 6 secondes max
    private readonly miniSwipeInterval: number = 150; // 150ms minimum entre mini-swipes
    private readonly minConfidence: number = 0.004; // Confidence minimale (réduite)

    constructor(featureStore: FeatureStore) {
        super(featureStore, eventBus, eventHistory);
        this.setupEventListeners();
        this.enable();
    }

    /**
     * Setup event listeners for tap detection
     */
    private setupEventListeners(): void {
        this.eventBus.on('phalanx_tap_detected', (event: Event) => {
            this.handleTapDetection(event);
        });
    }

    /**
     * Handle incoming tap detection events
     */
    private handleTapDetection(event: Event): void {
        if (this.state !== 'IDLE') {
            console.log(`[SwipeDetection] Ignoring tap - state: ${this.state}`);
            return;
        }

        const data = event.data;
        console.log(`[SwipeDetection] 🔥 TAP DETECTED: ${data.finger}[${data.phalanxType}] - Starting monitoring`);

        this.state = 'MONITORING';
        this.monitoringContext = {
            finger: data.finger,
            phalanx: data.phalanxType,
            startTime: Date.now(),
            tapData: data,
            lastSwipeTime: 0,
            swipeCount: 0,
            totalSwipeDistance: 0,
            currentDirection: null
        };
        
        this.swipeFinger = new SwipeFinger(data.finger);
        this.monitoringStartTime = Date.now();

        // Emit monitoring started event
        // this.emitEvent('swipe_monitoring_started', {
        //     finger: data.finger,
        //     phalanx: data.phalanxType,
        //     originalTap: data
        // });
    }

    /**
     * Main analysis loop
     */
    analyze(): void {
        if (!this.enabled || this.state === 'IDLE') {
            return;
        }

        const now = Date.now();
        const elapsed = now - this.monitoringStartTime;

        // Log state periodically for debugging
        if (elapsed % 1000 < 50) { // Every ~1 second
           // console.log(`[SwipeDetection] 🔄 State: ${this.state} | Elapsed: ${elapsed}ms | Finger: ${this.monitoringContext?.finger}`);
        }

        // Check for monitoring timeout
        if (this.state === 'MONITORING' && elapsed > this.monitoringTimeout) {
           // console.log(`[SwipeDetection] ⏰ Monitoring timeout (${elapsed}ms) - returning to IDLE`);
            this.resetToIdle();
            return;
        }

        if (!this.swipeFinger || !this.monitoringContext) {
           // console.log(`[SwipeDetection] ⚠️ Missing swipeFinger or context`);
            return;
        }

        // Update buffers with current data
        this.swipeFinger.updateBuffers(this.featureStore);

        // SIMPLE EXIT CHECK: Vérifier si le pouce est trop écarté du doigt
        const currentDistances = this.swipeFinger.getCurrentDistances();
        const maxDistance = Math.max(currentDistances.base, currentDistances.middle, currentDistances.tip);
        const exitDistanceThreshold = 0.15; // Seuil critique
        
        // Si on a eu au moins 1 swipe et que le pouce est maintenant trop loin
        if (this.monitoringContext.swipeCount > 0 && maxDistance > exitDistanceThreshold) {
            console.log(`[SwipeDetection] 🚪 SIMPLE EXIT: pouce trop écarté! max=${maxDistance.toFixed(3)} > ${exitDistanceThreshold}`);
            console.log(`[SwipeDetection] 📏 Distances: base=${currentDistances.base.toFixed(3)}, middle=${currentDistances.middle.toFixed(3)}, tip=${currentDistances.tip.toFixed(3)}`);
            
            this.emitEvent('swipe_ended', {
                reason: 'distance_exit',  
                finger: this.monitoringContext.finger,
                phalanx: this.monitoringContext.phalanx,
                confidence: 0.9, // High confidence pour distance exit
                distances: currentDistances,
                maxDistance: maxDistance,
                threshold: exitDistanceThreshold,
                duration: Date.now() - this.monitoringStartTime,
                swipeCount: this.monitoringContext.swipeCount,
                totalDistance: this.monitoringContext.totalSwipeDistance,
                finalDirection: this.monitoringContext.currentDirection
            });

            this.resetToIdle();
            return;
        }

        // Analyze movement patterns
        const analysis = this.swipeFinger.analyzeMovement(elapsed);

        // console.log(`[SwipeDetection] 🔍 Analysis result (${elapsed}ms): direction=${analysis.direction}, confidence=${analysis.confidence.toFixed(4)}, minConf=${this.minConfidence}`);

        if (analysis.direction && analysis.confidence > this.minConfidence) {
            if (analysis.direction === 'exit') {
                this.handleExitDetection(analysis);
            } else {
                this.handleSwipeDetection(analysis);
            }
        } else if (analysis.confidence > 0) {
           // console.log(`[SwipeDetection] 📊 Low confidence: ${analysis.confidence.toFixed(4)} < ${this.minConfidence}`);
        }
    }

    /**
     * Handle mini-swipe detection (proximal or distal movement)
     */
    private handleSwipeDetection(analysis: SwipeAnalysisResult): void {
        const now = Date.now();
        const timeSinceLastSwipe = now - this.monitoringContext!.lastSwipeTime;
        
        // Limiter la fréquence des mini-swipes
        if (timeSinceLastSwipe < this.miniSwipeInterval) {
           // console.log(`[SwipeDetection] ⏰ Mini-swipe cooldown (${timeSinceLastSwipe}ms < ${this.miniSwipeInterval}ms)`);
            return;
        }

        // Mettre à jour le contexte
        this.monitoringContext!.lastSwipeTime = now;
        this.monitoringContext!.swipeCount++;
        this.monitoringContext!.currentDirection = analysis.direction;
        
        // Estimer la "distance" du swipe basée sur la confidence
        const swipeDistance = analysis.confidence * 10; // Approximation
        this.monitoringContext!.totalSwipeDistance += swipeDistance;

        console.log(`[SwipeDetection] ✅ MINI-SWIPE #${this.monitoringContext!.swipeCount}: ${analysis.direction} ` +
                   `conf=${analysis.confidence.toFixed(3)} dist=${swipeDistance.toFixed(1)} total=${this.monitoringContext!.totalSwipeDistance.toFixed(1)}`);

        const distances = this.swipeFinger!.getCurrentDistances();

        // Émettre événement mini-swipe
        this.emitEvent('finger_swipe_detected', {
            finger: this.monitoringContext!.finger,
            phalanx: this.monitoringContext!.phalanx,
            direction: analysis.direction,
            confidence: analysis.confidence,
            swipeCount: this.monitoringContext!.swipeCount,
            totalDistance: this.monitoringContext!.totalSwipeDistance,
            elapsed: now - this.monitoringStartTime,
            distances: distances,
            trends: {
                base: analysis.baseTrend,
                middle: analysis.middleTrend,
                tip: analysis.tipTrend
            },
            originalTap: this.monitoringContext!.tapData,
            isMiniSwipe: true
        });
        
        // Rester en état MONITORING pour continuer à détecter
        // Ne pas passer en SWIPE_ACTIVE comme avant
    }

    /**
     * Handle exit detection (thumb moving away from finger)
     */
    private handleExitDetection(analysis: SwipeAnalysisResult): void {
        console.log(`[SwipeDetection] 🚪 EXIT DETECTED: confidence=${analysis.confidence.toFixed(3)} ` +
                   `finger=${this.monitoringContext?.finger}`);

        const distances = this.swipeFinger!.getCurrentDistances();

        this.emitEvent('swipe_ended', {
            reason: 'exit',
            finger: this.monitoringContext!.finger,
            phalanx: this.monitoringContext!.phalanx,
            confidence: analysis.confidence,
            distances: distances,
            trends: {
                base: analysis.baseTrend,
                middle: analysis.middleTrend,
                tip: analysis.tipTrend
            },
            duration: Date.now() - this.monitoringStartTime,
            swipeCount: this.monitoringContext!.swipeCount,
            totalDistance: this.monitoringContext!.totalSwipeDistance,
            finalDirection: this.monitoringContext!.currentDirection
        });

        this.resetToIdle();
    }

    /**
     * Reset analyzer to idle state
     */
    private resetToIdle(): void {
        this.state = 'IDLE';
        this.monitoringContext = null;
        this.swipeFinger = null;
        this.monitoringStartTime = 0;
    }

    /**
     * Emit event with proper formatting
     */
    private emitEvent(type: string, data: any): void {
        const event: Event = {
            type,
            timestamp: Date.now(),
            data
        };
        
        this.eventBus.emit(event);
    }

    /**
     * Get current state for debugging
     */
    getState(): SwipeState {
        return this.state;
    }

    /**
     * Get monitoring context for debugging
     */
    getMonitoringContext(): MonitoringContext | null {
        return this.monitoringContext;
    }

    /**
     * Force reset for testing
     */
    forceReset(): void {
        console.log('[SwipeDetection] 🔄 Force reset to IDLE');
        this.resetToIdle();
    }
}