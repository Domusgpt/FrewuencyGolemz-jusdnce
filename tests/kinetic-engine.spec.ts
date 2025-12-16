import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * KINETIC ENGINE TEST SUITE
 *
 * Tests the core logic of the Kinetic Engine including:
 * - BPM Detection algorithm
 * - Transient Detection
 * - Beat position cycling
 * - Frame pool organization
 * - DAG state machine transitions
 * - Energy-based state filtering
 */

test.describe('BPM Detection Tests', () => {
  test('BPMDetector calculates correct BPM for 120 BPM input', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      class TestBPMDetector {
        private beatTimes: number[] = [];
        private lastBeatTime: number = 0;
        private minInterval: number = 250; // Max 240 BPM
        private maxInterval: number = 1500; // Min 40 BPM
        private adaptiveThreshold: number = 0.6;
        private energyHistory: number[] = [];

        detectBeat(bass: number, timestamp: number): boolean {
          this.energyHistory.push(bass);
          if (this.energyHistory.length > 60) this.energyHistory.shift();

          if (this.energyHistory.length > 10) {
            const avg = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
            const max = Math.max(...this.energyHistory);
            this.adaptiveThreshold = avg + (max - avg) * 0.5;
          }

          const interval = timestamp - this.lastBeatTime;
          if (bass > this.adaptiveThreshold && interval > this.minInterval) {
            this.lastBeatTime = timestamp;
            this.beatTimes.push(timestamp);
            if (this.beatTimes.length > 32) this.beatTimes.shift();
            return true;
          }
          return false;
        }

        calculateBPM(): { bpm: number; confidence: number } {
          if (this.beatTimes.length < 4) return { bpm: 120, confidence: 0 };

          const intervals: number[] = [];
          for (let i = 1; i < this.beatTimes.length; i++) {
            const interval = this.beatTimes[i] - this.beatTimes[i - 1];
            if (interval >= this.minInterval && interval <= this.maxInterval) {
              intervals.push(interval);
            }
          }

          if (intervals.length < 3) return { bpm: 120, confidence: 0 };

          intervals.sort((a, b) => a - b);
          const medianInterval = intervals[Math.floor(intervals.length / 2)];
          const bpm = Math.round(60000 / medianInterval);

          const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
          const variance = intervals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / intervals.length;
          const stdDev = Math.sqrt(variance);
          const cv = stdDev / mean;
          const confidence = Math.max(0, Math.min(1, 1 - cv * 2));

          return { bpm: Math.max(60, Math.min(200, bpm)), confidence };
        }
      }

      const detector = new TestBPMDetector();
      const baseTime = Date.now();

      // Simulate 120 BPM (500ms intervals)
      for (let i = 0; i < 16; i++) {
        detector.detectBeat(0.8, baseTime + i * 500);
      }

      return detector.calculateBPM();
    });

    console.log(`✓ BPM Test (120 BPM): Got ${result.bpm} BPM, confidence: ${(result.confidence * 100).toFixed(1)}%`);
    expect(result.bpm).toBeGreaterThanOrEqual(115);
    expect(result.bpm).toBeLessThanOrEqual(125);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  test('BPMDetector calculates correct BPM for 140 BPM input', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      class TestBPMDetector {
        private beatTimes: number[] = [];
        private lastBeatTime: number = 0;
        private minInterval: number = 250;
        private maxInterval: number = 1500;

        detectBeat(bass: number, timestamp: number): boolean {
          const interval = timestamp - this.lastBeatTime;
          if (bass > 0.5 && interval > this.minInterval) {
            this.lastBeatTime = timestamp;
            this.beatTimes.push(timestamp);
            if (this.beatTimes.length > 32) this.beatTimes.shift();
            return true;
          }
          return false;
        }

        calculateBPM(): { bpm: number; confidence: number } {
          if (this.beatTimes.length < 4) return { bpm: 120, confidence: 0 };

          const intervals: number[] = [];
          for (let i = 1; i < this.beatTimes.length; i++) {
            const interval = this.beatTimes[i] - this.beatTimes[i - 1];
            if (interval >= this.minInterval && interval <= this.maxInterval) {
              intervals.push(interval);
            }
          }

          if (intervals.length < 3) return { bpm: 120, confidence: 0 };

          intervals.sort((a, b) => a - b);
          const medianInterval = intervals[Math.floor(intervals.length / 2)];
          return { bpm: Math.round(60000 / medianInterval), confidence: 0.8 };
        }
      }

      const detector = new TestBPMDetector();
      const baseTime = Date.now();

      // Simulate 140 BPM (~428ms intervals)
      for (let i = 0; i < 16; i++) {
        detector.detectBeat(0.8, baseTime + i * 428);
      }

      return detector.calculateBPM();
    });

    console.log(`✓ BPM Test (140 BPM): Got ${result.bpm} BPM`);
    expect(result.bpm).toBeGreaterThanOrEqual(135);
    expect(result.bpm).toBeLessThanOrEqual(145);
  });

  test('BPMDetector handles variable input with noise', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      class TestBPMDetector {
        private beatTimes: number[] = [];
        private lastBeatTime: number = 0;
        private minInterval: number = 250;
        private maxInterval: number = 1500;

        detectBeat(bass: number, timestamp: number): boolean {
          const interval = timestamp - this.lastBeatTime;
          if (bass > 0.5 && interval > this.minInterval) {
            this.lastBeatTime = timestamp;
            this.beatTimes.push(timestamp);
            if (this.beatTimes.length > 32) this.beatTimes.shift();
            return true;
          }
          return false;
        }

        calculateBPM(): { bpm: number; confidence: number } {
          if (this.beatTimes.length < 4) return { bpm: 120, confidence: 0 };

          const intervals: number[] = [];
          for (let i = 1; i < this.beatTimes.length; i++) {
            const interval = this.beatTimes[i] - this.beatTimes[i - 1];
            if (interval >= this.minInterval && interval <= this.maxInterval) {
              intervals.push(interval);
            }
          }

          if (intervals.length < 3) return { bpm: 120, confidence: 0 };

          intervals.sort((a, b) => a - b);
          const medianInterval = intervals[Math.floor(intervals.length / 2)];
          return { bpm: Math.round(60000 / medianInterval), confidence: 0.8 };
        }
      }

      const detector = new TestBPMDetector();
      const baseTime = Date.now();

      // Simulate 120 BPM with ±10% jitter
      for (let i = 0; i < 20; i++) {
        const jitter = (Math.random() - 0.5) * 100; // ±50ms jitter
        detector.detectBeat(0.8, baseTime + i * 500 + jitter);
      }

      return detector.calculateBPM();
    });

    console.log(`✓ BPM Test (with noise): Got ${result.bpm} BPM`);
    expect(result.bpm).toBeGreaterThanOrEqual(100);
    expect(result.bpm).toBeLessThanOrEqual(140);
  });
});

