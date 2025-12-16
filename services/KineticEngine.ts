/**
 * KINETIC CORE ENGINE (v2.0)
 *
 * The "Choreography Brain" - A DAG-based state machine for audio-reactive animation.
 * Implements the Matrix Jaudnce architecture with:
 * - Directed Acyclic Graph (DAG) for state transitions
 * - 200ms Lookahead Buffer for predictive beat analysis
 * - beatPos metronomic quantization
 * - Close-up Lock mechanism
 * - Auto BPM Detection
 * - Peak/Transient Detection
 * - Debug Telemetry
 */

import { GeneratedFrame, EnergyLevel, SequenceMode, MoveDirection } from '../types';

// --- DEBUG TELEMETRY ---
export interface KineticTelemetry {
  currentBPM: number;
  detectedBPM: number;
  confidence: number;
  bassLevel: number;
  midLevel: number;
  highLevel: number;
  energy: number;
  peakDetected: boolean;
  transientDetected: boolean;
  beatPhase: number;
  framePoolStats: {
    low: number;
    mid: number;
    high: number;
    closeups: number;
    hands: number;
    feet: number;
    mandalas: number;
    virtuals: number;
  };
  transitionHistory: string[];
  audioHistory: number[];
}

// --- KINETIC NODE TYPES ---

export type KineticNodeId =
  | 'idle'
  | 'groove_left'
  | 'groove_right'
  | 'groove_center'
  | 'crouch'
  | 'jump'
  | 'spin'
  | 'vogue_left'
  | 'vogue_right'
  | 'closeup'
  | 'hands'
  | 'feet'
  | 'impact'
  | 'mandala';

export type MechanicalFX = 'none' | 'zoom' | 'mirror' | 'stutter' | 'mandala';
export type TransitionStyle = 'CUT' | 'SLIDE' | 'MORPH' | 'SMOOTH' | 'ZOOM_IN';

export interface KineticNode {
  id: KineticNodeId;
  possibleTransitions: KineticNodeId[];
  energyRequirement: number; // 0.0 - 1.0 threshold to enter
  exitThreshold: number; // Energy below this exits to idle
  mechanicalFx: MechanicalFX;
  preferredTransition: TransitionStyle;
  minDuration: number; // Minimum ms before allowing transition (Lock mechanism)
  frameSelector: (frames: KineticFramePool) => GeneratedFrame | null;
}

export interface KineticFramePool {
  byEnergy: Record<EnergyLevel, GeneratedFrame[]>;
  closeups: GeneratedFrame[];
  hands: GeneratedFrame[];
  feet: GeneratedFrame[];
  mandalas: GeneratedFrame[];
  virtuals: GeneratedFrame[];
  acrobatics: GeneratedFrame[];
  byDirection: Record<MoveDirection, GeneratedFrame[]>;
}

export interface AudioSample {
  bass: number;
  mid: number;
  high: number;
  energy: number;
  timestamp: number;
}

export interface KineticState {
  currentNode: KineticNodeId;
  currentFrame: GeneratedFrame | null;
  transitionProgress: number;
  transitionStyle: TransitionStyle;
  sourceFrame: GeneratedFrame | null;
  beatPos: number; // 0.0 - 1.0 normalized beat position
  barCounter: number;
  phraseCounter: number;
  lastTransitionTime: number;
  isLocked: boolean; // Close-up lock active
  lockReleaseTime: number;
  sequenceMode: SequenceMode;
}

// --- THE KINETIC GRAPH (DAG) ---

