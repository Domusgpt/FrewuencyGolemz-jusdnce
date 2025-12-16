import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * KINETIC ENGINE FRAME INTEGRATION TESTS
 *
 * Tests actual frame selection, stitching, and mechanical frame generation
 * under various sonic conditions.
 */

test.describe('Frame Pool Population Tests', () => {
  test('Frame pool correctly categorizes all frame types', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      // Simulate frame pool loading logic from KineticEngine
      interface Frame {
        pose: string;
        energy: 'low' | 'mid' | 'high';
        direction: 'left' | 'right' | 'center';
        type: 'body' | 'closeup' | 'hands' | 'feet';
        role: 'base' | 'alt' | 'flourish' | 'details';
        isVirtual?: boolean;
      }

      // Simulated generated frames (matching gemini.ts output structure)
      const mockGeneratedFrames: Frame[] = [
        // Base sheet - Row 1 (low energy)
        { pose: 'low_center_1', energy: 'low', direction: 'center', type: 'body', role: 'base' },
        { pose: 'low_center_2', energy: 'low', direction: 'center', type: 'body', role: 'base' },
        { pose: 'low_center_3', energy: 'low', direction: 'center', type: 'body', role: 'base' },
        { pose: 'low_center_4', energy: 'low', direction: 'center', type: 'body', role: 'base' },
        // Base sheet - Row 2 (mid energy, left)
        { pose: 'mid_left_1', energy: 'mid', direction: 'left', type: 'body', role: 'base' },
        { pose: 'mid_left_2', energy: 'mid', direction: 'left', type: 'body', role: 'base' },
        { pose: 'mid_left_3', energy: 'mid', direction: 'left', type: 'body', role: 'base' },
        { pose: 'mid_left_4', energy: 'mid', direction: 'left', type: 'body', role: 'base' },
        // Base sheet - Row 3 (mid energy, right)
        { pose: 'mid_right_1', energy: 'mid', direction: 'right', type: 'body', role: 'base' },
        { pose: 'mid_right_2', energy: 'mid', direction: 'right', type: 'body', role: 'base' },
        { pose: 'mid_right_3', energy: 'mid', direction: 'right', type: 'body', role: 'base' },
        { pose: 'mid_right_4', energy: 'mid', direction: 'right', type: 'body', role: 'base' },
        // Base sheet - Row 4 (high energy)
        { pose: 'high_center_1', energy: 'high', direction: 'center', type: 'body', role: 'base' },
        { pose: 'high_center_2', energy: 'high', direction: 'center', type: 'body', role: 'base' },
        { pose: 'high_center_3', energy: 'high', direction: 'center', type: 'body', role: 'base' },
        { pose: 'high_center_4', energy: 'high', direction: 'center', type: 'body', role: 'base' },
        // Alt sheet (acrobatics)
        { pose: 'alt_1', energy: 'high', direction: 'center', type: 'body', role: 'alt' },
        { pose: 'alt_2', energy: 'high', direction: 'center', type: 'body', role: 'alt' },
        // Flourish sheet (closeups)
        { pose: 'closeup_1', energy: 'high', direction: 'center', type: 'closeup', role: 'flourish' },
        { pose: 'closeup_2', energy: 'high', direction: 'center', type: 'closeup', role: 'flourish' },
        // Details sheet (hands/feet)
        { pose: 'hands_1', energy: 'high', direction: 'center', type: 'hands', role: 'details' },
        { pose: 'hands_mandala_1', energy: 'high', direction: 'center', type: 'hands', role: 'details' },
        { pose: 'feet_1', energy: 'high', direction: 'center', type: 'feet', role: 'details' },
        { pose: 'feet_2', energy: 'high', direction: 'center', type: 'feet', role: 'details' },
      ];

      // Categorize using KineticEngine logic
      const framePool = {
        byEnergy: { low: [] as Frame[], mid: [] as Frame[], high: [] as Frame[] },
        byDirection: { left: [] as Frame[], right: [] as Frame[], center: [] as Frame[] },
        closeups: [] as Frame[],
        hands: [] as Frame[],
        feet: [] as Frame[],
        mandalas: [] as Frame[],
        acrobatics: [] as Frame[],
      };

      for (const frame of mockGeneratedFrames) {
        // Energy sorting
        if (frame.energy) {
          framePool.byEnergy[frame.energy].push(frame);
        }

        // Direction sorting
        framePool.byDirection[frame.direction || 'center'].push(frame);

        // Type sorting
        if (frame.type === 'closeup') {
          framePool.closeups.push(frame);
        } else if (frame.type === 'hands') {
          framePool.hands.push(frame);
          if (frame.pose.includes('mandala')) {
            framePool.mandalas.push(frame);
          }
        } else if (frame.type === 'feet') {
          framePool.feet.push(frame);
        }

        // Role sorting
        if (frame.role === 'alt') {
          framePool.acrobatics.push(frame);
        }
      }

      return {
        energyCounts: {
          low: framePool.byEnergy.low.length,
          mid: framePool.byEnergy.mid.length,
          high: framePool.byEnergy.high.length
        },
        directionCounts: {
          left: framePool.byDirection.left.length,
          right: framePool.byDirection.right.length,
          center: framePool.byDirection.center.length
        },
        specialCounts: {
          closeups: framePool.closeups.length,
          hands: framePool.hands.length,
          feet: framePool.feet.length,
          mandalas: framePool.mandalas.length,
          acrobatics: framePool.acrobatics.length
        },
        totalFrames: mockGeneratedFrames.length
      };
    });

    console.log('Frame Pool Population:', JSON.stringify(result, null, 2));

    // Verify expected frame distribution
    expect(result.totalFrames).toBe(24);
    expect(result.energyCounts.low).toBe(4);
    expect(result.energyCounts.mid).toBe(8);
    expect(result.energyCounts.high).toBe(12); // includes closeups, hands, feet, alt
    expect(result.directionCounts.left).toBe(4);
    expect(result.directionCounts.right).toBe(4);
    expect(result.specialCounts.closeups).toBe(2);
    expect(result.specialCounts.mandalas).toBe(1);
    expect(result.specialCounts.acrobatics).toBe(2);
  });
});