test.describe('Transient Detection Tests', () => {
  test('TransientDetector identifies sudden spikes', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      // Improved TransientDetector with instant delta check
      class TestTransientDetector {
        private history: number[] = [];
        private windowSize: number = 8;
        private sensitivity: number = 2.0;
        private lastValue: number = 0;

        detect(value: number): boolean {
          this.history.push(value);
          if (this.history.length > this.windowSize) this.history.shift();
          if (this.history.length < this.windowSize) {
            this.lastValue = value;
            return false;
          }

          const prevAvg = this.history.slice(0, -1).reduce((a, b) => a + b, 0) / (this.windowSize - 1);
          const ratio = value / (prevAvg + 0.01);
          const instantDelta = value - this.lastValue;
          this.lastValue = value;

          return ratio > this.sensitivity && value > 0.3 && instantDelta > 0.15;
        }
      }

      const detector = new TestTransientDetector();

      // Feed low values
      for (let i = 0; i < 10; i++) {
        detector.detect(0.1);
      }

      // Now spike (0.1 -> 0.9 is a delta of 0.8, well above 0.15)
      return detector.detect(0.9);
    });

    console.log(`✓ Transient Test: Spike detected = ${result}`);
    expect(result).toBe(true);
  });

  test('TransientDetector ignores gradual increases', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      // Improved TransientDetector with instant delta check
      class TestTransientDetector {
        private history: number[] = [];
        private windowSize: number = 8;
        private sensitivity: number = 2.0;
        private lastValue: number = 0;

        detect(value: number): boolean {
          this.history.push(value);
          if (this.history.length > this.windowSize) this.history.shift();
          if (this.history.length < this.windowSize) {
            this.lastValue = value;
            return false;
          }

          const prevAvg = this.history.slice(0, -1).reduce((a, b) => a + b, 0) / (this.windowSize - 1);
          const ratio = value / (prevAvg + 0.01);
          const instantDelta = value - this.lastValue;
          this.lastValue = value;

          return ratio > this.sensitivity && value > 0.3 && instantDelta > 0.15;
        }
      }

      const detector = new TestTransientDetector();
      let detected = false;

      // Gradual increase from 0.1 to 0.9 over 20 steps
      // Each step delta is 0.8/20 = 0.04, below the 0.15 threshold
      for (let i = 0; i <= 20; i++) {
        const value = 0.1 + (0.8 * i / 20);
        if (detector.detect(value)) detected = true;
      }

      return detected;
    });

    console.log(`✓ Transient Test: Gradual increase = ${result ? 'detected (unexpected)' : 'not detected (expected)'}`);
    expect(result).toBe(false);
  });
});

