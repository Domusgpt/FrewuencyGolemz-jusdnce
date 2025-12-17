
import { GoogleGenAI } from "@google/genai";
import { GeneratedFrame, PoseType, EnergyLevel, SubjectCategory, FrameType, SheetRole, MoveDirection } from "../types";

// Strict API Key usage as per guidelines
const API_KEY = process.env.API_KEY;

// Debug: Log if API key is present (not the actual key)
console.log('[Gemini] API Key status:', API_KEY ? `Set (${API_KEY.substring(0, 8)}...)` : 'MISSING');

// --- UTILITIES ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const loadImageWithTimeout = (src: string, timeoutMs: number = 8000): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        const timer = setTimeout(() => {
            img.onload = null;
            img.onerror = null;
            reject(new Error("Image load timed out"));
        }, timeoutMs);

        img.onload = () => {
            clearTimeout(timer);
            resolve(img);
        };
        img.onerror = (e) => {
            clearTimeout(timer);
            reject(new Error("Image load failed"));
        };
        img.src = src;
    });
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error("FileReader result was not a string"));
            }
        };
        reader.onerror = (error) => reject(new Error("File reading failed: " + (error.target?.error?.message || "Unknown error")));
    });
};

const resizeImage = (file: File, maxDim: number = 384): Promise<string> => {
    return new Promise((resolve, reject) => {
        if (!file || !(file instanceof File)) return reject(new Error("Invalid file passed to resizeImage"));

        let url = '';
        try { url = URL.createObjectURL(file); } catch (e) { 
            return fileToBase64(file).then(resolve).catch(reject); 
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        
        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            fileToBase64(file).then(resolve).catch(reject);
        }, 3000);

        img.onload = () => {
            clearTimeout(timeout);
            try {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxDim) { height *= maxDim / width; width = maxDim; }
                } else {
                    if (height > maxDim) { width *= maxDim / height; height = maxDim; }
                }

                canvas.width = Math.floor(width);
                canvas.height = Math.floor(height);
                const ctx = canvas.getContext('2d');
                if (!ctx) { 
                    URL.revokeObjectURL(url); 
                    return fileToBase64(file).then(resolve).catch(reject); 
                }
                
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85); 
                URL.revokeObjectURL(url);
                resolve(dataUrl);
            } catch (e) {
                URL.revokeObjectURL(url);
                fileToBase64(file).then(resolve).catch(reject);
            }
        };
        img.onerror = (e) => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            fileToBase64(file).then(resolve).catch(reject);
        };
        img.src = url;
    });
};

export const fileToGenericBase64 = async (file: File): Promise<string> => {
  try { return await resizeImage(file); } 
  catch (e: any) { return await fileToBase64(file); }
};

// --- SPRITE SHEET SLICER ---
const sliceSpriteSheet = (base64Image: string, rows: number, cols: number): Promise<string[]> => {
    return new Promise(async (resolve, reject) => {
        try {
            const img = await loadImageWithTimeout(base64Image, 8000);
            
            // MECHANICAL ALIGNMENT
            const SHEET_SIZE = 1024;
            const normCanvas = document.createElement('canvas');
            normCanvas.width = SHEET_SIZE;
            normCanvas.height = SHEET_SIZE;
            const normCtx = normCanvas.getContext('2d');
            if (!normCtx) { reject("Canvas context failed"); return; }
            
            normCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, SHEET_SIZE, SHEET_SIZE);

            const cellW = SHEET_SIZE / cols; // 256
            const cellH = SHEET_SIZE / rows; // 256
            
            // 1% Safety Clean
            const cropFactor = 0.01; 
            const cropX = cellW * cropFactor;
            const cropY = cellH * cropFactor;
            const sourceW = cellW * (1 - 2 * cropFactor);
            const sourceH = cellH * (1 - 2 * cropFactor);

            const frames: string[] = [];
            
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const cellCanvas = document.createElement('canvas');
                    cellCanvas.width = Math.floor(sourceW);
                    cellCanvas.height = Math.floor(sourceH);
                    const cellCtx = cellCanvas.getContext('2d');
                    
                    if(cellCtx) {
                        const cellSrcX = (c * cellW) + cropX;
                        const cellSrcY = (r * cellH) + cropY;

                        cellCtx.drawImage(
                            normCanvas, 
                            cellSrcX, cellSrcY, sourceW, sourceH, 
                            0, 0, cellCanvas.width, cellCanvas.height
                        );
                        frames.push(cellCanvas.toDataURL('image/jpeg', 0.85));
                    }
                }
            }
            resolve(frames);
        } catch (e) {
            reject(e);
        }
    });
};