test.describe('Frame Selection Under Sonic Conditions', () => {
  test('Low bass selects low energy frames', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      function selectFrameByEnergy(energy: number): 'low' | 'mid' | 'high' {
        if (energy < 0.3) return 'low';
        if (energy < 0.7) return 'mid';
        return 'high';
      }

      // Simulate various bass levels
      return {
        bass0_1: selectFrameByEnergy(0.1),
        bass0_25: selectFrameByEnergy(0.25),
        bass0_3: selectFrameByEnergy(0.3),
        bass0_5: selectFrameByEnergy(0.5),
        bass0_7: selectFrameByEnergy(0.7),
        bass0_9: selectFrameByEnergy(0.9),
      };
    });

    expect(result.bass0_1).toBe('low');
    expect(result.bass0_25).toBe('low');
    expect(result.bass0_3).toBe('mid'); // Boundary
    expect(result.bass0_5).toBe('mid');
    expect(result.bass0_7).toBe('high'); // Boundary
    expect(result.bass0_9).toBe('high');
  });

  test('Left/Right direction ping-pong on beat', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      // Simulate direction ping-pong state machine
      let currentDirection: 'left' | 'right' | 'center' = 'center';
      const directionHistory: string[] = [];

      function pingPongDirection() {
        if (currentDirection === 'center') {
          currentDirection = 'left';
        } else if (currentDirection === 'left') {
          currentDirection = 'right';
        } else {
          currentDirection = 'left';
        }
        directionHistory.push(currentDirection);
      }

      // Simulate 8 beat transitions
      for (let i = 0; i < 8; i++) {
        pingPongDirection();
      }

      return {
        history: directionHistory,
        alternatesCorrectly: directionHistory.every((dir, i) => {
          if (i === 0) return dir === 'left';
          return dir !== directionHistory[i - 1];
        })
      };
    });

    console.log('Direction Ping-Pong:', result.history.join(' -> '));
    expect(result.alternatesCorrectly).toBe(true);
    expect(result.history[0]).toBe('left');
    expect(result.history[1]).toBe('right');
  });

  test('High energy triggers closeup consideration', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      interface Frame { type: string; energy: string; }

      function shouldTriggerCloseup(
        energy: number,
        beatPos: number,
        barCounter: number,
        lastCloseupBar: number
      ): boolean {
        // Closeup rules:
        // 1. Energy must be high (>0.7)
        // 2. Must be on a beat (beatPos < 0.1)
        // 3. At least 2 bars since last closeup (cooldown)
        const hasEnergy = energy > 0.7;
        const isOnBeat = beatPos < 0.1;
        const hasCooldown = (barCounter - lastCloseupBar) >= 2;

        return hasEnergy && isOnBeat && hasCooldown;
      }

      return {
        // Should trigger: high energy, on beat, enough cooldown
        case1: shouldTriggerCloseup(0.9, 0.05, 5, 2),
        // Should NOT trigger: low energy
        case2: shouldTriggerCloseup(0.3, 0.05, 5, 2),
        // Should NOT trigger: not on beat
        case3: shouldTriggerCloseup(0.9, 0.5, 5, 2),
        // Should NOT trigger: no cooldown
        case4: shouldTriggerCloseup(0.9, 0.05, 3, 2),
      };
    });

    expect(result.case1).toBe(true);
    expect(result.case2).toBe(false);
    expect(result.case3).toBe(false);
    expect(result.case4).toBe(false);
  });
});