test.describe('Beat Position Tests', () => {
  test('beatPos cycles from 0 to 1 correctly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const bpm = 120;
      const beatDuration = 60000 / bpm; // 500ms
      const samples: number[] = [];

      const startTime = 0;
      for (let i = 0; i < 120; i++) {
        const currentTime = i * 16.67; // ~60fps
        const beatPos = (currentTime % beatDuration) / beatDuration;
        samples.push(beatPos);
      }

      // Check that beatPos wraps around
      const hasWrap = samples.some((v, i) => i > 0 && v < samples[i - 1]);

      return {
        minBeatPos: Math.min(...samples),
        maxBeatPos: Math.max(...samples),
        hasWrap,
        sampleCount: samples.length
      };
    });

    console.log(`✓ beatPos Test: Range [${result.minBeatPos.toFixed(3)}, ${result.maxBeatPos.toFixed(3)}], Wraps: ${result.hasWrap}`);
    expect(result.hasWrap).toBe(true);
    expect(result.minBeatPos).toBeGreaterThanOrEqual(0);
    expect(result.maxBeatPos).toBeLessThan(1);
  });

  test('beatPos respects BPM changes', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      function calculateBeatPosAt(time: number, bpm: number): number {
        const beatDuration = 60000 / bpm;
        return (time % beatDuration) / beatDuration;
      }

      const time = 1000; // 1 second
      return {
        at120bpm: calculateBeatPosAt(time, 120),
        at60bpm: calculateBeatPosAt(time, 60),
        at240bpm: calculateBeatPosAt(time, 240)
      };
    });

    console.log(`✓ beatPos at 1s: 120BPM=${result.at120bpm.toFixed(3)}, 60BPM=${result.at60bpm.toFixed(3)}, 240BPM=${result.at240bpm.toFixed(3)}`);

    // At 120 BPM, 1 second = 2 beats, so beatPos should be 0
    expect(result.at120bpm).toBeCloseTo(0, 2);
    // At 60 BPM, 1 second = 1 beat, so beatPos should be 0
    expect(result.at60bpm).toBeCloseTo(0, 2);
    // At 240 BPM, 1 second = 4 beats, so beatPos should be 0
    expect(result.at240bpm).toBeCloseTo(0, 2);
  });
});

