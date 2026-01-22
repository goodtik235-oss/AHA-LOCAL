
import React, { useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Maximize2 } from 'lucide-react';
import { Caption } from '../types';

interface VideoPlayerProps {
  src: string | null;
  captions: Caption[];
  onTimeUpdate: (time: number) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, captions, onTimeUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [activeCaption, setActiveCaption] = React.useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      const time = video.currentTime;
      onTimeUpdate(time);
      
      const current = captions.find(c => time >= c.start && time <= c.end);
      setActiveCaption(current ? current.text : null);
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [captions, onTimeUpdate]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  return (
    <div className="relative group w-full aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-slate-800">
      {src ? (
        <>
          <video 
            ref={videoRef}
            src={src}
            className="w-full h-full object-contain"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          
          {/* Caption Overlay */}
          {activeCaption && (
            <div className="absolute bottom-16 left-0 right-0 flex justify-center px-8 pointer-events-none">
              <p className="bg-slate-950/80 backdrop-blur-md px-6 py-3 rounded-2xl text-white text-lg font-bold text-center border border-slate-700/50 shadow-2xl animate-in fade-in slide-in-from-bottom-2">
                {activeCaption}
              </p>
            </div>
          )}

          {/* Custom Controls */}
          <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-6">
            <button onClick={togglePlay} className="text-white hover:text-indigo-400 transition-colors">
              {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
            </button>
            <div className="flex-1 h-1.5 bg-slate-800/50 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-indigo-500 transition-all duration-100" 
                 style={{ width: `${videoRef.current ? (videoRef.current.currentTime / videoRef.current.duration) * 100 : 0}%` }}
               />
            </div>
            <Volume2 size={20} className="text-slate-400" />
            <Maximize2 size={20} className="text-slate-400" />
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
           <div className="w-20 h-20 rounded-full bg-slate-900 flex items-center justify-center border border-slate-800">
              <Play size={32} className="ml-1 opacity-20" />
           </div>
           <p className="font-bold text-sm tracking-widest uppercase opacity-40">Ready for Preview</p>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