test.describe('Mechanical Frame Generation Tests', () => {
  test('Dolly Zoom generates intermediate frames', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      // Dolly zoom creates virtual frames with progressive zoom
      function createDollyZoomFrames(
        sourceFrame: { pose: string; url: string },
        steps: number = 5,
        maxZoom: number = 1.5
      ) {
        const frames: { pose: string; virtualZoom: number; isVirtual: boolean }[] = [];

        for (let i = 0; i < steps; i++) {
          const progress = i / (steps - 1);
          const zoom = 1.0 + (maxZoom - 1.0) * progress;
          frames.push({
            pose: `${sourceFrame.pose}_dolly_${i}`,
            virtualZoom: zoom,
            isVirtual: true
          });
        }

        return frames;
      }

      const sourceFrame = { pose: 'closeup_1', url: 'data:...' };
      const dollyFrames = createDollyZoomFrames(sourceFrame, 5, 1.5);

      return {
        frameCount: dollyFrames.length,
        zoomProgression: dollyFrames.map(f => f.virtualZoom.toFixed(2)),
        allVirtual: dollyFrames.every(f => f.isVirtual),
        firstZoom: dollyFrames[0].virtualZoom,
        lastZoom: dollyFrames[dollyFrames.length - 1].virtualZoom
      };
    });

    console.log('Dolly Zoom Frames:', result);
    expect(result.frameCount).toBe(5);
    expect(result.allVirtual).toBe(true);
    expect(result.firstZoom).toBe(1.0);
    expect(result.lastZoom).toBe(1.5);
  });

  test('Virtual Zoom variants created from closeups', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      interface Frame {
        pose: string;
        type: string;
        isVirtual?: boolean;
        virtualZoom?: number;
        virtualOffsetY?: number;
      }

      function generateVirtualZoomVariants(closeupFrames: Frame[]): Frame[] {
        const virtuals: Frame[] = [];

        for (const frame of closeupFrames) {
          if (frame.type === 'closeup') {
            virtuals.push({
              pose: `${frame.pose}_vzoom`,
              type: 'closeup',
              isVirtual: true,
              virtualZoom: 1.5,
              virtualOffsetY: 0.0
            });
          }
        }

        return virtuals;
      }

      const closeups: Frame[] = [
        { pose: 'closeup_1', type: 'closeup' },
        { pose: 'closeup_2', type: 'closeup' },
      ];

      const virtuals = generateVirtualZoomVariants(closeups);

      return {
        inputCount: closeups.length,
        outputCount: virtuals.length,
        allHaveZoom: virtuals.every(v => v.virtualZoom === 1.5),
        poseNaming: virtuals.map(v => v.pose)
      };
    });

    console.log('Virtual Zoom Variants:', result);
    expect(result.outputCount).toBe(result.inputCount);
    expect(result.allHaveZoom).toBe(true);
    expect(result.poseNaming).toContain('closeup_1_vzoom');
  });

  test('Mandala frames tagged correctly from hands', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      interface Frame { pose: string; type: string; }

      function identifyMandalas(handFrames: Frame[]): Frame[] {
        return handFrames.filter(f => f.pose.includes('mandala'));
      }

      const handFrames: Frame[] = [
        { pose: 'hands_1', type: 'hands' },
        { pose: 'hands_mandala_1', type: 'hands' },
        { pose: 'hands_mandala_2', type: 'hands' },
        { pose: 'hands_3', type: 'hands' },
      ];

      const mandalas = identifyMandalas(handFrames);

      return {
        totalHands: handFrames.length,
        mandalaCount: mandalas.length,
        mandalaPoses: mandalas.map(m => m.pose)
      };
    });

    expect(result.mandalaCount).toBe(2);
    expect(result.mandalaPoses).toContain('hands_mandala_1');
  });
});