const KINETIC_GRAPH: Record<KineticNodeId, KineticNode> = {
  idle: {
    id: 'idle',
    possibleTransitions: ['groove_left', 'groove_right', 'groove_center', 'crouch'],
    energyRequirement: 0,
    exitThreshold: 0,
    mechanicalFx: 'none',
    preferredTransition: 'SMOOTH',
    minDuration: 0,
    frameSelector: (pool) => pool.byEnergy.low[0] || pool.byEnergy.mid[0] || null
  },
  groove_left: {
    id: 'groove_left',
    possibleTransitions: ['idle', 'groove_center', 'vogue_left', 'crouch'],
    energyRequirement: 0.3,
    exitThreshold: 0.2,
    mechanicalFx: 'none',
    preferredTransition: 'CUT',
    minDuration: 100,
    frameSelector: (pool) => pool.byDirection.left[Math.floor(Math.random() * pool.byDirection.left.length)] || pool.byEnergy.mid[0]
  },
  groove_right: {
    id: 'groove_right',
    possibleTransitions: ['idle', 'groove_center', 'vogue_right', 'crouch'],
    energyRequirement: 0.3,
    exitThreshold: 0.2,
    mechanicalFx: 'mirror',
    preferredTransition: 'CUT',
    minDuration: 100,
    frameSelector: (pool) => pool.byDirection.right[Math.floor(Math.random() * pool.byDirection.right.length)] || pool.byEnergy.mid[0]
  },
  groove_center: {
    id: 'groove_center',
    possibleTransitions: ['groove_left', 'groove_right', 'jump', 'spin', 'closeup'],
    energyRequirement: 0.4,
    exitThreshold: 0.3,
    mechanicalFx: 'none',
    preferredTransition: 'CUT',
    minDuration: 150,
    frameSelector: (pool) => pool.byDirection.center[Math.floor(Math.random() * pool.byDirection.center.length)] || pool.byEnergy.mid[0]
  },
  crouch: {
    id: 'crouch',
    possibleTransitions: ['idle', 'jump', 'feet'],
    energyRequirement: 0.5,
    exitThreshold: 0.3,
    mechanicalFx: 'none',
    preferredTransition: 'SMOOTH',
    minDuration: 200,
    frameSelector: (pool) => pool.byEnergy.low[Math.floor(Math.random() * pool.byEnergy.low.length)]
  },
  jump: {
    id: 'jump',
    possibleTransitions: ['crouch', 'groove_center', 'impact'],
    energyRequirement: 0.7,
    exitThreshold: 0.5,
    mechanicalFx: 'zoom',
    preferredTransition: 'CUT',
    minDuration: 100,
    frameSelector: (pool) => pool.acrobatics[Math.floor(Math.random() * pool.acrobatics.length)] || pool.byEnergy.high[0]
  },
  spin: {
    id: 'spin',
    possibleTransitions: ['groove_center', 'jump', 'vogue_left', 'vogue_right'],
    energyRequirement: 0.6,
    exitThreshold: 0.4,
    mechanicalFx: 'none',
    preferredTransition: 'MORPH',
    minDuration: 300,
    frameSelector: (pool) => pool.acrobatics[Math.floor(Math.random() * pool.acrobatics.length)] || pool.byEnergy.high[0]
  },
  vogue_left: {
    id: 'vogue_left',
    possibleTransitions: ['vogue_right', 'groove_left', 'hands', 'mandala'],
    energyRequirement: 0.5,
    exitThreshold: 0.3,
    mechanicalFx: 'none',
    preferredTransition: 'CUT',
    minDuration: 150,
    frameSelector: (pool) => pool.hands[Math.floor(Math.random() * pool.hands.length)] || pool.byDirection.left[0]
  },
  vogue_right: {
    id: 'vogue_right',
    possibleTransitions: ['vogue_left', 'groove_right', 'hands', 'mandala'],
    energyRequirement: 0.5,
    exitThreshold: 0.3,
    mechanicalFx: 'mirror',
    preferredTransition: 'CUT',
    minDuration: 150,
    frameSelector: (pool) => pool.hands[Math.floor(Math.random() * pool.hands.length)] || pool.byDirection.right[0]
  },
  closeup: {
    id: 'closeup',
    possibleTransitions: ['groove_center', 'idle'],
    energyRequirement: 0.6,
    exitThreshold: 0.4,
    mechanicalFx: 'zoom',
    preferredTransition: 'ZOOM_IN',
    minDuration: 500, // Close-up Lock: Minimum 500ms
    frameSelector: (pool) => pool.closeups[Math.floor(Math.random() * pool.closeups.length)] || pool.virtuals[0]
  },
  hands: {
    id: 'hands',
    possibleTransitions: ['vogue_left', 'vogue_right', 'mandala', 'groove_center'],
    energyRequirement: 0.5,
    exitThreshold: 0.3,
    mechanicalFx: 'none',
    preferredTransition: 'CUT',
    minDuration: 200,
    frameSelector: (pool) => pool.hands[Math.floor(Math.random() * pool.hands.length)]
  },
  feet: {
    id: 'feet',
    possibleTransitions: ['crouch', 'groove_left', 'groove_right'],
    energyRequirement: 0.4,
    exitThreshold: 0.2,
    mechanicalFx: 'none',
    preferredTransition: 'CUT',
    minDuration: 200,
    frameSelector: (pool) => pool.feet[Math.floor(Math.random() * pool.feet.length)]
  },
  impact: {
    id: 'impact',
    possibleTransitions: ['groove_center', 'crouch', 'mandala'],
    energyRequirement: 0.8,
    exitThreshold: 0.6,
    mechanicalFx: 'zoom',
    preferredTransition: 'CUT',
    minDuration: 100,
    frameSelector: (pool) => pool.virtuals[Math.floor(Math.random() * pool.virtuals.length)] || pool.byEnergy.high[0]
  },
  mandala: {
    id: 'mandala',
    possibleTransitions: ['hands', 'groove_center', 'impact'],
    energyRequirement: 0.7,
    exitThreshold: 0.5,
    mechanicalFx: 'mandala',
    preferredTransition: 'CUT',
    minDuration: 300,
    frameSelector: (pool) => pool.mandalas[Math.floor(Math.random() * pool.mandalas.length)] || pool.hands[0]
  }
};

