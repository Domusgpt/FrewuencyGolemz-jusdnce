
import { HolographicParams } from "./components/Visualizer/HolographicVisualizer";

export enum AppStep {
  ASSETS = 1,
  DIRECTOR = 2,
  PREVIEW = 3,
}

export type StyleCategory = 'Cinematic' | 'Anime/2D' | 'Digital/Glitch' | 'Artistic';
export type SubjectCategory = 'CHARACTER' | 'TEXT' | 'SYMBOL';
export type FrameType = 'body' | 'closeup' | 'hands' | 'feet'; 
export type SheetRole = 'base' | 'alt' | 'flourish' | 'details'; 
export type MoveDirection = 'center' | 'left' | 'right'; 
export type SequenceMode = 'GROOVE' | 'IMPACT' | 'FOOTWORK' | 'EMOTE'; 

export interface StylePreset {
  id: string;
  name: string;
  category: StyleCategory;
  description: string;
  promptModifier: string;
  thumbnail: string;
  hologramParams: HolographicParams; 
}

export type EnergyLevel = 'low' | 'mid' | 'high';
export type UserTier = 'free' | 'pro';

export type PoseType = string;

export interface GeneratedFrame {
  url: string;
  pose: PoseType;
  energy: EnergyLevel;
  type?: FrameType; 
  role?: SheetRole; 
  direction?: MoveDirection; 
  promptUsed?: string; 
  isVirtual?: boolean; 
  virtualZoom?: number;
  virtualOffsetY?: number;
  deckId?: number; // Added for multi-deck tracking
}

export interface SavedProject {
    id: string;
    name: string;
    createdAt: number;
    frames: GeneratedFrame[];
    styleId: string;
    subjectCategory: SubjectCategory;
    hologramParams?: HolographicParams; 
}

export type DeckMixMode = 'sequencer' | 'layer';

export interface DeckSlot {
    id: number;
    rig: SavedProject | null;
    isActive: boolean;
    opacity: number;
    mixMode: DeckMixMode; // New: Controls whether frames are pooled or overlayed
    images?: Record<string, HTMLImageElement>;
    framesByEnergy?: Record<EnergyLevel, GeneratedFrame[]>;
    closeups?: GeneratedFrame[];
    hands?: GeneratedFrame[]; 
    feet?: GeneratedFrame[];
    // Machine Frame Specialized Buckets
    mandalas?: GeneratedFrame[];
    virtuals?: GeneratedFrame[];
    acrobatics?: GeneratedFrame[];
}

export interface AuthUser {
  uid: string; 
  name: string;
  email: string;
  photoURL: string;
}

export interface FXSettings {
    hue: { base: number, reactive: number };
    aberration: { base: number, reactive: number };
    scanlines: { base: number, reactive: number };
    stutter: { base: number, reactive: number }; 
    chaos: { base: number, reactive: number };   
}

export interface AppState {
  step: AppStep;
  user: AuthUser | null; 
  showAuthModal: boolean;
  showPaymentModal: boolean;
  
  userTier: UserTier;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  audioFile: File | null;
  audioPreviewUrl: string | null;
  selectedStyleId: string;
  
  secondaryStyleId: string; 
  morphIntensity: number;   
  reactivity: number;       
  
  motionPrompt: string; 
  motionPreset: string; 
  useTurbo: boolean; 
  superMode: boolean; 
  
  intensity: number; 
  duration: number; 
  smoothness: number; 
  stutter: number; 
  generatedFrames: GeneratedFrame[]; 
  subjectCategory: SubjectCategory; 
  isGenerating: boolean;
  credits: number;
}

export const DEFAULT_STATE: AppState = {
  step: AppStep.ASSETS,
  user: null,
  showAuthModal: false,
  showPaymentModal: false,
  
  userTier: 'free',
  imageFile: null,
  imagePreviewUrl: null,
  audioFile: null,
  audioPreviewUrl: null,
  selectedStyleId: 'natural', 
  
  secondaryStyleId: '',
  morphIntensity: 0,
  reactivity: 80,

  motionPrompt: '', 
  motionPreset: 'auto', 
  useTurbo: true, 
  superMode: false, 
  
  intensity: 80, 
  duration: 30,
  smoothness: 20, 
  stutter: 50, 
  generatedFrames: [],
  subjectCategory: 'CHARACTER',
  isGenerating: false,
  credits: 0, 
};
