// src/pages/Reports.tsx
// Monthly DGCA Reports Hub
// Route: /reports

import {
  BarChart2, CheckSquare, ChevronLeft, ChevronRight,
  Download, Loader2, Plane, Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client'; // Global Axios client with interceptors

import type {
  AircraftUtilizationReport, AircraftUtilRow,
  InstructorUtilRow, InstructorUtilizationReport,
  ReportType, SPLReport, SPLStudent,
  TraineeHoursReport, TraineeHoursRow,
} from '../types/audit';


// ── Month navigator ────────────────────────────────────────────────────────────
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

interface MonthPickerProps {
  year: number;
  month: number;
  onChange: (y: number, m: number) => void;
}

const MonthPicker: React.FC<MonthPickerProps> = ({ year, month, onChange }) => {
  const prev = () => {
    if (month === 1) onChange(year - 1, 12);
    else              onChange(year, month - 1);
  };
  const next = () => {
    const now = new Date();
    if (year === now.getFullYear() && month === now.getMonth() + 1) return;
    if (month === 12) onChange(year + 1, 1);
    else               onChange(year, month + 1);
  };

  return (
    <div className="flex items-center gap-3">
      <button onClick={prev}
        className="p-1.5 rounded text-gray-500 hover:text-amber-400 hover:bg-gray-800 transition-colors">
        <ChevronLeft size={16} />
      </button>
      <span className="text-sm font-mono font-semibold text-gray-200 w-36 text-center">
        {MONTHS[month - 1]} {year}
      </span>
      <button onClick={next}
        className="p-1.5 rounded text-gray-500 hover:text-amber-400 hover:bg-gray-800 transition-colors">
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

// ── Colour helpers ────────────────────────────────────────────────────────────
const utilColour = (pct: number) =>
  pct >= 75 ? '#22c55e' : pct >= 50 ? '#f5a623' : pct >= 25 ? '#f97316' : '#ef4444';

const fdtlColour = (pct: number) =>
  pct >= 90 ? '#ef4444' : pct >= 75 ? '#f97316' : pct >= 50 ? '#f5a623' : '#22c55e';

// ── Shared table wrapper ──────────────────────────────────────────────────────
const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-x-auto rounded-xl border border-gray-800">
    <table className="w-full text-sm">{children}</table>
  </div>
);
const Th: React.FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2.5 text-left text-[10px] font-mono text-gray-500
                  tracking-widest uppercase bg-[#111827] border-b border-gray-800
                  ${right ? 'text-right' : ''}`}>
    {children}
  </th>
);
const Td: React.FC<{ children: React.ReactNode; right?: boolean; mono?: boolean }> = ({
  children, right, mono,
}) => (
  <td className={`px-3 py-2.5 border-b border-gray-800 text-gray-300
                  ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''}`}>
    {children}
  </td>
);

// ── 1. SPL Report ─────────────────────────────────────────────────────────────
const SPLReportView: React.FC<{ data: SPLReport }> = ({ data }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-[#111827] border border-amber-500/30 rounded-xl p-4 text-center">
        <p className="text-4xl font-mono font-bold text-amber-400">{data.total_spls_issued}</p>
        <p className="text-xs text-gray-500 mt-1 font-mono tracking-widest uppercase">
          SPLs Issued
        </p>
      </div>
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4 text-center sm:col-span-2">
        <p className="text-xs text-gray-600 font-mono">Period: {MONTHS[data.month - 1]} {data.year}</p>
        <p className="text-xs text-gray-500 mt-1">
          Student Pilot Licences issued by this FTO during the reporting month.
        </p>
      </div>
    </div>

    {data.students.length > 0 ? (
      <Table>
        <thead>
          <tr>
            <Th>#</Th>
            <Th>Student Name</Th>
            <Th>Enrolment No.</Th>
            <Th>SPL No.</Th>
            <Th>Issued Date</Th>
            <Th>Expiry</Th>
            <Th>Assigned Instructor</Th>
          </tr>
        </thead>
        <tbody>
          {data.students.map((s: SPLStudent, i: number) => (
            <tr key={s.student_id} className="hover:bg-gray-800/30 transition-colors">
              <Td mono>{i + 1}</Td>
              <Td>{s.name}</Td>
              <Td mono>{s.enrollment_no}</Td>
              <Td mono>{s.spl_number}</Td>
              <Td mono>{s.spl_issued_date}</Td>
              <Td mono>
                <span className={
                  new Date(s.spl_expiry) < new Date()
                    ? 'text-red-400' : 'text-green-400'
                }>
                  {s.spl_expiry}
                </span>
              </Td>
              <Td>{s.instructor}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    ) : (
      <div className="text-center py-12 text-gray-600">
        <CheckSquare size={28} className="mx-auto mb-2 opacity-40" />
        <p>No SPLs issued in {MONTHS[data.month - 1]} {data.year}</p>
      </div>
    )}
  </div>
);

// ── 2. Aircraft Utilisation ───────────────────────────────────────────────────
const AircraftUtilView: React.FC<{ data: AircraftUtilizationReport }> = ({ data }) => {
  const chartData = data.aircraft.map(a => ({
    name: a.registration,
    Actual: a.actual_hours,
    Available: a.available_hours - a.actual_hours,
    pct: a.utilization_pct,
  }));

  return (
    <div className="space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Fleet Utilisation',  value: `${data.fleet_utilization_pct}%`,  colour: utilColour(data.fleet_utilization_pct) },
          { label: 'Total Flying Hours', value: `${data.total_actual_hours} hr`,    colour: '#f5a623' },
          { label: 'Available Hours',    value: `${data.total_available_hours} hr`, colour: '#6b7280' },
          { label: 'Total Flights',      value: data.total_flights,                 colour: '#f5a623' },
        ].map(s => (
          <div key={s.label} className="bg-[#111827] border border-gray-800 rounded-xl p-3 text-center">
            <p className="text-xl font-mono font-bold" style={{ color: s.colour }}>{s.value}</p>
            <p className="text-[10px] text-gray-600 mt-0.5 font-mono">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-[#111827] border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-mono text-gray-500 mb-3 tracking-widest uppercase">
          Aircraft Hours – Actual vs Available
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10, fontFamily: 'monospace' }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#f5a623', fontFamily: 'monospace' }}
              itemStyle={{ color: '#9ca3af', fontFamily: 'monospace' }}
            />
            <Bar dataKey="Actual" stackId="a" radius={[0, 0, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={utilColour(entry.pct)} />
              ))}
            </Bar>
            <Bar dataKey="Available" stackId="a" fill="#1e2a3a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail table */}
      <Table>
        <thead>
          <tr>
            <Th>Registration</Th>
            <Th>Type</Th>
            <Th>Base</Th>
            <Th>Status</Th>
            <Th right>Avail. (hr)</Th>
            <Th right>Actual (hr)</Th>
            <Th right>Flights</Th>
            <Th right>Util %</Th>
          </tr>
        </thead>
        <tbody>
          {data.aircraft.map((a: AircraftUtilRow) => (
            <tr key={a.aircraft_id} className="hover:bg-gray-800/30 transition-colors">
              <Td mono>
                <span className="text-amber-400 font-semibold">{a.registration}</span>
              </Td>
              <Td mono>{a.aircraft_type}</Td>
              <Td>{a.base}</Td>
              <Td>
                <span className={`text-xs font-mono px-1.5 py-0.5 rounded
                  ${a.status === 'AOG'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-green-500/20 text-green-400'}`}>
                  {a.status}
                </span>
              </Td>
              <Td right mono>{a.available_hours}</Td>
              <Td right mono>{a.actual_hours}</Td>
              <Td right mono>{a.total_flights}</Td>
              <Td right mono>
                <span style={{ color: utilColour(a.utilization_pct) }}>
                  {a.utilization_pct}%
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

// ── 3. Instructor Utilisation ─────────────────────────────────────────────────
const InstructorUtilView: React.FC<{ data: InstructorUtilizationReport }> = ({ data }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Flying Hours', value: `${data.total_flying_hours} hr`, colour: '#f5a623' },
        { label: 'Dual Hours',         value: `${data.total_dual_hours} hr`,   colour: '#60a5fa' },
        { label: 'Check Hours',        value: `${data.total_check_hours} hr`,  colour: '#a78bfa' },
        { label: 'Total Duty Hours',   value: `${data.total_duty_hours} hr`,   colour: '#6b7280' },
      ].map(s => (
        <div key={s.label} className="bg-[#111827] border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-xl font-mono font-bold" style={{ color: s.colour }}>{s.value}</p>
          <p className="text-[10px] text-gray-600 mt-0.5 font-mono">{s.label}</p>
        </div>
      ))}
    </div>

    <Table>
      <thead>
        <tr>
          <Th>Instructor</Th>
          {/* <Th>Rating</Th> */}
          <Th right>Dual hr</Th>
          <Th right>Check hr</Th>
          <Th right>Total Fly hr</Th>
          <Th right>Duty hr</Th>
          <Th right>FDTL Fly %</Th>
          <Th right>FDTL Duty %</Th>
          {/* <Th right>Students</Th> */}
          <Th right>Flights</Th>
        </tr>
      </thead>
      <tbody>
        {data.instructors.map((ins: InstructorUtilRow) => (
          <tr key={ins.instructor_id} className="hover:bg-gray-800/30 transition-colors">
            <Td>
              <p className="text-gray-200 font-medium">{ins.name}</p>
              <p className="text-[10px] text-gray-600 font-mono">{ins.employee_id}</p>
            </Td>
            {/* <Td mono>{ins.rating}</Td> */}
            <Td right mono>{ins.dual_hours}</Td>
            <Td right mono>{ins.check_hours}</Td>
            <Td right mono>
              <span className="text-amber-400 font-semibold">{ins.total_flying_hrs}</span>
            </Td>
            <Td right mono>{ins.duty_hours}</Td>
            <Td right mono>
              <span style={{ color: fdtlColour(ins.fdtl_flying_pct) }}>
                {ins.fdtl_flying_pct}%
              </span>
            </Td>
            <Td right mono>
              <span style={{ color: fdtlColour(ins.fdtl_duty_pct) }}>
                {ins.fdtl_duty_pct}%
              </span>
            </Td>
            {/* <Td right mono>{ins.active_students}</Td>
            <Td right mono>{ins.total_flights}</Td> */}
          </tr>
        ))}
      </tbody>
    </Table>
    <p className="text-[10px] text-gray-600 font-mono">
      FDTL limits: flying {data.monthly_flying_limit} hr / month · duty {data.monthly_duty_limit} hr / month
    </p>
  </div>
);

// ── 4. Trainee Hours ──────────────────────────────────────────────────────────
const TraineeHoursView: React.FC<{ data: TraineeHoursReport }> = ({ data }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {[
        { label: 'Total Hours',     value: `${data.month_total_hours} hr`, colour: '#f5a623' },
        { label: 'DUAL',            value: `${data.month_dual_hours} hr`,  colour: '#60a5fa' },
        { label: 'SOLO',            value: `${data.month_solo_hours} hr`,  colour: '#22c55e' },
        // { label: 'IFOX',            value: `${data.month_ifox_hours} hr`,  colour: '#a78bfa' },
        { label: 'CHECK',           value: `${data.month_check_hours} hr`, colour: '#f97316' },
      ].map(s => (
        <div key={s.label} className="bg-[#111827] border border-gray-800 rounded-xl p-3 text-center">
          <p className="text-lg font-mono font-bold" style={{ color: s.colour }}>{s.value}</p>
          <p className="text-[10px] text-gray-600 mt-0.5 font-mono">{s.label}</p>
        </div>
      ))}
    </div>

    <Table>
      <thead>
        <tr>
          <Th>#</Th>
          <Th>Student</Th>
          {/* <Th>Instructor</Th> */}
          <Th right>DUAL</Th>
          <Th right>SOLO</Th>
          {/* <Th right>IFOX</Th> */}
          <Th right>CHECK</Th>
          <Th right>Month Total</Th>
          <Th right>Cumulative</Th>
          <Th right>Progress</Th>
        </tr>
      </thead>
      <tbody>
        {data.students.map((s: TraineeHoursRow, i: number) => (
          <tr key={s.student_id} className="hover:bg-gray-800/30 transition-colors">
            <Td mono>{i + 1}</Td>
            <Td>
              <p className="text-gray-200 font-medium">{s.name}</p>
              <p className="text-[10px] text-gray-600 font-mono">{s.enrollment_no} · {s.course_type}</p>
            </Td>
            {/* <Td>{s.instructor}</Td> */}
            <Td right mono>{s.month_dual_hours}</Td>
            <Td right mono>{s.month_solo_hours}</Td>
            {/* <Td right mono>{s.month_ifox_hours}</Td> */}
            <Td right mono>{s.month_check_hours}</Td>
            <Td right mono>
              <span className="text-amber-400 font-semibold">{s.month_total_hours}</span>
            </Td>
            <Td right mono>{s.cumulative_hours}</Td>
            <Td right>
              <div className="flex items-center justify-end gap-2">
                <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${s.progress_pct}%`,
                      backgroundColor: s.progress_pct >= 75 ? '#22c55e'
                        : s.progress_pct >= 50 ? '#f5a623' : '#6b7280',
                    }}
                  />
                </div>
                <span className="text-xs font-mono text-gray-400">{s.progress_pct}%</span>
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  </div>
);

// ── Report type selector cards ────────────────────────────────────────────────
interface ReportCard {
  type: ReportType;
  label: string;
  description: string;
  icon: React.ElementType;
}

const REPORT_CARDS: ReportCard[] = [
  {
    type: 'spl-monthly',
    label: 'SPL Issuance',
    description: 'Student Pilot Licences issued during the month',
    icon: CheckSquare,
  },
  {
    type: 'aircraft-utilization',
    label: 'Aircraft Utilisation',
    description: 'Fleet flying hours vs available hours per aircraft',
    icon: Plane,
  },
  {
    type: 'instructor-utilization',
    label: 'Instructor Utilisation',
    description: 'Flying duty, FDTL compliance and student load per instructor',
    icon: Users,
  },
  {
    type: 'trainee-hours',
    label: 'Trainee Flying Hours',
    description: 'Monthly and cumulative hours per student by flight type',
    icon: BarChart2,
  },
];

// ── Main Reports page ─────────────────────────────────────────────────────────
const Reports: React.FC = () => {
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [activeType, setActiveType] = useState<ReportType>('trainee-hours');

  const reportUrl = `compliance/reports/${activeType}/?year=${year}&month=${month}`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['report', activeType, year, month],
    queryFn: async () => {
      const res = await apiClient.get(reportUrl);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const renderReport = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-amber-400 mr-3" />
          <span className="text-gray-500 font-mono text-sm">Generating report…</span>
        </div>
      );
    }
    if (isError) {
      return (
        <div className="text-center py-16 text-red-400">
          <p className="font-mono text-sm">Error: {String(error)}</p>
        </div>
      );
    }
    if (!data) return null;

    switch (activeType) {
      case 'spl-monthly':
        return <SPLReportView data={data as SPLReport} />;
      case 'aircraft-utilization':
        return <AircraftUtilView data={data as AircraftUtilizationReport} />;
      case 'instructor-utilization':
        return <InstructorUtilView data={data as InstructorUtilizationReport} />;
      case 'trainee-hours':
        return <TraineeHoursView data={data as TraineeHoursReport} />;
    }
  };

  const activeCard = REPORT_CARDS.find(c => c.type === activeType)!;

  return (
    <div className="min-h-screen bg-[#0B1017] text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[10px] font-mono text-gray-600 tracking-widest uppercase">
              DGCA FTO · VAAW Amravati
            </p>
            <h1 className="text-xl font-bold text-gray-100">Monthly Reports</h1>
          </div>
          <div className="flex items-center gap-4">
            <MonthPicker year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
            <button
              onClick={() => {
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href     = url;
                a.download = `${activeType}-${year}-${String(month).padStart(2, '0')}.json`;
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="flex items-center gap-1.5 text-xs font-mono text-gray-500
                         hover:text-amber-400 border border-gray-700 hover:border-amber-500/40
                         rounded-lg px-3 py-1.5 transition-colors"
              disabled={!data}
            >
              <Download size={13} /> Export JSON
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Report type selector */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {REPORT_CARDS.map(card => {
            const Icon    = card.icon;
            const active  = card.type === activeType;
            return (
              <button
                key={card.type}
                onClick={() => setActiveType(card.type)}
                className={`text-left p-4 rounded-xl border transition-all
                  ${active
                    ? 'bg-amber-500/10 border-amber-500/50'
                    : 'bg-[#111827] border-gray-800 hover:border-gray-700'
                  }`}
              >
                <Icon size={18} className={active ? 'text-amber-400' : 'text-gray-500'} />
                <p className={`text-sm font-semibold mt-2 ${active ? 'text-amber-400' : 'text-gray-300'}`}>
                  {card.label}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5 leading-tight">
                  {card.description}
                </p>
              </button>
            );
          })}
        </div>

        {/* Report content */}
        <div className="bg-[#111827] border border-gray-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-5 border-b border-gray-800 pb-4">
            <activeCard.icon size={16} className="text-amber-400" />
            <h2 className="text-sm font-semibold text-gray-200">{activeCard.label} Report</h2>
            <span className="text-xs text-gray-600 font-mono ml-2">
              {MONTHS[month - 1]} {year}
            </span>
          </div>
          {renderReport()}
        </div>

      </div>
    </div>
  );
};

export default Reports;