// --- BPM DETECTOR ---

export class BPMDetector {
  private beatTimes: number[] = [];
  private lastBeatTime: number = 0;
  private threshold: number = 0.6;
  private adaptiveThreshold: number = 0.6;
  private energyHistory: number[] = [];
  private readonly maxBeats: number = 32;
  private readonly minInterval: number = 250; // Max 240 BPM
  private readonly maxInterval: number = 1500; // Min 40 BPM

  /**
   * Feed a bass sample and detect beats.
   * Returns true if a beat was detected.
   */
  detectBeat(bass: number, timestamp: number): boolean {
    // Update energy history for adaptive threshold
    this.energyHistory.push(bass);
    if (this.energyHistory.length > 60) {
      this.energyHistory.shift();
    }

    // Calculate adaptive threshold based on recent energy
    if (this.energyHistory.length > 10) {
      const avg = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
      const max = Math.max(...this.energyHistory);
      this.adaptiveThreshold = avg + (max - avg) * 0.5;
    }

    const interval = timestamp - this.lastBeatTime;

    // Detect beat: above threshold AND minimum interval passed
    if (bass > this.adaptiveThreshold && interval > this.minInterval) {
      this.lastBeatTime = timestamp;
      this.beatTimes.push(timestamp);

      // Keep only recent beats
      if (this.beatTimes.length > this.maxBeats) {
        this.beatTimes.shift();
      }

      return true;
    }

    return false;
  }

  /**
   * Calculate BPM from detected beats.
   * Returns { bpm, confidence } where confidence is 0-1.
   */
  calculateBPM(): { bpm: number; confidence: number } {
    if (this.beatTimes.length < 4) {
      return { bpm: 120, confidence: 0 };
    }

    // Calculate intervals between beats
    const intervals: number[] = [];
    for (let i = 1; i < this.beatTimes.length; i++) {
      const interval = this.beatTimes[i] - this.beatTimes[i - 1];
      if (interval >= this.minInterval && interval <= this.maxInterval) {
        intervals.push(interval);
      }
    }

    if (intervals.length < 3) {
      return { bpm: 120, confidence: 0 };
    }

    // Use median interval for robustness
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];

    // Calculate BPM
    const bpm = Math.round(60000 / medianInterval);

    // Calculate confidence based on interval consistency
    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / mean; // Coefficient of variation

    // Lower CV = more consistent = higher confidence
    const confidence = Math.max(0, Math.min(1, 1 - cv * 2));

