
import { GeneratedFrame, SubjectCategory, SavedProject, DeckMixMode } from "../types";
import { VERTEX_SHADER, FRAGMENT_SHADER, HolographicParams } from "../components/Visualizer/HolographicVisualizer";

interface ExportDeck {
    id: number;
    rig: SavedProject | null;
    isActive: boolean;
    mixMode?: DeckMixMode;
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
    <title>jusDNCE // Standalone Player</title>
    <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700;900&display=swap" rel="stylesheet">
    <style>
        body { margin: 0; background: #050505; overflow: hidden; font-family: 'Rajdhani', sans-serif; user-select: none; color: #fff; }
        canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        #bgCanvas { z-index: 1; }
        #charCanvas { z-index: 2; pointer-events: none; }
        
        #ui {
            position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); z-index: 100;
            display: flex; gap: 12px; align-items: center;
            background: rgba(10,10,12,0.8); backdrop-filter: blur(16px);
            padding: 12px 24px; border-radius: 24px; 
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
        }
        button {
            background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);
            color: #ccc; padding: 10px 20px; border-radius: 14px;
            cursor: pointer; font-weight: 700; font-size: 13px; text-transform: uppercase;
        }
        button.active { background: #8b5cf6; border-color: #a78bfa; color: white; }
        button.red { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
        
        #tooltip {
            position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%);
            background: rgba(139,92,246,0.9); padding: 12px; border-radius: 12px;
            color: white; font-size: 12px; font-weight: bold; pointer-events: none; opacity: 0; transition: opacity 0.2s;
            z-index: 200; display: flex; align-items: center; gap: 10px;
        }
        
        #fxPanel {
            position: absolute; bottom: 100px; right: 20px; width: 200px;
            background: rgba(0,0,0,0.8); padding: 16px; border-radius: 12px;
            display: none; z-index: 110; border: 1px solid rgba(255,255,255,0.1);
        }
        .fx-slider { width: 100%; margin-bottom: 10px; }
        
        #watermark {
            position: absolute; top: 20px; right: 20px; z-index: 200;
            font-size: 24px; font-weight: 900; color: white; opacity: 0.5;
            text-shadow: 0 0 10px rgba(139,92,246,0.5);
        }
    </style>