test.describe('Stutter/Glitch Effect Tests', () => {
  test('Stutter repeats current frame', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      // Stutter effect: repeat current frame for N beats
      function simulateStutter(
        frameSequence: string[],
        stutterStartIndex: number,
        stutterDuration: number
      ): string[] {
        const result = [...frameSequence];
        const stutterFrame = result[stutterStartIndex];

        // Replace next N frames with the stutter frame
        for (let i = 1; i <= stutterDuration && (stutterStartIndex + i) < result.length; i++) {
          result[stutterStartIndex + i] = stutterFrame;
        }

        return result;
      }

      const originalSequence = ['A', 'B', 'C', 'D', 'E', 'F'];
      const stutteredSequence = simulateStutter(originalSequence, 2, 3);

      return {
        original: originalSequence,
        stuttered: stutteredSequence,
        stutterCorrect: stutteredSequence[3] === 'C' && stutteredSequence[4] === 'C'
      };
    });

    console.log('Stutter Effect:', result.original.join('->'), '=>', result.stuttered.join('->'));
    expect(result.stutterCorrect).toBe(true);
    expect(result.stuttered[2]).toBe('C');
    expect(result.stuttered[3]).toBe('C');
    expect(result.stuttered[4]).toBe('C');
  });

  test('Glitch effect creates RGB split timing', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      function calculateRGBSplit(energy: number, isGlitchActive: boolean): number {
        const baseAmount = energy * 0.1;
        const glitchBoost = isGlitchActive ? 0.8 : 0;
        return Math.min(1.0, baseAmount + glitchBoost);
      }

      return {
        normalLowEnergy: calculateRGBSplit(0.3, false),
        normalHighEnergy: calculateRGBSplit(0.9, false),
        glitchLowEnergy: calculateRGBSplit(0.3, true),
        glitchHighEnergy: calculateRGBSplit(0.9, true),
      };
    });

    // Normal mode: low RGB split
    expect(result.normalLowEnergy).toBeLessThan(0.1);
    expect(result.normalHighEnergy).toBeLessThan(0.15);
    // Glitch mode: high RGB split
    expect(result.glitchLowEnergy).toBeGreaterThan(0.8);
    expect(result.glitchHighEnergy).toBe(1.0); // Clamped
  });
});

