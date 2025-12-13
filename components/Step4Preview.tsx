
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, Video, Settings, Mic, MicOff, Maximize2, Minimize2, Upload, X, Loader2, Sliders, Package, Music, ChevronDown, ChevronUp, Activity, Download, FileVideo, Radio, Star, Camera, Volume2, VolumeX, Sparkles, CircleDot, Monitor, Smartphone, Square, Eye, Layers, Plus, Trash2, Zap } from 'lucide-react';
import { AppState, EnergyLevel, MoveDirection, FrameType, DeckSlot, SavedProject, GeneratedFrame } from '../types';
import { QuantumVisualizer } from './Visualizer/HolographicVisualizer';
import { generatePlayerHTML } from '../services/playerExport';
import { STYLE_PRESETS } from '../constants';
import { useAudioAnalyzer } from '../hooks/useAudioAnalyzer';

interface Step4Props {
  state: AppState;
  onGenerateMore: () => void;
  onSpendCredit: (amount: number) => boolean;
  onUploadAudio: (file: File) => void;
  onSaveProject: () => void;
}

type AspectRatio = '9:16' | '1:1' | '16:9';
type Resolution = '720p' | '1080p' | '4K';

type RhythmPhase = 'AMBIENT' | 'WARMUP' | 'SWING_LEFT' | 'SWING_RIGHT' | 'DROP' | 'CHAOS';

// Interpolation Modes
type InterpMode = 'CUT' | 'SLIDE' | 'MORPH' | 'SMOOTH' | 'ZOOM_IN';
type FXMode = 'NORMAL' | 'INVERT' | 'BW' | 'STROBE' | 'GHOST';

