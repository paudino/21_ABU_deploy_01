
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

// Funzioni di decodifica PCM standard per Gemini TTS
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
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

    useEffect(() => {
        return () => stopAudio();
    }, []);

    const stopAudio = () => {
        if (audioSourceRef.current) {
            try { audioSourceRef.current.stop(); } catch(e) {}
            audioSourceRef.current = null;
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

            // 1. Recupero o generazione audio
            if (!currentAudio) {
                const textToRead = `${articleTitle}. ${articleSummary}`;
                currentAudio = await generateAudio(textToRead) || undefined;
                
                if (currentAudio) {
                    setAudioBase64(currentAudio);
                    if (articleUrl) {
                        db.updateArticleAudio(articleUrl, currentAudio).catch(e => console.error("Errore salvataggio audio in cache:", e));
                    }
                }
            }

            if (!currentAudio) throw new Error("Impossibile generare l'audio al momento.");

            // 2. Setup AudioContext (24kHz richiesto dal modello Kore)
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
            }
            
            const ctx = audioContextRef.current;
            if (ctx.state === 'suspended') await ctx.resume();

            // 3. Decodifica PCM raw
            const decodedBytes = decodeBase64(currentAudio);
            const audioBuffer = await decodeAudioData(decodedBytes, ctx, 24000, 1);

            // 4. Avvio riproduzione
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
            console.error("Errore playback audio:", e);
            alert("Spiacenti, si è verificato un errore durante la riproduzione audio.");
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
                disabled={!canPlay || isLoading} 
                className={`
                    flex items-center gap-2 px-6 py-2.5 rounded-full font-bold transition-all shadow-md transform hover:scale-105 active:scale-95
                    ${isPlaying 
                        ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-200' 
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200'
                    }
                    ${(!canPlay || isLoading) ? 'opacity-50 cursor-not-allowed grayscale' : ''}
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
