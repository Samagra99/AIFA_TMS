// src/components/audit/AlertsPanel.tsx
// Compliance alert feed for the DGCA Audit Dashboard.

import {
  AlertTriangle, CheckCheck, Clock,
  Info, Radio, XCircle,
} from 'lucide-react';
import React, { useState } from 'react';
import type { AlertCategory, AlertSeverity, ComplianceAlert } from '../../types/audit';

// ── Severity styling ──────────────────────────────────────────────────────────
const SEVERITY_META: Record<AlertSeverity, {
  icon: React.ElementType;
  bg: string;
  border: string;
  text: string;
  label: string;
}> = {
  critical: {
    icon: XCircle,
    bg: 'bg-red-500/10 dark:bg-red-950/40',
    border: 'border-red-500/30 dark:border-red-800/40',
    text: 'text-red-600 dark:text-red-400',
    label: 'CRITICAL',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10 dark:bg-amber-950/40',
    border: 'border-amber-500/30 dark:border-amber-800/40',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'WARNING',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/10 dark:bg-blue-950/40',
    border: 'border-blue-500/30 dark:border-blue-800/40',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'INFO',
  },
};

const CATEGORY_LABELS: Record<AlertCategory, string> = {
  medical:       'Medical',
  aircraft:      'Aircraft',
  fdtl:          'FDTL',
  spl:           'SPL / Exams',
  training:      'Training',
  documentation: 'Docs',
  safety:        'Safety',
  maintenance:   'Maintenance',
};

function timeAgo(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Single alert row ──────────────────────────────────────────────────────────
interface AlertRowProps {
  alert: ComplianceAlert;
  onResolve: (id: number) => void;
  resolving: boolean;
}

const AlertRow: React.FC<AlertRowProps> = ({ alert, onResolve, resolving }) => {
  const meta = SEVERITY_META[alert.severity];
  const Icon = meta.icon;

  return (
    <div className={`flex gap-3 p-3 rounded-lg border ${meta.bg} ${meta.border}
                     transition-opacity ${resolving ? 'opacity-50' : ''}`}>
      <Icon size={16} className={`${meta.text} shrink-0 mt-0.5`} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold tracking-widest ${meta.text}`}>
            {meta.label}
          </span>
          <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded">
            {CATEGORY_LABELS[alert.category]}
          </span>
          {alert.entity_name && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
              {alert.entity_name}
            </span>
          )}
        </div>

        <p className="text-sm text-slate-900 dark:text-white mt-0.5 font-medium">{alert.title}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">{alert.description}</p>

        <div className="flex items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            <Clock size={9} /> {timeAgo(alert.created_at)}
          </span>
          {alert.due_date && (
            <span className="text-[10px] text-orange-600 dark:text-orange-400 font-semibold">
              Due {new Date(alert.due_date).toLocaleDateString('en-IN')}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onResolve(alert.id)}
        disabled={resolving}
        className="shrink-0 flex items-center gap-1 text-[10px] font-semibold
                   text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 border border-slate-300 dark:border-slate-600
                   hover:border-emerald-500 rounded px-2 py-1
                   transition-colors disabled:opacity-40"
        title="Resolve alert"
      >
        <CheckCheck size={11} />
        Resolve
      </button>
    </div>
  );
};

// ── Main alerts panel ─────────────────────────────────────────────────────────
interface AlertsPanelProps {
  alerts: ComplianceAlert[];
  isLoading?: boolean;
  onResolve: (id: number) => void;
  resolvingIds?: Set<number>;
}

type FilterSeverity = 'all' | AlertSeverity;

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  isLoading,
  onResolve,
  resolvingIds = new Set(),
}) => {
  const [filter, setFilter] = useState<FilterSeverity>('all');

  const counts = {
    critical: alerts.filter(a => a.severity === 'critical').length,
    warning:  alerts.filter(a => a.severity === 'warning').length,
    info:     alerts.filter(a => a.severity === 'info').length,
  };

  const visible = filter === 'all'
    ? alerts
    : alerts.filter(a => a.severity === filter);

  const sorted = [...visible].sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    if (order[a.severity] !== order[b.severity])
      return order[a.severity] - order[b.severity];
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const tabs: Array<{ key: FilterSeverity; label: string; count: number; colour: string }> = [
    { key: 'all',      label: 'All',      count: alerts.length, colour: 'text-slate-600 dark:text-slate-300' },
    { key: 'critical', label: 'Critical', count: counts.critical, colour: 'text-red-600 dark:text-red-400' },
    { key: 'warning',  label: 'Warnings', count: counts.warning,  colour: 'text-amber-600 dark:text-amber-400' },
    { key: 'info',     label: 'Info',     count: counts.info,     colour: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Radio size={15} className="text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white tracking-wide">
            COMPLIANCE ALERTS
          </h3>
          {isLoading && (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`text-xs px-2.5 py-1 rounded-lg transition-colors font-medium
                ${filter === t.key
                  ? 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
            >
              <span className={t.key !== 'all' ? t.colour : ''}>{t.label}</span>
              {t.count > 0 && (
                <span className="ml-1 text-slate-400">({t.count})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Alert list */}
      <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-slate-400 dark:text-slate-500">
            <CheckCheck size={28} className="mb-2 text-emerald-500" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No active alerts</p>
            <p className="text-xs mt-1">
              {filter !== 'all' ? `No ${filter} alerts` : 'All compliance checks passing'}
            </p>
          </div>
        ) : (
          sorted.map(alert => (
            <AlertRow
              key={alert.id}
              alert={alert}
              onResolve={onResolve}
              resolving={resolvingIds.has(alert.id)}
            />
          ))
        )}
      </div>

      {alerts.length > 8 && (
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Showing all {sorted.length} alerts
          </p>
        </div>
      )}
    </div>
  );
};

export default AlertsPanel;
