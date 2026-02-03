
import React, { useState, useRef, useEffect } from 'react';
import { IconHeadphones, IconPlay, IconPause, IconRefresh } from './Icons';
import { generateAudio } from '../services/geminiService';
import { db } from '../services/dbService';

interface AudioPlayerProps {
    articleTitle: string;
    articleSummary: string;
    articleUrl: string;
    initialAudioBase64?: string;
    canPlay: boolean;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ 
    articleTitle, 
    articleSummary, 
    articleUrl, 
    initialAudioBase64,
    canPlay 
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [audioBase64, setAudioBase64] = useState<string | undefined>(initialAudioBase64);
    
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    // Pulizia risorse al unmount
    useEffect(() => {
        return () => {
            stopAudio();
        };
    }, []);

    const stopAudio = () => {
        if (audioSourceRef.current) {
            try { audioSourceRef.current.stop(); } catch(e) {}
            audioSourceRef.current = null;
        }
        if (audioContextRef.current) {
            // Non chiudiamo il context ogni volta per evitare limiti browser, 
            // ma lo sospendiamo se necessario. Per ora stop semplice.
            // try { audioContextRef.current.close(); } catch(e) {}
            // audioContextRef.current = null;
        }
        setIsPlaying(false);
    };

    const handlePlayPause = async () => {
        if (!canPlay) return;

        if (isPlaying) {
            stopAudio();
            return;
        }

        setIsLoading(true);

        try {
            let currentAudio = audioBase64;

            // 1. Se non abbiamo l'audio, generiamolo
            if (!currentAudio) {
                console.log("[AudioPlayer] Generazione audio AI...");
                const textToRead = `${articleTitle}. ${articleSummary}`;
                currentAudio = await generateAudio(textToRead);
                
                if (currentAudio) {
                    setAudioBase64(currentAudio);
                    // Salviamo in cache DB in background
                    if (articleUrl) {
                        db.updateArticleAudio(articleUrl, currentAudio).catch(e => console.error("Salvataggio audio fallito", e));
                    }
                }
            } else {
                console.log("[AudioPlayer] Audio trovato in cache.");
            }

            if (!currentAudio) throw new Error("Audio non disponibile (Risposta vuota AI)");

            // 2. Setup Audio Context (Singleton Pattern per evitare limiti)
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            
            // Creiamo un nuovo context se non esiste o se è chiuso
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
            }
            
            const ctx = audioContextRef.current;

            // CRITICO: I browser spesso sospendono l'audio se non c'è interazione diretta immediata.
            // Forziamo il resume.
            if (ctx.state === 'suspended') {
                await ctx.resume();
            }

            // 3. Decodifica Ottimizzata (PCM 16-bit Little Endian -> Float32)
            const binaryString = atob(currentAudio);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            const int16Data = new Int16Array(bytes.buffer);
            const float32Data = new Float32Array(int16Data.length);
            
            // Conversione veloce
            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32768.0;
            }

            const audioBuffer = ctx.createBuffer(1, float32Data.length, 24000); // 24kHz fisso
            audioBuffer.getChannelData(0).set(float32Data);

            // 4. Play
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            
            source.onended = () => {
                setIsPlaying(false);
                audioSourceRef.current = null;
            };

            source.start(0);
            audioSourceRef.current = source;
            setIsPlaying(true);

        } catch (e: any) {
            console.error("Errore playback:", e);
            alert(`Impossibile riprodurre l'audio: ${e.message}`);
            stopAudio();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="mb-8 p-4 bg-indigo-50/80 border border-indigo-100 rounded-xl flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${isPlaying ? 'bg-indigo-100 text-indigo-600 animate-pulse' : 'bg-white text-slate-400'}`}>
                    <IconHeadphones className="w-6 h-6" />
                </div>
                <div>
                    <span className="block text-indigo-900 font-bold text-sm">Ascolta la notizia</span>
                </div>
            </div>
            
            <button 
                onClick={handlePlayPause} 
                disabled={!canPlay} 
                className={`
                    flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all shadow-md transform hover:scale-105 active:scale-95
                    ${isPlaying 
                        ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                    }
                    ${!canPlay ? 'opacity-50 cursor-not-allowed grayscale' : ''}
                `}
            >
                {isLoading ? (
                    <IconRefresh spin className="w-5 h-5" />
                ) : isPlaying ? (
                    <>
                        <IconPause className="w-5 h-5" />
                        <span>Stop</span>
                    </>
                ) : (
                    <>
                        <IconPlay className="w-5 h-5" />
                        <span>Ascolta</span>
                    </>
                )}
            </button>
        </div>
    );
};