</head>
<body>
    <canvas id="bgCanvas"></canvas>
    <canvas id="charCanvas"></canvas>
    <div id="watermark">jusDNCE</div>
    
    <div id="tooltip">
        <div id="tt-img" style="width: 40px; height: 40px; background: black; border-radius: 4px; overflow: hidden;"><img src="" style="width:100%"></div>
        <div>
            <div id="tt-pose">POSE</div>
            <div id="tt-type" style="font-size: 10px; opacity: 0.7">TYPE</div>
        </div>
    </div>

    <div id="fxPanel">
        <label>ABERRATION</label><input type="range" class="fx-slider" id="fxAberration" min="0" max="100" value="20">
        <label>HUE SHIFT</label><input type="range" class="fx-slider" id="fxHue" min="0" max="100" value="0">
    </div>

    <div id="ui">
        <button id="btnPlay" onclick="document.getElementById('audioInput').click()">🎵 LOAD AUDIO</button>
        <button id="btnMic">🎙️ MIC</button>
        <button id="btnFX" onclick="document.getElementById('fxPanel').style.display = document.getElementById('fxPanel').style.display=='block'?'none':'block'">🎛️ FX</button>
        <button id="btnRec" class="red">🔴 REC</button>
    </div>
    
    <input type="file" id="audioInput" accept="audio/*" style="display:none" onchange="loadAudioFile(this)">
    <audio id="audioEl" loop style="display:none"></audio>

    <script>
        const DECKS = ${decksJSON};
        const PARAMS = ${paramsJSON};
        
        // --- VISUALIZER ---
        const VERTEX = \`${VERTEX_SHADER}\`;
        const FRAGMENT = \`${FRAGMENT_SHADER}\`;
        
        // ... (Visualizer Class same as before, simplified for brevity in this output) ...
        class Visualizer {
            constructor(c){this.gl=c.getContext('webgl'); this.st=Date.now(); this.init();}
            init(){
                const p=this.gl.createProgram(); 
                this.gl.attachShader(p,this.s(35633,VERTEX)); this.gl.attachShader(p,this.s(35632,FRAGMENT));
                this.gl.linkProgram(p); this.gl.useProgram(p);
                this.u={t:this.gl.getUniformLocation(p,'u_time'), r:this.gl.getUniformLocation(p,'u_resolution'),
                        b:this.gl.getUniformLocation(p,'u_audioBass'), m:this.gl.getUniformLocation(p,'u_audioMid'), h:this.gl.getUniformLocation(p,'u_audioHigh')};
                this.gl.bindBuffer(34962,this.gl.createBuffer());
                this.gl.bufferData(34962,new Float32Array([-1,-1,1,-1,-1,1,1,1]),35044);
                this.gl.enableVertexAttribArray(0); this.gl.vertexAttribPointer(0,2,5126,0,0,0);
            }
            s(t,s){const x=this.gl.createShader(t);this.gl.shaderSource(x,s);this.gl.compileShader(x);return x;}
            render(a){
                this.gl.uniform1f(this.u.t,(Date.now()-this.st)/1000);
                this.gl.uniform2f(this.u.r,window.innerWidth,window.innerHeight);
                this.gl.uniform1f(this.u.b,a.bass); this.gl.uniform1f(this.u.m,a.mid); this.gl.uniform1f(this.u.h,a.high);
                this.gl.drawArrays(5,0,4);
            }
        }

        const bg=document.getElementById('bgCanvas'); const viz=new Visualizer(bg);
        const charC=document.getElementById('charCanvas'); const ctx=charC.getContext('2d');
        const tt=document.getElementById('tooltip');
        
        // --- AUDIO ---
        let audioCtx, analyser, srcNode;
        async function initAudioContext(){
            if(!audioCtx) {
                audioCtx=new (window.AudioContext||window.webkitAudioContext)();
                analyser=audioCtx.createAnalyser(); analyser.fftSize=256;
            }
            if(audioCtx.state === 'suspended') audioCtx.resume();
            return audioCtx;
        }

        async function initMic(){
            await initAudioContext();
            if(srcNode) srcNode.disconnect();
            const mic=await navigator.mediaDevices.getUserMedia({audio:true});
            srcNode=audioCtx.createMediaStreamSource(mic);
            srcNode.connect(analyser);
        }
        
        async function loadAudioFile(el){
            const file = el.files[0];
            if(!file) return;
            await initAudioContext();
            const url = URL.createObjectURL(file);
            const audio = document.getElementById('audioEl');
            audio.src = url;
            
            if(srcNode) srcNode.disconnect();
            srcNode = audioCtx.createMediaElementSource(audio);
            srcNode.connect(analyser);
            srcNode.connect(audioCtx.destination);
            
            audio.play();
        }
        
        let targetPose='base', currentFrame=null;
        
        // --- LOOP ---
        function loop(){
            requestAnimationFrame(loop);
            const w=window.innerWidth; const h=window.innerHeight;
            if(bg.width!==w) {bg.width=w; bg.height=h; charC.width=w; charC.height=h;}
            
            let bass=0, mid=0, high=0;
            if(analyser){
                const d=new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(d);
                bass=d[0]/255; mid=d[10]/255; high=d[40]/255;
            }
            
            viz.render({bass,mid,high});
            ctx.clearRect(0,0,w,h);
            
            // Logic to pick frame from ALL active sequencer decks
            const activeDecks = DECKS.filter(d => d.rig && (d.isActive === undefined || d.isActive));
            
            if(activeDecks.length > 0) {
                // Pick a deck based on chaos or just default to first
                // For simplicity in player, we randomly sample if bass > threshold
                const deck = activeDecks[Math.floor(Math.random() * activeDecks.length)];
                
                const pool = deck.rig.frames;
                if(bass>0.5 && Math.random()>0.8) {
                    currentFrame = pool[Math.floor(Math.random()*pool.length)];
                }
                if(!currentFrame) currentFrame=pool[0];
                
                // Draw
                const img = new Image(); img.src=currentFrame.url; 
                if(img.complete) {
                     const ar=img.width/img.height;
                     let dw=w, dh=w/ar; if(dh>h){dh=h; dw=dh*ar;}
                     
                     // Apply FX
                     const aber = document.getElementById('fxAberration').value / 100;
                     if(aber>0) {
                         ctx.globalCompositeOperation='screen';
                         ctx.fillStyle='red';
                         ctx.drawImage(img, (w-dw)/2 - (10*aber*bass), (h-dh)/2, dw, dh);
                         ctx.fillStyle='blue';
                         ctx.drawImage(img, (w-dw)/2 + (10*aber*bass), (h-dh)/2, dw, dh);
                         ctx.globalCompositeOperation='source-over';
                     }
                     
                     ctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
                }
                
                // Tooltip
                tt.style.opacity = bass > 0.4 ? 1 : 0;
                document.getElementById('tt-pose').innerText = currentFrame.pose;
                document.getElementById('tt-type').innerText = currentFrame.type || 'BODY';
                document.getElementById('tt-img').querySelector('img').src = currentFrame.url;
            }
        }
        
        document.getElementById('btnMic').onclick=initMic;
        loop();
        
        // RECORDER LOGIC
        const btnRec=document.getElementById('btnRec');
        let mediaRec, chunks=[];
        btnRec.onclick = () => {
             if(btnRec.innerText.includes('REC')) {
                 const st=charC.captureStream(30);
                 mediaRec=new MediaRecorder(st);
                 chunks=[];
                 mediaRec.ondataavailable=e=>chunks.push(e.data);
                 mediaRec.onstop=()=>{
                     const b=new Blob(chunks,{type:'video/webm'});
                     const u=URL.createObjectURL(b);
                     const a=document.createElement('a'); a.href=u; a.download='jusdnce_export.webm'; a.click();
                 };
                 mediaRec.start();
                 btnRec.innerText='STOP';
             } else {
                 mediaRec.stop();
                 btnRec.innerText='🔴 REC';
             }
        }
    </script>
</body>
</html>`;
};
