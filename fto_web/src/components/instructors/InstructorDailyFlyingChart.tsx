import React, { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Activity, Clock, Calendar, CheckSquare } from 'lucide-react';
import { useInstructorDailyFlying } from '@/api/hooks/useInstructors';
import { Card, PageLoader } from '@/components/ui';

interface Props {
  instructorId: string;
  instructorName?: string;
}

export const InstructorDailyFlyingChart: React.FC<Props> = ({ instructorId, instructorName }) => {
  const [days, setDays] = useState<number>(30);
  const { data, isLoading, isError } = useInstructorDailyFlying(instructorId, days);

  if (isLoading) return <PageLoader />;
  if (isError || !data) {
    return (
      <Card className="p-4 text-center text-slate-400">
        <p className="text-xs">Failed to load daily flying activity</p>
      </Card>
    );
  }

  const activeDays = data.daily_data.filter(d => d.hours > 0).length;

  return (
    <Card className="p-4 space-y-4">
      {/* Header controls & summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 dark:border-slate-700 pb-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-primary-600 dark:text-primary-400" />
            Daily Flying Hours ({days} Days)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {instructorName ? `${instructorName} · ` : ''}{data.start_date} to {data.end_date}
          </p>
        </div>

        {/* Preset Selector */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          {[
            { label: '14 Days', value: 14 },
            { label: '30 Days', value: 30 },
            { label: '60 Days', value: 60 },
          ].map(p => (
            <button
              key={p.value}
              onClick={() => setDays(p.value)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                days === p.value
                  ? 'bg-white dark:bg-slate-700 text-primary-600 dark:text-primary-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-1">
            <Clock className="h-3 w-3 text-primary-500" /> Total Hours
          </p>
          <p className="text-lg font-bold text-primary-600 dark:text-primary-400 mt-0.5">
            {data.total_hours} <span className="text-xs font-normal text-slate-400">hrs</span>
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-1">
            <CheckSquare className="h-3 w-3 text-emerald-500" /> Total Sorties
          </p>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
            {data.total_sorties}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700/60 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-center gap-1">
            <Calendar className="h-3 w-3 text-amber-500" /> Active Days
          </p>
          <p className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
            {activeDays} <span className="text-xs font-normal text-slate-400">/ {days}</span>
          </p>
        </div>
      </div>

      {/* Scrollable Bar Chart */}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3">
        <div style={{ minWidth: `${Math.max(700, days * 28)}px`, height: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.daily_data} margin={{ top: 10, right: 10, bottom: 5, left: -15 }}>
              <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#cbd5e1' }} domain={[0, 'dataMax + 1']} />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-2.5 rounded-lg shadow-lg border border-slate-700 text-xs space-y-1">
                        <p className="font-bold text-amber-400">{item.label} ({item.date})</p>
                        <p className="text-slate-200 font-medium">Flying Hours: <span className="font-bold text-emerald-400">{item.hours} hrs</span></p>
                        <p className="text-slate-300">Sorties Flown: <span className="font-semibold text-white">{item.sorties}</span></p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="hours" radius={[3, 3, 0, 0]}>
                {data.daily_data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.hours > 6 ? '#ef4444' : entry.hours > 4 ? '#f59e0b' : entry.hours > 0 ? '#3b82f6' : '#e2e8f0'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
};