export const Step4Preview: React.FC<Step4Props> = ({ state, onGenerateMore, onSpendCredit, onUploadAudio, onSaveProject }) => {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const charCanvasRef = useRef<HTMLCanvasElement>(null); 
  const containerRef = useRef<HTMLDivElement>(null);
  const audioElementRef = useRef<HTMLAudioElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  // -- Audio Hook --
  const { 
    audioDestRef, 
    isMicActive, 
    connectFileAudio, 
    connectMicAudio, 
    disconnectMic, 
    getFrequencyData 
  } = useAudioAnalyzer();

  const [isRecording, setIsRecording] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showDeck, setShowDeck] = useState(false); // Neural Deck Visibility
  
  // -- FX LAYER STATE --
  const [showFX, setShowFX] = useState(false);
  const [fxSettings, setFxSettings] = useState({
      hue: { base: 0, reactive: 0 },
      aberration: { base: 0, reactive: 20 },
      scanlines: { base: 0, reactive: 0 }
  });

  const [exportRatio, setExportRatio] = useState<AspectRatio>('9:16');
  const [exportRes, setExportRes] = useState<Resolution>('1080p');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordCanvasRef = useRef<HTMLCanvasElement>(null); 
  const [recordingTime, setRecordingTime] = useState(0);

  const hologramRef = useRef<QuantumVisualizer | null>(null);
  
  const requestRef = useRef<number>(0);
  const lastFrameTimeRef = useRef<number>(0); 
  const lastBeatTimeRef = useRef<number>(0);
  const lastStutterTimeRef = useRef<number>(0);
  
  const [brainState, setBrainState] = useState({ activePoseName: 'BASE', fps: 0 });
  const [hoveredFrame, setHoveredFrame] = useState<GeneratedFrame | null>(null); // For Tooltip

  // --- MULTI-DECK STATE ---
  const [decks, setDecks] = useState<DeckSlot[]>([
      { id: 0, rig: null, isActive: true, opacity: 1.0 },
      { id: 1, rig: null, isActive: false, opacity: 1.0 },
      { id: 2, rig: null, isActive: false, opacity: 1.0 },
      { id: 3, rig: null, isActive: false, opacity: 1.0 },
  ]);

  // --- INTERPOLATION STATE ---
  const sourcePoseRef = useRef<string>('base'); 
  const targetPoseRef = useRef<string>('base'); 
  const transitionProgressRef = useRef<number>(1.0); 
  const transitionSpeedRef = useRef<number>(10.0);   
  const transitionModeRef = useRef<InterpMode>('CUT');

  // --- DYNAMIC CHOREOGRAPHY STATE ---
  const energyHistoryRef = useRef<number[]>(new Array(30).fill(0));
  const beatCounterRef = useRef<number>(0); 
  const closeupLockTimeRef = useRef<number>(0); 
  const currentDirectionRef = useRef<MoveDirection>('center');

  const BASE_ZOOM = 1.15;
  const camZoomRef = useRef<number>(BASE_ZOOM);
  const camPanXRef = useRef<number>(0); 
  
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
  
  // FX
  const ghostAmountRef = useRef<number>(0); 
  const fluidStutterRef = useRef<number>(0); 
  const scratchModeRef = useRef<boolean>(false);
  const rgbSplitRef = useRef<number>(0); 
  const flashIntensityRef = useRef<number>(0); 
  const activeFXModeRef = useRef<FXMode>('NORMAL'); 
  
  const [frameCount, setFrameCount] = useState(0);
  const [imagesReady, setImagesReady] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [superCamActive, setSuperCamActive] = useState(true);

  // Helper to process frames into buckets and load images
  const processRig = useCallback(async (frames: GeneratedFrame[], slotId: number) => {
      const sorted: Record<EnergyLevel, GeneratedFrame[]> = { low: [], mid: [], high: [] };
      const closeups: GeneratedFrame[] = [];
      const images: Record<string, HTMLImageElement> = {};
      const loadPromises: Promise<void>[] = [];

      // HELPER: Load and cache image
      const preload = (url: string, pose: string) => {
          return new Promise<void>((resolve) => {
              if (images[pose]) { resolve(); return; } // already loaded
              
              const img = new Image();
              img.crossOrigin = "anonymous";
              img.src = url;
              img.onload = () => resolve();
              img.onerror = () => resolve(); // Don't block
              images[pose] = img;
          });
      };

      for (const f of frames) {
          const frameData = { ...f };
          loadPromises.push(preload(frameData.url, frameData.pose));

          if (f.type === 'closeup') {
              closeups.push(frameData);
              // MECHANICAL FRAME: Add zoom/impact version for closeup
              const vPose = f.pose + '_vzoom';
              closeups.push({ ...frameData, pose: vPose, isVirtual: true, virtualZoom: 1.4, virtualOffsetY: 0.0 });
              loadPromises.push(new Promise<void>(r => { images[vPose] = images[f.pose]; r(); }));
          } 
          else {
              if (sorted[f.energy]) sorted[f.energy].push(frameData);
              
              // MECHANICAL FRAME: Virtual Zoom for High Energy
              if (f.energy === 'high') {
                  const vPose = f.pose + '_vzoom';
                  // Add to 'high' bucket so randomizer picks it up
                  sorted.high.push({ ...frameData, pose: vPose, isVirtual: true, virtualZoom: 1.6, virtualOffsetY: 0.2 });
                  // Reuse original image ref
                  loadPromises.push(new Promise<void>(r => { images[vPose] = images[f.pose]; r(); }));
              }
              
              // MECHANICAL FRAME: Virtual Mid-Shot for Mid Energy
              if (f.energy === 'mid') {
                  const vPose = f.pose + '_vmid';
                  sorted.mid.push({ ...frameData, pose: vPose, isVirtual: true, virtualZoom: 1.25, virtualOffsetY: 0.1 });
                  loadPromises.push(new Promise<void>(r => { images[vPose] = images[f.pose]; r(); }));
              }
          }
      }

      // Fallbacks to ensure buckets aren't empty
      if (sorted.low.length === 0 && sorted.mid.length > 0) sorted.low = [...sorted.mid];
      if (sorted.mid.length === 0 && sorted.low.length > 0) sorted.mid = [...sorted.low];
      if (sorted.high.length === 0 && sorted.mid.length > 0) sorted.high = [...sorted.mid];

      // Wait for images
      await Promise.all(loadPromises);

      setDecks(prev => prev.map(d => d.id === slotId ? { 
          ...d, 
          isActive: true, // Auto-activate on load
          images, 
          framesByEnergy: sorted, 
          closeups 
      } : d));
      
      setFrameCount(prev => prev + frames.length);
  }, []);

  // Initialize Default Deck (Slot 0) - RESTORED AUTOMATIC UPDATES
  useEffect(() => {
      // Logic: If state has frames, and Deck 0 is either empty OR has different frames than state (new generation), update it.
      const currentDeckRigId = decks[0].rig?.id;
      const stateRigId = 'current_session'; // Synthetic ID for current session
      
      const hasFrames = state.generatedFrames.length > 0;
      const needsUpdate = hasFrames && (!decks[0].rig || decks[0].rig.frames.length !== state.generatedFrames.length);

      if (needsUpdate) {
          const defaultRig: SavedProject = {
              id: stateRigId,
              name: 'Current Session',
              createdAt: Date.now(),
              frames: state.generatedFrames,
              styleId: state.selectedStyleId,
              subjectCategory: state.subjectCategory
          };
          
          setDecks(prev => prev.map(d => d.id === 0 ? { ...d, rig: defaultRig } : d));
          processRig(state.generatedFrames, 0).then(() => setImagesReady(true));
      } 
      else if (state.imagePreviewUrl && !decks[0].rig && !hasFrames) {
          // Placeholder rig from image if no frames yet
          const dummyFrame: GeneratedFrame = {
              url: state.imagePreviewUrl,
              pose: 'base',
              energy: 'low',
              type: 'body',
              direction: 'center'
          };
           const defaultRig: SavedProject = {
              id: 'preview',
              name: 'Preview Image',
              createdAt: Date.now(),
              frames: [dummyFrame],
              styleId: state.selectedStyleId,
              subjectCategory: state.subjectCategory
          };
          setDecks(prev => prev.map(d => d.id === 0 ? { ...d, rig: defaultRig } : d));
          processRig([dummyFrame], 0).then(() => setImagesReady(true));
      }
  }, [state.generatedFrames, state.imagePreviewUrl, processRig]); // Removed `decks` from dependency to prevent loop, checking logic inside

  // Deck Management Logic
  const handleDeckToggle = (id: number) => {
      setDecks(prev => prev.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d));
  };

  const handleImportRig = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
          try {
              const project = JSON.parse(ev.target?.result as string) as SavedProject;
              if (!project.frames) throw new Error("Invalid Rig");

              // Find empty slot
              const emptySlot = decks.find(d => !d.rig);
              if (emptySlot) {
                  setDecks(prev => prev.map(d => d.id === emptySlot.id ? { ...d, rig: project } : d));
                  processRig(project.frames, emptySlot.id);
              } else {
                  // Prompt for replacement
                  const replacement = confirm("All deck slots are full. Replace the last slot (Slot 4)?");
                  if(replacement) {
                       setDecks(prev => prev.map(d => d.id === 3 ? { ...d, rig: project } : d));
                       processRig(project.frames, 3);
                  }
              }
          } catch (err) {
              alert("Failed to load rig.");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };
  
  const removeRig = (id: number) => {
      if (id === 0) return; // Don't remove main
      setDecks(prev => prev.map(d => d.id === id ? { ...d, rig: null, isActive: false, images: undefined } : d));
  };

  // 1. Initialize Hologram
  useEffect(() => {
    if (bgCanvasRef.current && !hologramRef.current) {
        try {
            hologramRef.current = new QuantumVisualizer(bgCanvasRef.current);
            const style = STYLE_PRESETS.find(s => s.id === state.selectedStyleId);
            if(style && style.hologramParams) {
                hologramRef.current.params = {...style.hologramParams};
            }
        } catch (e) { console.error("Failed to init hologram:", e); }
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
  }, [state.selectedStyleId]);

  const toggleMic = () => {
      if (isMicActive) {
          disconnectMic();
      } else {
          setIsPlaying(false);
          if (audioElementRef.current) audioElementRef.current.pause();
          connectMicAudio();
      }
  };

  // Helper to trigger a Smart Transition
  const triggerTransition = (newPose: string, mode: InterpMode, speedMultiplier: number = 1.0) => {
      if (newPose === targetPoseRef.current) return;
      
      sourcePoseRef.current = targetPoseRef.current;
      targetPoseRef.current = newPose;
      transitionProgressRef.current = 0.0;
      transitionModeRef.current = mode;
      
      let speed = 20.0;
      if (mode === 'CUT') speed = 1000.0; // Instant
      else if (mode === 'MORPH') speed = 5.0; // Fast crossfade
      else if (mode === 'ZOOM_IN') speed = 6.0; // Rapid Zoom
      else if (mode === 'SLIDE') speed = 8.0; // Fluid
      else if (mode === 'SMOOTH') speed = 1.5; // Slow interpolation (Ambient)
      
      transitionSpeedRef.current = speed * speedMultiplier;
  };

  // 3. Animation Loop
  const loop = useCallback((time: number) => {
    if (!lastFrameTimeRef.current) lastFrameTimeRef.current = time;
    const deltaTime = Math.min((time - lastFrameTimeRef.current) / 1000, 0.1); 
    lastFrameTimeRef.current = time;

    requestRef.current = requestAnimationFrame(loop);
    
    // --- TRANSITION UPDATE ---
    if (transitionProgressRef.current < 1.0) {
        transitionProgressRef.current += transitionSpeedRef.current * deltaTime;
        if (transitionProgressRef.current > 1.0) transitionProgressRef.current = 1.0;
    }

    // Get Audio Data from Hook
    const { bass, mid, high, energy } = getFrequencyData();
    
    // --- DYNAMIC CHOREOGRAPHY ANALYSIS ---
    energyHistoryRef.current.shift();
    energyHistoryRef.current.push(energy);
    const avgEnergy = energyHistoryRef.current.reduce((a, b) => a + b, 0) / energyHistoryRef.current.length;
    const energyTrend = energy - avgEnergy;

    // --- PHYSICS ---
    const stiffness = 140;
    const damping = 8; 
    
    const targetRotX = bass * 35.0; 
    const targetRotY = mid * 25.0 * Math.sin(time * 0.005); 
    const targetRotZ = high * 15.0; 

    // Spring Solver
    masterVelXRef.current += ((targetRotX - masterRotXRef.current) * stiffness - (masterVelXRef.current * damping)) * deltaTime;
    masterRotXRef.current += masterVelXRef.current * deltaTime;

    masterVelYRef.current += ((targetRotY - masterRotYRef.current) * (stiffness * 0.5) - (masterVelYRef.current * (damping * 0.8))) * deltaTime;
    masterRotYRef.current += masterVelYRef.current * deltaTime;

    masterVelZRef.current += ((targetRotZ - masterRotZRef.current) * stiffness - (masterVelZRef.current * damping)) * deltaTime;
    masterRotZRef.current += masterVelZRef.current * deltaTime;

    if (hologramRef.current) {
        hologramRef.current.updateAudio({ bass, mid, high, energy });
        const rx = superCamActive ? masterRotXRef.current * 0.3 : 0;
        const ry = superCamActive ? masterRotYRef.current * 0.3 : 0;
        const rz = superCamActive ? masterRotZRef.current * 0.2 : 0;
        hologramRef.current.render(0, { x: rx, y: ry, z: rz }); 
    }

    const now = Date.now();
    const isCloseupLocked = now < closeupLockTimeRef.current;
    
    // --- STUTTER & SCRATCH ENGINE ---
    const isStuttering = (mid > 0.6 || high > 0.6) && !isCloseupLocked;
    
    if (isStuttering && (now - lastStutterTimeRef.current) > 50) { 
        lastStutterTimeRef.current = now;
        
        if (Math.random() < 0.35) { 
             const swap = targetPoseRef.current;
             triggerTransition(sourcePoseRef.current, 'CUT'); 
             sourcePoseRef.current = swap; 
             
             charSkewRef.current = (Math.random() - 0.5) * 2.0; 
             fluidStutterRef.current = 1.0; 
             scratchModeRef.current = true;
             rgbSplitRef.current = 1.0; 
             masterRotZRef.current += (Math.random() - 0.5) * 10;
        } else {
             // USE DECK 0 Frames as reference for energy availability
             const refDeck = decks.find(d => d.rig) || decks[0];
             if(refDeck && refDeck.framesByEnergy && refDeck.framesByEnergy.high) {
                 const pool = [...refDeck.framesByEnergy.high];
                 if(pool.length > 0) {
                     const next = pool[Math.floor(Math.random() * pool.length)].pose;
                     triggerTransition(next, 'CUT', 1.0);
                 }
             }
             scratchModeRef.current = false;
        }
    }

    // --- MAIN GROOVE ENGINE ---
    const beatThreshold = 0.5;
    
    if (!scratchModeRef.current && (now - lastBeatTimeRef.current) > 300) {
        if (bass > beatThreshold) {
            lastBeatTimeRef.current = now;
            beatCounterRef.current = (beatCounterRef.current + 1) % 16; 

            const beat = beatCounterRef.current;
            let phase: RhythmPhase = 'WARMUP';
            if (beat >= 4 && beat < 8) phase = 'SWING_LEFT';
            else if (beat >= 8 && beat < 12) phase = 'SWING_RIGHT';
            else if (beat === 12 || beat === 13) phase = 'DROP'; 
            else if (beat >= 14) phase = 'CHAOS'; 
            
            if (phase === 'CHAOS' || phase === 'DROP') {
                const rand = Math.random();
                if (rand > 0.7) activeFXModeRef.current = 'INVERT';
                else if (rand > 0.4) activeFXModeRef.current = 'BW';
                else activeFXModeRef.current = 'NORMAL';
            } else {
                activeFXModeRef.current = 'NORMAL';
            }

            camZoomRef.current = BASE_ZOOM + (bass * 0.35); 
            charSquashRef.current = 0.85; 
            charBounceYRef.current = -50 * bass; 
            flashIntensityRef.current = 0.8; 

            if (phase === 'SWING_LEFT') { targetTiltRef.current = -8; currentDirectionRef.current = 'left'; }
            else if (phase === 'SWING_RIGHT') { targetTiltRef.current = 8; currentDirectionRef.current = 'right'; }
            else if (phase === 'CHAOS') targetTiltRef.current = (Math.random() - 0.5) * 25; 
            else { targetTiltRef.current = 0; currentDirectionRef.current = 'center'; }

            // USE MAIN DECK FOR DECISION MAKING
            const refDeck = decks.find(d => d.rig) || decks[0];
            
            if (refDeck && refDeck.framesByEnergy && refDeck.closeups) {
                let pool: GeneratedFrame[] = [];
                
                if (isCloseupLocked) {
                    pool = refDeck.closeups;
                } else {
                    if (energyTrend > 0.1 && refDeck.framesByEnergy.high.length > 0) {
                        pool = refDeck.framesByEnergy.high;
                    } else {
                        if (phase === 'WARMUP') pool = refDeck.framesByEnergy.low; 
                        else if (phase === 'SWING_LEFT') {
                            const leftFrames = refDeck.framesByEnergy.mid.filter(f => f.direction === 'left');
                            pool = leftFrames.length > 0 ? leftFrames : refDeck.framesByEnergy.mid;
                        } else if (phase === 'SWING_RIGHT') {
                            const rightFrames = refDeck.framesByEnergy.mid.filter(f => f.direction === 'right');
                            pool = rightFrames.length > 0 ? rightFrames : refDeck.framesByEnergy.mid;
                        } else if (phase === 'DROP') pool = refDeck.framesByEnergy.high;
                        else if (phase === 'CHAOS') pool = refDeck.framesByEnergy.high;
                    }
                }

                if (pool.length === 0) pool = refDeck.framesByEnergy.mid;
                if (pool.length === 0) pool = refDeck.framesByEnergy.low;
                
                if (pool.length > 0) {
                    let nextFrame = pool[Math.floor(Math.random() * pool.length)];
                    let attempts = 0;
                    while (nextFrame.pose === targetPoseRef.current && attempts < 3 && phase !== 'CHAOS') {
                        nextFrame = pool[Math.floor(Math.random() * pool.length)];
                        attempts++;
                    }
                    
                    let mode: InterpMode = 'CUT'; 
                    
                    if (isCloseupLocked || nextFrame.type === 'closeup') {
                        mode = 'ZOOM_IN'; 
                    } else if (phase === 'SWING_LEFT' || phase === 'SWING_RIGHT') {
                        if (high > 0.4) mode = 'SMOOTH';
                        else mode = 'SLIDE';
                    } else if (phase === 'DROP') {
                        mode = 'CUT';
                    } else if (energyTrend < -0.1) {
                        mode = 'SMOOTH';
                    }

                    triggerTransition(nextFrame.pose, mode);
                }
            }
        } 
        else if (bass < 0.3 && mid < 0.3) {
             const refDeck = decks.find(d => d.rig) || decks[0];
             if (Math.random() < 0.02 && refDeck && refDeck.framesByEnergy) {
                 const pool = refDeck.framesByEnergy.low;
                 if (pool && pool.length > 0) {
                     const next = pool[Math.floor(Math.random() * pool.length)];
                     triggerTransition(next.pose, 'SMOOTH');
                 }
                 targetTiltRef.current = 0;
                 currentDirectionRef.current = 'center';
             }
        }
    }
    
    // Vocal Gate logic
    if(!isCloseupLocked && high > 0.6 && mid > 0.4 && bass < 0.5) {
        const refDeck = decks.find(d => d.rig) || decks[0];
        if (refDeck && refDeck.closeups && refDeck.closeups.length > 0 && Math.random() < 0.5) {
            const next = refDeck.closeups[Math.floor(Math.random() * refDeck.closeups.length)].pose;
            triggerTransition(next, 'ZOOM_IN', 1.0); 
            closeupLockTimeRef.current = now + 2500;
        }
    }

    // Physics Decay
    charSquashRef.current += (1.0 - charSquashRef.current) * (12 * deltaTime);
    charSkewRef.current += (0.0 - charSkewRef.current) * (10 * deltaTime);
    fluidStutterRef.current *= Math.exp(-8 * deltaTime); 
    charTiltRef.current += (targetTiltRef.current - charTiltRef.current) * (6 * deltaTime);
    charBounceYRef.current += (0 - charBounceYRef.current) * (10 * deltaTime); 
    
    rgbSplitRef.current *= Math.exp(-10 * deltaTime); 
    flashIntensityRef.current *= Math.exp(-15 * deltaTime); 

    const decay = 1 - Math.exp(-5 * deltaTime);
    camZoomRef.current += (BASE_ZOOM - camZoomRef.current) * decay;
    ghostAmountRef.current *= Math.exp(-8 * deltaTime); 
    
    let targetPanX = 0;
    if (currentDirectionRef.current === 'left') targetPanX = 30;
    else if (currentDirectionRef.current === 'right') targetPanX = -30;
    camPanXRef.current += (targetPanX - camPanXRef.current) * (4 * deltaTime);

    const rotX = superCamActive ? masterRotXRef.current : 0;
    const rotY = superCamActive ? masterRotYRef.current : 0;
    const rotZ = superCamActive ? masterRotZRef.current : 0;
    
    // RENDER FUNCTION
    const renderCharacterCanvas = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
        const cx = w/2;
        const cy = h/2;
        ctx.clearRect(0, 0, w, h);
        
        // --- FX LAYER PROCESSING ---
        const fxHue = fxSettings.hue.base + (fxSettings.hue.reactive * (high * 2) * 1.8); // 0-180deg
        const fxAberration = fxSettings.aberration.base + (fxSettings.aberration.reactive * bass);
        const fxScanlines = fxSettings.scanlines.base + (fxSettings.scanlines.reactive * mid);
        
        let filterString = '';
        if (activeFXModeRef.current === 'INVERT') filterString += ' invert(1)';
        else if (activeFXModeRef.current === 'BW') filterString += ' grayscale(1)';
        
        if (fxHue > 2) filterString += ` hue-rotate(${fxHue}deg)`;
        
        if (filterString === '') ctx.filter = 'none';
        else ctx.filter = filterString.trim();

        // --- MULTI DECK RENDERING ---
        // We render active decks from 0 to 3
        decks.forEach(deck => {
            if (!deck.isActive || !deck.images) return;

            const drawLayer = (pose: string, opacity: number, blurAmount: number, skewOffset: number, extraScale: number = 1.0) => {
                // Find frame data in this deck (fallback to matching pose name)
                let frame = deck.framesByEnergy?.low.find(f => f.pose === pose) 
                         || deck.framesByEnergy?.mid.find(f => f.pose === pose)
                         || deck.framesByEnergy?.high.find(f => f.pose === pose)
                         || deck.closeups?.find(f => f.pose === pose);
                
                // Fallback: If not found (e.g. pose is 'base_vzoom' but only 'base' exists in this deck), try stripping suffix
                if (!frame && pose.includes('_v')) {
                    const rootPose = pose.split('_v')[0];
                    frame = deck.framesByEnergy?.low.find(f => f.pose === rootPose) 
                         || deck.framesByEnergy?.mid.find(f => f.pose === rootPose)
                         || deck.framesByEnergy?.high.find(f => f.pose === rootPose)
                         || deck.closeups?.find(f => f.pose === rootPose);
                }

                // If still no frame, verify if we at least have an image
                const img = deck.images![pose] || (pose.includes('_v') ? deck.images![pose.split('_v')[0]] : null);
                if (!img || !img.complete || img.naturalWidth === 0) return;
                
                const aspect = img.width / img.height;
                let dw = w;
                let dh = w / aspect;
                
                if (dh > h) { dh = h; dw = dh * aspect; } 
                
                const renderFrame = (image: HTMLImageElement, zoom: number, alpha: number, composite: GlobalCompositeOperation = 'source-over', offsetY: number = 0, colorChannel: 'all'|'r'|'b' = 'all') => {
                    ctx.save();
                    ctx.translate(cx + camPanXRef.current, cy + charBounceYRef.current); 
                    
                    if (colorChannel === 'r') ctx.translate(-10 * (rgbSplitRef.current + fxAberration * 0.1), 0);
                    if (colorChannel === 'b') ctx.translate(10 * (rgbSplitRef.current + fxAberration * 0.1), 0);

                    const radX = (rotX * Math.PI) / 180;
                    const radY = (rotY * Math.PI) / 180;
                    const scaleX = Math.cos(radY); 
                    const scaleY = Math.cos(radX); 
                    
                    const tiltZ = (rotZ * 0.8) * (Math.PI/180);
                    ctx.rotate(tiltZ + (charTiltRef.current * Math.PI / 180));
                    ctx.scale(Math.abs(scaleX), Math.abs(scaleY));
                    ctx.scale(1/charSquashRef.current, charSquashRef.current); 
                    
                    if (skewOffset !== 0) ctx.transform(1, 0, skewOffset, 1, 0, 0);
                    if (charSkewRef.current !== 0) ctx.transform(1, 0, charSkewRef.current * 0.2, 1, 0, 0);

                    ctx.scale(zoom * extraScale, zoom * extraScale);
                    ctx.translate(0, offsetY * dh); 
                    
                    if (blurAmount > 0) {
                         const currentFilter = ctx.filter === 'none' ? '' : ctx.filter;
                         ctx.filter = `${currentFilter} blur(${blurAmount}px)`;
                    }

                    ctx.globalAlpha = alpha * deck.opacity;
                    ctx.globalCompositeOperation = composite;
                    
                    if (colorChannel !== 'all') {
                         ctx.globalAlpha = alpha * deck.opacity * 0.7;
                         if(colorChannel === 'r') ctx.filter = 'hue-rotate(90deg)'; 
                         if(colorChannel === 'b') ctx.filter = 'hue-rotate(-90deg)';
                    }

                    try {
                        ctx.drawImage(image, -dw/2, -dh/2, dw, dh);
                    } catch (e) {}
                    ctx.restore();
                };

                let effectiveZoom = camZoomRef.current;
                let effectiveOffsetY = 0;
                
                if (frame && frame.isVirtual && frame.virtualZoom) {
                    effectiveZoom *= frame.virtualZoom;
                    effectiveOffsetY = frame.virtualOffsetY || 0;
                }
                
                const totalAberration = rgbSplitRef.current + (fxAberration * 0.05);
                
                if (totalAberration > 0.05) {
                    renderFrame(img, effectiveZoom, opacity * 0.8, 'screen', effectiveOffsetY, 'r');
                    renderFrame(img, effectiveZoom, opacity * 0.8, 'screen', effectiveOffsetY, 'b');
                    renderFrame(img, effectiveZoom, opacity, 'multiply', effectiveOffsetY, 'all'); 
                } else {
                    renderFrame(img, effectiveZoom, opacity, 'source-over', effectiveOffsetY);
                }
            };

            const progress = transitionProgressRef.current;
            const mode = transitionModeRef.current;
            
            if (progress >= 1.0 || mode === 'CUT') {
                drawLayer(targetPoseRef.current, 1.0, 0, 0);
            } else {
                const easeT = progress * progress * (3 - 2 * progress); 
                
                if (mode === 'ZOOM_IN') {
                     const zoomFactor = 1.0 + (easeT * 0.5); 
                     drawLayer(sourcePoseRef.current, 1.0 - easeT, easeT * 10, 0, zoomFactor);
                     drawLayer(targetPoseRef.current, easeT, 0, 0);
                } else if (mode === 'SLIDE') {
                    const dirMultiplier = targetPoseRef.current.includes('right') ? -1 : 1;
                    drawLayer(sourcePoseRef.current, 1.0 - easeT, 0, easeT * 0.5 * dirMultiplier);
                    drawLayer(targetPoseRef.current, easeT, 0, (1.0 - easeT) * -0.5 * dirMultiplier);
                } else if (mode === 'SMOOTH' || mode === 'MORPH') {
                    drawLayer(sourcePoseRef.current, 1.0 - easeT, 0, 0);
                    drawLayer(targetPoseRef.current, easeT, 0, 0); 
                }
            }
        }); // End Deck Loop
            
        // Scanlines FX
        const totalScanlines = fxScanlines + (mid * 0.3); // Mix manual + auto beat
        if (totalScanlines > 0.1) {
            ctx.save();
            ctx.fillStyle = `rgba(0,0,0, ${totalScanlines * 0.4})`;
            const step = Math.max(2, Math.floor(10 - totalScanlines * 8));
            for(let y=0; y<h; y+=step) {
                 ctx.fillRect(0, y, w, step/2);
            }
            ctx.restore();
        }
        
        if (flashIntensityRef.current > 0.01) {
            ctx.fillStyle = `rgba(255,255,255, ${flashIntensityRef.current})`;
            ctx.fillRect(0,0,w,h);
        }
    };

    if (charCanvasRef.current && imagesReady) {
        const ctx = charCanvasRef.current.getContext('2d');
        if (ctx) renderCharacterCanvas(ctx, charCanvasRef.current.width, charCanvasRef.current.height);
    }
    
    // Recording Renderer
    if (isRecording && recordCanvasRef.current && bgCanvasRef.current) {
        const ctx = recordCanvasRef.current.getContext('2d');
        if (ctx) {
            const w = recordCanvasRef.current.width;
            const h = recordCanvasRef.current.height;
            const bgAspect = bgCanvasRef.current.width / bgCanvasRef.current.height;
            let bgW = w;
            let bgH = w / bgAspect;
            if (bgH < h) { bgH = h; bgW = bgH * bgAspect; }
            
            ctx.drawImage(bgCanvasRef.current, (w-bgW)/2, (h-bgH)/2, bgW, bgH);
            renderCharacterCanvas(ctx, w, h);
        }
    }
    
    setBrainState({
        activePoseName: targetPoseRef.current,
        fps: Math.round(1/deltaTime)
    });

  }, [imagesReady, superCamActive, isRecording, getFrequencyData, decks, fxSettings]); 


  useEffect(() => {
    if (imagesReady) {
        requestRef.current = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [loop, imagesReady]);

  // Audio Playback Handling
  useEffect(() => {
      if(audioElementRef.current && isPlaying) {
          connectFileAudio(audioElementRef.current);
          audioElementRef.current.play();
      } else if(audioElementRef.current) {
          audioElementRef.current.pause();
      }
  }, [isPlaying, connectFileAudio]);


  const handleExportWidget = () => {
      if(!hologramRef.current) return;
      // We pass the currently loaded rigs into the exported player
      // We map our DeckSlot structure to a simpler array for export
      const exportDecks = decks.map(d => ({
          id: d.id,
          rig: d.rig,
          isActive: d.isActive
      }));
      
      const html = generatePlayerHTML(exportDecks, hologramRef.current.params, state.subjectCategory);
      const blob = new Blob([html], {type: 'text/html'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `jusdnce_rig_${Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  };

  const startRecording = () => {
      if (!recordCanvasRef.current) return;
      
      let w = 1080;
      let h = 1920;
      
      const resMult = exportRes === '4K' ? 2 : (exportRes === '720p' ? 0.66 : 1);
      const baseDim = 1080 * resMult;
      
      if (exportRatio === '9:16') { w = baseDim; h = baseDim * (16/9); }
      else if (exportRatio === '16:9') { w = baseDim * (16/9); h = baseDim; }
      else if (exportRatio === '1:1') { w = baseDim; h = baseDim; }
      
      recordCanvasRef.current.width = Math.floor(w);
      recordCanvasRef.current.height = Math.floor(h);

      const stream = recordCanvasRef.current.captureStream(60);
      
      if (audioDestRef.current) {
          const audioTracks = audioDestRef.current.stream.getAudioTracks();
          if (audioTracks.length > 0) {
              stream.addTrack(audioTracks[0]);
          }
      }

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 8000000 });
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `jusdnce_${exportRatio.replace(':','x')}_${Date.now()}.webm`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      };
      
      recorder.start();
      setIsRecording(true);
      setShowExportMenu(false); 
      
      const startTime = Date.now();
      const interval = setInterval(() => {
          setRecordingTime(Date.now() - startTime);
      }, 100);
      (mediaRecorderRef.current as any).timerInterval = interval;
  };

  const stopRecording = () => {
      if (mediaRecorderRef.current && isRecording) {
          mediaRecorderRef.current.stop();
          clearInterval((mediaRecorderRef.current as any).timerInterval);
          setIsRecording(false);
          setRecordingTime(0);
      }
  };


  return (
    <div ref={containerRef} className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black/90">
      
      <canvas ref={recordCanvasRef} className="hidden pointer-events-none fixed -top-[9999px]" />

      <div className="absolute inset-0 w-full h-full overflow-hidden flex items-center justify-center perspective-1000">
           <canvas 
              ref={bgCanvasRef} 
              className="absolute inset-0 w-full h-full object-cover opacity-80 transition-transform duration-75 ease-linear will-change-transform" 
           />
           <canvas 
              ref={charCanvasRef} 
              className="absolute inset-0 w-full h-full object-contain z-10 transition-transform duration-75 ease-linear will-change-transform" 
           />
      </div>

      {showExportMenu && (
          <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center animate-fade-in p-6">
              <div className="bg-dark-surface border border-brand-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-zoom-out relative">
                  <button onClick={() => setShowExportMenu(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                  <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><FileVideo className="text-brand-400" /> EXPORT SETTINGS</h3>
                  <div className="space-y-6">
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">Aspect Ratio</label>
                          <div className="grid grid-cols-3 gap-3">
                              {[{ id: '9:16', icon: Smartphone, label: 'Story' }, { id: '1:1', icon: Square, label: 'Post' }, { id: '16:9', icon: Monitor, label: 'Cinema' }].map((opt) => (
                                  <button key={opt.id} onClick={() => setExportRatio(opt.id as AspectRatio)} className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${exportRatio === opt.id ? 'bg-brand-600 border-brand-400 text-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}>
                                      <opt.icon size={20} /> <span className="text-xs font-bold">{opt.label}</span>
                                  </button>
                              ))}
                          </div>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block mb-3">Resolution</label>
                          <div className="flex bg-black/40 rounded-lg p-1 border border-white/10">
                              {['720p', '1080p', '4K'].map((res) => (
                                  <button key={res} onClick={() => setExportRes(res as Resolution)} className={`flex-1 py-2 rounded-md text-xs font-bold transition-all ${exportRes === res ? 'bg-brand-500 text-white shadow-md' : 'text-gray-500 hover:text-white'}`}>{res}</button>
                              ))}
                          </div>
                      </div>
                      <button onClick={startRecording} className="w-full py-4 bg-red-600 hover:bg-red-500 text-white font-black tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(220,38,38,0.4)] transition-all hover:scale-[1.02]"><CircleDot size={20} /> START RECORDING</button>
                  </div>
              </div>
          </div>
      )}

      {!imagesReady && !state.isGenerating && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 backdrop-blur-md">
             <Loader2 size={48} className="text-brand-500 animate-spin mb-4" />
             <p className="text-white font-mono tracking-widest animate-pulse">NEURAL RIG INITIALIZING...</p>
             <p className="text-gray-500 text-xs mt-2">Loading {frameCount} frames</p>
         </div>
      )}
      
      {state.isGenerating && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in slide-in-from-top-4 fade-in">
             <div className="bg-black/80 border border-brand-500/50 px-6 py-3 rounded-full flex items-center gap-4 shadow-[0_0_30px_rgba(139,92,246,0.3)] backdrop-blur-md">
                  <div className="relative w-5 h-5">
                      <div className="w-5 h-5 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                  </div>
                  <div className="flex flex-col">
                      <span className="text-xs font-bold text-white tracking-widest">EXPANDING REALITY</span>
                      <span className="text-[10px] text-brand-300 font-mono">Generating variations...</span>
                  </div>
             </div>
          </div>
      )}

      {state.audioPreviewUrl && (
          <audio ref={audioElementRef} src={state.audioPreviewUrl} loop crossOrigin="anonymous" onEnded={() => setIsPlaying(false)} />
      )}
      
      {/* FX CONTROL PANEL */}
      {showFX && (
         <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-40 p-4 animate-slide-in-right w-full max-w-lg">
             <div className="bg-black/80 backdrop-blur-lg border-t border-white/10 p-5 rounded-xl">
                 <div className="flex justify-between items-center mb-5">
                     <h4 className="text-white font-bold text-xs tracking-widest flex items-center gap-2"><Zap size={14}/> FX RACK</h4>
                     <button onClick={() => setShowFX(false)} className="text-gray-400 hover:text-white"><X size={14} /></button>
                 </div>
                 
                 <div className="space-y-6">
                     {/* HUE SHIFT */}
                     <div className="space-y-2">
                         <div className="flex justify-between text-[10px] font-bold text-gray-400">
                             <span>HUE SHIFT</span>
                             <span className="text-brand-400">REACTIVITY: {fxSettings.hue.reactive}%</span>
                         </div>
                         <div className="flex gap-4 items-center">
                             <input type="range" min="0" max="360" value={fxSettings.hue.base} onChange={e => setFxSettings(p => ({...p, hue: {...p.hue, base: Number(e.target.value)}}))} className="flex-1 h-1 bg-white/10 rounded-full accent-white" />
                             <input type="range" min="0" max="100" value={fxSettings.hue.reactive} onChange={e => setFxSettings(p => ({...p, hue: {...p.hue, reactive: Number(e.target.value)}}))} className="w-24 h-1 bg-white/10 rounded-full accent-brand-500" />
                         </div>
                     </div>

                     {/* CHROMATIC ABERRATION */}
                     <div className="space-y-2">
                         <div className="flex justify-between text-[10px] font-bold text-gray-400">
                             <span>ABERRATION</span>
                             <span className="text-brand-400">REACTIVITY: {fxSettings.aberration.reactive}%</span>
                         </div>
                         <div className="flex gap-4 items-center">
                             <input type="range" min="0" max="100" value={fxSettings.aberration.base} onChange={e => setFxSettings(p => ({...p, aberration: {...p.aberration, base: Number(e.target.value)}}))} className="flex-1 h-1 bg-white/10 rounded-full accent-white" />
                             <input type="range" min="0" max="100" value={fxSettings.aberration.reactive} onChange={e => setFxSettings(p => ({...p, aberration: {...p.aberration, reactive: Number(e.target.value)}}))} className="w-24 h-1 bg-white/10 rounded-full accent-brand-500" />
                         </div>
                     </div>

                     {/* SCANLINES */}
                     <div className="space-y-2">
                         <div className="flex justify-between text-[10px] font-bold text-gray-400">
                             <span>SCANLINES</span>
                             <span className="text-brand-400">REACTIVITY: {fxSettings.scanlines.reactive}%</span>
                         </div>
                         <div className="flex gap-4 items-center">
                             <input type="range" min="0" max="100" value={fxSettings.scanlines.base} onChange={e => setFxSettings(p => ({...p, scanlines: {...p.scanlines, base: Number(e.target.value)}}))} className="flex-1 h-1 bg-white/10 rounded-full accent-white" />
                             <input type="range" min="0" max="100" value={fxSettings.scanlines.reactive} onChange={e => setFxSettings(p => ({...p, scanlines: {...p.scanlines, reactive: Number(e.target.value)}}))} className="w-24 h-1 bg-white/10 rounded-full accent-brand-500" />
                         </div>
                     </div>
                 </div>
             </div>
         </div>
      )}

      {/* NEURAL DECK / MULTI-CHANNEL MIXER */}
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
                         <div key={deck.id} className={`relative p-2 rounded-lg border transition-all ${deck.isActive ? 'border-brand-500 bg-brand-900/20' : 'border-white/10 bg-black/40'} ${!deck.rig ? 'opacity-50 border-dashed' : ''}`}>
                             <div className="aspect-square bg-black/50 rounded overflow-hidden mb-2 relative group">
                                 {deck.rig ? (
                                     <img src={deck.rig.frames[0].url} className="w-full h-full object-contain" />
                                 ) : (
                                     <div className="w-full h-full flex items-center justify-center text-white/20 font-mono text-xs">EMPTY</div>
                                 )}
                                 {deck.rig && (
                                     <button onClick={(e) => { e.stopPropagation(); removeRig(deck.id); }} className="absolute top-1 right-1 bg-red-500/80 p-1 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                         <Trash2 size={12} />
                                     </button>
                                 )}
                             </div>
                             
                             <div className="flex justify-between items-center">
                                 <span className="text-[10px] text-gray-400 font-mono">CH {deck.id + 1}</span>
                                 <button 
                                    disabled={!deck.rig}
                                    onClick={() => handleDeckToggle(deck.id)}
                                    className={`w-3 h-3 rounded-full border ${deck.isActive ? 'bg-green-500 border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-black border-white/30'}`}
                                 />
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
         </div>
      )}
      
      {/* TOOLTIP */}
      {hoveredFrame && (
          <div className="absolute bottom-52 left-1/2 -translate-x-1/2 z-50 bg-brand-900/90 border border-brand-500/50 p-4 rounded-xl shadow-[0_0_30px_rgba(139,92,246,0.5)] backdrop-blur-xl animate-fade-in flex items-center gap-4">
               <img src={hoveredFrame.url} className="w-16 h-16 object-contain bg-black/50 rounded-lg" />
               <div>
                   <div className="text-xs font-bold text-brand-300 tracking-widest uppercase">FRAME DATA</div>
                   <div className="text-white font-mono text-sm">POSE: {hoveredFrame.pose}</div>
                   <div className="text-white font-mono text-sm">ENERGY: {hoveredFrame.energy}</div>
                   <div className="text-white font-mono text-sm">TYPE: {hoveredFrame.type}</div>
               </div>
          </div>
      )}

      <div className="absolute inset-0 pointer-events-none z-30 p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div className="bg-black/40 backdrop-blur-md border border-white/10 p-3 rounded-lg pointer-events-auto">
                 <div className="flex items-center gap-2 mb-1"><Activity size={14} className="text-brand-400" /><span className="text-[10px] font-bold text-gray-300 tracking-widest">NEURAL STATUS</span></div>
                 <div className="font-mono text-xs text-brand-300">FPS: {brainState.fps}<br/>POSE: {brainState.activePoseName}<br/>FRAMES: {frameCount}</div>
             </div>
             <div className="flex gap-2 pointer-events-auto items-center">
                 {isRecording && <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/50 px-3 py-1.5 rounded-full animate-pulse"><div className="w-2 h-2 bg-red-500 rounded-full" /><span className="text-red-300 font-mono text-xs">{(recordingTime / 1000).toFixed(1)}s</span></div>}
                 <button onClick={() => isRecording ? stopRecording() : setShowExportMenu(true)} className={`glass-button px-4 py-2 rounded-lg text-white flex items-center gap-2 ${isRecording ? 'bg-red-500/50 border-red-500' : ''}`}><CircleDot size={18} className={isRecording ? 'text-white' : 'text-red-400'} /><span className="text-xs font-bold">{isRecording ? 'STOP REC' : 'REC VIDEO'}</span></button>
                 <button className="glass-button p-2 rounded-lg text-white" onClick={handleExportWidget} title="Download Standalone Widget"><Download size={20} /></button>
             </div>
          </div>

          <div className="flex flex-col items-center gap-4 pointer-events-auto w-full max-w-2xl mx-auto">
              <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl border border-white/10 p-2 rounded-full shadow-2xl">
                   {state.audioPreviewUrl ? (
                       <button onClick={() => { setIsPlaying(!isPlaying); if(isMicActive) toggleMic(); }} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-brand-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.4)]' : 'bg-white/10 text-white hover:bg-white/20'}`}>{isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="ml-1" />}</button>
                   ) : <div className="px-4 text-[10px] text-gray-400 font-mono">NO TRACK LOADED</div>}
                   <div className="h-8 w-[1px] bg-white/10" />
                   <button onClick={toggleMic} className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all border ${isMicActive ? 'bg-red-500/20 border-red-500 text-red-400 animate-pulse' : 'border-transparent text-gray-400 hover:text-white'}`}>{isMicActive ? <Mic size={16} /> : <MicOff size={16} />} LIVE INPUT</button>
                   <div className="h-8 w-[1px] bg-white/10" />
                   <button onClick={() => setSuperCamActive(!superCamActive)} className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all border ${superCamActive ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'}`}><Camera size={16} /> SUPER CAM</button>
                   <div className="h-8 w-[1px] bg-white/10" />
                   <button onClick={() => { setShowDeck(false); setShowFX(!showFX); }} className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all border ${showFX ? 'bg-brand-500 border-brand-400 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}><Zap size={16} /> FX</button>
                   <div className="h-8 w-[1px] bg-white/10" />
                   <button onClick={() => { setShowFX(false); setShowDeck(!showDeck); }} className={`px-4 py-2 rounded-full flex items-center gap-2 text-xs font-bold transition-all border ${showDeck ? 'bg-white/20 border-white/30 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}><Layers size={16} /> MIXER</button>
              </div>
              <div className="flex gap-3">
                  <button onClick={onGenerateMore} className="glass-button px-6 py-2 rounded-full text-xs font-bold text-white flex items-center gap-2 hover:bg-white/20"><Package size={14} /> NEW VARIATIONS</button>
                  <button onClick={onSaveProject} className="glass-button px-6 py-2 rounded-full text-xs font-bold text-white flex items-center gap-2 hover:bg-white/20"><Download size={14} /> SAVE RIG</button>
              </div>
          </div>
      </div>
      
    </div>
  );
};
