
import React from 'react';
import { Search, Clock, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import { Caption } from '../types';

interface CaptionEditorProps {
  captions: Caption[];
  currentTime: number;
  onUpdateCaption: (id: string, text: string) => void;
  onSeek: (time: number) => void;
}

const CaptionEditor: React.FC<CaptionEditorProps> = ({ captions, currentTime, onUpdateCaption, onSeek }) => {
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const filteredCaptions = captions.filter(c => 
    c.text.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-8 border-b border-slate-800/40">
        <h2 className="text-xl font-black text-white mb-6 tracking-tighter">STUDIO TIMELINE</h2>
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search transcripts..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm focus:border-indigo-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {filteredCaptions.length > 0 ? (
          filteredCaptions.map((cap) => {
            const isActive = currentTime >= cap.start && currentTime <= cap.end;
            return (
              <div 
                key={cap.id} 
                onClick={() => onSeek(cap.start)}
                className={`group p-5 rounded-3xl border transition-all cursor-pointer ${
                  isActive 
                  ? 'bg-indigo-500/10 border-indigo-500/40 shadow-xl' 
                  : 'bg-slate-900/20 border-slate-800/40 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <Clock size={12} />
                    <span>{formatTime(cap.start)} — {formatTime(cap.end)}</span>
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,1)]" />
                  )}
                </div>
                
                <textarea
                  value={cap.text}
                  onChange={(e) => onUpdateCaption(cap.id, e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full bg-transparent border-none text-slate-200 text-sm font-medium leading-relaxed resize-none focus:outline-none focus:ring-0 p-0"
                  rows={2}
                />
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center px-10">
            <Edit3 size={32} className="mb-4 opacity-20" />
            <p className="text-sm font-medium leading-relaxed">Transcribe audio to begin editing your localization timeline.</p>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-950/80 border-t border-slate-800/40 backdrop-blur-md">
         <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-widest">
            <span>Total Segments</span>
            <span className="text-indigo-400">{captions.length}</span>
         </div>
      </div>
    </div>
  );
};

export default CaptionEditor;
