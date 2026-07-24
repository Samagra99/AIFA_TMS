import {
  AlertTriangle, Camera, CheckCircle2, RefreshCw, TrendingUp, XCircle, ShieldCheck,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import {
  PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip,
} from 'recharts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Card, Button, PageLoader, Badge } from '@/components/ui';

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
  label, value, sub, colour = '#f59e0b', icon: Icon,
}) => (
  <Card className="flex items-start gap-3 p-4">
    {Icon && (
      <div className="p-2.5 rounded-lg shrink-0" style={{ backgroundColor: `${colour}18` }}>
        <Icon size={18} style={{ color: colour }} />
      </div>
    )}
    <div>
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-0.5" style={{ color: colour }}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </Card>
);

// ── Custom radar tooltip ──────────────────────────────────────────────────────
const RadarTooltip: React.FC<{ active?: boolean; payload?: any[] }> = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { value, payload: inner } = payload[0];
  return (
    <div className="bg-slate-900 dark:bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-xl text-white">
      <p className="text-amber-400 font-semibold">{inner.fullName}</p>
      <p className="text-slate-300">{value} / {inner.max} pts ({inner.pct}%)</p>
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
    refetchInterval: 5 * 60 * 1000,
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

  const snapshotMutation = useMutation({
    mutationFn: () => apiClient.post('compliance/audit/snapshot/'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audit', 'history'] }),
  });

  const resolveAlert = useCallback(async (id: number) => {
    setResolvingIds(prev => new Set(prev).add(id));
    try {
      await apiClient.post(`compliance/alerts/${id}/resolve/`);
      qc.invalidateQueries({ queryKey: ['compliance', 'alerts'] });
    } finally {
      setResolvingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }, [qc]);

  const radarData = (auditData?.categories ?? []).map(cat => ({
    subject:  cat.code,
    fullName: cat.name,
    value:    Math.round(cat.score),
    max:      cat.max_score,
    pct:      cat.percentage,
    fullMark: cat.max_score,
  }));

  const atRisk = (auditData?.categories ?? []).filter(c => c.percentage < 75).length;

  if (auditLoading) {
    return <PageLoader />;
  }

  if (auditError || !auditData) {
    return (
      <div className="flex h-96 flex-col items-center justify-center text-center">
        <XCircle size={36} className="text-red-500 mb-3" />
        <p className="text-slate-600 dark:text-slate-400 font-medium">Failed to load audit data.</p>
        <Button onClick={() => refetchAudit()} variant="secondary" size="sm" className="mt-3">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase">
              DGCA CAR-FTO Compliance Audit
            </span>
            <Badge variant={auditData.rating === 'excellent' ? 'success' : auditData.rating === 'good' ? 'warning' : 'danger'}>
              {auditData.rating_label.toUpperCase()}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            DGCA Audit Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => refetchAudit()}
            disabled={isFetching}
            variant="secondary"
            size="sm"
            className="gap-1.5"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button
            onClick={() => snapshotMutation.mutate()}
            loading={snapshotMutation.isPending}
            variant="primary"
            size="sm"
            className="gap-1.5"
          >
            <Camera size={14} />
            Save Snapshot
          </Button>
        </div>
      </div>

      {/* ── Row 1: Gauge + Summary stats + Radar ───────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Gauge */}
        <Card className="p-6 flex flex-col items-center justify-center">
          <ScoreGauge
            score={auditData.total_score}
            maxScore={auditData.max_score}
            rating={auditData.rating}
            ratingLabel={auditData.rating_label}
            ratingColor={auditData.rating_color}
            asOf={auditData.as_of}
          />

          <div className="mt-4 w-full grid grid-cols-4 gap-1 text-center">
            {[
              { label: '≥90', sub: 'Excellent', colour: '#10b981' },
              { label: '≥75', sub: 'Good',      colour: '#f59e0b' },
              { label: '≥60', sub: 'Satisfact.', colour: '#f97316' },
              { label: '<60', sub: 'Unsatisfact.', colour: '#ef4444' },
            ].map(r => (
              <div key={r.label} className="text-center">
                <p className="text-xs font-bold" style={{ color: r.colour }}>{r.label}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{r.sub}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Summary cards (stacked) */}
        <div className="space-y-3">
          <StatCard
            label="Active Alerts"
            value={alertSummary?.total ?? alerts.length}
            sub={`${alertSummary?.critical ?? 0} critical · ${alertSummary?.warning ?? 0} warnings`}
            colour={
              (alertSummary?.critical ?? 0) > 0 ? '#ef4444'
              : (alertSummary?.warning ?? 0) > 0 ? '#f59e0b'
              : '#10b981'
            }
            icon={(alertSummary?.critical ?? 0) > 0 ? XCircle
                  : (alertSummary?.warning ?? 0) > 0 ? AlertTriangle
                  : CheckCircle2}
          />
          <StatCard
            label="Categories at Risk"
            value={`${atRisk} / 7`}
            sub="Scoring below 75 %"
            colour={atRisk > 0 ? '#f97316' : '#10b981'}
            icon={TrendingUp}
          />
          <StatCard
            label="Auto-Scored Parameters"
            value={auditData.categories
              .flatMap(c => c.parameters)
              .filter(p => p.auto).length}
            sub="Live from system data"
            colour="#3b82f6"
          />
        </div>

        {/* Radar chart */}
        <Card className="p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-3">
            Category Radar
          </p>
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
              <PolarGrid className="stroke-slate-200 dark:stroke-slate-700" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: '#64748b', fontSize: 11 }}
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
                stroke="#94a3b8"
                fill="#94a3b8"
                fillOpacity={0}
                strokeWidth={1}
                strokeDasharray="4 2"
              />
              <Tooltip content={<RadarTooltip />} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Row 2: Category breakdown (7 cards in grid) ─────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-wider">
            Category Breakdown
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Click any card to expand parameter details
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
  );
};

export default DGCAAuditDashboard;