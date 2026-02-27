// Classe SwipeBuffer pour gérer les buffers de distances
class SwipeBuffer {
  constructor(finger, phalanx, bufferSize = 18) {
    this.bufferSize = bufferSize;
    this.featureName = this.buildFeatureName(finger, phalanx);
    this.distanceBuffer = Array(this.bufferSize).fill(0);
  }

  buildFeatureName(finger, phalanx) {
    let phalanxName;
    if (phalanx === 1 || phalanx === "base") phalanxName = "base";
    else if (phalanx === 2 || phalanx === "middle") phalanxName = "middle";
    else phalanxName = "tip";
    return `thumb_to_${finger}_${phalanxName}_dist`;
  }

  updateBuffer(distance) {
    this.distanceBuffer.shift();
    this.distanceBuffer.push(distance);
  }

  getFeatureName() {
    return this.featureName;
  }

  calculateTrend() {
    const n = this.distanceBuffer.length;
    if (n < 3) {
      return 0;
    }
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let i = 0; i < n; i++) {
      const distance = this.distanceBuffer[i];
      if (distance !== undefined) {
        sumX += i;
        sumY += distance;
        sumXY += i * distance;
        sumX2 += i * i;
      }
    }
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) {
      return 0;
    }
    const slope = (n * sumXY - sumX * sumY) / denom;
    return isNaN(slope) ? 0 : slope;
  }

  getCurrentAverage(samples = 3) {
    const recentSamples = this.distanceBuffer.slice(-samples);
    if (recentSamples.length === 0) {
      return 0;
    }
    return recentSamples.reduce((sum, val) => sum + val, 0) / recentSamples.length;
  }

  getBuffer() {
    return [...this.distanceBuffer];
  }
}


import { BaseGestureAnalyzer } from "./BaseGestureAnalyzer.js";

/**
 * DATA CONTRACT (at end of handle):
 * - data.analysis.touches: touch events detected on the current frame
 * - data.analysis.distancesAndVelocities: distance features from FeatureExtractingAnalyzer
 * - data.analysis.swipes: current swipe state(s) detected in this frame
 * - data.analysis.swipeEvent: one-frame swipe event (finger_swipe_detected or swipe_ended)
 */

/**
 * SwipeAnalyzer - Detects swipe movement after a touch event
 * Uses touch events and augments data with swipe info when detected.
 */
class SwipeFinger {
  constructor(name, bufferSize = 18) {
    this.name = name;
    // Harmonisation : base=1, middle=2, tip=3
    this.baseBuffer = new SwipeBuffer(name, 1, bufferSize);
    this.middleBuffer = new SwipeBuffer(name, 2, bufferSize);
    this.tipBuffer = new SwipeBuffer(name, 3, bufferSize);
  }

  updateBuffers(distancesAndVelocities) {
    const baseDistance = this.getFeatureValue(distancesAndVelocities, this.baseBuffer.getFeatureName());
    const middleDistance = this.getFeatureValue(distancesAndVelocities, this.middleBuffer.getFeatureName());
    const tipDistance = this.getFeatureValue(distancesAndVelocities, this.tipBuffer.getFeatureName());

    if (typeof baseDistance === "number") {
      this.baseBuffer.updateBuffer(baseDistance);
    }
    if (typeof middleDistance === "number") {
      this.middleBuffer.updateBuffer(middleDistance);
    }
    if (typeof tipDistance === "number") {
      this.tipBuffer.updateBuffer(tipDistance);
    }
  }

  analyzeMovement(elapsedSinceStart) {
    const baseTrend = this.baseBuffer.calculateTrend();
    const middleTrend = this.middleBuffer.calculateTrend();
    const tipTrend = this.tipBuffer.calculateTrend();

    const isEarlyPhase = elapsedSinceStart < 500;
    const trendThreshold = 0.0012;
    const stabilityThreshold = 0.0025;
    const exitThreshold = isEarlyPhase ? 0.006 : 0.004;
    const exitGracePeriod = 400;

    const minBufferFill = Math.min(
      this.baseBuffer.getBuffer().filter((v) => v > 0).length,
      this.middleBuffer.getBuffer().filter((v) => v > 0).length,
      this.tipBuffer.getBuffer().filter((v) => v > 0).length
    );

    if (minBufferFill < 8) {
      return { direction: null, confidence: 0, baseTrend, middleTrend, tipTrend };
    }

    if (elapsedSinceStart >= exitGracePeriod) {
      if (baseTrend > exitThreshold && middleTrend > exitThreshold && tipTrend > exitThreshold) {
        return {
          direction: "exit",
          confidence: Math.min((baseTrend + middleTrend + tipTrend) * 8, 1.0),
          baseTrend,
          middleTrend,
          tipTrend,
        };
      }
    }

    const isDistalCandidate = baseTrend > trendThreshold;
    const isDistalTipCondition = tipTrend < -trendThreshold;
    const isDistalMiddleCondition = Math.abs(middleTrend) < stabilityThreshold;

    if (isDistalCandidate && isDistalTipCondition && isDistalMiddleCondition) {
      return {
        direction: "distal",
        confidence: Math.min((baseTrend + Math.abs(tipTrend)) * 2, 1.0),
        baseTrend,
        middleTrend,
        tipTrend,
      };
    }

    const isProximalCandidate = tipTrend > trendThreshold;
    const isProximalBaseCondition = baseTrend < -trendThreshold;
    const isProximalMiddleCondition = Math.abs(middleTrend) < stabilityThreshold;

    if (isProximalCandidate && isProximalBaseCondition && isProximalMiddleCondition) {
      return {
        direction: "proximal",
        confidence: Math.min((tipTrend + Math.abs(baseTrend)) * 2, 1.0),
        baseTrend,
        middleTrend,
        tipTrend,
      };
    }

    return { direction: null, confidence: 0, baseTrend, middleTrend, tipTrend };
  }

