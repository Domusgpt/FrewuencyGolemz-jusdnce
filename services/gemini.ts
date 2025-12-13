
import { GoogleGenAI } from "@google/genai";
import { GeneratedFrame, PoseType, EnergyLevel, SubjectCategory, FrameType, SheetRole, MoveDirection } from "../types";

// Strict API Key usage as per guidelines
const API_KEY = process.env.API_KEY;

// --- UTILITIES ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to wrap image loading in a timeout to prevent hanging
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
            // Fallback immediately if createObjectURL fails
            return fileToBase64(file).then(resolve).catch(reject); 
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        
        // Safety timeout
        const timeout = setTimeout(() => {
            console.warn("Resize timed out, falling back to base64");
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
                
                // Fill with white to handle transparent PNGs correctly (prevent black backgrounds)
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85); 
                URL.revokeObjectURL(url);
                resolve(dataUrl);
            } catch (e) {
                URL.revokeObjectURL(url);
                console.warn("Canvas resize failed, falling back to original", e);
                fileToBase64(file).then(resolve).catch(reject);
            }
        };
        img.onerror = (e) => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            console.warn("Image load for resize failed, falling back to original");
            fileToBase64(file).then(resolve).catch(reject);
        };
        img.src = url;
    });
};

export const fileToGenericBase64 = async (file: File): Promise<string> => {
  try { 
      return await resizeImage(file); 
  } catch (e: any) { 
      try { return await fileToBase64(file); } 
      catch (e2: any) { throw new Error("Failed to process file"); }
  }
};

// --- SPRITE SHEET SLICER ---
const sliceSpriteSheet = (base64Image: string, rows: number, cols: number): Promise<string[]> => {
    return new Promise(async (resolve, reject) => {
        try {
            // Use timeout wrapper to prevent hanging
            const img = await loadImageWithTimeout(base64Image, 8000);
            
            // 1. MECHANICAL ALIGNMENT
            const SHEET_SIZE = 1024;
            const normCanvas = document.createElement('canvas');
            normCanvas.width = SHEET_SIZE;
            normCanvas.height = SHEET_SIZE;
            const normCtx = normCanvas.getContext('2d');
            
            if (!normCtx) { reject("Canvas context failed"); return; }
            
            // STRETCH TO FIT (Mechanical Solution)
            normCtx.drawImage(img, 0, 0, img.width, img.height, 0, 0, SHEET_SIZE, SHEET_SIZE);

            // 2. SLICING STEP
            const cellW = SHEET_SIZE / cols; // 256
            const cellH = SHEET_SIZE / rows; // 256
            
            // MINIMAL CROP: Relying on 75% scale prompt to provide buffer.
            // Using 1% just to clean potential grid line artifacts.
            const cropFactor = 0.01; 
            const cropX = cellW * cropFactor;
            const cropY = cellH * cropFactor;
            const sourceW = cellW * (1 - 2 * cropFactor);
            const sourceH = cellH * (1 - 2 * cropFactor);

            const frames: string[] = [];
            
            // We do this synchronously to avoid Promise overhead for 16 frames which can be buggy
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
            console.error("Slice Sprite Sheet failed", e);
            reject(e);
        }
    });
};

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
        img.onerror = () => resolve(frameUrl); // Fail gracefull
        img.src = frameUrl;
    });
};

const generateWithRetry = async (ai: GoogleGenAI, params: any, retries = 2) => {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await ai.models.generateContent(params);
        } catch (e: any) {
            console.warn(`Gemini generation attempt ${i + 1} failed:`, e.message);
            lastError = e;
            await delay(1000 * Math.pow(2, i)); 
        }
    }
    throw lastError;
};

// --- MECHANICAL MANIFEST (Shared Rules) ---
const MECHANICAL_MANIFEST = `
STRICT MECHANICAL RULES (CRITICAL):
1. GRID: Output a strictly aligned 4x4 Grid (16 frames).
2. SCALE: The subject MUST occupy exactly 75% of the cell's height. 
3. BUFFER: Leave 12.5% empty space on ALL sides of the subject within the cell.
4. CENTERING: Center of mass must be in the absolute middle of the cell.
5. NO CLIPPING: Limbs must NEVER touch the edge of the grid cell.
6. IDENTITY: Maintain exact character consistency from the Reference Image.
`;