    return { bpm: Math.max(60, Math.min(200, bpm)), confidence };
  }

  reset(): void {
    this.beatTimes = [];
    this.lastBeatTime = 0;
    this.energyHistory = [];
    this.adaptiveThreshold = 0.6;
  }
}

// --- TRANSIENT DETECTOR ---

export class TransientDetector {
  private history: number[] = [];
  private readonly windowSize: number = 8;
  private readonly sensitivity: number = 2.0; // Increased for sharper spikes only
  private lastValue: number = 0;

  /**
   * Detect sharp transients (snares, hi-hats, clicks).
   * Returns true if a transient is detected.
   * Improved: Also checks for sudden jump from previous sample.
   */
  detect(value: number): boolean {
    this.history.push(value);
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }

    if (this.history.length < this.windowSize) {
      this.lastValue = value;
      return false;
    }

    // Calculate local average (excluding current)
    const prevAvg = this.history.slice(0, -1).reduce((a, b) => a + b, 0) / (this.windowSize - 1);

    // Detect transient: current value significantly higher than recent average
    const ratio = value / (prevAvg + 0.01);

    // Also require a sudden jump from the previous sample (not gradual increase)
    const instantDelta = value - this.lastValue;
    this.lastValue = value;

    // Must be a sharp spike: high ratio AND sudden increase
    return ratio > this.sensitivity && value > 0.3 && instantDelta > 0.15;
  }

  reset(): void {
    this.history = [];
    this.lastValue = 0;
  }
}

// --- LOOKAHEAD BUFFER ---

export class AudioLookaheadBuffer {
  private buffer: AudioSample[] = [];
  private readonly bufferSize: number;
  private readonly lookaheadMs: number;
  private peakHistory: number[] = [];

  constructor(lookaheadMs: number = 200, sampleRate: number = 60) {
    this.lookaheadMs = lookaheadMs;
    this.bufferSize = Math.ceil((lookaheadMs / 1000) * sampleRate);
  }

  push(sample: AudioSample): void {
    this.buffer.push(sample);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    // Track energy peaks for visualization
    this.peakHistory.push(sample.energy);
    if (this.peakHistory.length > 120) {
      this.peakHistory.shift();
    }
  }

  /**
   * Analyze future energy by looking at the buffer trend.
   * Returns predicted energy for the next `ms` milliseconds.
   */
  predictEnergy(ms: number = 200): { bass: number; mid: number; high: number; energy: number } {
    if (this.buffer.length < 2) {
      return { bass: 0, mid: 0, high: 0, energy: 0 };
    }

    // Calculate trend from recent samples
    const recentCount = Math.min(this.buffer.length, 10);
    const recent = this.buffer.slice(-recentCount);

    // Weighted average with emphasis on most recent
    let bassSum = 0, midSum = 0, highSum = 0, weightSum = 0;

    for (let i = 0; i < recent.length; i++) {
      const weight = (i + 1) / recent.length; // Linear weight increase
      bassSum += recent[i].bass * weight;
      midSum += recent[i].mid * weight;
      highSum += recent[i].high * weight;
      weightSum += weight;
    }

    const bass = bassSum / weightSum;
    const mid = midSum / weightSum;
    const high = highSum / weightSum;
    const energy = bass * 0.5 + mid * 0.3 + high * 0.2;

    return { bass, mid, high, energy };
  }

  /**
   * Detect if a beat is coming in the near future.
   * Looks for rising bass energy.
   */
  detectUpcomingBeat(threshold: number = 0.6): boolean {
    if (this.buffer.length < 5) return false;

    const recent = this.buffer.slice(-5);
    const trend = recent[4].bass - recent[0].bass;

    return trend > 0.15 && recent[4].bass > threshold * 0.8;
  }

  /**
   * Detect peak (local maximum in energy).
   */
  detectPeak(): boolean {
    if (this.buffer.length < 3) return false;

    const n = this.buffer.length;
    const prev = this.buffer[n - 3].energy;
    const curr = this.buffer[n - 2].energy;
    const next = this.buffer[n - 1].energy;

    return curr > prev && curr > next && curr > 0.4;
  }

  /**
   * Get the current instantaneous values (latest sample).
   */
  getCurrent(): AudioSample | null {
    return this.buffer.length > 0 ? this.buffer[this.buffer.length - 1] : null;
  }