  getCurrentDistances() {
    return {
      base: this.baseBuffer.getCurrentAverage(),
      middle: this.middleBuffer.getCurrentAverage(),
      tip: this.tipBuffer.getCurrentAverage(),
    };
  }

  getFeatureValue(list, name) {
    if (!Array.isArray(list)) {
      return undefined;
    }
    const feature = list.find((item) => item && item.name === name);
    return feature ? feature.value : undefined;
  }
}

export class SwipeAnalyzer extends BaseGestureAnalyzer {
  constructor() {
    super();
    this.state = "IDLE";
    this.monitoringContext = null;
    this.swipeFinger = null;
    this.monitoringStartTime = 0;
    this.monitoringTimeout = 6000;
    this.miniSwipeInterval = 100;
    this.minConfidence = 0.004;
    this.phalanxNames = ["base", "middle", "tip"];
  }

  handle(data) {
    if (!data.analysis) {
      return data;
    }

    data.analysis.swipes = [];
    data.analysis.swipeEvent = null;




    if (this.state === "IDLE") {
      if (data.state && data.state === "touch" && data.event) {
        this.startMonitoring(data.event);
      } else {
        return data;
      }
    }

    if (!this.swipeFinger || !this.monitoringContext) {
      return data;
    }

    if (!Array.isArray(data.analysis.distancesAndVelocities)) {
      return data;
    }

    const now = Date.now();
    const elapsed = now - this.monitoringStartTime;

    if (elapsed > this.monitoringTimeout) {
      this.resetToIdle();
      return data;
    }

    this.swipeFinger.updateBuffers(data.analysis.distancesAndVelocities);

    const currentDistances = this.swipeFinger.getCurrentDistances();
    //const maxDistance = Math.max(currentDistances.base, currentDistances.middle, currentDistances.tip);
    //get the min value instead. If one phalanx is close, that's a good indication.
    const maxDistance = Math.min(currentDistances.base, currentDistances.middle, currentDistances.tip);
    const exitDistanceThreshold = 0.16;

    // Si un release est détecté (state == 'release'), on arrête le swipe
    if (data.state === 'release') {
      this.resetToIdle();
      return data;
    }

    const analysis = this.swipeFinger.analyzeMovement(elapsed);

    if (analysis.direction && analysis.confidence > this.minConfidence) {
      if (analysis.direction === "exit") {
        data.analysis.swipeEvent = this.handleExitDetection(analysis, now);
        this.resetToIdle();

        return data;
      }

      const swipeState = this.handleSwipeDetection(analysis, now);
      if (swipeState) {
        data.event = swipeState;
        console.log("swipe detected:", swipeState);
      }
    }

    return data;
  }

  startMonitoring(touchData) {
    if (!touchData || !touchData.finger) {
      return;
    }

    this.state = "MONITORING";
    this.monitoringContext = {
      finger: touchData.finger,
      // Harmonisation : phalanx doit être 1,2,3 (tip=3)
      phalanx: touchData.phalanx,
      lastSwipeTime: 0,
      swipeCount: 0,
      totalSwipeDistance: 0,
      currentDirection: null,
      touchData,
    };
    this.swipeFinger = new SwipeFinger(touchData.finger);
    this.monitoringStartTime = Date.now();
  }

  getPhalanxIndex(phalanx) {
    if (phalanx === "base") return 1;
    if (phalanx === "middle") return 2;
    if (phalanx === "tip") return 3;

    console.warn("Unknown phalanx:", phalanx);
    return null;
  }

  handleSwipeDetection(analysis, now) {
    const timeSinceLastSwipe = now - this.monitoringContext.lastSwipeTime;
    if (timeSinceLastSwipe < this.miniSwipeInterval) {
      return null;
    }

    this.monitoringContext.lastSwipeTime = now;
    this.monitoringContext.swipeCount += 1;
    this.monitoringContext.currentDirection = analysis.direction;

    const swipeDistance = analysis.confidence * 10;
    this.monitoringContext.totalSwipeDistance += swipeDistance;

    const distances = this.swipeFinger.getCurrentDistances();

    return {
      type: "swipe",
      finger: this.monitoringContext.finger,
      phalanx: this.monitoringContext.phalanx,
      direction: analysis.direction,
      confidence: analysis.confidence,
      swipeCount: this.monitoringContext.swipeCount,
      totalDistance: this.monitoringContext.totalSwipeDistance,
      elapsed: now - this.monitoringStartTime,
      distances,
      trends: {
        base: analysis.baseTrend,
        middle: analysis.middleTrend,
        tip: analysis.tipTrend,
      },
      originalTouch: this.monitoringContext.touchData,
      isMiniSwipe: true,
      expiresAt: now + 500, // feedback valable 0.5 seconde
    };
  }

  handleExitDetection(analysis, now) {
    const distances = this.swipeFinger.getCurrentDistances();
    return {
      reason: "exit",
      finger: this.monitoringContext.finger,
      phalanx: this.monitoringContext.phalanx,
      confidence: analysis.confidence,
      distances,
      trends: {
        base: analysis.baseTrend,
        middle: analysis.middleTrend,
        tip: analysis.tipTrend,
      },
      duration: now - this.monitoringStartTime,
      swipeCount: this.monitoringContext.swipeCount,
      totalDistance: this.monitoringContext.totalSwipeDistance,
      finalDirection: this.monitoringContext.currentDirection,
    };
  }


  resetToIdle() {
    this.state = "IDLE";
    this.monitoringContext = null;
    this.swipeFinger = null;
    this.monitoringStartTime = 0;
  }
}
