// src/pages/DGCAAuditDashboard.tsx
// DGCA 100-Point FTO Audit Dashboard
// Route: /audit

import {
  AlertTriangle, Camera, CheckCircle2, RefreshCw, TrendingUp, XCircle,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import {
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client'; // Global Axios client with interceptors

import { AlertsPanel }  from '../components/audit/AlertsPanel';
import { CategoryCard } from '../components/audit/CategoryCard';
import { ScoreGauge }   from '../components/audit/ScoreGauge';
import type {
  AlertSummary, ComplianceAlert, LiveAuditScore,
} from '../types/audit';

// ── Summary stat card ─────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  colour?: string;
  icon?: React.ElementType;
}

const StatCard: React.FC<StatCardProps> = ({
  label, value, sub, colour = '#f5a623', icon: Icon,
}) => (
  <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 flex items-start gap-3">
    {Icon && (
      <div className="p-2 rounded-lg shrink-0" style={{ backgroundColor: `${colour}18` }}>
        <Icon size={18} style={{ color: colour }} />
      </div>
    )}
    <div>
      <p className="text-xs text-gray-500 font-mono tracking-widest uppercase">{label}</p>
      <p className="text-2xl font-mono font-bold mt-0.5" style={{ color: colour }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ── Custom radar tooltip ──────────────────────────────────────────────────────
const RadarTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { value, payload: inner } = payload[0];
  return (
    <div className="bg-[#0B1017] border border-gray-700 rounded-lg px-3 py-2 text-xs font-mono">
      <p className="text-amber-400 font-semibold">{inner.fullName}</p>
      <p className="text-gray-300">{value} / {inner.max} pts ({inner.pct}%)</p>
    </div>
  );
};

// ── Main dashboard ────────────────────────────────────────────────────────────
const DGCAAuditDashboard: React.FC = () => {
  const qc = useQueryClient();
  const [resolvingIds, setResolvingIds] = useState<Set<number>>(new Set());

  // ── Data fetching ─────────────────────────────────────────────────────────
  const {
    data: auditData,
    isLoading: auditLoading,
    isError: auditError,
    refetch: refetchAudit,
    isFetching,
  } = useQuery<LiveAuditScore>({
    queryKey: ['audit', 'live'],
    queryFn: async () => {
      const res = await apiClient.get('compliance/audit/live/');
      return res.data;
    },
    refetchInterval: 5 * 60 * 1000,    // auto-refresh every 5 min
  });

  const { data: alerts = [], isLoading: alertsLoading } = useQuery<ComplianceAlert[]>({
    queryKey: ['compliance', 'alerts'],
    queryFn: async () => {
      const res = await apiClient.get('compliance/alerts/');
      return res.data.results ?? res.data;
    },
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: alertSummary } = useQuery<AlertSummary>({
    queryKey: ['compliance', 'alerts', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get('compliance/alerts/summary/');
      return res.data;
    },
    refetchInterval: 2 * 60 * 1000,
  });

  // ── Snapshot mutation ─────────────────────────────────────────────────────
  const snapshotMutation = useMutation({
    mutationFn: () => apiClient.post('compliance/audit/snapshot/'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'history'] }),
  });

  // ── Resolve alert ─────────────────────────────────────────────────────────
  const resolveAlert = useCallback(async (id: number) => {
    setResolvingIds(prev => new Set(prev).add(id));
    try {
      await apiClient.post(`compliance/alerts/${id}/resolve/`);
      qc.invalidateQueries({ queryKey: ['compliance', 'alerts'] });
    } finally {
      setResolvingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [qc]);

  // ── Radar chart data ──────────────────────────────────────────────────────
  const radarData = (auditData?.categories ?? []).map(cat => ({
    subject:  cat.code,
    fullName: cat.name,
    value:    Math.round(cat.score),
    max:      cat.max_score,
    pct:      cat.percentage,
    fullMark: cat.max_score,
  }));

  // ── Rating badge ──────────────────────────────────────────────────────────
  const ratingBorder = auditData
    ? ({
        excellent:     'border-green-500/50 text-green-400',
        good:          'border-amber-500/50 text-amber-400',
        satisfactory:  'border-orange-500/50 text-orange-400',
        unsatisfactory:'border-red-500/50 text-red-400',
      }[auditData.rating] ?? 'border-gray-500 text-gray-400')
    : 'border-gray-700 text-gray-600';

  // ── Categories at risk (< 75 %) ───────────────────────────────────────────
  const atRisk = (auditData?.categories ?? []).filter(c => c.percentage < 75).length;

  // ────────────────────────────────────────────────────────────────────────────

  if (auditLoading) {
    return (
      <div className="min-h-screen bg-[#0B1017] flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 border-2 border-amber-400 border-t-transparent
                          rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 font-mono text-sm">Computing audit score…</p>
        </div>
      </div>
    );
  }

  if (auditError || !auditData) {
    return (
      <div className="min-h-screen bg-[#0B1017] flex items-center justify-center">
        <div className="text-center">
          <XCircle size={36} className="text-red-500 mx-auto mb-3" />
          <p className="text-gray-400 font-mono">Failed to load audit data.</p>
          <button onClick={() => refetchAudit()}
            className="mt-3 text-amber-400 hover:text-amber-300 text-sm font-mono">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1017] text-gray-100">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-mono text-gray-600 tracking-widest uppercase">
                DGCA CAR-FTO · VAAW Amravati
              </span>
              <span className={`text-[10px] font-mono border rounded px-1.5 py-0.5 ${ratingBorder}`}>
                {auditData.rating_label.toUpperCase()}
              </span>
            </div>
            <h1 className="text-xl font-bold text-gray-100 tracking-wide">
              FTO Audit Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetchAudit()}
              disabled={isFetching}
              className="flex items-center gap-1.5 text-xs font-mono text-gray-500
                         hover:text-amber-400 border border-gray-700 hover:border-amber-500/50
                         rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={() => snapshotMutation.mutate()}
              disabled={snapshotMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-mono text-amber-400
                         border border-amber-500/40 hover:border-amber-400
                         rounded-lg px-3 py-1.5 transition-colors"
            >
              <Camera size={13} />
              Save Snapshot
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* ── Row 1: Gauge + Summary stats + Radar ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Gauge */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-6
                          flex flex-col items-center justify-center">
            <ScoreGauge
              score={auditData.total_score}
              maxScore={auditData.max_score}
              rating={auditData.rating}
              ratingLabel={auditData.rating_label}
              ratingColor={auditData.rating_color}
              asOf={auditData.as_of}
            />

            {/* DGCA rating scale legend */}
            <div className="mt-4 w-full grid grid-cols-4 gap-1 text-center">
              {[
                { label: '≥90', sub: 'Excellent', colour: '#22c55e' },
                { label: '≥75', sub: 'Good',      colour: '#f5a623' },
                { label: '≥60', sub: 'Satisfact.', colour: '#f97316' },
                { label: '<60', sub: 'Unsatisfact.', colour: '#ef4444' },
              ].map(r => (
                <div key={r.label} className="text-center">
                  <p className="text-[11px] font-mono font-bold"
                     style={{ color: r.colour }}>{r.label}</p>
                  <p className="text-[9px] text-gray-600">{r.sub}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Summary cards (stacked) */}
          <div className="space-y-3">
            <StatCard
              label="Active Alerts"
              value={alertSummary?.total ?? alerts.length}
              sub={`${alertSummary?.critical ?? 0} critical · ${alertSummary?.warning ?? 0} warnings`}
              colour={
                (alertSummary?.critical ?? 0) > 0 ? '#ef4444'
                : (alertSummary?.warning ?? 0) > 0 ? '#f5a623'
                : '#22c55e'
              }
              icon={(alertSummary?.critical ?? 0) > 0 ? XCircle
                    : (alertSummary?.warning ?? 0) > 0 ? AlertTriangle
                    : CheckCircle2}
            />
            <StatCard
              label="Categories at Risk"
              value={`${atRisk} / 7`}
              sub="Scoring below 75 %"
              colour={atRisk > 0 ? '#f97316' : '#22c55e'}
              icon={TrendingUp}
            />
            <StatCard
              label="Auto-Scored Parameters"
              value={auditData.categories
                .flatMap(c => c.parameters)
                .filter(p => p.auto).length}
              sub="Live from system data"
              colour="#f5a623"
            />
          </div>

          {/* Radar chart */}
          <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
            <p className="text-xs font-mono text-gray-500 tracking-widest uppercase mb-3">
              Category Radar
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <PolarGrid stroke="#1e2a3a" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: '#6b7280', fontSize: 11, fontFamily: 'monospace' }}
                />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke={auditData.rating_color}
                  fill={auditData.rating_color}
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Radar
                  name="Max"
                  dataKey="fullMark"
                  stroke="#1e2a3a"
                  fill="#1e2a3a"
                  fillOpacity={0}
                  strokeWidth={1}
                  strokeDasharray="4 2"
                />
                <Tooltip content={<RadarTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Row 2: Category breakdown (7 cards in grid) ─────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-mono font-semibold text-gray-400 tracking-widest uppercase">
              Category Breakdown
            </h2>
            <span className="text-xs text-gray-600 font-mono">
              Click any card to expand parameters
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
            {auditData.categories.map(cat => (
              <CategoryCard key={cat.code} category={cat} />
            ))}
          </div>
        </div>

        {/* ── Row 3: Compliance alerts ─────────────────────────────────────── */}
        <AlertsPanel
          alerts={alerts}
          isLoading={alertsLoading}
          onResolve={resolveAlert}
          resolvingIds={resolvingIds}
        />

      </div>
    </div>
  );
};

export default DGCAAuditDashboard;