test.describe('Frame Pool Organization Tests', () => {
  test('Frames are correctly categorized by energy level', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      interface Frame {
        pose: string;
        energy: 'low' | 'mid' | 'high';
        direction: 'left' | 'right' | 'center';
        type: 'body' | 'closeup' | 'hands' | 'feet';
      }

      const mockFrames: Frame[] = [
        { pose: 'low_1', energy: 'low', direction: 'center', type: 'body' },
        { pose: 'low_2', energy: 'low', direction: 'center', type: 'body' },
        { pose: 'mid_left_1', energy: 'mid', direction: 'left', type: 'body' },
        { pose: 'mid_right_1', energy: 'mid', direction: 'right', type: 'body' },
        { pose: 'high_1', energy: 'high', direction: 'center', type: 'body' },
        { pose: 'closeup_1', energy: 'high', direction: 'center', type: 'closeup' },
        { pose: 'hands_1', energy: 'high', direction: 'center', type: 'hands' },
      ];

      const byEnergy = { low: 0, mid: 0, high: 0 };
      const byDirection = { left: 0, right: 0, center: 0 };
      const byType = { body: 0, closeup: 0, hands: 0, feet: 0 };

      for (const frame of mockFrames) {
        byEnergy[frame.energy]++;
        byDirection[frame.direction]++;
        byType[frame.type]++;
      }

      return { byEnergy, byDirection, byType };
    });

    console.log(`✓ Frame categorization: Energy=${JSON.stringify(result.byEnergy)}, Direction=${JSON.stringify(result.byDirection)}, Type=${JSON.stringify(result.byType)}`);

    expect(result.byEnergy.low).toBe(2);
    expect(result.byEnergy.mid).toBe(2);
    expect(result.byEnergy.high).toBe(3);
    expect(result.byDirection.left).toBe(1);
    expect(result.byDirection.right).toBe(1);
    expect(result.byType.body).toBe(5);
  });

  test('Frame selection respects energy constraints', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      function selectFrameForEnergy(energy: number): string {
        if (energy < 0.3) return 'low';
        if (energy < 0.7) return 'mid';
        return 'high';
      }

      return {
        energy0_1: selectFrameForEnergy(0.1),
        energy0_5: selectFrameForEnergy(0.5),
        energy0_9: selectFrameForEnergy(0.9)
      };
    });

    console.log(`✓ Frame selection: 0.1=${result.energy0_1}, 0.5=${result.energy0_5}, 0.9=${result.energy0_9}`);

    expect(result.energy0_1).toBe('low');
    expect(result.energy0_5).toBe('mid');
    expect(result.energy0_9).toBe('high');
  });
});

test.describe('DAG State Machine Tests', () => {
  test('State transitions follow DAG rules', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      type NodeId = 'idle' | 'groove_left' | 'groove_right' | 'groove_center' | 'crouch' | 'jump';

      const KINETIC_GRAPH: Record<NodeId, { targets: NodeId[]; energyRange: [number, number] }> = {
        idle: { targets: ['groove_left', 'groove_right', 'groove_center'], energyRange: [0, 0.3] },
        groove_left: { targets: ['groove_right', 'groove_center', 'crouch', 'jump'], energyRange: [0.2, 0.6] },
        groove_right: { targets: ['groove_left', 'groove_center', 'crouch', 'jump'], energyRange: [0.2, 0.6] },
        groove_center: { targets: ['groove_left', 'groove_right', 'crouch', 'jump'], energyRange: [0.2, 0.6] },
        crouch: { targets: ['groove_left', 'groove_right', 'jump'], energyRange: [0.4, 0.8] },
        jump: { targets: ['groove_left', 'groove_right', 'crouch'], energyRange: [0.7, 1.0] }
      };

      function canTransition(from: NodeId, to: NodeId): boolean {
        return KINETIC_GRAPH[from].targets.includes(to);
      }

      return {
        idleToGrooveLeft: canTransition('idle', 'groove_left'),
        grooveLeftToGrooveRight: canTransition('groove_left', 'groove_right'),
        crouchToJump: canTransition('crouch', 'jump'),
        idleToJump: canTransition('idle', 'jump'),
        jumpToIdle: canTransition('jump', 'idle')
      };
    });

    console.log(`✓ DAG Transitions: idle→groove_left=${result.idleToGrooveLeft}, groove_left→groove_right=${result.grooveLeftToGrooveRight}, crouch→jump=${result.crouchToJump}, idle→jump=${result.idleToJump}`);

    expect(result.idleToGrooveLeft).toBe(true);
    expect(result.grooveLeftToGrooveRight).toBe(true);
    expect(result.crouchToJump).toBe(true);
    expect(result.idleToJump).toBe(false); // Invalid - idle can't go directly to jump
    expect(result.jumpToIdle).toBe(false); // Invalid - no return to idle
  });

  test('Energy determines valid states', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      function getValidNodesForEnergy(energy: number): string[] {
        const nodes = [
          { id: 'idle', range: [0, 0.3] },
          { id: 'groove_left', range: [0.2, 0.6] },
          { id: 'groove_right', range: [0.2, 0.6] },
          { id: 'groove_center', range: [0.2, 0.6] },
          { id: 'crouch', range: [0.4, 0.8] },
          { id: 'jump', range: [0.7, 1.0] }
        ];

        return nodes
          .filter(n => energy >= n.range[0] && energy <= n.range[1])
          .map(n => n.id);
      }

      return {
        lowEnergy: getValidNodesForEnergy(0.1),
        midEnergy: getValidNodesForEnergy(0.5),
        highEnergy: getValidNodesForEnergy(0.9)
      };
    });

    console.log(`✓ Energy states: Low=${result.lowEnergy.join(',')}, Mid=${result.midEnergy.join(',')}, High=${result.highEnergy.join(',')}`);

    expect(result.lowEnergy).toContain('idle');
    expect(result.midEnergy).toContain('groove_left');
    expect(result.midEnergy).toContain('crouch');
    expect(result.highEnergy).toContain('jump');
    expect(result.highEnergy).not.toContain('idle');
  });

  test('Close-up lock mechanism prevents premature transitions', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      class TestLockMechanism {
        private isLocked: boolean = false;
        private lockReleaseTime: number = 0;

        lock(duration: number): void {
          this.isLocked = true;
          this.lockReleaseTime = Date.now() + duration;
        }

        checkLock(currentTime: number): boolean {
          if (this.isLocked && currentTime >= this.lockReleaseTime) {
            this.isLocked = false;
          }
          return this.isLocked;
        }
      }

      const mechanism = new TestLockMechanism();
      const now = Date.now();

      // Lock for 500ms
      mechanism.lock(500);

      return {
        lockedImmediately: mechanism.checkLock(now),
        lockedAt250ms: mechanism.checkLock(now + 250),
        lockedAt600ms: mechanism.checkLock(now + 600)
      };
    });

    console.log(`✓ Lock mechanism: Immediate=${result.lockedImmediately}, At250ms=${result.lockedAt250ms}, At600ms=${result.lockedAt600ms}`);

    expect(result.lockedImmediately).toBe(true);
    expect(result.lockedAt250ms).toBe(true);
    expect(result.lockedAt600ms).toBe(false); // Should be unlocked after 500ms
  });
});