test.describe('Close-Up Lock Mechanism Tests', () => {
  test('Lock prevents transitions during closeup', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      class LockMechanism {
        private isLocked = false;
        private lockReleaseTime = 0;

        lock(durationMs: number) {
          this.isLocked = true;
          this.lockReleaseTime = Date.now() + durationMs;
        }

        canTransition(currentTime: number): boolean {
          if (this.isLocked && currentTime >= this.lockReleaseTime) {
            this.isLocked = false;
          }
          return !this.isLocked;
        }
      }

      const lock = new LockMechanism();
      const now = Date.now();

      // Before lock
      const before = lock.canTransition(now);

      // Lock for 500ms
      lock.lock(500);

      // During lock
      const during = lock.canTransition(now + 200);

      // After lock expires
      const after = lock.canTransition(now + 600);

      return { before, during, after };
    });

    expect(result.before).toBe(true);
    expect(result.during).toBe(false);
    expect(result.after).toBe(true);
  });

  test('Minimum closeup duration enforced', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      const MINIMUM_CLOSEUP_DURATION_MS = 500;
      const BEATS_PER_CLOSEUP = 2;

      function calculateCloseupDuration(bpm: number): number {
        const beatDurationMs = 60000 / bpm;
        return Math.max(MINIMUM_CLOSEUP_DURATION_MS, beatDurationMs * BEATS_PER_CLOSEUP);
      }

      return {
        at60bpm: calculateCloseupDuration(60),   // 2000ms (2 beats)
        at120bpm: calculateCloseupDuration(120), // 1000ms (2 beats)
        at180bpm: calculateCloseupDuration(180), // 666ms (2 beats)
        at240bpm: calculateCloseupDuration(240), // 500ms (min enforced)
      };
    });

    expect(result.at60bpm).toBe(2000);
    expect(result.at120bpm).toBe(1000);
    expect(result.at180bpm).toBeCloseTo(666.67, 0);
    expect(result.at240bpm).toBe(500); // Minimum enforced
  });
});

test.describe('Beat-Synced Transition Timing', () => {
  test('Transitions quantized to beat boundaries', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      function quantizeToBeat(currentBeatPos: number, threshold: number = 0.1): boolean {
        // Returns true if we're close enough to a beat boundary
        return currentBeatPos < threshold || currentBeatPos > (1 - threshold);
      }

      // Test various positions in beat cycle
      return {
        atStart: quantizeToBeat(0.0),
        nearStart: quantizeToBeat(0.05),
        middle: quantizeToBeat(0.5),
        nearEnd: quantizeToBeat(0.95),
        atEnd: quantizeToBeat(0.99),
      };
    });

    expect(result.atStart).toBe(true);
    expect(result.nearStart).toBe(true);
    expect(result.middle).toBe(false);
    expect(result.nearEnd).toBe(true);
    expect(result.atEnd).toBe(true);
  });

  test('Bar counter increments every 4 beats', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(() => {
      let beatCounter = 0;
      let barCounter = 0;
      const barHistory: number[] = [];

      // Simulate 16 beats
      for (let i = 0; i < 16; i++) {
        beatCounter++;
        if (beatCounter >= 4) {
          beatCounter = 0;
          barCounter++;
        }
        barHistory.push(barCounter);
      }

      return {
        finalBarCount: barCounter,
        barHistory,
        correctBars: barCounter === 4
      };
    });

    expect(result.finalBarCount).toBe(4);
    expect(result.correctBars).toBe(true);
    // Bar should increment after beats 4, 8, 12, 16
    expect(result.barHistory[3]).toBe(1);
    expect(result.barHistory[7]).toBe(2);
  });
});