  /**
   * Get energy history for visualization.
   */
  getEnergyHistory(): number[] {
    return [...this.peakHistory];
  }

  clear(): void {
    this.buffer = [];
    this.peakHistory = [];
  }
}

// --- KINETIC ENGINE ---

export class KineticEngine {
  private graph: Record<KineticNodeId, KineticNode> = KINETIC_GRAPH;
  private state: KineticState;
  private framePool: KineticFramePool;
  private audioBuffer: AudioLookaheadBuffer;

  // BPM Detection
  private bpm: number = 120;
  private beatDuration: number = 500; // ms per beat
  private lastBeatTime: number = 0;

  // Enhanced detection
  private bpmDetector: BPMDetector;
  private transientDetector: TransientDetector;
  private autoBPM: boolean = true;
  private bpmConfidence: number = 0;

  // Telemetry
  private transitionHistory: string[] = [];
  private lastPeakDetected: boolean = false;
  private lastTransientDetected: boolean = false;

  constructor() {
    this.state = {
      currentNode: 'idle',
      currentFrame: null,
      transitionProgress: 1.0,
      transitionStyle: 'CUT',
      sourceFrame: null,
      beatPos: 0,
      barCounter: 0,
      phraseCounter: 0,
      lastTransitionTime: 0,
      isLocked: false,
      lockReleaseTime: 0,
      sequenceMode: 'GROOVE'
    };

    this.framePool = {
      byEnergy: { low: [], mid: [], high: [] },
      closeups: [],
      hands: [],
      feet: [],
      mandalas: [],
      virtuals: [],
      acrobatics: [],
      byDirection: { left: [], right: [], center: [] }
    };

    this.audioBuffer = new AudioLookaheadBuffer(200, 60);
    this.bpmDetector = new BPMDetector();
    this.transientDetector = new TransientDetector();
  }

  /**
   * Set BPM for metronomic sync.
   */
  setBPM(bpm: number): void {
    this.bpm = Math.max(60, Math.min(200, bpm));
    this.beatDuration = 60000 / this.bpm;
  }

  /**
   * Load frames into the pool, categorizing by type/energy/direction.
   */
  loadFramePool(frames: GeneratedFrame[]): void {
    // Reset pools
    this.framePool = {
      byEnergy: { low: [], mid: [], high: [] },
      closeups: [],
      hands: [],
      feet: [],
      mandalas: [],
      virtuals: [],
      acrobatics: [],
      byDirection: { left: [], right: [], center: [] }
    };

    for (const frame of frames) {
      // Energy sorting
      if (frame.energy && this.framePool.byEnergy[frame.energy]) {
        this.framePool.byEnergy[frame.energy].push(frame);
      }

      // Direction sorting
      const dir = frame.direction || 'center';
      this.framePool.byDirection[dir].push(frame);

      // Type sorting
      if (frame.type === 'closeup') {
        this.framePool.closeups.push(frame);
      } else if (frame.type === 'hands') {
        this.framePool.hands.push(frame);
        if (frame.pose?.includes('mandala')) {
          this.framePool.mandalas.push(frame);
        }
      } else if (frame.type === 'feet') {
        this.framePool.feet.push(frame);
      }

      // Role sorting
      if (frame.role === 'alt') {
        this.framePool.acrobatics.push(frame);
      }

      // Virtual frames
      if (frame.isVirtual) {
        this.framePool.virtuals.push(frame);
      }
    }

    // Ensure pools have fallbacks
    if (this.framePool.byEnergy.low.length === 0) {
      this.framePool.byEnergy.low = [...this.framePool.byEnergy.mid];
    }
    if (this.framePool.byEnergy.mid.length === 0) {
      this.framePool.byEnergy.mid = [...this.framePool.byEnergy.low];
    }
    if (this.framePool.byDirection.center.length === 0) {
      this.framePool.byDirection.center = [...this.framePool.byEnergy.mid];
    }
  }

  /**
   * Enable/disable automatic BPM detection.
   */
  setAutoBPM(enabled: boolean): void {
    this.autoBPM = enabled;
    if (enabled) {
      this.bpmDetector.reset();
    }
  }

