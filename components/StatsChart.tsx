
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area 
} from 'recharts';
import { Caption } from '../types';

interface StatsChartProps {
  captions: Caption[];
}

const StatsChart: React.FC<StatsChartProps> = ({ captions }) => {
  if (captions.length === 0) return null;

  // Process data for "Speech Density" (Words per segment over time)
  const data = captions.map((c, i) => ({
    time: Math.floor(c.start),
    words: c.text.split(' ').length,
    label: `${Math.floor(c.start)}s`
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl shadow-2xl">
          <p className="text-xs font-bold text-indigo-400 mb-1">{payload[0].payload.label}</p>
          <p className="text-sm font-black text-white">{payload[0].value} Words</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mt-12 bg-slate-900/20 border border-slate-800/40 rounded-[2.5rem] p-10">
      <div className="flex items-center justify-between mb-10">
         <div>
            <h3 className="text-lg font-black text-white tracking-tighter">SPEECH DENSITY</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Linguistic throughput across the timeline</p>
         </div>
         <div className="flex items-center space-x-6">
            <div className="flex flex-col items-end">
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Total Words</span>
               <span className="text-xl font-black text-indigo-400">
                  {captions.reduce((acc, c) => acc + c.text.split(' ').length, 0)}
               </span>
            </div>
         </div>
      </div>
      
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorWords" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis 
              dataKey="label" 
              stroke="#475569" 
              fontSize={10} 
              tickLine={false} 
              axisLine={false} 
              tickMargin={15}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#6366f1', strokeWidth: 1 }} />
            <Area 
              type="monotone" 
              dataKey="words" 
              stroke="#6366f1" 
              strokeWidth={3} 
              fillOpacity={1} 
              fill="url(#colorWords)" 
              animationDuration={1500}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsChart;
