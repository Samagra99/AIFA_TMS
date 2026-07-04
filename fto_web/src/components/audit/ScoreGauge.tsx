// src/components/audit/ScoreGauge.tsx
// Aviation-styled semi-circular arc gauge for the DGCA 100-point score.

import React, { useMemo } from 'react';
import type { AuditRating } from '../../types/audit';

interface ScoreGaugeProps {
  score: number;          // 0–100
  maxScore?: number;      // default 100
  rating: AuditRating;
  ratingLabel: string;
  ratingColor: string;    // hex, from API
  asOf?: string;          // ISO timestamp
  size?: number;          // SVG canvas size in px (default 320)
}

const RATING_COLOURS: Record<AuditRating, string> = {
  excellent:     '#22c55e',
  good:          '#f5a623',
  satisfactory:  '#f97316',
  unsatisfactory:'#ef4444',
};

// Render a tick mark at each 10-point interval on the track
const TICK_VALUES = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  maxScore = 100,
  rating,
  ratingLabel,
  ratingColor,
  asOf,
  size = 320,
}) => {
  const cx = size / 2;
  const cy = size / 2;
  const R  = size * 0.38;        // arc radius
  const trackWidth = size * 0.065;

  const colour = RATING_COLOURS[rating] ?? ratingColor;

  // ── Arc math (semi-circle: 180° left → 0° right through TOP) ────────────
  // Standard trig: x = cx + R·cos(θ), y = cy − R·sin(θ)
  // θ = π  →  left point (0 %)
  // θ = 0  →  right point (100 %)
  // θ = π·(1 − pct/100)  →  intermediate points

  const pctSafe = Math.max(0, Math.min(score / maxScore, 1));

  const arcPoint = (fraction: number) => {
    const theta = Math.PI * (1 - fraction);
    return {
      x: cx + R * Math.cos(theta),
      y: cy - R * Math.sin(theta),
    };
  };

  const trackStart = arcPoint(0);
  const trackEnd   = arcPoint(1);

  const scoreEnd   = arcPoint(pctSafe);
  const isLargeArc = pctSafe > 0.5 ? 1 : 0;

  const trackPath = `M ${trackStart.x.toFixed(2)} ${trackStart.y.toFixed(2)} A ${R} ${R} 0 0 0 ${trackEnd.x.toFixed(2)} ${trackEnd.y.toFixed(2)}`;
  const scorePath = pctSafe > 0.001
    ? `M ${trackStart.x.toFixed(2)} ${trackStart.y.toFixed(2)} A ${R} ${R} 0 ${isLargeArc} 0 ${scoreEnd.x.toFixed(2)} ${scoreEnd.y.toFixed(2)}`
    : '';

  // ── Tick marks ────────────────────────────────────────────────────────────
  const ticks = useMemo(() => {
    const innerR = R - trackWidth / 2 - 4;
    const outerR = R + trackWidth / 2 + 4;
    return TICK_VALUES.map((v) => {
      const frac  = v / 100;
      const theta = Math.PI * (1 - frac);
      const cos   = Math.cos(theta);
      const sin   = Math.sin(theta);
      const isMajor = v % 20 === 0;
      return {
        v,
        x1: (cx + innerR * cos).toFixed(2),
        y1: (cy - innerR * sin).toFixed(2),
        x2: (cx + outerR * cos).toFixed(2),
        y2: (cy - outerR * sin).toFixed(2),
        // label position – outside the arc
        lx: (cx + (outerR + 14) * cos).toFixed(2),
        ly: (cy - (outerR + 14) * sin).toFixed(2),
        isMajor,
      };
    });
  }, [cx, cy, R, trackWidth]);

  // ── Rating zone backgrounds (red/amber/green bands on track) ─────────────
  const zones = [
    { from: 0,  to: 0.60, colour: '#3f1213' },
    { from: 0.60, to: 0.75, colour: '#3d2808' },
    { from: 0.75, to: 0.90, colour: '#2d3a12' },
    { from: 0.90, to: 1.00, colour: '#123a1e' },
  ];

  const zonePath = (from: number, to: number) => {
    const s = arcPoint(from);
    const e = arcPoint(to);
    const large = (to - from) > 0.5 ? 1 : 0;
    return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${large} 0 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
  };

  const asOfStr = asOf
    ? new Date(asOf).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
    : null;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${size} ${size * 0.62}`}
        className="w-full max-w-xs sm:max-w-sm"
        aria-label={`DGCA FTO Score: ${Math.round(score)} out of ${maxScore} – ${ratingLabel}`}
      >
        {/* ── Zone bands (subtle coloured background on track) ───────────── */}
        {zones.map((z) => (
          <path
            key={z.from}
            d={zonePath(z.from, z.to)}
            fill="none"
            stroke={z.colour}
            strokeWidth={trackWidth + 6}
            strokeLinecap="butt"
          />
        ))}

        {/* ── Track (grey) ────────────────────────────────────────────────── */}
        <path
          d={trackPath}
          fill="none"
          stroke="#1e2a3a"
          strokeWidth={trackWidth}
          strokeLinecap="round"
        />

        {/* ── Tick marks ──────────────────────────────────────────────────── */}
        {ticks.map((t) => (
          <g key={t.v}>
            <line
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.isMajor ? '#4b5563' : '#2d3748'}
              strokeWidth={t.isMajor ? 2 : 1}
            />
            {t.isMajor && (
              <text
                x={t.lx} y={t.ly}
                textAnchor="middle" dominantBaseline="middle"
                fill="#4b5563" fontSize={size * 0.038}
                fontFamily="ui-monospace, monospace"
              >
                {t.v}
              </text>
            )}
          </g>
        ))}

        {/* ── Score arc ───────────────────────────────────────────────────── */}
        {scorePath && (
          <path
            d={scorePath}
            fill="none"
            stroke={colour}
            strokeWidth={trackWidth}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 8px ${colour}88)` }}
          />
        )}

        {/* ── Needle dot at score position ─────────────────────────────────── */}
        {pctSafe > 0.001 && (
          <circle
            cx={scoreEnd.x}
            cy={scoreEnd.y}
            r={trackWidth / 2 + 3}
            fill={colour}
            stroke="#0B1017"
            strokeWidth={2}
            style={{ filter: `drop-shadow(0 0 6px ${colour})` }}
          />
        )}

        {/* ── Central score display ────────────────────────────────────────── */}
        <text
          x={cx} y={cy - size * 0.06}
          textAnchor="middle"
          fill={colour}
          fontSize={size * 0.2}
          fontWeight="bold"
          fontFamily="ui-monospace, monospace"
          style={{ filter: `drop-shadow(0 0 12px ${colour}66)` }}
        >
          {Math.round(score)}
        </text>

        <text
          x={cx} y={cy + size * 0.08}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={size * 0.055}
          fontFamily="ui-monospace, monospace"
        >
          / {maxScore} pts
        </text>

        {/* ── Rating label ─────────────────────────────────────────────────── */}
        <text
          x={cx} y={cy + size * 0.165}
          textAnchor="middle"
          fill={colour}
          fontSize={size * 0.065}
          fontWeight="600"
          letterSpacing="0.1em"
          style={{ textTransform: 'uppercase' }}
        >
          {ratingLabel.toUpperCase()}
        </text>

        {/* ── Rating scale labels on arc ends ──────────────────────────────── */}
        <text x={trackStart.x - 6} y={trackStart.y + 4}
          textAnchor="end" fill="#ef4444" fontSize={size * 0.042}
          fontFamily="ui-monospace, monospace">0</text>
        <text x={trackEnd.x + 6} y={trackEnd.y + 4}
          textAnchor="start" fill="#22c55e" fontSize={size * 0.042}
          fontFamily="ui-monospace, monospace">100</text>
      </svg>

      {/* ── Timestamp below gauge ────────────────────────────────────────── */}
      {asOfStr && (
        <p className="text-xs text-gray-600 mt-1 font-mono tracking-wide">
          LIVE · {asOfStr}
        </p>
      )}
    </div>
  );
};

export default ScoreGauge;