  /**
   * Feed audio sample into the lookahead buffer.
   */
  feedAudio(bass: number, mid: number, high: number): void {
    const now = Date.now();
    const energy = bass * 0.5 + mid * 0.3 + high * 0.2;

    this.audioBuffer.push({
      bass,
      mid,
      high,
      energy,
      timestamp: now
    });

    // Auto BPM detection
    if (this.autoBPM) {
      const beatDetected = this.bpmDetector.detectBeat(bass, now);
      if (beatDetected) {
        const { bpm, confidence } = this.bpmDetector.calculateBPM();
        this.bpmConfidence = confidence;

        // Only update BPM if confidence is high enough
        if (confidence > 0.5) {
          this.setBPM(bpm);
        }
      }
    }

    // Transient detection
    this.lastTransientDetected = this.transientDetector.detect(mid + high);

    // Peak detection
    this.lastPeakDetected = this.audioBuffer.detectPeak();
  }

  /**
   * Main update loop - call every frame.
   */
  update(deltaTime: number): KineticState {
    const now = Date.now();

    // Update beat position (metronomic quantization)
    this.state.beatPos = ((now % this.beatDuration) / this.beatDuration);

    // Update transition progress
    if (this.state.transitionProgress < 1.0) {
      const transitionSpeed = this.getTransitionSpeed(this.state.transitionStyle);
      this.state.transitionProgress += transitionSpeed * deltaTime;
      if (this.state.transitionProgress > 1.0) {
        this.state.transitionProgress = 1.0;
      }
    }

    // Check lock release
    if (this.state.isLocked && now >= this.state.lockReleaseTime) {
      this.state.isLocked = false;
    }

    // Get predicted and current audio
    const predicted = this.audioBuffer.predictEnergy(200);
    const current = this.audioBuffer.getCurrent();

    if (!current) return this.state;

    const { bass, mid, high, energy } = current;

    // Determine sequence mode from audio
    this.updateSequenceMode(bass, mid, high);

    // Check for beat-triggered transition
    const beatTrigger = this.shouldTriggerOnBeat(bass);

    if (beatTrigger && !this.state.isLocked) {
      const timeSinceLastTransition = now - this.state.lastTransitionTime;
      const currentNodeConfig = this.graph[this.state.currentNode];

      // Respect minimum duration
      if (timeSinceLastTransition >= currentNodeConfig.minDuration) {
        this.attemptTransition(energy, bass, mid, high, now);
      }
    }

    // Update bar/phrase counters on beat
    if (this.state.beatPos < 0.1 && this.lastBeatTime < now - (this.beatDuration * 0.9)) {
      this.lastBeatTime = now;
      this.state.barCounter = (this.state.barCounter + 1) % 16;
      this.state.phraseCounter = (this.state.phraseCounter + 1) % 8;
    }

    return this.state;
  }

  /**
   * Determine if we should trigger a transition based on beat position.
   */
  private shouldTriggerOnBeat(bass: number): boolean {
    // Trigger near beat boundaries (first 10% or last 10% of beat)
    const nearBeat = this.state.beatPos < 0.1 || this.state.beatPos > 0.9;

    // Or trigger on strong bass hit
    const strongBass = bass > 0.6;

    return nearBeat || strongBass;
  }

  /**
   * Update sequence mode based on audio characteristics.
   */
  private updateSequenceMode(bass: number, mid: number, high: number): void {
    const isDrop = bass > 0.8;
    const isPeak = high > 0.7;
    const isFill = this.state.phraseCounter === 7;

    const hasCloseups = this.framePool.closeups.length > 0;
    const hasHands = this.framePool.hands.length > 0;
    const hasFeet = this.framePool.feet.length > 0;

    if (isPeak && hasCloseups) {
      this.state.sequenceMode = 'EMOTE';
    } else if (isDrop && hasHands) {
      this.state.sequenceMode = 'IMPACT';
    } else if (this.state.barCounter >= 12 && hasFeet) {
      this.state.sequenceMode = 'FOOTWORK';
    } else if (isFill) {
      this.state.sequenceMode = 'IMPACT';
    } else {
      this.state.sequenceMode = 'GROOVE';
    }
  }