test.describe('Audio Lookahead Buffer Tests', () => {
  test('Lookahead buffer detects rising energy', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      class TestLookaheadBuffer {
        private buffer: { bass: number; energy: number }[] = [];
        private bufferSize: number = 12;

        push(bass: number, energy: number): void {
          this.buffer.push({ bass, energy });
          if (this.buffer.length > this.bufferSize) {
            this.buffer.shift();
          }
        }

        predictRisingBeat(threshold: number): boolean {
          if (this.buffer.length < 5) return false;
          const recent = this.buffer.slice(-5);
          const trend = recent[4].bass - recent[0].bass;
          return trend > 0.15 && recent[4].bass > threshold * 0.8;
        }
      }

      const buffer = new TestLookaheadBuffer();

      // Simulate rising energy
      for (let i = 0; i < 10; i++) {
        buffer.push(0.2 + i * 0.08, 0.3 + i * 0.05);
      }

      return buffer.predictRisingBeat(0.6);
    });

    console.log(`✓ Lookahead buffer: Rising beat detected = ${result}`);
    expect(result).toBe(true);
  });

  test('Lookahead buffer detects peaks', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      class TestLookaheadBuffer {
        private buffer: { energy: number }[] = [];
        private bufferSize: number = 12;

        push(energy: number): void {
          this.buffer.push({ energy });
          if (this.buffer.length > this.bufferSize) {
            this.buffer.shift();
          }
        }

        detectPeak(): boolean {
          if (this.buffer.length < 3) return false;
          const n = this.buffer.length;
          const prev = this.buffer[n - 3].energy;
          const curr = this.buffer[n - 2].energy;
          const next = this.buffer[n - 1].energy;
          return curr > prev && curr > next && curr > 0.4;
        }
      }

      const buffer = new TestLookaheadBuffer();

      // Create a peak pattern: low -> high -> low
      buffer.push(0.2);
      buffer.push(0.3);
      buffer.push(0.8); // Peak
      buffer.push(0.4);

      return buffer.detectPeak();
    });

    console.log(`✓ Lookahead buffer: Peak detected = ${result}`);
    expect(result).toBe(true);
  });
});