const generateSingleSheet = async (
    ai: GoogleGenAI,
    role: SheetRole,
    imageBase64: string,
    stylePrompt: string,
    motionPrompt: string,
    category: SubjectCategory,
    seed: number, 
    contextImageBase64?: string,
    useFallbackPrompt: boolean = false
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
             systemPrompt += `
             SUBJECT: TEXT/LOGO.
             Action: Dynamic Motion/Pulsing.
             Keep content centered in each cell.
             `;
    } else {
        if (role === 'base') {
            systemPrompt += `
            SHEET 1 (BASE LOOP):
            Row 1: Idle / Groove (Center) - Establishing the character.
            Row 2: ${motionPrompt ? 'Signature Move Part A' : 'Step Left'} - ${danceStyle}
            Row 3: ${motionPrompt ? 'Signature Move Part B' : 'Step Right'} - ${danceStyle}
            Row 4: Power Pose / Freeze Frame
            Ensure feet are visible. Center of mass in middle of cell.
            `;
        } else if (role === 'alt') {
            systemPrompt += `
            SHEET 2 (VARIATIONS):
            Generate 16 NEW frames extending the dance.
            Row 1: Dynamic Jump or Hop (Maintain 75% scale constraint).
            Row 2: Low movement / Crouch / Floor work.
            Row 3: Spin / Rotation frames.
            Row 4: Expressive Extension / Kick.
            Keep action strictly contained within cell boundaries.
            MUST MATCH CHARACTER FROM REFERENCE SHEET EXACTLY.
            `;
        } else if (role === 'flourish') {
            systemPrompt += `
            SHEET 3 (CINEMATIC ANGLES):
            Generate 16 frames of the character from DIFFERENT CAMERA ANGLES.
            Row 1: Profile View (Left/Right).
            Row 2: 3/4 Perspective View.
            Row 3: Low Angle (Heroic).
            Row 4: High Angle (Top Down).
            CRITICAL: Maintain the 4x4 Grid and 75% Scale. Do not zoom in too much.
            These frames will be used for camera pans and cuts.
            `;
        } else if (role === 'smooth') {
             systemPrompt += `
             SHEET 4 (FLOW & RHYTHM):
             Generate 16 frames of alternative rhythmic poses.
             Focus on smooth weight shifts, liquid motion, and transition frames.
             Create poses that bridge the gap between heavy beats.
             Maintain exact character consistency.
             `;
        }
    }

    console.log(`[Gemini] Generating Sheet: ${role} (${category}) [Fallback: ${useFallbackPrompt}]...`);

    const cleanBase64 = imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64;
    const cleanContext = contextImageBase64 && contextImageBase64.includes('base64,') ? contextImageBase64.split('base64,')[1] : contextImageBase64;

    const parts: any[] = [
        { inlineData: { mimeType: 'image/jpeg', data: cleanBase64 } }
    ];

    if (cleanContext) {
        // Pass base sheet as style/layout reference
        parts.push({ inlineData: { mimeType: 'image/jpeg', data: cleanContext } });
        systemPrompt += "\nREFERENCE: Use the second image (previous sprite sheet) as the MASTER STYLE & SCALE REFERENCE.";
    }

    parts.push({ text: systemPrompt });

    try {
        const response = await generateWithRetry(ai, {
            model: 'gemini-2.5-flash-image',
            contents: { parts },
            config: {
                imageConfig: { aspectRatio: "1:1" },
                seed: seed
            }
        });

        const candidate = response.candidates?.[0];
        if (!candidate) throw new Error("API returned no candidates.");
        
        let spriteSheetBase64: string | undefined = undefined;
        let mimeType = 'image/png'; // Default guess

        if (candidate.content && candidate.content.parts) {
            for (const part of candidate.content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    spriteSheetBase64 = part.inlineData.data;
                    if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
                    break;
                }
            }
        }

        if (!spriteSheetBase64) {
             console.warn(`[Gemini] Sheet ${role} yielded no image data.`);
             throw new Error("Model returned no image data.");
        }
        
        const dataUri = `data:${mimeType};base64,${spriteSheetBase64}`;
        const rawFrames = await sliceSpriteSheet(dataUri, rows, cols);
        const finalFrames: GeneratedFrame[] = [];

        for (let i = 0; i < rawFrames.length; i++) {
            let energy: EnergyLevel = 'mid';
            let type: FrameType = 'body';
            let direction: MoveDirection = 'center';
            let poseName = `${role}_${i}`;

            // Metadata assignment based on Grid Position
            if (role === 'base') {
                if (i < 4) { energy = 'low'; direction = 'center'; }
                else if (i >= 4 && i < 8) { energy = 'mid'; direction = 'left'; }
                else if (i >= 8 && i < 12) { energy = 'mid'; direction = 'right'; }
                else if (i >= 12) { energy = 'high'; direction = 'center'; }
            } 
            else if (role === 'alt') {
                energy = 'high';
                if (i < 4) direction = 'center'; 
                else if (i >= 4 && i < 8) direction = 'center'; 
            }
            else if (role === 'flourish') {
                // Cinematic Angles - treated as High energy "Features"
                energy = 'high';
                type = 'closeup'; // We use 'closeup' logic for special angles
            }
            else if (role === 'smooth') {
                energy = 'low';
                direction = i % 2 === 0 ? 'left' : 'right';
            }

            finalFrames.push({
                url: rawFrames[i],
                pose: poseName,
                energy,
                type,
                role,
                direction
            });
            
            // ENABLE MIRRORING FOR EVERYTHING
            // Doubling the frame count for smooth loops
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
        
        return { frames: finalFrames, rawSheetBase64: spriteSheetBase64 };

    } catch (e: any) {
        console.error(`Failed to generate sheet ${role}:`, e);
        // If Base fails, we propagate error to retry logic in parent
        if (role === 'base') throw e;
        return { frames: [] };
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

  if (!API_KEY) {
      throw new Error("API Key is missing. Please check your environment variables.");
  }

  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const masterSeed = Math.floor(Math.random() * 2147483647);
  console.log("Master Seed for Consistency:", masterSeed);

  let category: SubjectCategory = 'CHARACTER';
  if (/logo|text|word|letter|font|typography/i.test(motionPrompt)) category = 'TEXT';
  
  let allFrames: GeneratedFrame[] = [];
  let baseSheetBase64: string | undefined = undefined;

  // 1. GENERATE BASE (The Foundation)
  // Implemented simple retry logic with fallback prompt
  let baseResult;
  try {
      baseResult = await generateSingleSheet(ai, 'base', imageBase64, stylePrompt, motionPrompt, category, masterSeed);
  } catch (e) {
      console.warn("Base generation failed. Retrying...");
      try {
          // Retry with same prompt structure but maybe different seed implicitly or connection retry
          baseResult = await generateSingleSheet(ai, 'base', imageBase64, stylePrompt, motionPrompt, category, masterSeed + 1);
      } catch (e2) {
          throw new Error("Base generation failed after retry. Please try a different image.");
      }
  }
  
  if (baseResult && baseResult.frames.length > 0) {
      allFrames = [...allFrames, ...baseResult.frames];
      onFrameUpdate(allFrames); 
      baseSheetBase64 = baseResult.rawSheetBase64; 
  } else {
      throw new Error("Base generation produced 0 frames.");
  }

  // 2. PARALLEL GENERATION STRATEGY
  const parallelGenerators: Promise<void>[] = [];

  // Alt Sheet: Action/Variations. Needed for everything except ultra-minimal (which we don't have)
  // Turbo: Base + Alt (Total 32 frames)
  // Quality: Base + Alt + Flourish (Total 48 frames)
  // Super: Base + Alt + Flourish + Smooth (Total 64 frames)

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

  if (superMode) {
      const generateSmooth = async () => {
          try {
              const result = await generateSingleSheet(ai, 'smooth', imageBase64, stylePrompt, motionPrompt, category, masterSeed, baseSheetBase64);
              if(result.frames.length > 0) {
                  allFrames = [...allFrames, ...result.frames];
                  onFrameUpdate(allFrames);
              }
          } catch(e) { console.warn("Smooth sheet failed", e); }
      };
      parallelGenerators.push(generateSmooth());
  }

  // Execute all extensions in parallel
  await Promise.allSettled(parallelGenerators);

  if (allFrames.length === 0) {
      throw new Error("Generation failed: No frames produced.");
  }

  return { frames: allFrames, category };
};
