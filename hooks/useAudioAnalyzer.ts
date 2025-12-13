
import { useRef, useState, useCallback, useEffect } from 'react';

export const useAudioAnalyzer = () => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<MediaElementAudioSourceNode | MediaStreamAudioSourceNode | null>(null);
    const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const micStreamRef = useRef<MediaStream | null>(null);
    
    const [isMicActive, setIsMicActive] = useState(false);

    const initAudio = useCallback(() => {
        if (!audioCtxRef.current) {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            audioCtxRef.current = new AudioContextClass();
            
            analyserRef.current = audioCtxRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            analyserRef.current.smoothingTimeConstant = 0.8;
            
            audioDestRef.current = audioCtxRef.current.createMediaStreamDestination();
        }
        if (audioCtxRef.current.state === 'suspended') {
            audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    }, []);

    const connectFileAudio = useCallback((audioElement: HTMLAudioElement) => {
        const ctx = initAudio();
        if (analyserRef.current && audioDestRef.current) {
            try {
                // Prevent double connection
                if (!sourceNodeRef.current || sourceNodeRef.current instanceof MediaStreamAudioSourceNode) {
                    if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
                    
                    const src = ctx.createMediaElementSource(audioElement);
                    src.connect(analyserRef.current);
                    src.connect(ctx.destination);
                    src.connect(audioDestRef.current);
                    sourceNodeRef.current = src;
                }
            } catch (e) {
                // Often fails if element is already connected, safe to ignore in React strict mode re-renders
                // console.warn("Audio connection warning:", e);
            }
        }
    }, [initAudio]);

    const connectMicAudio = useCallback(async () => {
        const ctx = initAudio();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;
            
            if (analyserRef.current && audioDestRef.current) {
                if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
                
                const src = ctx.createMediaStreamSource(stream);
                src.connect(analyserRef.current);
                // Do NOT connect mic to ctx.destination to avoid feedback loop
                src.connect(audioDestRef.current);
                sourceNodeRef.current = src;
            }
            setIsMicActive(true);
        } catch (e) {
            console.error("Mic access denied", e);
            alert("Microphone access denied. Check permissions.");
        }
    }, [initAudio]);

    const disconnectMic = useCallback(() => {
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
        }
        setIsMicActive(false);
    }, []);

    const getFrequencyData = useCallback(() => {
        if (!analyserRef.current) return { bass: 0, mid: 0, high: 0, energy: 0 };
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Simple frequency banding
        const bassRange = dataArray.slice(0, 5); 
        const midRange = dataArray.slice(5, 30); 
        const highRange = dataArray.slice(30, 100); 
        
        const bass = bassRange.reduce((a, b) => a + b, 0) / (bassRange.length * 255);
        const mid = midRange.reduce((a, b) => a + b, 0) / (midRange.length * 255);
        const high = highRange.reduce((a, b) => a + b, 0) / (highRange.length * 255);
        const energy = (bass * 0.5 + mid * 0.3 + high * 0.2);

        return { bass, mid, high, energy };
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(t => t.stop());
            }
            if (audioCtxRef.current) {
                audioCtxRef.current.close();
            }
        };
    }, []);

    return {
        audioCtxRef,
        analyserRef,
        audioDestRef, // Exposed for recording
        isMicActive,
        initAudio,
        connectFileAudio,
        connectMicAudio,
        disconnectMic,
        getFrequencyData
    };
};
