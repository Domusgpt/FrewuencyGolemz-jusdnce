
import { useRef, useState, useCallback, useEffect } from 'react';

export interface AudioPlayer {
    audioElement: HTMLAudioElement;
    isPlaying: boolean;
    isMicActive: boolean;
    togglePlay: () => void;
    toggleMic: () => Promise<void>;
    loadAudio: (url: string) => void;
    getAnalysis: () => AudioAnalysis;
    audioDestNode: MediaStreamAudioDestinationNode | null; // For recording
}

export interface AudioAnalysis {
    bass: number;
    mid: number;
    high: number;
    energy: number;
}

export const useAudioPlayer = (initialUrl?: string | null): AudioPlayer => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);
    const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    
    // The actual audio element
    const audioRef = useRef<HTMLAudioElement>(new Audio());
    
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMicActive, setIsMicActive] = useState(false);

    // Initialize Audio Context on user interaction
    const initContext = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new AudioContextClass();
            
            analyserRef.current = audioCtxRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            analyserRef.current.smoothingTimeConstant = 0.8; // Snappy but smooth
            
            // Destination node for recording
            audioDestRef.current = audioCtxRef.current.createMediaStreamDestination();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    }, []);

    const connectSource = useCallback(() => {
        const ctx = initContext();
        if (analyserRef.current && audioDestRef.current) {
             // Disconnect old source
             if (sourceNodeRef.current) {
                 try { sourceNodeRef.current.disconnect(); } catch(e) {}
             }
             
             // Create new element source
             const src = ctx.createMediaElementSource(audioRef.current);
             src.connect(analyserRef.current);
             src.connect(ctx.destination); // Output to speakers
             src.connect(audioDestRef.current); // Output to recorder
             sourceNodeRef.current = src;
        }
    }, [initContext]);

    const loadAudio = useCallback((url: string) => {
        if (audioRef.current.src !== url) {
            audioRef.current.src = url;
            audioRef.current.crossOrigin = "anonymous";
            audioRef.current.loop = true;
            setIsPlaying(false);
        }
    }, []);

    useEffect(() => {
        if (initialUrl) loadAudio(initialUrl);
    }, [initialUrl, loadAudio]);

    const togglePlay = useCallback(async () => {
        if (isMicActive) {
            disconnectMic();
        }

        const ctx = initContext();
        
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            // Check if connected
            if (!sourceNodeRef.current || sourceNodeRef.current instanceof MediaStreamAudioSourceNode) {
                connectSource();
            }
            try {
                await audioRef.current.play();
                setIsPlaying(true);
            } catch (e) {
                console.error("Playback failed", e);
            }
        }
    }, [isPlaying, isMicActive, initContext, connectSource]);

    const toggleMic = useCallback(async () => {
        if (isMicActive) {
            disconnectMic();
            return;
        }

        // Stop file playback
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        }

        const ctx = initContext();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;

            if (analyserRef.current && audioDestRef.current) {
                if (sourceNodeRef.current) {
                    try { sourceNodeRef.current.disconnect(); } catch(e){}
                }
                
                const src = ctx.createMediaStreamSource(stream);
                src.connect(analyserRef.current);
                // NOTE: We do NOT connect mic to ctx.destination (speakers) to avoid feedback
                src.connect(audioDestRef.current); // Connect to recorder
                sourceNodeRef.current = src;
            }
            setIsMicActive(true);
        } catch (e) {
            alert("Microphone access denied.");
        }
    }, [isMicActive, isPlaying, initContext]);

    const disconnectMic = () => {
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }
        setIsMicActive(false);
    };

    const getAnalysis = useCallback((): AudioAnalysis => {
        if (!analyserRef.current) return { bass: 0, mid: 0, high: 0, energy: 0 };

        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Bands
        const bassRange = dataArray.slice(0, 5); 
        const midRange = dataArray.slice(5, 30); 
        const highRange = dataArray.slice(30, 100); 

        const bass = bassRange.reduce((a, b) => a + b, 0) / (bassRange.length * 255);
        const mid = midRange.reduce((a, b) => a + b, 0) / (midRange.length * 255);
        const high = highRange.reduce((a, b) => a + b, 0) / (highRange.length * 255);
        const energy = (bass * 0.5 + mid * 0.3 + high * 0.2);

        return { bass, mid, high, energy };
    }, []);

    // Cleanup
    useEffect(() => {
        const audioEl = audioRef.current;
        return () => {
            audioEl.pause();
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(t => t.stop());
            }
            // We don't close context to avoid recreating it constantly
        };
    }, []);

    return {
        audioElement: audioRef.current,
        isPlaying,
        isMicActive,
        togglePlay,
        toggleMic,
        loadAudio,
        getAnalysis,
        audioDestNode: audioDestRef.current
    };
};