  /**
   * Attempt to transition to a new node based on current audio state.
   */
  private attemptTransition(energy: number, bass: number, mid: number, high: number, now: number): void {
    const currentNode = this.graph[this.state.currentNode];

    // Find valid transitions based on energy
    const validTransitions = currentNode.possibleTransitions.filter(nodeId => {
      const targetNode = this.graph[nodeId];
      return energy >= targetNode.energyRequirement;
    });

    if (validTransitions.length === 0) {
      // Fall back to idle if energy drops
      if (energy < currentNode.exitThreshold) {
        this.transitionTo('idle', now);
      }
      return;
    }

    // Select next node based on sequence mode
    let targetNodeId: KineticNodeId = validTransitions[0];

    switch (this.state.sequenceMode) {
      case 'EMOTE':
        targetNodeId = validTransitions.includes('closeup') ? 'closeup' :
                       validTransitions.includes('hands') ? 'hands' : validTransitions[0];
        break;
      case 'IMPACT':
        targetNodeId = validTransitions.includes('impact') ? 'impact' :
                       validTransitions.includes('mandala') ? 'mandala' :
                       validTransitions.includes('jump') ? 'jump' : validTransitions[0];
        break;
      case 'FOOTWORK':
        targetNodeId = validTransitions.includes('feet') ? 'feet' :
                       validTransitions.includes('crouch') ? 'crouch' : validTransitions[0];
        break;
      case 'GROOVE':
      default:
        // Ping-pong left/right based on bar counter
        if (this.state.barCounter % 2 === 0) {
          targetNodeId = validTransitions.includes('groove_left') ? 'groove_left' :
                        validTransitions.includes('groove_center') ? 'groove_center' : validTransitions[0];
        } else {
          targetNodeId = validTransitions.includes('groove_right') ? 'groove_right' :
                        validTransitions.includes('groove_center') ? 'groove_center' : validTransitions[0];
        }
        break;
    }

    this.transitionTo(targetNodeId, now);
  }

  /**
   * Execute transition to a new node.
   */
  private transitionTo(nodeId: KineticNodeId, now: number): void {
    const targetNode = this.graph[nodeId];
    const frame = targetNode.frameSelector(this.framePool);

    if (!frame) return;

    // Store source frame for transitions
    this.state.sourceFrame = this.state.currentFrame;

    // Update state
    this.state.currentNode = nodeId;
    this.state.currentFrame = frame;
    this.state.transitionProgress = 0;
    this.state.transitionStyle = targetNode.preferredTransition;
    this.state.lastTransitionTime = now;

    // Track transition history
    this.transitionHistory.push(`${nodeId}@${now}`);
    if (this.transitionHistory.length > 50) {
      this.transitionHistory.shift();
    }

    // Apply lock for closeup/impact
    if (targetNode.minDuration >= 500) {
      this.state.isLocked = true;
      this.state.lockReleaseTime = now + targetNode.minDuration;
    }
  }

  /**
   * Get transition speed based on style.
   */
  private getTransitionSpeed(style: TransitionStyle): number {
    switch (style) {
      case 'CUT': return 100.0; // Instant
      case 'MORPH': return 3.0;
      case 'ZOOM_IN': return 4.0;
      case 'SLIDE': return 6.0;
      case 'SMOOTH': return 1.5;
      default: return 10.0;
    }
  }

  /**
   * Force a specific state (for manual triggers).
   */
  forceState(nodeId: KineticNodeId): void {
    this.transitionTo(nodeId, Date.now());
  }

  /**
   * Trigger stutter effect.
   */
  triggerStutter(): void {
    // Re-trigger current frame with instant transition
    this.state.transitionProgress = 0;
    this.state.transitionStyle = 'CUT';
    this.state.sourceFrame = this.state.currentFrame;
  }

