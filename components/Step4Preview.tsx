
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Video, Settings, Mic, MicOff, Maximize2, Minimize2, Upload, X, Loader2, Sliders, Package, Music, ChevronDown, ChevronUp, Activity, Download, FileVideo, Radio, Star, Camera, Volume2, VolumeX, Sparkles, CircleDot, Monitor, Smartphone, Square, Eye, Layers, Plus, Trash2, Zap, RotateCcw, ZapOff, Shuffle, Merge, Grid, Gauge } from 'lucide-react';
import { AppState, EnergyLevel, MoveDirection, FrameType, DeckSlot, SavedProject, GeneratedFrame, SequenceMode, FXSettings } from '../types';
import { QuantumVisualizer } from './Visualizer/HolographicVisualizer';
import { generatePlayerHTML } from '../services/playerExport';
import { STYLE_PRESETS } from '../constants';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { KineticEngine, KineticState, KineticTelemetry, createDollyZoom, generateVirtualZoomVariants } from '../services/KineticEngine';
import { KineticDebugPanel } from './KineticDebugPanel';

interface Step4Props {
  state: AppState;
  onGenerateMore: () => void;
  onSpendCredit: (amount: number) => boolean;
  onUploadAudio: (file: File) => void;
  onSaveProject: () => void;
}

type AspectRatio = '9:16' | '1:1' | '16:9';
type Resolution = '720p' | '1080p' | '4K';
type InterpMode = 'CUT' | 'SLIDE' | 'MORPH' | 'SMOOTH' | 'ZOOM_IN';