// Standard Mirror
const mirrorFrame = (frameUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.translate(canvas.width, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            } else {
                resolve(frameUrl);
            }
        };
        img.onerror = () => resolve(frameUrl);
        img.src = frameUrl;
    });
};

// MANDALA MIRROR (Symmetrical Stitch) for Hands
const mandalaFrame = (frameUrl: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const w = img.width;
            const h = img.height;
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            
            if (ctx) {
                // 1. Draw Original on Left Half (clip right half)
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, w/2, h);
                ctx.clip();
                ctx.drawImage(img, 0, 0);
                ctx.restore();

                // 2. Draw Mirrored on Right Half (clip left half)
                ctx.save();
                ctx.beginPath();
                ctx.rect(w/2, 0, w/2, h);
                ctx.clip();
                ctx.translate(w, 0);
                ctx.scale(-1, 1);
                ctx.drawImage(img, 0, 0);
                ctx.restore();
                
                // Add center glow/blend line?
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(w/2 - 2, 0, 4, h);

                resolve(canvas.toDataURL('image/jpeg', 0.85));
            } else {
                resolve(frameUrl);
            }
        };
        img.onerror = () => resolve(frameUrl);
        img.src = frameUrl;
    });
};

const generateWithRetry = async (ai: GoogleGenAI, params: any, retries = 2) => {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[Gemini] Generation attempt ${i + 1}/${retries} with model: ${params.model}`);
            const result = await ai.models.generateContent(params);
            console.log(`[Gemini] Generation attempt ${i + 1} succeeded`);
            return result;
        } catch (e: any) {
            console.error(`[Gemini] Attempt ${i + 1} failed:`, e.message);
            console.error('[Gemini] Error details:', {
                name: e.name,
                code: e.code,
                status: e.status,
                statusText: e.statusText,
                message: e.message
            });
            lastError = e;
            if (i < retries - 1) {
                const waitTime = 1000 * Math.pow(2, i);
                console.log(`[Gemini] Retrying in ${waitTime}ms...`);
                await delay(waitTime);
            }
        }
    }
    throw lastError;
};

// --- MECHANICAL MANIFEST ---
const MECHANICAL_MANIFEST = `
STRICT MECHANICAL RULES (CRITICAL):
1. GRID: Output a strictly aligned 4x4 Grid (16 frames).
2. SCALE: The subject MUST occupy exactly 75% of the cell's height. 
3. BUFFER: Leave 12.5% empty space on ALL sides of the subject within the cell.
4. CENTERING: Center of mass must be in the absolute middle of the cell.
5. NO CLIPPING: Limbs must NEVER touch the edge of the grid cell.
`;

const generateSingleSheet = async (
    ai: GoogleGenAI,
    role: SheetRole,
    imageBase64: string,
    stylePrompt: string,
    motionPrompt: string,
    category: SubjectCategory,
    seed: number, 
    contextImageBase64?: string
): Promise<{ frames: GeneratedFrame[], rawSheetBase64?: string }> => {
    
    const rows = 4;
    const cols = 4;
    const isTextOrSymbol = category === 'TEXT' || category === 'SYMBOL';
    const danceStyle = motionPrompt ? `Specific Dance Style: ${motionPrompt}.` : "Style: Rhythmic, energetic dance loop.";

    let systemPrompt = `TASK: Generate a 4x4 Sprite Sheet (16 frames).
    ${MECHANICAL_MANIFEST}
    Visual Style: ${stylePrompt}
    ${danceStyle}
    `;

    if (isTextOrSymbol) {
             systemPrompt += `\nSUBJECT: TEXT/LOGO. Action: Dynamic Motion/Pulsing. Keep content centered.`;
    } else {
        if (role === 'base') {
            systemPrompt += `
            SHEET 1 (GROOVE):
            Row 1: Idle / Groove (Center).
            Row 2: ${motionPrompt ? 'Signature Move A' : 'Step Left'}.
            Row 3: ${motionPrompt ? 'Signature Move B' : 'Step Right'}.
            Row 4: Power Pose / Freeze.
            Ensure feet are visible. Center of mass in middle.
            `;
        } else if (role === 'alt') {
            systemPrompt += `
            SHEET 2 (IMPACT):
            Row 1: Dynamic Jump or Hop (Maintain 75% scale).
            Row 2: Low movement / Crouch / Floor work.
            Row 3: Spin / Rotation frames.
            Row 4: Expressive Extension / Kick.
            Keep action contained within cell boundaries.
            `;
        } else if (role === 'flourish') {
            systemPrompt += `
            SHEET 3 (EMOTE / FACE):
            Row 1: Profile View (Left/Right).
            Row 2: 3/4 Perspective View.
            Row 3: Low Angle (Heroic).
            Row 4: High Angle (Top Down).
            FOCUS ON FACIAL EXPRESSION. 
            Maintain 4x4 Grid. Do not zoom in too much (keep 60% scale).
            `;
        } else if (role === 'details') {
             systemPrompt += `
             SHEET 4 (INSERTS - HANDS & FEET):
             Row 1: Hand Gestures / Mudras / Voguing (Hands Only).
             Row 2: Hand Gestures / Finger Tutting.
             Row 3: Fancy Footwork / Shoes / Stepping.
             Row 4: Fancy Footwork / Sliding.
             FOCUS ON APPENDAGES. 
             Center the hand/foot in the cell.
             `;
        }
    }

    console.log(`[Gemini] Generating Sheet: ${role}`);
    const cleanBase64 = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
    const cleanContext = contextImageBase64 && contextImageBase64.includes('base64,') ? contextImageBase64.split('base64,')[1] : contextImageBase64;

    const parts: any[] = [
        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }
    ];

    if (cleanContext) {
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanContext } });
        systemPrompt += "\nREFERENCE: Use the second image as the MASTER STYLE REFERENCE.";
    }

    parts.push({ text: systemPrompt });

    try {
        const response = await generateWithRetry(ai, {
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: { imageConfig: { aspectRatio: "1:1" }, seed: seed }
        });

        const candidate = response.candidates?.[0];
        let spriteSheetBase64: string | undefined = undefined;
        let mimeType = 'image/png';

        if (candidate?.content?.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    spriteSheetBase64 = part.inlineData.data;
                    if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
                    break;
                }
            }
        }

        if (!spriteSheetBase64) throw new Error("Model returned no image data.");
        
        const dataUri = `data:${mimeType};base64,${spriteSheetBase64}`;
        const rawFrames = await sliceSpriteSheet(dataUri, rows, cols);
        const finalFrames: GeneratedFrame[] = [];

        for (let i = 0; i < rawFrames.length; i++) {
            let energy: EnergyLevel = 'mid';
            let type: FrameType = 'body';
            let direction: MoveDirection = 'center';
            let poseName = `${role}_${i}`;

            // --- ROLE MAPPING ---
            if (role === 'base') {
                if (i < 4) { energy = 'low'; direction = 'center'; }
                else if (i >= 4 && i < 8) { energy = 'mid'; direction = 'left'; }
                else if (i >= 8 && i < 12) { energy = 'mid'; direction = 'right'; }
                else if (i >= 12) { energy = 'high'; direction = 'center'; }
            } 
            else if (role === 'alt') {
                energy = 'high';
                direction = 'center'; 
            }
            else if (role === 'flourish') {
                energy = 'high';
                type = 'closeup'; // Face frames
            }
            else if (role === 'details') {
                energy = 'high';
                if (i < 8) type = 'hands'; // Row 1 & 2
                else type = 'feet'; // Row 3 & 4
            }

            finalFrames.push({
                url: rawFrames[i],
                pose: poseName,
                energy,
                type,
                role,
                direction
            });
            
            // --- TARGETED EXPANSION ---
            if (role === 'details' && type === 'hands') {
                // MANDALA MIRROR for Hands
                const mandala = await mandalaFrame(rawFrames[i]);
                finalFrames.push({
                    url: mandala,
                    pose: poseName + '_mandala',
                    energy,
                    type,
                    role,
                    direction: 'center'
                });
            } else {
                // STANDARD MIRROR for Body/Face/Feet
                const mirrored = await mirrorFrame(rawFrames[i]);
                let mirrorDir: MoveDirection = direction;
                if (direction === 'left') mirrorDir = 'right';
                else if (direction === 'right') mirrorDir = 'left';
                
                finalFrames.push({
                    url: mirrored,
                    pose: poseName + '_mirror',
                    energy,
                    type,
                    role,
                    direction: mirrorDir
                });
            }
        }
        
        return { frames: finalFrames, rawSheetBase64: spriteSheetBase64 };

    } catch (e: any) {
        console.error(`Failed to generate sheet ${role}:`, e);
        if (role === 'base') throw e;
        return { frames: [] };
    }
};

// Helper to validate API key with a lightweight request
const validateApiKey = async (ai: GoogleGenAI): Promise<boolean> => {
    try {
        console.log('[Gemini] Validating API key...');
        // Try to list models to validate the key works
        const models = await ai.models.list();
        console.log('[Gemini] API key validated successfully. Available models:',
            models?.models?.slice(0, 5).map((m: any) => m.name) || 'Unable to list');
        return true;
    } catch (e: any) {
        console.error('[Gemini] API key validation failed:', e.message);
        if (e.message?.includes('API_KEY_INVALID') || e.message?.includes('invalid')) {
            throw new Error('API Key is invalid. Please check your GEMINI_API_KEY in GitHub Secrets.');
        }
        if (e.message?.includes('expired')) {
            throw new Error('API Key has expired. Please generate a new key from Google AI Studio.');
        }
        // Don't block on validation failure for other reasons
        console.warn('[Gemini] Validation check failed but continuing...');
        return false;
    }
};

export const generateDanceFrames = async (
  imageBase64: string,
  stylePrompt: string,
  motionPrompt: string,
  useTurbo: boolean,
  superMode: boolean,
  onFrameUpdate: (frames: GeneratedFrame[]) => void
): Promise<{ frames: GeneratedFrame[], category: SubjectCategory }> => {

  console.log('[Gemini] ====== STARTING GENERATION ======');
  console.log('[Gemini] API_KEY present:', !!API_KEY);
  console.log('[Gemini] API_KEY length:', API_KEY?.length || 0);
  console.log('[Gemini] API_KEY prefix:', API_KEY ? API_KEY.substring(0, 10) + '...' : 'N/A');
  console.log('[Gemini] useTurbo:', useTurbo);
  console.log('[Gemini] superMode:', superMode);
  console.log('[Gemini] imageBase64 length:', imageBase64?.length || 0);

  if (!API_KEY) {
    console.error('[Gemini] API Key is missing! Check your environment variables.');
    throw new Error("API Key is missing. Please set GEMINI_API_KEY in GitHub Secrets.");
  }

  if (!API_KEY.startsWith('AIza')) {
    console.error('[Gemini] API Key format looks invalid. Expected to start with "AIza"');
    throw new Error("API Key format is invalid. Please check your GEMINI_API_KEY.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });

  // Validate the key before attempting generation
  await validateApiKey(ai);
  const masterSeed = Math.floor(Math.random() * 2147483647);
  let category: SubjectCategory = 'CHARACTER';
  if (/logo|text|word|letter|font|typography/i.test(motionPrompt)) category = 'TEXT';
  
  let allFrames: GeneratedFrame[] = [];
  let baseSheetBase64: string | undefined = undefined;

  // 1. BASE GENERATION
  let baseResult;
  try {
      baseResult = await generateSingleSheet(ai, 'base', imageBase64, stylePrompt, motionPrompt, category, masterSeed);
  } catch (e) {
      // Retry logic handled inside or here
      baseResult = await generateSingleSheet(ai, 'base', imageBase64, stylePrompt, motionPrompt, category, masterSeed + 1);
  }
  
  if (baseResult?.frames?.length > 0) {
      allFrames = [...allFrames, ...baseResult.frames];
      onFrameUpdate(allFrames); 
      baseSheetBase64 = baseResult.rawSheetBase64; 
  } else {
      throw new Error("Base generation failed.");
  }

  // 2. PARALLEL EXPANSION
  const parallelGenerators: Promise<void>[] = [];

  // Alt Sheet (Standard Action)
  const generateAlt = async () => {
      try {
          const result = await generateSingleSheet(ai, 'alt', imageBase64, stylePrompt, motionPrompt, category, masterSeed, baseSheetBase64);
          if(result.frames.length > 0) {
              allFrames = [...allFrames, ...result.frames];
              onFrameUpdate(allFrames);
          }
      } catch(e) { console.warn("Alt sheet failed", e); }
  };
  parallelGenerators.push(generateAlt());

  // Quality Mode: Flourish (Faces/Angles)
  if (!useTurbo || superMode) {
      const generateFlourish = async () => {
          try {
              const result = await generateSingleSheet(ai, 'flourish', imageBase64, stylePrompt, motionPrompt, category, masterSeed, baseSheetBase64);
              if(result.frames.length > 0) {
                  allFrames = [...allFrames, ...result.frames];
                  onFrameUpdate(allFrames);
              }
          } catch(e) { console.warn("Flourish sheet failed", e); }
      };
      parallelGenerators.push(generateFlourish());
  }

  // Super Mode: Details (Hands/Feet)
  if (superMode) {
      const generateDetails = async () => {
          try {
              const result = await generateSingleSheet(ai, 'details', imageBase64, stylePrompt, motionPrompt, category, masterSeed, baseSheetBase64);
              if(result.frames.length > 0) {
                  allFrames = [...allFrames, ...result.frames];
                  onFrameUpdate(allFrames);
              }
          } catch(e) { console.warn("Details sheet failed", e); }
      };
      parallelGenerators.push(generateDetails());
  }

  await Promise.allSettled(parallelGenerators);

  if (allFrames.length === 0) throw new Error("Generation failed.");
  return { frames: allFrames, category };
};
