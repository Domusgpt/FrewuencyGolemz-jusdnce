import React, { useEffect, useRef } from 'react';
import { KineticTelemetry } from '../services/KineticEngine';
import { Activity, Radio, Zap, BarChart3, Clock, Layers, ChevronRight } from 'lucide-react';

interface DebugPanelProps {
  telemetry: KineticTelemetry | null;
  isVisible: boolean;
  onClose: () => void;
}

/**
 * Real-time debug visualization panel for the Kinetic Engine.
 * Shows audio levels, BPM detection, frame pool stats, and transition history.
 */
export const KineticDebugPanel: React.FC<DebugPanelProps> = ({ telemetry, isVisible, onClose }) => {
  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  // Draw waveform visualization
  useEffect(() => {
    if (!telemetry || !waveformCanvasRef.current) return;

    const canvas = waveformCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Draw background grid
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)';
    ctx.lineWidth = 1;
    for (let y = 0; y < height; y += height / 4) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw energy history waveform
    const history = telemetry.audioHistory;
    if (history.length > 1) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.8)';
      ctx.lineWidth = 2;

      for (let i = 0; i < history.length; i++) {
        const x = (i / history.length) * width;
        const y = height - (history[i] * height);
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Fill under the curve
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      ctx.fillStyle = 'rgba(139, 92, 246, 0.1)';
      ctx.fill();
    }

    // Draw beat phase indicator
    const beatX = telemetry.beatPhase * width;
    ctx.strokeStyle = 'rgba(255, 255, 0, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(beatX, 0);
    ctx.lineTo(beatX, height);
    ctx.stroke();

    // Draw peak/transient markers
    if (telemetry.peakDetected) {
      ctx.fillStyle = 'rgba(0, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(width - 10, 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (telemetry.transientDetected) {
      ctx.fillStyle = 'rgba(255, 0, 255, 0.8)';
      ctx.beginPath();
      ctx.arc(width - 25, 10, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [telemetry]);

  if (!isVisible || !telemetry) return null;

  const confidenceColor = telemetry.confidence > 0.7 ? 'text-green-400' :
                          telemetry.confidence > 0.4 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className="fixed top-20 right-4 w-80 bg-black/90 backdrop-blur-xl border border-brand-500/30 rounded-xl shadow-2xl z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-brand-900/50 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-brand-400" />
          <span className="text-xs font-bold text-white tracking-widest">KINETIC DEBUG</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-xs">✕</button>
      </div>

      {/* Waveform */}
      <div className="p-3 border-b border-white/5">
        <canvas
          ref={waveformCanvasRef}
          width={280}
          height={60}
          className="w-full rounded bg-black/50"
        />
        <div className="flex justify-between mt-1 text-[8px] text-gray-500">
          <span>ENERGY HISTORY</span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" /> PEAK
            <span className="w-2 h-2 rounded-full bg-pink-400 inline-block" /> TRANS
          </span>
        </div>
      </div>

      {/* Audio Levels */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 size={12} className="text-brand-400" />
          <span className="text-[10px] font-bold text-gray-400 tracking-wider">AUDIO LEVELS</span>
        </div>
        <div className="space-y-2">
          <LevelBar label="BASS" value={telemetry.bassLevel} color="bg-red-500" />
          <LevelBar label="MID" value={telemetry.midLevel} color="bg-yellow-500" />
          <LevelBar label="HIGH" value={telemetry.highLevel} color="bg-cyan-500" />
          <LevelBar label="ENERGY" value={telemetry.energy} color="bg-brand-500" />
        </div>
      </div>

      {/* BPM Detection */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Radio size={12} className="text-brand-400" />
          <span className="text-[10px] font-bold text-gray-400 tracking-wider">BPM DETECTION</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-black/40 rounded p-2 text-center">
            <div className="text-lg font-mono font-bold text-yellow-400">{telemetry.currentBPM}</div>
            <div className="text-[8px] text-gray-500">CURRENT</div>
          </div>
          <div className="bg-black/40 rounded p-2 text-center">
            <div className="text-lg font-mono font-bold text-brand-300">{telemetry.detectedBPM}</div>
            <div className="text-[8px] text-gray-500">DETECTED</div>
          </div>
          <div className="bg-black/40 rounded p-2 text-center">
            <div className={`text-lg font-mono font-bold ${confidenceColor}`}>
              {(telemetry.confidence * 100).toFixed(0)}%
            </div>
            <div className="text-[8px] text-gray-500">CONFIDENCE</div>
          </div>
        </div>
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <Clock size={10} className="text-gray-500" />
            <span className="text-[9px] text-gray-500">BEAT PHASE:</span>
            <div className="flex-1 h-1.5 bg-black/40 rounded-full overflow-hidden">
              <div
                className="h-full bg-yellow-400 transition-all duration-75"
                style={{ width: `${telemetry.beatPhase * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Frame Pool Stats */}
      <div className="p-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Layers size={12} className="text-brand-400" />
          <span className="text-[10px] font-bold text-gray-400 tracking-wider">FRAME POOL</span>
        </div>
        <div className="grid grid-cols-4 gap-1 text-center">
          <StatBox label="LOW" value={telemetry.framePoolStats.low} />
          <StatBox label="MID" value={telemetry.framePoolStats.mid} />
          <StatBox label="HIGH" value={telemetry.framePoolStats.high} />
          <StatBox label="CLOSE" value={telemetry.framePoolStats.closeups} />
          <StatBox label="HANDS" value={telemetry.framePoolStats.hands} />
          <StatBox label="FEET" value={telemetry.framePoolStats.feet} />
          <StatBox label="MANDALA" value={telemetry.framePoolStats.mandalas} />
          <StatBox label="VIRTUAL" value={telemetry.framePoolStats.virtuals} />
        </div>
      </div>

      {/* Transition History */}
      <div className="p-3 max-h-32 overflow-y-auto">
        <div className="flex items-center gap-2 mb-2">
          <Zap size={12} className="text-brand-400" />
          <span className="text-[10px] font-bold text-gray-400 tracking-wider">TRANSITION LOG</span>
        </div>
        <div className="space-y-1">
          {telemetry.transitionHistory.slice().reverse().map((entry, i) => {
            const [node, time] = entry.split('@');
            const relTime = Date.now() - parseInt(time);
            return (
              <div key={i} className="flex items-center gap-1 text-[9px]">
                <ChevronRight size={8} className="text-brand-500" />
                <span className="text-brand-300 font-mono">{node}</span>
                <span className="text-gray-600 ml-auto">{(relTime / 1000).toFixed(1)}s ago</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Helper components
const LevelBar: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="flex items-center gap-2">
    <span className="text-[9px] text-gray-500 w-10">{label}</span>
    <div className="flex-1 h-2 bg-black/40 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-75`}
        style={{ width: `${Math.min(100, value * 100)}%` }}
      />
    </div>
    <span className="text-[9px] font-mono text-gray-400 w-8 text-right">
      {(value * 100).toFixed(0)}
    </span>
  </div>
);

const StatBox: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-black/30 rounded p-1">
    <div className="text-xs font-mono font-bold text-brand-300">{value}</div>
    <div className="text-[7px] text-gray-600">{label}</div>
  </div>
);

export default KineticDebugPanel;