export const Step4Preview: React.FC<Step4Props> = ({ state, onGenerateMore, onSpendCredit, onUploadAudio, onSaveProject }) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const charCanvasRef = useRef<HTMLCanvasElement>(null); 
  const containerRef = useRef<HTMLDivElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  // -- Audio System --
  const { 
      audioElement, 
      isPlaying, 
      isMicActive, 
      togglePlay, 
      toggleMic, 
      getAnalysis,
      audioDestNode 
  } = useAudioPlayer(state.audioPreviewUrl);

  const [isRecording, setIsRecording] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDeck, setShowDeck] = useState(false);
  const [showFX, setShowFX] = useState(false);
  
  const [fxSettings, setFxSettings] = useState<FXSettings>({
      hue: { base: 0, reactive: 0 },
      aberration: { base: 0, reactive: 20 },
      scanlines: { base: 0, reactive: 0 },
      stutter: { base: 20, reactive: 50 }, 
      chaos: { base: 0, reactive: 0 }       
  });

  const [exportRatio, setExportRatio] = useState<AspectRatio>('9:16');
  const [exportRes, setExportRes] = useState<Resolution>('1080p');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordCanvasRef = useRef<HTMLCanvasElement>(null); 
  const [recordingTime, setRecordingTime] = useState(0);

  const hologramRef = useRef<QuantumVisualizer | null>(null);
  const kineticEngineRef = useRef<KineticEngine | null>(null);

  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0);
  const lastBeatTimeRef = useRef<number>(0);
  const lastStutterRef = useRef<number>(0);

  // Kinetic Engine State
  const [useKineticEngine, setUseKineticEngine] = useState(true);
  const [kineticState, setKineticState] = useState<KineticState | null>(null);
  const [detectedBPM, setDetectedBPM] = useState(120);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [telemetry, setTelemetry] = useState<KineticTelemetry | null>(null);
  const [autoBPM, setAutoBPM] = useState(true);
  
  const [brainState, setBrainState] = useState({ activePoseName: 'BASE', fps: 0, mode: 'GROOVE' });
  const [hoveredFrame, setHoveredFrame] = useState<GeneratedFrame | null>(null);

  // --- MULTI-DECK STATE ---
  const [decks, setDecks] = useState<DeckSlot[]>([
      { id: 0, rig: null, isActive: true, mixMode: 'sequencer', opacity: 1.0 },
      { id: 1, rig: null, isActive: false, mixMode: 'sequencer', opacity: 1.0 },
      { id: 2, rig: null, isActive: false, mixMode: 'sequencer', opacity: 1.0 },
      { id: 3, rig: null, isActive: false, mixMode: 'sequencer', opacity: 1.0 },
  ]);

  // --- KINETIC GRAPH STATE ---
  const sequenceModeRef = useRef<SequenceMode>('GROOVE');
  const barCounterRef = useRef<number>(0);
  const phraseCounterRef = useRef<number>(0); 
  
  const sourcePoseRef = useRef<string>('base'); 
  const targetPoseRef = useRef<string>('base'); 
  const currentDeckIdRef = useRef<number>(0); // Tracks which deck owns the current target frame
  const transitionProgressRef = useRef<number>(1.0); 
  const transitionSpeedRef = useRef<number>(10.0);   
  const transitionModeRef = useRef<InterpMode>('CUT');
  
  // Triggers
  const triggerStutterRef = useRef<boolean>(false);
  const triggerReverseRef = useRef<boolean>(false);
  const triggerGlitchRef = useRef<boolean>(false);

  const BASE_ZOOM = 1.15;
  const camZoomRef = useRef<number>(BASE_ZOOM);
  const camPanXRef = useRef<number>(0); 
  const camPanYRef = useRef<number>(0); 
  
  // Physics
  const charSquashRef = useRef<number>(1.0); 
  const charSkewRef = useRef<number>(0.0);   
  const charTiltRef = useRef<number>(0.0);   
  const targetTiltRef = useRef<number>(0.0); 
  const charBounceYRef = useRef<number>(0.0); 

  const masterRotXRef = useRef<number>(0); 
  const masterVelXRef = useRef<number>(0); 
  const masterRotYRef = useRef<number>(0); 
  const masterVelYRef = useRef<number>(0); 
  const masterRotZRef = useRef<number>(0); 
  const masterVelZRef = useRef<number>(0); 
  
  const rgbSplitRef = useRef<number>(0); 
  
  const [frameCount, setFrameCount] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);
  const [superCamActive, setSuperCamActive] = useState(true);
  
  // Lookup map: Key = "deckId_poseName"
  const frameLookupRef = useRef<Map<string, GeneratedFrame>>(new Map());

  // HELPER: Process Rig into Buckets & Machine Categories
  const processRig = useCallback(async (frames: GeneratedFrame[], slotId: number) => {
      const sorted: Record<EnergyLevel, GeneratedFrame[]> = { low: [], mid: [], high: [] };
      const closeups: GeneratedFrame[] = [];
      const hands: GeneratedFrame[] = [];
      const feet: GeneratedFrame[] = [];
      
      const mandalas: GeneratedFrame[] = [];
      const virtuals: GeneratedFrame[] = [];
      const acrobatics: GeneratedFrame[] = [];

      const images: Record<string, HTMLImageElement> = {};
      const loadPromises: Promise<void>[] = [];

      const preload = (url: string, pose: string) => {
          return new Promise<void>((resolve) => {
              if (images[pose]) { resolve(); return; } 
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.src = url;
              img.onload = () => resolve();
              img.onerror = () => resolve(); 
              images[pose] = img;
          });
      };

      for (const f of frames) {
          const frameData = { ...f, deckId: slotId };
          const lookupKey = `${slotId}_${f.pose}`;
          
          frameLookupRef.current.set(lookupKey, frameData);
          loadPromises.push(preload(frameData.url, frameData.pose));

          // 1. Sort by Type
          if (f.type === 'closeup') {
              closeups.push(frameData);
              // Machine Frame: Virtual Zoom
              const vPose = f.pose + '_vzoom';
              const vLookupKey = `${slotId}_${vPose}`;
              const vFrame = { 
                  ...frameData, 
                  pose: vPose, 
                  isVirtual: true, 
                  virtualZoom: 1.5,
                  virtualOffsetY: 0.0 
              };
              frameLookupRef.current.set(vLookupKey, vFrame);
              virtuals.push(vFrame); 
              loadPromises.push(new Promise<void>(r => { images[vPose] = images[f.pose]; r(); }));
          } 
          else if (f.type === 'hands') {
              hands.push(frameData);
              if (f.pose.includes('mandala')) mandalas.push(frameData); 
          }
          else if (f.type === 'feet') feet.push(frameData);
          else {
              // Body Frames
              if (sorted[f.energy]) sorted[f.energy].push(frameData);
              
              if (f.role === 'alt') acrobatics.push(frameData);
          }
      }

      // Safety Fill
      if (sorted.low.length === 0 && sorted.mid.length > 0) sorted.low = [...sorted.mid];
      if (sorted.mid.length === 0 && sorted.low.length > 0) sorted.mid = [...sorted.low];

      await Promise.all(loadPromises);

      setDecks(prev => prev.map(d => d.id === slotId ? { 
          ...d, 
          isActive: true, 
          images, 
          framesByEnergy: sorted, 
          closeups, 
          hands, 
          feet,
          mandalas,
          virtuals,
          acrobatics
      } : d));
      
      setFrameCount(prev => prev + frames.length);
  }, []);

  // Rig Initialization
  useEffect(() => {
      const hasFrames = state.generatedFrames.length > 0;
      const needsUpdate = hasFrames && (!decks[0].rig || decks[0].rig.frames.length !== state.generatedFrames.length);

      if (needsUpdate) {
          const defaultRig: SavedProject = {
              id: 'current_session',
              name: 'Current Session',
              createdAt: Date.now(),
              frames: state.generatedFrames,
              styleId: state.selectedStyleId,
              subjectCategory: state.subjectCategory
          };
          setDecks(prev => prev.map(d => d.id === 0 ? { ...d, rig: defaultRig, isActive: true, mixMode: 'sequencer' } : d));
          frameLookupRef.current.clear();

          // Initialize Kinetic Engine
          if (!kineticEngineRef.current) {
              kineticEngineRef.current = new KineticEngine();
          }
          kineticEngineRef.current.loadFramePool(state.generatedFrames);
          kineticEngineRef.current.setBPM(detectedBPM);

          processRig(state.generatedFrames, 0).then(() => setImagesReady(true));
      }
  }, [state.generatedFrames, processRig, detectedBPM]);

  // Visualizer Init
  useEffect(() => {
    if (bgCanvasRef.current && !hologramRef.current) {
        hologramRef.current = new QuantumVisualizer(bgCanvasRef.current);
    }
    if (containerRef.current && hologramRef.current) {
        const resizeObserver = new ResizeObserver(() => {
            if (hologramRef.current) hologramRef.current.resize();
            if (charCanvasRef.current && containerRef.current) {
                charCanvasRef.current.width = containerRef.current.clientWidth;
                charCanvasRef.current.height = containerRef.current.clientHeight;
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }
  }, []);

  const triggerTransition = (newPose: string, deckId: number, mode: InterpMode, speedMult: number = 1.0) => {
      if (newPose === targetPoseRef.current && deckId === currentDeckIdRef.current) return;
      sourcePoseRef.current = targetPoseRef.current;
      targetPoseRef.current = newPose;
      currentDeckIdRef.current = deckId;
      transitionProgressRef.current = 0.0;
      transitionModeRef.current = mode;
      
      let speed = 20.0;
      if (mode === 'CUT') speed = 1000.0; 
      else if (mode === 'MORPH') speed = 5.0; 
      else if (mode === 'ZOOM_IN') speed = 6.0; 
      else if (mode === 'SLIDE') speed = 8.0; 
      else if (mode === 'SMOOTH') speed = 1.5; 
      transitionSpeedRef.current = speed * speedMult;
  };

  // --- THE BRAIN LOOP ---
  const loop = useCallback((time: number) => {
    if (!lastFrameTimeRef.current) lastFrameTimeRef.current = time;
    const deltaTime = Math.min((time - lastFrameTimeRef.current) / 1000, 0.1);
    lastFrameTimeRef.current = time;
    requestRef.current = requestAnimationFrame(loop);

    if (transitionProgressRef.current < 1.0) {
        transitionProgressRef.current += transitionSpeedRef.current * deltaTime;
        if (transitionProgressRef.current > 1.0) transitionProgressRef.current = 1.0;
    }

    const { bass, mid, high, energy } = getAnalysis();

    // SEQUENCER LOGIC: Gather all "Sequencer" decks
    const seqDecks = decks.filter(d => d.isActive && d.rig && d.mixMode === 'sequencer');
    const refDeck = seqDecks[0]; // Primary logic driver, but pools are shared

    // --- PHYSICS SOLVER (Springs) ---
    const sensitivity = (state.reactivity || 80) / 100;
    const stiffness = 140;
    const damping = 8;

    let targetRotX = bass * 35.0 * sensitivity;
    let targetRotY = mid * 25.0 * Math.sin(time * 0.005) * sensitivity;

    if (sequenceModeRef.current === 'FOOTWORK') {
        targetRotX += 20; // Look down
    }

    masterVelXRef.current += ((targetRotX - masterRotXRef.current) * stiffness - (masterVelXRef.current * damping)) * deltaTime;
    masterRotXRef.current += masterVelXRef.current * deltaTime;
    masterVelYRef.current += ((targetRotY - masterRotYRef.current) * stiffness * 0.5 - (masterVelYRef.current * damping * 0.8)) * deltaTime;
    masterRotYRef.current += masterVelYRef.current * deltaTime;

    // Visualizer Render
    if (hologramRef.current) {
        hologramRef.current.updateAudio({ bass, mid, high, energy });
        const rx = superCamActive ? masterRotXRef.current * 0.3 : 0;
        const ry = superCamActive ? masterRotYRef.current * 0.3 : 0;
        hologramRef.current.render(0, { x: rx, y: ry, z: 0 });
    }

    const now = Date.now();

    // ========== KINETIC ENGINE MODE ==========
    if (useKineticEngine && kineticEngineRef.current) {
        // Feed audio into lookahead buffer
        kineticEngineRef.current.feedAudio(bass, mid, high);

        // Handle manual triggers
        if (triggerStutterRef.current) {
            kineticEngineRef.current.triggerStutter();
            charSquashRef.current = 1.2;
            rgbSplitRef.current = 0.5;
        }
        if (triggerGlitchRef.current) {
            kineticEngineRef.current.triggerGlitch();
            rgbSplitRef.current = 1.0;
            charSkewRef.current = Math.sin(time * 0.05) * 0.5;
        }
        if (triggerReverseRef.current) {
            kineticEngineRef.current.forceState('idle');
        }

        // Update engine and get state
        const engineState = kineticEngineRef.current.update(deltaTime);
        setKineticState(engineState);

        // Get telemetry for debug panel
        if (showDebugPanel) {
            setTelemetry(kineticEngineRef.current.getTelemetry());
        }

        // Sync BPM from auto-detection
        if (autoBPM) {
            const currentBPM = kineticEngineRef.current.getBPM();
            if (currentBPM !== detectedBPM) {
                setDetectedBPM(currentBPM);
            }
        }

        // Sync refs from engine state for rendering
        sequenceModeRef.current = engineState.sequenceMode;
        barCounterRef.current = engineState.barCounter;
        phraseCounterRef.current = engineState.phraseCounter;

        // Update transition if engine changed frames
        if (engineState.currentFrame) {
            const newPose = engineState.currentFrame.pose;
            if (newPose !== targetPoseRef.current) {
                sourcePoseRef.current = targetPoseRef.current;
                targetPoseRef.current = newPose;
                transitionProgressRef.current = engineState.transitionProgress;
                transitionModeRef.current = engineState.transitionStyle;

                // Set transition speed based on style
                let speed = 20.0;
                if (engineState.transitionStyle === 'CUT') speed = 1000.0;
                else if (engineState.transitionStyle === 'MORPH') speed = 5.0;
                else if (engineState.transitionStyle === 'ZOOM_IN') speed = 6.0;
                else if (engineState.transitionStyle === 'SLIDE') speed = 8.0;
                else if (engineState.transitionStyle === 'SMOOTH') speed = 1.5;
                transitionSpeedRef.current = speed;
            }
        }

        // Zoom for closeup/impact modes
        const nodeConfig = kineticEngineRef.current.getCurrentNodeConfig();
        if (nodeConfig.mechanicalFx === 'zoom') {
            camZoomRef.current = 1.5;
        }

        // Beat-synced bounce on bass hits
        if (engineState.beatPos < 0.1 && bass > 0.5) {
            charSquashRef.current = 0.85;
            charBounceYRef.current = -50 * bass * sensitivity;
        }

    } else {
        // ========== LEGACY DFF MODE ==========

        // --- STUTTER & GLITCH ENGINE ---
        if (triggerGlitchRef.current) {
            rgbSplitRef.current = 1.0;
            charSkewRef.current = Math.sin(time * 0.05) * 0.5;
            // Chaos: Random deck, random frame
            if (Math.random() > 0.8 && seqDecks.length > 0) {
                 const randomDeck = seqDecks[Math.floor(Math.random() * seqDecks.length)];
                 if (randomDeck.framesByEnergy?.high) {
                    const pool = randomDeck.framesByEnergy.high;
                    const frame = pool[Math.floor(Math.random() * pool.length)];
                    triggerTransition(frame.pose, randomDeck.id, 'CUT');
                 }
            }
        }

        const stutterThreshold = 1.0 - (fxSettings.stutter.base / 100);
        const isStuttering = triggerStutterRef.current || (mid > 0.6 && Math.random() > stutterThreshold);

        if (isStuttering && (now - lastStutterRef.current) > 80 && refDeck) {
            lastStutterRef.current = now;
            // Retrigger same frame (Stutter)
            triggerTransition(targetPoseRef.current, currentDeckIdRef.current, 'CUT');
            charSquashRef.current = 1.2;
            rgbSplitRef.current = 0.5;

            // Variation
            if (Math.random() > 0.5) {
                 // Try Mirror or Virtual
                 if (targetPoseRef.current.includes('_mirror')) {
                     triggerTransition(targetPoseRef.current.replace('_mirror',''), currentDeckIdRef.current, 'CUT');
                 } else {
                     triggerTransition(targetPoseRef.current + '_mirror', currentDeckIdRef.current, 'CUT');
                 }
            }
        }
        else if ((now - lastBeatTimeRef.current) > 300 && bass > 0.5 && seqDecks.length > 0) {
            // --- INTELLIGENT SEQUENCER ---
            lastBeatTimeRef.current = now;
            barCounterRef.current = (barCounterRef.current + 1) % 16;
            phraseCounterRef.current = (phraseCounterRef.current + 1) % 8;

            const isDrop = bass > 0.8;
            const isPeak = high > 0.7;
            const isFill = phraseCounterRef.current === 7;

            if (triggerReverseRef.current) {
                 sequenceModeRef.current = 'GROOVE';
            } else {
                // Check global pool capabilities
                const hasCloseups = seqDecks.some(d => d.closeups && d.closeups.length > 0);
                const hasHands = seqDecks.some(d => d.hands && d.hands.length > 0);
                const hasFeet = seqDecks.some(d => d.feet && d.feet.length > 0);

                if (isPeak && hasCloseups) sequenceModeRef.current = 'EMOTE';
                else if (isDrop && hasHands) sequenceModeRef.current = 'IMPACT';
                else if (barCounterRef.current >= 12 && hasFeet) sequenceModeRef.current = 'FOOTWORK';
                else if (isFill) sequenceModeRef.current = 'IMPACT';
                else sequenceModeRef.current = 'GROOVE';
            }

            if (Math.random() * 100 < fxSettings.chaos.base) {
                 sequenceModeRef.current = 'IMPACT';
            }

            // --- GLOBAL FRAME POOLING ---
            // Helper to grab frames from ALL sequencer decks
            const gatherFrames = (selector: (d: DeckSlot) => GeneratedFrame[] | undefined) => {
                return seqDecks.flatMap(d => {
                    const frames = selector(d) || [];
                    return frames.map(f => ({...f, deckId: d.id})); // Ensure deckID is attached
                });
            };

            let pool: GeneratedFrame[] = [];
            let nextMode: InterpMode = 'CUT';

            switch (sequenceModeRef.current) {
                case 'EMOTE':
                    if (isPeak) {
                         pool = gatherFrames(d => d.virtuals);
                         if (pool.length === 0) pool = gatherFrames(d => d.closeups);
                         nextMode = 'CUT';
                    } else {
                         pool = gatherFrames(d => d.closeups);
                         nextMode = 'MORPH';
                    }
                    camZoomRef.current = 1.5;
                    break;
                case 'FOOTWORK':
                    pool = gatherFrames(d => d.feet);
                    nextMode = 'CUT';
                    break;
                case 'IMPACT':
                    if (isDrop) pool = gatherFrames(d => d.mandalas);
                    if (pool.length === 0 && isFill) pool = gatherFrames(d => d.acrobatics);
                    if (pool.length === 0) pool = gatherFrames(d => d.hands);
                    if (pool.length === 0) pool = gatherFrames(d => d.framesByEnergy?.high);
                    nextMode = 'CUT';
                    break;
                case 'GROOVE':
                default:
                    const dir = barCounterRef.current % 2 === 0 ? 'left' : 'right';
                    pool = gatherFrames(d => d.framesByEnergy?.mid.filter(f => f.direction === dir));
                    if (pool.length === 0) pool = gatherFrames(d => d.framesByEnergy?.mid);
                    if (pool.length === 0) pool = gatherFrames(d => d.framesByEnergy?.low);

                    nextMode = 'CUT';
                    charSquashRef.current = 0.85;
                    charBounceYRef.current = -50 * bass * sensitivity;
                    break;
            }

            if (pool.length > 0) {
                const nextFrame = pool[Math.floor(Math.random() * pool.length)];
                // Pass the specific Deck ID of the chosen frame
                triggerTransition(nextFrame.pose, nextFrame.deckId || 0, nextMode);
            }
        }
    }

    // --- PHYSICS DECAY ---
    charSquashRef.current += (1.0 - charSquashRef.current) * (12 * deltaTime);
    charBounceYRef.current += (0 - charBounceYRef.current) * (10 * deltaTime); 
    charSkewRef.current *= 0.9;
    rgbSplitRef.current *= 0.9;
    
    const targetZoom = sequenceModeRef.current === 'EMOTE' ? 1.5 : BASE_ZOOM;
    camZoomRef.current += (targetZoom - camZoomRef.current) * (2 * deltaTime);
    
    const targetPanY = sequenceModeRef.current === 'FOOTWORK' ? -150 : 0; 
    camPanYRef.current += (targetPanY - camPanYRef.current) * (4 * deltaTime);
    
    // --- RENDERER ---
    const render = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const cx = w/2;
        const cy = h/2;
        ctx.clearRect(0,0,w,h);
        
        const fxHue = fxSettings.hue.base + (fxSettings.hue.reactive * high * 2);
        let filter = '';
        if (fxHue > 2) filter += `hue-rotate(${fxHue}deg) `;
        
        const aber = fxSettings.aberration.base + (rgbSplitRef.current * 100);
        
        // 1. Draw Main Actor (Sequencer)
        // Find the deck corresponding to currentDeckIdRef
        const mainDeck = decks.find(d => d.id === currentDeckIdRef.current);
        
        const drawFrame = (deck: DeckSlot, pose: string, opacity: number) => {
             if (!deck || !deck.images) return;
             const img = deck.images[pose];
             if (!img) return;

             const lookupKey = `${deck.id}_${pose}`;
             const frameData = frameLookupRef.current.get(lookupKey);
             const extraScale = frameData?.virtualZoom || 1.0;
             const offsetY = frameData?.virtualOffsetY || 0.0;

             const aspect = img.width / img.height;
             let dw = w; let dh = w / aspect;
             if (dh > h) { dh = h; dw = dh * aspect; }
             
             ctx.save();
             ctx.translate(cx + camPanXRef.current, cy + charBounceYRef.current + camPanYRef.current + offsetY);
             const radY = (superCamActive ? masterRotYRef.current : 0) * Math.PI / 180;
             const scaleX = Math.cos(radY); 
             ctx.transform(1, 0, charSkewRef.current, 1, 0, 0);
             ctx.scale(Math.abs(scaleX), 1);
             ctx.scale(1/charSquashRef.current, charSquashRef.current);
             ctx.scale(camZoomRef.current * extraScale, camZoomRef.current * extraScale);
             ctx.globalAlpha = opacity * deck.opacity;
             if(filter) ctx.filter = filter;
             
             if (aber > 5) {
                 ctx.globalCompositeOperation = 'screen';
                 ctx.fillStyle = 'red'; 
                 ctx.drawImage(img, -dw/2 - (aber * 0.2), -dh/2, dw, dh);
                 ctx.globalCompositeOperation = 'screen';
                 ctx.drawImage(img, -dw/2 + (aber * 0.2), -dh/2, dw, dh);
                 ctx.globalCompositeOperation = 'source-over';
             } else {
                 ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
             }
             ctx.restore();
        };

        if (mainDeck && mainDeck.isActive) {
            const progress = transitionProgressRef.current;
            if (progress >= 1.0 || transitionModeRef.current === 'CUT') {
                drawFrame(mainDeck, targetPoseRef.current, 1.0);
            } else {
                 if (transitionModeRef.current === 'MORPH') {
                     drawFrame(mainDeck, sourcePoseRef.current, 1.0 - progress);
                     drawFrame(mainDeck, targetPoseRef.current, progress);
                 } else {
                     drawFrame(mainDeck, targetPoseRef.current, 1.0);
                 }
            }
        }

        // 2. Draw Layer Decks (Overlays)
        decks.filter(d => d.isActive && d.mixMode === 'layer').forEach(layerDeck => {
             // For layers, we might just loop their own sequence or sync to main?
             // Simplest: Sync to main pose if it exists, otherwise idle
             if (!layerDeck.images) return;
             // Check if layer deck has the target pose, else fallback
             let layerPose = targetPoseRef.current;
             if (!layerDeck.images[layerPose]) layerPose = Object.keys(layerDeck.images)[0]; 
             drawFrame(layerDeck, layerPose, 1.0);
        });
        
        const scans = fxSettings.scanlines.base + (mid * 0.3);
        if (scans > 0.1) {
            ctx.fillStyle = `rgba(0,0,0,${scans * 0.4})`;
            for(let y=0; y<h; y+=4) ctx.fillRect(0, y, w, 2);
        }
    };

    if (charCanvasRef.current && imagesReady) {
        render(charCanvasRef.current.getContext('2d')!, charCanvasRef.current.width, charCanvasRef.current.height);
    }
    
    if (isRecording && recordCanvasRef.current) {
         const ctx = recordCanvasRef.current.getContext('2d')!;
         if (bgCanvasRef.current) ctx.drawImage(bgCanvasRef.current, 0, 0, recordCanvasRef.current.width, recordCanvasRef.current.height);
         render(ctx, recordCanvasRef.current.width, recordCanvasRef.current.height);
    }
    
    // Update brain state display
    const displayMode = useKineticEngine && kineticState
        ? `${kineticState.currentNode.toUpperCase()}${kineticState.isLocked ? ' [LOCKED]' : ''}`
        : sequenceModeRef.current;
    setBrainState({ activePoseName: targetPoseRef.current, fps: Math.round(1/deltaTime), mode: displayMode });

  }, [imagesReady, superCamActive, isRecording, getAnalysis, decks, fxSettings, state.reactivity, useKineticEngine, kineticState, showDebugPanel, autoBPM, detectedBPM]); 

  useEffect(() => {
    if (imagesReady) requestRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(requestRef.current);
  }, [loop, imagesReady]);

  // --- RECORDING & EXPORT ---
  const startRecording = () => {
      if (!recordCanvasRef.current || !audioDestNode) return;
      
      const w = 1080; const h = 1920; 
      recordCanvasRef.current.width = w; recordCanvasRef.current.height = h;
      
      const stream = recordCanvasRef.current.captureStream(60);
      
      // CRITICAL: Add Audio Track
      const audioTracks = audioDestNode.stream.getAudioTracks();
      if (audioTracks.length > 0) {
          stream.addTrack(audioTracks[0]); 
      } else {
          console.warn("No audio tracks found on destination node");
      }

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      
      recorder.ondataavailable = e => { if (e.data.size > 0) recordedChunksRef.current.push(e.data); };
      recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = `jusdnce_${Date.now()}.webm`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
      };
      
      recorder.start();
      setIsRecording(true);
      const startTime = Date.now();
      const interval = setInterval(() => setRecordingTime(Date.now() - startTime), 100);
      (mediaRecorderRef.current as any).timerInterval = interval;
  };
  
  const stopRecording = () => {
      if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          clearInterval((mediaRecorderRef.current as any).timerInterval);
          setIsRecording(false);
      }
  };

  const handleExportPlayer = () => {
      if(!hologramRef.current) return;
      const exportDecks = decks.map(d => ({ id: d.id, rig: d.rig, isActive: d.isActive, mixMode: d.mixMode }));
      const html = generatePlayerHTML(exportDecks, hologramRef.current.params, state.subjectCategory);
      const blob = new Blob([html], {type: 'text/html'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `jusdnce_player.html`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  
  const handleDeckToggle = (id: number) => {
      setDecks(prev => prev.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d));
  };

  const toggleDeckMode = (id: number) => {
      setDecks(prev => prev.map(d => d.id === id ? { 
          ...d, 
          mixMode: d.mixMode === 'sequencer' ? 'layer' : 'sequencer' 
      } : d));
  };

  const handleImportRig = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const project = JSON.parse(ev.target?.result as string) as SavedProject;
              if (!project.frames) throw new Error("Invalid Rig");
              const emptySlot = decks.find(d => !d.rig);
              if (emptySlot) {
                  setDecks(prev => prev.map(d => d.id === emptySlot.id ? { ...d, rig: project, isActive: true, mixMode: 'sequencer' } : d));
                  frameLookupRef.current.clear();
                  // Re-process ALL decks to rebuild lookup
                  // Note: In a real app we'd optimize this, but here we just process the new one and rely on deckId separation
                  processRig(project.frames, emptySlot.id);
              } else {
                   setDecks(prev => prev.map(d => d.id === 3 ? { ...d, rig: project, isActive: true, mixMode: 'sequencer' } : d));
                   processRig(project.frames, 3);
              }
          } catch (err) { alert("Failed to load rig."); }
      };
      reader.readAsText(file);
      e.target.value = '';
  };
  
  const removeRig = (id: number) => {
      if (id === 0) return; 
      setDecks(prev => prev.map(d => d.id === id ? { ...d, rig: null, isActive: false, images: undefined } : d));
  };
  
  const getFrameIcon = (frame: GeneratedFrame) => {
      if (frame.pose.includes('mandala')) return '💠';
      if (frame.pose.includes('mirror')) return '🪞';
      if (frame.isVirtual) return '🔮';
      if (frame.type === 'closeup') return '👁️';
      if (frame.type === 'hands') return '✋';
      return null;
  };

  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black/90">
      <canvas ref={recordCanvasRef} className="hidden pointer-events-none fixed -top-[9999px]" />
      <div className="absolute inset-0 w-full h-full flex items-center justify-center perspective-1000">
           <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full object-cover opacity-80" />
           <canvas ref={charCanvasRef} className="absolute inset-0 w-full h-full object-contain z-10" />
      </div>

      {!imagesReady && !state.isGenerating && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 backdrop-blur-md">
             <Loader2 size={48} className="text-brand-500 animate-spin mb-4" />
             <p className="text-white font-mono tracking-widest animate-pulse">KINETIC RIG INITIALIZING...</p>
             <p className="text-gray-500 text-xs mt-2">Loading {frameCount} mechanical frames</p>
         </div>
      )}

      {/* FX RACK */}
      {showFX && (
         <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 p-4 animate-slide-in-right w-full max-w-lg">
             <div className="bg-black/80 backdrop-blur-lg border-t border-white/10 p-5 rounded-xl">
                 <div className="flex justify-between items-center mb-5">
                     <h4 className="text-white font-bold text-xs tracking-widest flex items-center gap-2"><Zap size={14}/> FX RACK & MOTION</h4>
                     <button onClick={() => setShowFX(false)} className="text-gray-400 hover:text-white"><X size={14} /></button>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                         <h5 className="text-[10px] text-brand-300 font-bold border-b border-white/10 pb-1">VISUALS</h5>
                         {['hue', 'aberration', 'scanlines'].map(fx => (
                             <div key={fx} className="space-y-1">
                                 <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase"><span>{fx}</span></div>
                                 <input type="range" min="0" max="100" 
                                    value={(fxSettings as any)[fx].reactive} 
                                    onChange={e => setFxSettings(p => ({...p, [fx]: {...(p as any)[fx], reactive: Number(e.target.value)}}))} 
                                    className="w-full h-1 bg-white/10 rounded-full accent-brand-500" />
                             </div>
                         ))}
                    </div>
                    <div className="space-y-4">
                         <h5 className="text-[10px] text-brand-300 font-bold border-b border-white/10 pb-1">MOTION TRICKS</h5>
                         <div className="space-y-1">
                             <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase"><span>STUTTER</span></div>
                             <input type="range" min="0" max="100" 
                                value={fxSettings.stutter.base} 
                                onChange={e => setFxSettings(p => ({...p, stutter: {...p.stutter, base: Number(e.target.value)}}))} 
                                className="w-full h-1 bg-white/10 rounded-full accent-yellow-500" />
                         </div>
                         <div className="space-y-1">
                             <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase"><span>CHAOS (RANDOM)</span></div>
                             <input type="range" min="0" max="100" 
                                value={fxSettings.chaos.base} 
                                onChange={e => setFxSettings(p => ({...p, chaos: {...p.chaos, base: Number(e.target.value)}}))} 
                                className="w-full h-1 bg-white/10 rounded-full accent-red-500" />
                         </div>
                    </div>
                 </div>
             </div>
         </div>
      )}
      
      {/* NEURAL MIXER */}
      {showDeck && (
         <div className="absolute bottom-24 left-0 right-0 z-40 p-4 animate-slide-in-right">
             <div className="bg-black/80 backdrop-blur-lg border-t border-white/10 p-4 rounded-xl max-w-4xl mx-auto">
                 <div className="flex justify-between items-center mb-4">
                     <h4 className="text-white font-bold text-xs tracking-widest flex items-center gap-2"><Layers size={14}/> NEURAL MIXER</h4>
                     <button onClick={() => importInputRef.current?.click()} className="text-[10px] bg-brand-600 px-3 py-1 rounded hover:bg-brand-500 text-white font-bold">+ IMPORT RIG</button>
                     <input type="file" ref={importInputRef} accept=".jusdnce" onChange={handleImportRig} className="hidden" />
                 </div>
                 
                 <div className="grid grid-cols-4 gap-4">
                     {decks.map((deck) => (
                         <div key={deck.id} className={`relative p-2 rounded-lg border transition-all flex flex-col ${deck.isActive ? 'border-brand-500 bg-brand-900/20' : 'border-white/10 bg-black/40'} ${!deck.rig ? 'opacity-50 border-dashed' : ''}`}>
                             <div className="aspect-square bg-black/50 rounded overflow-hidden mb-2 relative group flex-shrink-0">
                                 {deck.rig ? (
                                     <img src={deck.rig.frames[0].url} className="w-full h-full object-contain" />
                                 ) : (
                                     <div className="w-full h-full flex items-center justify-center text-white/20 font-mono text-xs">EMPTY</div>
                                 )}
                                 {deck.rig && deck.id !== 0 && (
                                     <button onClick={(e) => { e.stopPropagation(); removeRig(deck.id); }} className="absolute top-1 right-1 bg-red-500/80 p-1 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                         <Trash2 size={12} />
                                     </button>
                                 )}
                             </div>
                             
                             <div className="flex justify-between items-center mb-2">
                                 <span className="text-[10px] text-gray-400 font-mono">CH {deck.id + 1}</span>
                                 <div className="flex items-center gap-2">
                                     {/* MIX MODE TOGGLE */}
                                     <button
                                        onClick={() => toggleDeckMode(deck.id)}
                                        title={deck.mixMode === 'sequencer' ? "Pooled (Sequencer)" : "Overlay (Layer)"}
                                        disabled={!deck.rig}
                                        className={`p-1 rounded ${deck.mixMode === 'sequencer' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}
                                     >
                                         {deck.mixMode === 'sequencer' ? <Shuffle size={10} /> : <Merge size={10} />}
                                     </button>

                                     <button 
                                        disabled={!deck.rig}
                                        onClick={() => handleDeckToggle(deck.id)}
                                        className={`w-3 h-3 rounded-full border ${deck.isActive ? 'bg-green-500 border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-black border-white/30'}`}
                                     />
                                 </div>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         </div>
      )}
      
      {/* PERFORMANCE PADS */}
      {!showDeck && !showFX && (
         <div className="absolute bottom-24 left-0 right-0 z-40 p-4 flex justify-center gap-2 animate-slide-in-right">
             <button 
                onMouseDown={() => triggerStutterRef.current = true} 
                onMouseUp={() => triggerStutterRef.current = false}
                onTouchStart={() => triggerStutterRef.current = true}
                onTouchEnd={() => triggerStutterRef.current = false}
                className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 px-4 py-3 rounded-xl font-black text-xs active:bg-yellow-500 active:text-black hover:scale-105 transition-all"
             >
                 STUTTER
             </button>
             <button 
                onMouseDown={() => triggerReverseRef.current = true} 
                onMouseUp={() => triggerReverseRef.current = false}
                onTouchStart={() => triggerReverseRef.current = true}
                onTouchEnd={() => triggerReverseRef.current = false}
                className="bg-blue-500/20 border border-blue-500/50 text-blue-300 px-4 py-3 rounded-xl font-black text-xs active:bg-blue-500 active:text-white hover:scale-105 transition-all"
             >
                 <RotateCcw size={16} />
             </button>
             <button 
                onMouseDown={() => triggerGlitchRef.current = true} 
                onMouseUp={() => triggerGlitchRef.current = false}
                onTouchStart={() => triggerGlitchRef.current = true}
                onTouchEnd={() => triggerGlitchRef.current = false}
                className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl font-black text-xs active:bg-red-500 active:text-white hover:scale-105 transition-all"
             >
                 GLITCH
             </button>
         </div>
      )}
      
      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none z-30 p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-lg pointer-events-auto">
                 <div className="flex items-center gap-2 mb-1">
                     <Activity size={14} className={useKineticEngine ? "text-green-400" : "text-brand-400"} />
                     <span className="text-[10px] font-bold text-gray-300 tracking-widest">
                         {useKineticEngine ? 'KINETIC CORE' : 'LEGACY DFF'}
                     </span>
                     <button
                         onClick={() => setUseKineticEngine(!useKineticEngine)}
                         className={`ml-2 w-8 h-4 rounded-full transition-all ${useKineticEngine ? 'bg-green-500' : 'bg-gray-600'}`}
                     >
                         <div className={`w-3 h-3 rounded-full bg-white transition-transform ${useKineticEngine ? 'translate-x-4' : 'translate-x-0.5'}`} />
                     </button>
                 </div>
                 <div className="font-mono text-xs text-brand-300">
                     FPS: {brainState.fps}<br/>
                     MODE: {brainState.mode}<br/>
                     DECK: {currentDeckIdRef.current + 1}
                     {useKineticEngine && kineticState && (
                         <><br/>BEAT: {(kineticState.beatPos * 100).toFixed(0)}%<br/>BAR: {kineticState.barCounter}/16</>
                     )}
                 </div>
                 {useKineticEngine && (
                     <div className="mt-2 space-y-2">
                         <div className="flex items-center gap-2">
                             <Gauge size={12} className="text-yellow-400" />
                             <span className="text-[10px] text-gray-400">BPM:</span>
                             <input
                                 type="number"
                                 min="60"
                                 max="200"
                                 value={detectedBPM}
                                 disabled={autoBPM}
                                 onChange={(e) => {
                                     const bpm = parseInt(e.target.value) || 120;
                                     setDetectedBPM(bpm);
                                     kineticEngineRef.current?.setBPM(bpm);
                                 }}
                                 className={`w-12 bg-black/40 border border-white/20 rounded px-1 text-[10px] font-mono ${autoBPM ? 'text-green-300' : 'text-yellow-300'}`}
                             />
                             <button
                                 onClick={() => {
                                     setAutoBPM(!autoBPM);
                                     kineticEngineRef.current?.setAutoBPM(!autoBPM);
                                 }}
                                 className={`text-[8px] px-1.5 py-0.5 rounded ${autoBPM ? 'bg-green-500/30 text-green-300' : 'bg-gray-600/30 text-gray-400'}`}
                             >
                                 AUTO
                             </button>
                         </div>
                         <button
                             onClick={() => setShowDebugPanel(!showDebugPanel)}
                             className={`text-[9px] w-full py-1 rounded border transition-all ${showDebugPanel ? 'bg-brand-500/30 border-brand-400 text-brand-300' : 'bg-black/30 border-white/10 text-gray-500 hover:text-white'}`}
                         >
                             {showDebugPanel ? '◉ DEBUG ON' : '○ DEBUG OFF'}
                         </button>
                     </div>
                 )}
             </div>
             <div className="flex gap-2 pointer-events-auto items-center">
                 {isRecording && <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/50 px-3 py-1.5 rounded-full animate-pulse"><div className="w-2 h-2 bg-red-500 rounded-full" /><span className="text-red-300 font-mono text-xs">{(recordingTime / 1000).toFixed(1)}s</span></div>}
                 <button onClick={() => isRecording ? stopRecording() : startRecording()} className={`glass-button px-4 py-2 rounded-lg text-white flex items-center gap-2 ${isRecording ? 'bg-red-500/50 border-red-500' : ''}`}><CircleDot size={18} /><span className="text-xs font-bold">{isRecording ? 'STOP' : 'REC VIDEO'}</span></button>
                 <button className="glass-button p-2 rounded-lg text-white" onClick={handleExportPlayer} title="Export Player"><FileVideo size={20} /></button>
             </div>
          </div>

          <div className="flex flex-col items-center gap-4 pointer-events-auto w-full max-w-2xl mx-auto">
              <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-full shadow-2xl">
                   <button onClick={togglePlay} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-brand-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}</button>
                   <div className="h-8 w-[1px] bg-white/10" />
                   <button onClick={toggleMic} className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all border ${isMicActive ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'border-transparent text-gray-400 hover:text-white'}`}>{isMicActive ? <Mic size={16} /> : <MicOff size={16} />} LIVE</button>
                   <div className="h-8 w-[1px] bg-white/10" />
                   <button onClick={() => setSuperCamActive(!superCamActive)} className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all border ${superCamActive ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}><Camera size={16} /> CAM</button>
                   <div className="h-8 w-[1px] bg-white/10" />
                   <button onClick={() => { setShowDeck(false); setShowFX(!showFX); }} className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all border ${showFX ? 'bg-brand-500 border-brand-400 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}><Zap size={16} /> FX</button>
                   <div className="h-8 w-[1px] bg-white/10" />
                   <button onClick={() => { setShowFX(false); setShowDeck(!showDeck); }} className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all border ${showDeck ? 'bg-white/20 border-white/30 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}><Layers size={16} /> MIXER</button>
              </div>
          </div>
      </div>

      {/* Debug Panel */}
      <KineticDebugPanel
        telemetry={telemetry}
        isVisible={showDebugPanel && useKineticEngine}
        onClose={() => setShowDebugPanel(false)}
      />
    </div>
  );
};
