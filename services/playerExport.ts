
import { GeneratedFrame, SubjectCategory, SavedProject } from "../types";
import { VERTEX_SHADER, FRAGMENT_SHADER, HolographicParams } from "../components/Visualizer/HolographicVisualizer";

// Define a simplified deck structure for export
interface ExportDeck {
    id: number;
    rig: SavedProject | null;
    isActive: boolean;
}

export const generatePlayerHTML = (
    decks: ExportDeck[],
    hologramParams: HolographicParams,
    subjectCategory: SubjectCategory
): string => {
    
    const decksJSON = JSON.stringify(decks);
    const paramsJSON = JSON.stringify(hologramParams);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>jusDNCE // Neural Mixer</title>
    <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
        body { margin: 0; background: #050505; overflow: hidden; font-family: 'Rajdhani', sans-serif; user-select: none; color: #fff; }
        canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        #bgCanvas { z-index: 1; }
        #charCanvas { z-index: 2; pointer-events: none; }
        
        /* UI OVERLAY */
        #ui {
            position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 100;
            display: flex; gap: 12px; align-items: center;
            background: rgba(10,10,12,0.8); backdrop-filter: blur(16px);
            padding: 12px 24px; border-radius: 24px; 
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            transition: opacity 0.3s, transform 0.3s;
        }
        
        button {
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            color: #ccc; padding: 10px 20px; border-radius: 14px;
            cursor: pointer; font-weight: 700; font-size: 13px; font-family: 'Rajdhani', sans-serif;
            letter-spacing: 1px; text-transform: uppercase;
            transition: all 0.2s; display: flex; align-items: center; gap: 8px;
        }
        button:hover { background: rgba(255,255,255,0.15); color: white; transform: translateY(-2px); border-color: rgba(255,255,255,0.3); }
        button.active { background: #8b5cf6; border-color: #a78bfa; color: white; box-shadow: 0 0 20px rgba(139,92,246,0.4); }
        button.red { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
        button.red.active { background: #ef4444; color: white; border-color: #ef4444; box-shadow: 0 0 20px rgba(239,68,68,0.4); }
        
        .separator { width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px; }

        /* Loader */
        #loader {
            position: absolute; inset: 0; background: #000; z-index: 200;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            transition: opacity 0.5s; pointer-events: none;
        }
        .spinner {
            width: 50px; height: 50px; border: 3px solid rgba(139,92,246,0.3); border-top-color: #8b5cf6;
            border-radius: 50%; animation: spin 1s cubic-bezier(0.4, 0, 0.2, 1) infinite; margin-bottom: 20px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        /* Drag Overlay */
        #dropOverlay {
            position: absolute; inset: 0; z-index: 300; background: rgba(139, 92, 246, 0.9);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            backdrop-filter: blur(10px); opacity: 0; pointer-events: none; transition: opacity 0.2s;
        }
        body.drag-active #dropOverlay { opacity: 1; }
        .drop-title { font-size: 3em; color: white; font-weight: 900; letter-spacing: 4px; margin-bottom: 10px; }
        
        /* Info Corner */
        #info {
            position: absolute; top: 30px; left: 30px; z-index: 50;
            color: rgba(255,255,255,0.4); font-size: 12px; pointer-events: none;
            line-height: 1.5; font-weight: 600;
        }
        .brand {
            font-size: 24px; color: white; font-weight: 900; letter-spacing: -1px; margin-bottom: 4px; display: block;
            text-shadow: 0 0 20px rgba(139,92,246,0.5);
        }

        /* NEURAL MIXER */
        #mixer {
            position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
            padding: 20px; background: rgba(10,10,12,0.9); border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.1);
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
            z-index: 90; opacity: 0; pointer-events: none; transition: opacity 0.3s;
            width: 320px;
        }
        #mixer.visible { opacity: 1; pointer-events: auto; }
        
        .channel {
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            border-radius: 8px; padding: 8px; text-align: center;
            display: flex; flex-direction: column; align-items: center; gap: 8px;
            transition: all 0.2s;
        }
        .channel.active { border-color: #8b5cf6; background: rgba(139,92,246,0.1); }
        .channel.empty { border-style: dashed; opacity: 0.5; }
        
        .ch-thumb {
            width: 48px; height: 48px; background: #000; border-radius: 4px; overflow: hidden;
        }
        .ch-thumb img { width: 100%; height: 100%; object-fit: contain; }
        
        .toggle {
            width: 12px; height: 12px; border-radius: 50%; border: 1px solid #555;
            cursor: pointer; transition: all 0.2s;
        }
        .channel.active .toggle { background: #22c55e; border-color: #22c55e; box-shadow: 0 0 8px #22c55e; }
        
        .ch-label { font-size: 10px; font-weight: 700; color: #666; }
        .channel.active .ch-label { color: #8b5cf6; }
        
        .import-btn {
            grid-column: span 4; background: #8b5cf6; color: white; border: none;
            padding: 8px; font-size: 10px; border-radius: 6px; cursor: pointer;
            margin-top: 8px;
        }
        .import-btn:hover { background: #7c3aed; }

    </style>
</head>
<body>

    <canvas id="bgCanvas"></canvas>
    <canvas id="charCanvas"></canvas>
    
    <div id="loader">
        <div class="spinner"></div>
        <div style="color: #888; font-size: 14px; letter-spacing: 4px; font-weight: 700;">INITIALIZING NEURAL RIG...</div>
    </div>
    
    <div id="dropOverlay">
        <div class="drop-title">DROP FILE</div>
        <div style="font-size: 1.2em; color: rgba(255,255,255,0.8); letter-spacing: 2px;">IMPORT .JUSDNCE RIG OR AUDIO FILE</div>
    </div>
    
    <div id="info">
        <span class="brand">jusDNCE</span>
        MODE: <span id="subjectDisplay">${subjectCategory}</span><br>
        <span id="fps">0 FPS</span> // <span id="poseDisplay">INIT</span>
    </div>

    <div id="mixer"></div>

    <div id="ui">
        <button id="btnPlay">⏯️ PLAY</button>
        <button id="btnMic">🎙️ MIC INPUT</button>
        <div class="separator"></div>
        <button id="btnCam" class="active">🎥 DYNAMIC CAM</button>
        <button id="btnMixer">🎛️ MIXER</button>
        <div class="separator"></div>
        <button id="btnLoad" onclick="document.getElementById('fileInput').click()">📂 LOAD</button>
        <input type="file" id="fileInput" style="display:none" accept=".jusdnce,audio/*">
    </div>

    <!-- WEB COMPONENT WRAPPER -->
    <script>
        // --- 1. DATA INJECTION ---
        let INITIAL_DECKS = ${decksJSON};
        let PARAMS = ${paramsJSON};
        let SUBJECT = "${subjectCategory}";
        
        // --- 2. SHADER SOURCE ---
        const VERTEX = \`${VERTEX_SHADER}\`;
        const FRAGMENT = \`${FRAGMENT_SHADER}\`;

        // --- 3. QUANTUM VISUALIZER ENGINE ---
        class Visualizer {
            constructor(canvas) {
                this.canvas = canvas;
                this.gl = canvas.getContext('webgl', { alpha: false, preserveDrawingBuffer: true });
                if(!this.gl) this.gl = canvas.getContext('experimental-webgl');
                this.startTime = Date.now();
                this.mouse = {x:0, y:0};
                this.init();
            }
            init() {
                const vs = this.createShader(this.gl.VERTEX_SHADER, VERTEX);
                const fs = this.createShader(this.gl.FRAGMENT_SHADER, FRAGMENT);
                this.program = this.gl.createProgram();
                this.gl.attachShader(this.program, vs);
                this.gl.attachShader(this.program, fs);
                this.gl.linkProgram(this.program);
                this.gl.useProgram(this.program);
                
                const buffer = this.gl.createBuffer();
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
                this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), this.gl.STATIC_DRAW);
                const loc = this.gl.getAttribLocation(this.program, 'a_position');
                this.gl.enableVertexAttribArray(loc);
                this.gl.vertexAttribPointer(loc, 2, this.gl.FLOAT, false, 0, 0);
                
                this.locs = {
                    res: this.gl.getUniformLocation(this.program, 'u_resolution'),
                    time: this.gl.getUniformLocation(this.program, 'u_time'),
                    mouse: this.gl.getUniformLocation(this.program, 'u_mouse'),
                    bass: this.gl.getUniformLocation(this.program, 'u_audioBass'),
                    mid: this.gl.getUniformLocation(this.program, 'u_audioMid'),
                    high: this.gl.getUniformLocation(this.program, 'u_audioHigh'),
                    col: this.gl.getUniformLocation(this.program, 'u_color'),
                    den: this.gl.getUniformLocation(this.program, 'u_density'),
                    spd: this.gl.getUniformLocation(this.program, 'u_speed'),
                    int: this.gl.getUniformLocation(this.program, 'u_intensity'),
                    chs: this.gl.getUniformLocation(this.program, 'u_chaos'),
                    mph: this.gl.getUniformLocation(this.program, 'u_morph'),
                    camZ: this.gl.getUniformLocation(this.program, 'u_cameraZ'),
                    camRot: this.gl.getUniformLocation(this.program, 'u_cameraRot'),
                };
            }
            createShader(type, src) {
                const s = this.gl.createShader(type);
                this.gl.shaderSource(s, src);
                this.gl.compileShader(s);
                return s;
            }
            render(audio, camZ, rot) {
                const w = window.innerWidth;
                const h = window.innerHeight;
                if(this.canvas.width!==w || this.canvas.height!==h) {
                    this.canvas.width=w; this.canvas.height=h;
                    this.gl.viewport(0,0,w,h);
                }
                
                const hVal = (PARAMS.hue || 200) / 360;
                const sVal = PARAMS.saturation || 0.8;
                const lVal = 0.6;
                const q = lVal < 0.5 ? lVal * (1 + sVal) : lVal + sVal - lVal * sVal;
                const p = 2 * lVal - q;
                const hue2rgb = (p, q, t) => {
                    if(t < 0) t += 1; if(t > 1) t -= 1;
                    if(t < 1/6) return p + (q - p) * 6 * t;
                    if(t < 1/2) return q;
                    if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                    return p;
                }
                const r = hue2rgb(p, q, hVal + 1/3);
                const g = hue2rgb(p, q, hVal);
                const b = hue2rgb(p, q, hVal - 1/3);

                this.gl.uniform2f(this.locs.res, w, h);
                this.gl.uniform1f(this.locs.time, (Date.now()-this.startTime)/1000);
                this.gl.uniform2f(this.locs.mouse, this.mouse.x, this.mouse.y);
                this.gl.uniform1f(this.locs.bass, audio.bass);
                this.gl.uniform1f(this.locs.mid, audio.mid);
                this.gl.uniform1f(this.locs.high, audio.high);
                this.gl.uniform3f(this.locs.col, r, g, b);
                this.gl.uniform1f(this.locs.den, PARAMS.density || 2.0);
                this.gl.uniform1f(this.locs.spd, PARAMS.speed || 0.1);
                this.gl.uniform1f(this.locs.int, PARAMS.intensity || 0.6);
                this.gl.uniform1f(this.locs.chs, PARAMS.chaos || 0.5);
                this.gl.uniform1f(this.locs.mph, PARAMS.morph || 0.0);
                this.gl.uniform1f(this.locs.camZ, camZ);
                this.gl.uniform3f(this.locs.camRot, rot.x, rot.y, rot.z);
                this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
            }
        }

        // --- 4. ENGINE STATE ---
        const bgC = document.getElementById('bgCanvas');
        const charC = document.getElementById('charCanvas');
        const ctx = charC.getContext('2d');
        const loader = document.getElementById('loader');
        const mixerDiv = document.getElementById('mixer');
        
        const viz = new Visualizer(bgC);
        
        // DECK STATE
        let DECKS = [
            { id: 0, rig: null, isActive: true, images: {}, framesByEnergy: {}, closeups: [] },
            { id: 1, rig: null, isActive: false, images: {}, framesByEnergy: {}, closeups: [] },
            { id: 2, rig: null, isActive: false, images: {}, framesByEnergy: {}, closeups: [] },
            { id: 3, rig: null, isActive: false, images: {}, framesByEnergy: {}, closeups: [] }
        ];
        
        const STATE = {
            masterRot: {x:0, y:0, z:0},
            masterVel: {x:0, y:0, z:0},
            camZoom: 1.15,
            camPanX: 0,
            charSquash: 1.0,
            charSkew: 0.0,
            charTilt: 0.0,
            charBounceY: 0.0,
            targetTilt: 0.0,
            sourcePose: 'base',
            targetPose: 'base',
            transitionProgress: 1.0,
            transitionSpeed: 10.0,
            transitionMode: 'CUT',
            direction: 'center',
            lastBeat: 0,
            beatCount: 0,
            closeupLockTime: 0,
            flashIntensity: 0.0,
            dynamicCam: true,
            filterMode: 'NORMAL' // NORMAL, INVERT, BW
        };

        // --- 5. RIG LOADING LOGIC ---
        function processRig(deckId, rigData) {
            const d = DECKS.find(x => x.id === deckId);
            if(!d) return;
            
            d.rig = rigData;
            d.images = {};
            d.framesByEnergy = { low:[], mid:[], high:[] };
            d.closeups = [];
            
            let processedFrames = [];
            rigData.frames.forEach(f => {
                processedFrames.push(f);
                // Create Virtuals
                if(f.energy === 'high' && f.type === 'body') {
                    processedFrames.push({ ...f, pose: f.pose+'_vzoom', isVirtual: true, virtualZoom: 1.6, virtualOffsetY: 0.2 });
                }
                if(f.energy === 'mid' && f.type === 'body') {
                    processedFrames.push({ ...f, pose: f.pose+'_vmid', isVirtual: true, virtualZoom: 1.25, virtualOffsetY: 0.1 });
                }
            });
            
            processedFrames.forEach(f => {
                if(f.type === 'closeup') d.closeups.push(f);
                else {
                    if(!d.framesByEnergy[f.energy]) d.framesByEnergy[f.energy] = [];
                    d.framesByEnergy[f.energy].push(f);
                }
            });
            
            // Fallbacks
            const fbe = d.framesByEnergy;
            if(fbe.low.length===0) fbe.low = fbe.mid.length > 0 ? [...fbe.mid] : [...fbe.high];
            if(fbe.mid.length===0) fbe.mid = [...fbe.low];
            if(fbe.high.length===0) fbe.high = [...fbe.mid];
            
            // Preload Images
            let loaded = 0;
            const total = processedFrames.length;
            
            processedFrames.forEach(f => {
                if(d.images[f.pose]) { 
                    loaded++; 
                    if(loaded===total) updateMixerUI();
                    return; 
                }
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = f.url;
                const onDone = () => { loaded++; if(loaded === total) updateMixerUI(); };
                img.onload = onDone;
                img.onerror = onDone;
                d.images[f.pose] = img;
            });
            
            // Set initial state from first rig
            if(deckId === 0) {
               STATE.targetPose = processedFrames[0]?.pose || 'base';
               STATE.sourcePose = STATE.targetPose;
               hideLoader();
            }
            updateMixerUI();
        }
        
        function hideLoader() {
            loader.style.opacity = 0;
            setTimeout(() => { if(loader.parentNode) loader.parentNode.removeChild(loader); }, 500);
        }
        
        function updateMixerUI() {
            mixerDiv.innerHTML = '';
            DECKS.forEach(d => {
                const el = document.createElement('div');
                el.className = \`channel \${d.isActive ? 'active' : ''} \${!d.rig ? 'empty' : ''}\`;
                
                let thumbHtml = '<div class="ch-thumb" style="background:#222"></div>';
                if(d.rig && d.rig.frames && d.rig.frames[0]) {
                    thumbHtml = \`<div class="ch-thumb"><img src="\${d.rig.frames[0].url}"></div>\`;
                }
                
                el.innerHTML = thumbHtml + \`
                    <div class="ch-label">CH \${d.id + 1}</div>
                    <div class="toggle" onclick="toggleDeck(\${d.id})"></div>
                \`;
                mixerDiv.appendChild(el);
            });
            
            const btn = document.createElement('button');
            btn.className = 'import-btn';
            btn.innerText = '+ IMPORT RIG';
            btn.onclick = () => document.getElementById('fileInput').click();
            mixerDiv.appendChild(btn);
        }
        
        window.toggleDeck = (id) => {
            const d = DECKS.find(x => x.id === id);
            if(d && d.rig) {
                d.isActive = !d.isActive;
                updateMixerUI();
            }
        };

        // --- 6. AUDIO SYSTEM (ROBUST) ---
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        let audioCtx = new AudioContextClass();
        let analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        let sourceNode = null;
        let micStream = null;
        let audioEl = new Audio();
        audioEl.crossOrigin = "anonymous";
        audioEl.loop = true;

        async function connectAudioElement() {
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            if(!sourceNode || sourceNode.mediaStream) {
                if (sourceNode) sourceNode.disconnect();
                sourceNode = audioCtx.createMediaElementSource(audioEl);
                sourceNode.connect(analyser);
                sourceNode.connect(audioCtx.destination);
            }
        }
        
        async function connectMic() {
            if (audioCtx.state === 'suspended') await audioCtx.resume();
            try {
                micStream = await navigator.mediaDevices.getUserMedia({audio:true});
                if (sourceNode) sourceNode.disconnect();
                sourceNode = audioCtx.createMediaStreamSource(micStream);
                sourceNode.connect(analyser);
                // Do NOT connect to destination to avoid feedback
                if(audioEl) audioEl.pause();
                return true;
            } catch(e) {
                alert("Microphone access denied. Please check browser permissions.");
                return false;
            }
        }

        // --- 7. MAIN LOOP ---
        let lastTime = Date.now();
        
        function triggerTransition(newPose, mode) {
            if (newPose === STATE.targetPose) return;
            STATE.sourcePose = STATE.targetPose;
            STATE.targetPose = newPose;
            STATE.transitionProgress = 0.0;
            STATE.transitionMode = mode;
            
            let speed = 20.0;
            if (mode === 'CUT') speed = 1000.0;
            else if (mode === 'MORPH') speed = 5.0;
            else if (mode === 'SLIDE') speed = 8.0;
            else if (mode === 'ZOOM_IN') speed = 6.0;
            else if (mode === 'SMOOTH') speed = 1.5;
            
            STATE.transitionSpeed = speed;
        }

        // ENERGY HISTORY FOR TREND
        const energyHistory = new Array(30).fill(0);

        function loop() {
            requestAnimationFrame(loop);
            const now = Date.now();
            const dt = Math.min((now - lastTime) / 1000, 0.1);
            lastTime = now;
            const w = window.innerWidth;
            const h = window.innerHeight;
            
            // Audio Data
            const freq = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(freq);
            
            const bass = freq.slice(0,5).reduce((a,b)=>a+b,0)/(5*255);
            const mid = freq.slice(5,30).reduce((a,b)=>a+b,0)/(25*255);
            const high = freq.slice(30,100).reduce((a,b)=>a+b,0)/(70*255);
            const energy = (bass * 0.5 + mid * 0.3 + high * 0.2);
            
            // Trend Analysis
            energyHistory.shift();
            energyHistory.push(energy);
            const avgEnergy = energyHistory.reduce((a, b) => a + b, 0) / energyHistory.length;
            const energyTrend = energy - avgEnergy;

            // Physics Update (Spring Solver)
            if(STATE.dynamicCam) {
                const stiffness = 140;
                const damping = 8;
                
                const tRotX = bass * 35.0;
                const tRotY = mid * 25.0 * Math.sin(now * 0.005);
                const tRotZ = high * 15.0;
                
                STATE.masterVel.x += ((tRotX - STATE.masterRot.x) * stiffness - STATE.masterVel.x * damping) * dt;
                STATE.masterRot.x += STATE.masterVel.x * dt;
                
                STATE.masterVel.y += ((tRotY - STATE.masterRot.y) * stiffness*0.5 - STATE.masterVel.y * damping*0.8) * dt;
                STATE.masterRot.y += STATE.masterVel.y * dt;
                
                STATE.masterVel.z += ((tRotZ - STATE.masterRot.z) * stiffness - STATE.masterVel.z * damping) * dt;
                STATE.masterRot.z += STATE.masterVel.z * dt;
            } else {
                STATE.masterRot = {x:0, y:0, z:0};
            }
            
            // Transition Update
            if(STATE.transitionProgress < 1.0) {
                STATE.transitionProgress += STATE.transitionSpeed * dt;
                if(STATE.transitionProgress > 1.0) STATE.transitionProgress = 1.0;
            }
            
            // Rhythm Logic
            const isCloseupLocked = now < STATE.closeupLockTime;
            
            // Use active decks or fallback to first loaded deck for decision making
            const refDeck = DECKS.find(d => d.rig) || DECKS[0];
            
            if(bass > 0.5 && (now - STATE.lastBeat) > 300) {
                STATE.lastBeat = now;
                STATE.beatCount = (STATE.beatCount + 1) % 16;
                const beat = STATE.beatCount;
                
                let phase = 'WARMUP';
                if(beat >= 4 && beat < 8) phase = 'SWING_LEFT';
                else if(beat >= 8 && beat < 12) phase = 'SWING_RIGHT';
                else if(beat >= 12) phase = 'DROP';
                
                if (phase === 'DROP' && Math.random() > 0.7) STATE.filterMode = Math.random() > 0.5 ? 'INVERT' : 'BW';
                else STATE.filterMode = 'NORMAL';
                
                STATE.camZoom = 1.15 + (bass * 0.35);
                STATE.charSquash = 0.85;
                STATE.charBounceY = -50 * bass;
                STATE.flashIntensity = 0.8;
                
                if(phase === 'SWING_LEFT') { STATE.targetTilt = -8; STATE.direction = 'left'; }
                else if(phase === 'SWING_RIGHT') { STATE.targetTilt = 8; STATE.direction = 'right'; }
                else { STATE.targetTilt = 0; STATE.direction = 'center'; }
                
                let pool = [];
                if(refDeck && refDeck.framesByEnergy) {
                    if(isCloseupLocked) pool = refDeck.closeups;
                    else {
                        if (energyTrend > 0.1 && refDeck.framesByEnergy.high.length > 0) pool = refDeck.framesByEnergy.high;
                        else {
                            if(phase === 'WARMUP') pool = refDeck.framesByEnergy.low;
                            else if(phase === 'SWING_LEFT') pool = refDeck.framesByEnergy.mid.filter(f=>f.direction==='left');
                            else if(phase === 'SWING_RIGHT') pool = refDeck.framesByEnergy.mid.filter(f=>f.direction==='right');
                            else if(phase === 'DROP') pool = refDeck.framesByEnergy.high;
                        }
                    }
                    if(pool.length === 0) pool = refDeck.framesByEnergy.mid;
                    if(pool.length === 0) pool = refDeck.framesByEnergy.low;
                }
                
                if(pool.length > 0) {
                    const next = pool[Math.floor(Math.random()*pool.length)];
                    let mode = 'CUT';
                    if(isCloseupLocked || next.type === 'closeup') mode = 'ZOOM_IN';
                    else if(phase.includes('SWING')) {
                         if(high > 0.4) mode = 'SMOOTH';
                         else mode = 'SLIDE';
                    } else if (energyTrend < -0.1) mode = 'SMOOTH';
                    
                    triggerTransition(next.pose, mode);
                }
            } else if (bass < 0.3 && mid < 0.3 && Math.random() < 0.02) {
                 if (refDeck && refDeck.framesByEnergy && refDeck.framesByEnergy.low.length > 0) {
                     const next = refDeck.framesByEnergy.low[Math.floor(Math.random()*refDeck.framesByEnergy.low.length)];
                     triggerTransition(next.pose, 'SMOOTH');
                 }
                 STATE.targetTilt = 0;
            }
            
            // Vocal Gate
            if(!isCloseupLocked && high > 0.6 && mid > 0.4 && bass < 0.5) {
                if(refDeck && refDeck.closeups && refDeck.closeups.length > 0 && Math.random() < 0.5) {
                    const next = refDeck.closeups[Math.floor(Math.random()*refDeck.closeups.length)];
                    triggerTransition(next.pose, 'ZOOM_IN');
                    STATE.closeupLockTime = now + 2500;
                }
            }
            
            // Decay
            STATE.charSquash += (1.0 - STATE.charSquash) * (12 * dt);
            STATE.charSkew += (0.0 - STATE.charSkew) * (10 * dt);
            STATE.charTilt += (STATE.targetTilt - STATE.charTilt) * (6 * dt);
            STATE.charBounceY += (0 - STATE.charBounceY) * (10 * dt);
            STATE.flashIntensity *= Math.exp(-15 * dt);
            STATE.camZoom += (1.15 - STATE.camZoom) * (1 - Math.exp(-5 * dt));
            
            let targetPanX = 0;
            if(STATE.direction === 'left') targetPanX = 30;
            else if(STATE.direction === 'right') targetPanX = -30;
            STATE.camPanX += (targetPanX - STATE.camPanX) * (4 * dt);

            // Render
            const rx = STATE.dynamicCam ? STATE.masterRot.x : 0;
            const ry = STATE.dynamicCam ? STATE.masterRot.y : 0;
            const rz = STATE.dynamicCam ? STATE.masterRot.z : 0;
            viz.render({bass,mid,high}, 0, {x: rx*0.3, y: ry*0.3, z: rz*0.2});
            
            if(charC.width !== w || charC.height !== h) { charC.width=w; charC.height=h; }
            const cx = w/2; const cy = h/2;
            ctx.clearRect(0,0,w,h);
            
            if(STATE.filterMode === 'INVERT') ctx.filter = 'invert(1)';
            else if(STATE.filterMode === 'BW') ctx.filter = 'grayscale(1)';
            else ctx.filter = 'none';
            
            if(STATE.flashIntensity > 0.01) {
                ctx.fillStyle = \`rgba(255,255,255,\${STATE.flashIntensity})\`;
                ctx.fillRect(0,0,w,h);
            }

            // RENDER ACTIVE DECKS
            DECKS.forEach(deck => {
                if(!deck.isActive || !deck.rig || !deck.images) return;
                
                const drawLayer = (pose, opacity, blur, skew, extraScale) => {
                    // Try to find matching frame in this deck
                    const img = deck.images[pose];
                    const frame = deck.framesByEnergy?.low.find(f=>f.pose===pose) || deck.framesByEnergy?.mid.find(f=>f.pose===pose) || deck.closeups?.find(f=>f.pose===pose);
                    
                    if(!img || !img.complete) return;
                    
                    const aspect = img.width / img.height;
                    let dw = w * 1.0; let dh = dw / aspect;
                    if(dh > h) { dh = h; dw = dh*aspect; }
                    
                    let zoom = STATE.camZoom;
                    let vOffset = 0;
                    if(frame && frame.isVirtual) { zoom *= frame.virtualZoom || 1; vOffset = frame.virtualOffsetY || 0; }
                    
                    ctx.save();
                    ctx.translate(cx + STATE.camPanX, cy + STATE.charBounceY);
                    
                    const radX = (rx * Math.PI) / 180;
                    const radY = (ry * Math.PI) / 180;
                    const scaleX = Math.cos(radY); const scaleY = Math.cos(radX);
                    const tiltZ = (rz * 0.8) * (Math.PI/180);
                    
                    ctx.rotate(tiltZ + (STATE.charTilt * Math.PI/180));
                    ctx.scale(Math.abs(scaleX), Math.abs(scaleY));
                    ctx.scale(1/STATE.charSquash, STATE.charSquash);
                    if(skew) ctx.transform(1,0,skew,1,0,0);
                    if(STATE.charSkew !== 0) ctx.transform(1,0,STATE.charSkew * 0.2,1,0,0);
                    
                    const finalZoom = zoom * (extraScale || 1.0);
                    ctx.scale(finalZoom, finalZoom);
                    ctx.translate(0, vOffset * dh);
                    
                    if(blur > 0) ctx.filter = (ctx.filter === 'none' ? '' : ctx.filter) + \` blur(\${blur}px)\`;
                    
                    ctx.globalAlpha = opacity;
                    ctx.drawImage(img, -dw/2, -dh/2, dw, dh);
                    ctx.restore();
                };
                
                const prog = STATE.transitionProgress;
                if(prog >= 1.0 || STATE.transitionMode === 'CUT') {
                    drawLayer(STATE.targetPose, 1.0, 0, 0, 1.0);
                } else {
                    const easeT = prog * prog * (3 - 2 * prog);
                    if(STATE.transitionMode === 'ZOOM_IN') {
                        const zf = 1.0 + (easeT * 0.5);
                        drawLayer(STATE.sourcePose, 1.0-easeT, easeT*10, 0, zf);
                        drawLayer(STATE.targetPose, easeT, 0, 0, 1.0);
                    } else if(STATE.transitionMode === 'SLIDE') {
                        const dir = STATE.targetPose.includes('right') ? -1 : 1;
                        drawLayer(STATE.sourcePose, 1.0-easeT, 0, w*0.0002*easeT*dir, 1.0);
                        drawLayer(STATE.targetPose, easeT, 0, w*0.0002*(1.0-easeT)*-dir, 1.0);
                    } else {
                        drawLayer(STATE.sourcePose, 1.0-easeT, 0, 0, 1.0);
                        drawLayer(STATE.targetPose, easeT, 0, 0, 1.0);
                    }
                }
            });
            
            document.getElementById('fps').innerText = Math.round(1/dt) + ' FPS';
            document.getElementById('poseDisplay').innerText = STATE.targetPose.toUpperCase();
        }

        // LOAD INITIAL
        INITIAL_DECKS.forEach(d => {
            if(d.rig) processRig(d.id, d.rig);
        });
        
        loop();

        // --- 8. UI HANDLERS ---
        const btnMic = document.getElementById('btnMic');
        const btnPlay = document.getElementById('btnPlay');
        const btnCam = document.getElementById('btnCam');
        const btnMixer = document.getElementById('btnMixer');
        const fileInput = document.getElementById('fileInput');

        btnMic.onclick = async () => {
            if(micStream) {
                micStream.getTracks().forEach(t=>t.stop()); micStream=null;
                btnMic.classList.remove('red', 'active');
                if(sourceNode) { sourceNode.disconnect(); sourceNode=null; }
            } else {
                const success = await connectMic();
                if(success) btnMic.classList.add('red', 'active');
            }
        };
        
        btnPlay.onclick = () => {
            if(audioEl.paused) { 
                connectAudioElement(); 
                audioEl.play(); 
                btnPlay.classList.add('active'); 
                if(micStream) btnMic.click(); // turn off mic
            } else { 
                audioEl.pause(); 
                btnPlay.classList.remove('active'); 
            }
        };
        
        btnCam.onclick = () => { STATE.dynamicCam = !STATE.dynamicCam; btnCam.classList.toggle('active'); };
        
        btnMixer.onclick = () => {
            mixerDiv.classList.toggle('visible');
            btnMixer.classList.toggle('active');
        };

        // --- 9. DRAG AND DROP ---
        document.body.addEventListener('dragover', e => { e.preventDefault(); document.body.classList.add('drag-active'); });
        document.body.addEventListener('dragleave', e => { e.preventDefault(); document.body.classList.remove('drag-active'); });
        document.body.addEventListener('drop', e => {
            e.preventDefault(); document.body.classList.remove('drag-active');
            const file = e.dataTransfer.files[0];
            handleFile(file);
        });
        
        fileInput.onchange = (e) => handleFile(e.target.files[0]);
        
        function handleFile(file) {
            if(!file) return;
            if(file.name.toLowerCase().endsWith('.jusdnce') || file.type.includes('json')) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    try {
                        const proj = JSON.parse(ev.target.result);
                        if(!proj.frames) throw new Error("Invalid Rig");
                        
                        const empty = DECKS.find(d => !d.rig);
                        if(empty) {
                            processRig(empty.id, proj);
                        } else {
                            if(confirm("Slots full. Replace Slot 4?")) processRig(3, proj);
                        }
                    } catch(e) { alert("Invalid Rig File"); }
                };
                reader.readAsText(file);
            } else if(file.type.startsWith('audio/')) {
                const url = URL.createObjectURL(file);
                audioEl.src = url;
                audioEl.play();
                connectAudioElement();
                btnPlay.classList.add('active');
            }
        }
    </script>
</body>
</html>`;
};
