
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Upload, Languages, Download, Wand2, AlertTriangle, 
  Film, Mic, Square, Volume2, Sparkles, ChevronRight, Play, Pause
} from 'lucide-react';
import VideoPlayer from './components/VideoPlayer';
import CaptionEditor from './components/CaptionEditor';
import StatsChart from './components/StatsChart';
import { Caption, ProcessingStatus, SUPPORTED_LANGUAGES } from './types';
import { extractAudioFromVideo, decodeBase64, decodePcmToAudioBuffer } from './services/audioUtils';
import { transcribeAudio, translateCaptions, generateSpeech } from './services/huggingFaceService';
import { renderVideoWithCaptions } from './services/videoRenderer';

function App() {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState<ProcessingStatus>(ProcessingStatus.IDLE);
  const [selectedLang, setSelectedLang] = useState<string>('ur-PK');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [renderingProgress, setRenderingProgress] = useState(0);
  const [dubbedAudioBuffer, setDubbedAudioBuffer] = useState<AudioBuffer | null>(null);
  const [useDubbing, setUseDubbing] = useState(false);
  const [isDubPreviewPlaying, setIsDubPreviewPlaying] = useState(false);

  const videoInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const processAbortControllerRef = useRef<AbortController | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => {
      if (videoSrc) URL.revokeObjectURL(videoSrc);
      if (currentAudioSourceRef.current) currentAudioSourceRef.current.stop();
    };
  }, [videoSrc]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setVideoFile(file);
      setCaptions([]);
      setStatus(ProcessingStatus.IDLE);
      setErrorMsg(null);
      setDubbedAudioBuffer(null);
      setUseDubbing(false);
    }
  };

  const handleStopProcessing = () => {
    if (processAbortControllerRef.current) processAbortControllerRef.current.abort();
    setStatus(ProcessingStatus.IDLE);
    setErrorMsg("Operation cancelled.");
  };

  const handleGenerateCaptions = async () => {
    if (!videoFile) return;
    const controller = new AbortController();
    processAbortControllerRef.current = controller;
    try {
      setErrorMsg(null);
      setStatus(ProcessingStatus.EXTRACTING_AUDIO);
      const audioBase64 = await extractAudioFromVideo(videoFile);
      if (controller.signal.aborted) return;
      setStatus(ProcessingStatus.TRANSCRIBING);
      const generatedCaptions = await transcribeAudio(audioBase64, controller.signal);
      setCaptions(generatedCaptions);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg(err.message || "Whisper Transcription failed.");
    }
  };

  const handleTranslate = async () => {
    if (captions.length === 0) return;
    const controller = new AbortController();
    processAbortControllerRef.current = controller;
    try {
      setStatus(ProcessingStatus.TRANSLATING);
      const targetLangName = SUPPORTED_LANGUAGES.find(l => l.code === selectedLang)?.name || "English";
      const translated = await translateCaptions(captions, targetLangName, controller.signal);
      setCaptions(translated);
      setDubbedAudioBuffer(null);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg("NLLB Translation failed.");
    }
  };

  const handleDubbing = async () => {
    if (captions.length === 0) return;
    const controller = new AbortController();
    processAbortControllerRef.current = controller;
    try {
      setStatus(ProcessingStatus.GENERATING_SPEECH);
      const fullText = captions.map(c => c.text).join('. ');
      const audioBase64 = await generateSpeech(fullText, controller.signal);
      const uint8 = decodeBase64(audioBase64);
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      
      // Note: MMS TTS often returns standard wav headers, decodeAudioData might be safer 
      // but for consistency with your existing pipeline we use your PCM decoder.
      // If HF returns a standard wav, we use the browser's native decoder.
      let buffer;
      try {
        buffer = await audioContextRef.current.decodeAudioData(uint8.buffer);
      } catch {
        buffer = await decodePcmToAudioBuffer(uint8, audioContextRef.current);
      }
      
      setDubbedAudioBuffer(buffer);
      setUseDubbing(true);
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setStatus(ProcessingStatus.ERROR);
      setErrorMsg("MMS TTS Dubbing failed.");
    }
  };

  const toggleDubPreview = () => {
    if (!dubbedAudioBuffer) return;
    if (isDubPreviewPlaying) {
      currentAudioSourceRef.current?.stop();
      setIsDubPreviewPlaying(false);
    } else {
      if (!audioContextRef.current) audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createBufferSource();
      source.buffer = dubbedAudioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setIsDubPreviewPlaying(false);
      source.start();
      currentAudioSourceRef.current = source;
      setIsDubPreviewPlaying(true);
    }
  };

  const handleExportVideo = async () => {
    if (!videoSrc || captions.length === 0) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    try {
      setStatus(ProcessingStatus.RENDERING);
      const blob = await renderVideoWithCaptions(
        videoSrc, 
        captions, 
        (p) => setRenderingProgress(p),
        controller.signal,
        useDubbing ? dubbedAudioBuffer : null
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AHA_Studio_HF_Export_${Date.now()}.webm`;
      a.click();
      setStatus(ProcessingStatus.COMPLETED);
    } catch (err: any) {
      setStatus(err.name === 'AbortError' ? ProcessingStatus.IDLE : ProcessingStatus.ERROR);
    }
  };

  const isProcessing = [ProcessingStatus.EXTRACTING_AUDIO, ProcessingStatus.TRANSCRIBING, ProcessingStatus.TRANSLATING, ProcessingStatus.GENERATING_SPEECH].includes(status);
  const isRendering = status === ProcessingStatus.RENDERING;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-indigo-500/30">
      {(isRendering || isProcessing) && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center p-12">
          <div className="relative mb-12">
            <div className="absolute inset-0 bg-indigo-500/20 blur-[100px] animate-pulse rounded-full" />
            <div className="w-32 h-32 rounded-full border-b-4 border-indigo-500 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto text-indigo-400 w-10 h-10 animate-bounce" />
          </div>
          <h2 className="text-4xl font-black mb-4 tracking-tighter">
            {isRendering ? 'Rendering Masterpiece' : 'AHA Studio AI (Hugging Face)'}
          </h2>
          <p className="text-slate-400 max-w-md text-center text-lg mb-10">
            {status === ProcessingStatus.TRANSCRIBING ? 'Whisper V3 is listening...' : 
             status === ProcessingStatus.TRANSLATING ? 'Synthesizing NLLB translation...' :
             status === ProcessingStatus.GENERATING_SPEECH ? 'Generating MMS vocal patterns...' :
             `Processing content: ${Math.round(renderingProgress * 100)}%`}
          </p>
          {isRendering && (
            <div className="w-full max-w-sm h-1.5 bg-slate-800 rounded-full overflow-hidden mb-12">
              <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${renderingProgress * 100}%` }} />
            </div>
          )}
          <button onClick={handleStopProcessing} className="px-10 py-4 bg-slate-900 border border-slate-800 rounded-2xl hover:bg-red-500/10 hover:border-red-500/40 transition-all font-bold flex items-center">
            <Square size={16} className="mr-3" /> Stop Process
          </button>
        </div>
      )}

      <header className="h-20 border-b border-slate-800/50 bg-slate-950/80 backdrop-blur-xl px-10 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/20">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter">AHA STUDIO</h1>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">HF Inference Engine</span>
          <button onClick={() => videoInputRef.current?.click()} className="flex items-center space-x-2 px-8 py-3 bg-indigo-500 hover:bg-indigo-400 rounded-2xl font-bold transition-transform active:scale-95">
            <Upload size={18} /> <span>{videoFile ? 'Change Project' : 'New Project'}</span>
          </button>
        </div>
        <input type="file" ref={videoInputRef} accept="video/*" className="hidden" onChange={handleFileUpload} />
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-y-auto p-10 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-slate-900/40 via-slate-950 to-slate-950">
          <div className="max-w-6xl mx-auto space-y-10">
            <VideoPlayer src={videoSrc} captions={captions} onTimeUpdate={setCurrentTime} />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Step 1: Transcribe */}
              <div className="group bg-slate-900/30 border border-slate-800/50 p-8 rounded-[3rem] hover:border-indigo-500/30 transition-all">
                <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Wand2 size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">1. Transcribe</h3>
                <p className="text-sm text-slate-500 mb-6">Whisper V3 high-fidelity transcription.</p>
                <button onClick={handleGenerateCaptions} disabled={!videoFile || isProcessing} className="w-full py-4 bg-slate-800 hover:bg-indigo-500 rounded-2xl font-bold text-sm transition-all disabled:opacity-30">
                  Analyze Content
                </button>
              </div>

              {/* Step 2: Translate */}
              <div className="group bg-slate-900/30 border border-slate-800/50 p-8 rounded-[3rem] hover:border-purple-500/30 transition-all">
                <div className="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Languages size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">2. Translate</h3>
                <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-sm mb-4">
                  {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
                <button onClick={handleTranslate} disabled={captions.length === 0 || isProcessing} className="w-full py-4 bg-purple-500 hover:bg-purple-400 rounded-2xl font-bold text-sm transition-all disabled:opacity-30">
                  NLLB Translation
                </button>
              </div>

              {/* Step 3: AI Dub */}
              <div className="group bg-slate-900/30 border border-slate-800/50 p-8 rounded-[3rem] hover:border-pink-500/30 transition-all">
                <div className="w-12 h-12 bg-pink-500/10 text-pink-400 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Mic size={24} />
                </div>
                <h3 className="text-xl font-bold mb-2">3. AI Dub</h3>
                <p className="text-sm text-slate-500 mb-6">MMS Neural speech synthesis.</p>
                <button onClick={handleDubbing} disabled={captions.length === 0 || isProcessing} className="w-full py-4 bg-pink-500 hover:bg-pink-400 rounded-2xl font-bold text-sm transition-all disabled:opacity-30">
                  Generate Voice
                </button>
              </div>

              {/* Step 4: Export */}
              <div className="group bg-slate-900/30 border border-slate-800/50 p-8 rounded-[3rem] hover:border-emerald-500/30 transition-all">
                <div className="flex items-center justify-between mb-6">
                  <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Download size={24} />
                  </div>
                  {dubbedAudioBuffer && (
                    <button onClick={toggleDubPreview} className={`p-3 rounded-xl transition-all ${isDubPreviewPlaying ? 'bg-pink-500' : 'bg-slate-800'}`}>
                      {isDubPreviewPlaying ? <Square size={14} fill="white" /> : <Play size={14} fill="white" />}
                    </button>
                  )}
                </div>
                <div className="flex items-center space-x-3 mb-6">
                  <input type="checkbox" checked={useDubbing} onChange={(e) => setUseDubbing(e.target.checked)} disabled={!dubbedAudioBuffer} className="w-5 h-5 rounded-lg bg-slate-800 text-indigo-500 border-slate-700" />
                  <span className="text-sm font-medium text-slate-400">Include AI Dub</span>
                </div>
                <button onClick={handleExportVideo} disabled={captions.length === 0 || isProcessing} className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-emerald-500/10">
                  Export Video
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="p-8 bg-red-500/5 border border-red-500/20 rounded-[2.5rem] flex items-start space-x-6 animate-in zoom-in-95 duration-300">
                <div className="bg-red-500/10 p-4 rounded-2xl text-red-400"><AlertTriangle size={24} /></div>
                <div>
                  <h4 className="text-xl font-black text-red-400 tracking-tighter mb-1">HF Studio Alert</h4>
                  <p className="text-red-300/60 font-medium">{errorMsg}</p>
                </div>
              </div>
            )}
            <StatsChart captions={captions} />
          </div>
        </div>

        <aside className="w-[420px] bg-slate-950 border-l border-slate-800/50 flex flex-col">
          <CaptionEditor 
            captions={captions} 
            currentTime={currentTime} 
            onUpdateCaption={(id, text) => setCaptions(prev => prev.map(c => c.id === id ? {...c, text} : c))} 
            onSeek={(t) => {
              const v = document.querySelector('video');
              if (v) v.currentTime = t;
            }} 
          />
        </aside>
      </main>
    </div>
  );
}

export default App;
