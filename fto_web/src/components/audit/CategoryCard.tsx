// src/components/audit/CategoryCard.tsx
// Expandable card for one DGCA audit category with per-parameter detail.

import {
  Building2, FileText, GraduationCap, IdCard,
  LayoutDashboard, Plane, ShieldCheck, ChevronDown,
  ChevronUp, CheckCircle2, AlertTriangle, XCircle,
  Zap, PenLine,
} from 'lucide-react';
import React, { useState } from 'react';
import type { LiveCategoryScore, LiveParameterScore } from '../../types/audit';

// ── Icon map ─────────────────────────────────────────────────────────────────
const ICONS: Record<string, React.ElementType> = {
  Building2, GraduationCap, Plane, IdCard,
  ShieldCheck, FileText, LayoutDashboard,
};

function getCategoryIcon(iconName: string) {
  const Icon = ICONS[iconName] ?? Building2;
  return Icon;
}

// ── Parameter status indicator ────────────────────────────────────────────────
function paramColour(pct: number): string {
  if (pct >= 90) return 'text-green-400';
  if (pct >= 70) return 'text-amber-400';
  if (pct >= 50) return 'text-orange-400';
  return 'text-red-400';
}

function ParamRow({ p }: { p: LiveParameterScore }) {
  const pct    = p.max_score > 0 ? (p.score / p.max_score) * 100 : 0;
  const colour = paramColour(pct);
  const barW   = Math.round(pct);

  return (
    <div className="py-2 border-b border-gray-800 last:border-0">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* auto vs manual badge */}
          {p.auto ? (
            <Zap size={11} className="shrink-0 text-amber-500" />
          ) : (
            <PenLine size={11} className="shrink-0 text-gray-500" />
          )}
          <span className="text-xs text-gray-400 font-mono shrink-0">{p.code}</span>
          <span className="text-xs text-gray-300 truncate">{p.name}</span>
        </div>
        <span className={`text-xs font-mono font-semibold shrink-0 ${colour}`}>
          {p.score}/{p.max_score}
        </span>
      </div>

      {/* mini progress bar */}
      <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-1">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${barW}%`,
            backgroundColor:
              pct >= 90 ? '#22c55e'
              : pct >= 70 ? '#f5a623'
              : pct >= 50 ? '#f97316'
              : '#ef4444',
          }}
        />
      </div>

      {/* detail text */}
      <p className="text-[10px] text-gray-600 font-mono leading-tight pl-4">{p.detail}</p>
    </div>
  );
}

// ── Main category card ────────────────────────────────────────────────────────
interface CategoryCardProps {
  category: LiveCategoryScore;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({ category }) => {
  const [expanded, setExpanded] = useState(false);

  const pct    = category.max_score > 0
    ? (category.score / category.max_score) * 100
    : 0;
  const Icon   = getCategoryIcon(category.icon);

  // Card border colour based on percentage
  const borderColour =
    pct >= 90 ? 'border-green-500/40'
    : pct >= 75 ? 'border-amber-500/40'
    : pct >= 60 ? 'border-orange-500/40'
    : 'border-red-500/40';

  const arcColour =
    pct >= 90 ? '#22c55e'
    : pct >= 75 ? '#f5a623'
    : pct >= 60 ? '#f97316'
    : '#ef4444';

  // Issues count
  const issues = category.parameters.filter(p => {
    const pp = p.max_score > 0 ? (p.score / p.max_score) * 100 : 0;
    return pp < 75;
  }).length;

  return (
    <div
      className={`bg-[#111827] border ${borderColour} rounded-xl overflow-hidden
                  transition-all duration-200 hover:border-opacity-80`}
    >
      {/* ── Card header ───────────────────────────────────────────────────── */}
      <div
        className="p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
        role="button"
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: icon + name */}
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="p-2 rounded-lg shrink-0"
              style={{ backgroundColor: `${arcColour}18` }}
            >
              <Icon size={18} style={{ color: arcColour }} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 font-mono">{category.code}</span>
                {issues > 0 && (
                  <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full font-mono">
                    {issues} issue{issues > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-200 font-medium truncate">{category.name}</p>
            </div>
          </div>

          {/* Right: score + chevron */}
          <div className="flex items-center gap-3 shrink-0">
            {/* circular mini-gauge */}
            <div className="relative w-12 h-12">
              <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
                <circle cx="20" cy="20" r="16" fill="none"
                  stroke="#1e2a3a" strokeWidth="5" />
                <circle cx="20" cy="20" r="16" fill="none"
                  stroke={arcColour} strokeWidth="5"
                  strokeDasharray={`${(pct / 100) * 100.53} 100.53`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dasharray 1s ease' }} />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center
                               text-[10px] font-mono font-bold"
                style={{ color: arcColour }}>
                {Math.round(pct)}
              </span>
            </div>

            <div className="text-right">
              <p className="text-lg font-mono font-bold" style={{ color: arcColour }}>
                {category.score.toFixed(1)}
              </p>
              <p className="text-xs text-gray-600 font-mono">/ {category.max_score}</p>
            </div>

            {expanded
              ? <ChevronUp size={16} className="text-gray-500" />
              : <ChevronDown size={16} className="text-gray-500" />}
          </div>
        </div>

        {/* ── Progress bar ─────────────────────────────────────────────────── */}
        <div className="mt-3 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${pct}%`, backgroundColor: arcColour }}
          />
        </div>
      </div>

      {/* ── Expandable parameter list ──────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-2">
          {category.parameters.map((p) => (
            <ParamRow key={p.code} p={p} />
          ))}
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-800 text-[10px] text-gray-600">
            <span className="flex items-center gap-1">
              <Zap size={9} className="text-amber-500" /> Auto-scored
            </span>
            <span className="flex items-center gap-1">
              <PenLine size={9} className="text-gray-500" /> Manual entry
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryCard;