  /**
   * Trigger glitch - random high-energy frame.
   */
  triggerGlitch(): void {
    const highFrames = this.framePool.byEnergy.high;
    if (highFrames.length > 0) {
      const randomFrame = highFrames[Math.floor(Math.random() * highFrames.length)];
      this.state.sourceFrame = this.state.currentFrame;
      this.state.currentFrame = randomFrame;
      this.state.transitionProgress = 0;
      this.state.transitionStyle = 'CUT';
    }
  }

  /**
   * Get current state for rendering.
   */
  getState(): KineticState {
    return { ...this.state };
  }

  /**
   * Get current node configuration.
   */
  getCurrentNodeConfig(): KineticNode {
    return this.graph[this.state.currentNode];
  }

  /**
   * Get current BPM.
   */
  getBPM(): number {
    return this.bpm;
  }

  /**
   * Get BPM confidence (0-1).
   */
  getBPMConfidence(): number {
    return this.bpmConfidence;
  }

  /**
   * Get full telemetry for debug visualization.
   */
  getTelemetry(): KineticTelemetry {
    const current = this.audioBuffer.getCurrent();

    return {
      currentBPM: this.bpm,
      detectedBPM: this.bpmDetector.calculateBPM().bpm,
      confidence: this.bpmConfidence,
      bassLevel: current?.bass || 0,
      midLevel: current?.mid || 0,
      highLevel: current?.high || 0,
      energy: current?.energy || 0,
      peakDetected: this.lastPeakDetected,
      transientDetected: this.lastTransientDetected,
      beatPhase: this.state.beatPos,
      framePoolStats: {
        low: this.framePool.byEnergy.low.length,
        mid: this.framePool.byEnergy.mid.length,
        high: this.framePool.byEnergy.high.length,
        closeups: this.framePool.closeups.length,
        hands: this.framePool.hands.length,
        feet: this.framePool.feet.length,
        mandalas: this.framePool.mandalas.length,
        virtuals: this.framePool.virtuals.length
      },
      transitionHistory: [...this.transitionHistory].slice(-10),
      audioHistory: this.audioBuffer.getEnergyHistory()
    };
  }

  /**
   * Reset detectors (useful when changing tracks).
   */
  resetDetectors(): void {
    this.bpmDetector.reset();
    this.transientDetector.reset();
    this.audioBuffer.clear();
    this.transitionHistory = [];
    this.bpmConfidence = 0;
  }
}

// --- MECHANICAL FRAME GENERATORS ---

/**
 * Create a dolly zoom (virtual camera push) from an existing frame.
 */
export const createDollyZoom = (
  frameUrl: string,
  zoomFactor: number = 1.4,
  centerOffset: { x: number; y: number } = { x: 0, y: 0 }
): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(frameUrl);
        return;
      }

      // Calculate crop region for zoom
      const cropW = img.width / zoomFactor;
      const cropH = img.height / zoomFactor;
      const cropX = (img.width - cropW) / 2 + centerOffset.x;
      const cropY = (img.height - cropH) / 2 + centerOffset.y;

      // Draw the cropped region to fill the canvas
      ctx.drawImage(
        img,
        cropX, cropY, cropW, cropH, // Source
        0, 0, canvas.width, canvas.height // Destination
      );

      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };

    img.onerror = () => resolve(frameUrl);
    img.src = frameUrl;
  });
};

/**
 * Create a stutter frame (temporal hold).
 */
export const createStutterFrames = (
  frameUrl: string,
  count: number = 3
): Promise<string[]> => {
  // For stutter, we return the same frame multiple times
  // The engine handles the timing
  return Promise.resolve(Array(count).fill(frameUrl));
};

/**
 * Generate virtual zoom variants for closeup frames.
 */
export const generateVirtualZoomVariants = async (
  frame: GeneratedFrame,
  zoomLevels: number[] = [1.25, 1.5, 1.75]
): Promise<GeneratedFrame[]> => {
  const variants: GeneratedFrame[] = [];

  for (const zoom of zoomLevels) {
    const zoomedUrl = await createDollyZoom(frame.url, zoom);
    variants.push({
      ...frame,
      url: zoomedUrl,
      pose: `${frame.pose}_vzoom_${Math.round(zoom * 100)}`,
      isVirtual: true,
      virtualZoom: zoom
    });
  }

  return variants;
};
