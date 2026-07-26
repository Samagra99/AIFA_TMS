import {
  BarChart2, CheckSquare, Download, FileText, Plane, Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/api/client';
import { Card, Button, PageLoader, Badge } from '@/components/ui';

import type {
  AircraftUtilizationReport, AircraftUtilRow,
  InstructorUtilRow, InstructorUtilizationReport,
  ReportType, SPLReport, SPLStudent,
  TraineeHoursReport, TraineeHoursRow,
} from '../types/audit';

// ── Month navigator ────────────────────────────────────────────────────────────
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

import dayjs from 'dayjs';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({ startDate, endDate, onChange }) => {
  const setPreset = (preset: 'this_month' | 'last_month' | 'last_30' | 'qtd' | 'ytd') => {
    const today = dayjs();
    if (preset === 'this_month') {
      onChange(today.startOf('month').format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
    } else if (preset === 'last_month') {
      const lm = today.subtract(1, 'month');
      onChange(lm.startOf('month').format('YYYY-MM-DD'), lm.endOf('month').format('YYYY-MM-DD'));
    } else if (preset === 'last_30') {
      onChange(today.subtract(30, 'day').format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
    } else if (preset === 'qtd') {
      const qMonth = Math.floor(today.month() / 3) * 3;
      onChange(today.month(qMonth).startOf('month').format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
    } else if (preset === 'ytd') {
      onChange(today.startOf('year').format('YYYY-MM-DD'), today.format('YYYY-MM-DD'));
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
        {[
          { key: 'this_month', label: 'This Month' },
          { key: 'last_month', label: 'Last Month' },
          { key: 'last_30', label: 'Last 30 Days' },
          { key: 'qtd', label: 'QTD' },
          { key: 'ytd', label: 'YTD' },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPreset(p.key as any)}
            className="px-2 py-1 text-xs font-semibold rounded-md text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm transition-all"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1">
        <input
          type="date"
          value={startDate}
          onChange={e => onChange(e.target.value, endDate)}
          className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
        />
        <span className="text-slate-400 text-xs font-medium">to</span>
        <input
          type="date"
          value={endDate}
          onChange={e => onChange(startDate, e.target.value)}
          className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none"
        />
      </div>
    </div>
  );
};

// ── Colour helpers ────────────────────────────────────────────────────────────
const utilColour = (pct: number) =>
  pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : pct >= 25 ? '#f97316' : '#ef4444';

const fdtlColour = (pct: number) =>
  pct >= 90 ? '#ef4444' : pct >= 75 ? '#f97316' : pct >= 50 ? '#f59e0b' : '#10b981';

function exportReportToCSV(activeType: ReportType, data: any, startDate: string, endDate: string) {
  if (!data) return;

  let headers: string[] = [];
  let rows: string[][] = [];
  let title = '';

  const escapeCSV = (val: any) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  if (activeType === 'spl-monthly') {
    title = `SPL Issuance Report (${startDate} to ${endDate})`;
    headers = ['#', 'Student Name', 'Enrollment No', 'SPL Number', 'Issued Date', 'Expiry Date', 'Instructor'];
    const students: SPLStudent[] = data.students || [];
    rows = students.map((s, idx) => [
      String(idx + 1),
      s.name || '',
      s.enrollment_no || '',
      s.spl_number || '',
      s.spl_issued_date || '',
      s.spl_expiry || '',
      s.instructor || '',
    ]);
  } else if (activeType === 'aircraft-utilization') {
    title = `Aircraft Utilisation Report (${startDate} to ${endDate})`;
    headers = [
      'Registration', 'Aircraft Type', 'Base', 'Status',
      'Available Hours', 'Actual Hours', 'Total Flights', 'Utilisation %'
    ];
    const aircraft: AircraftUtilRow[] = data.aircraft || [];
    rows = aircraft.map(a => [
      a.registration || '',
      a.aircraft_type || '',
      a.base || '',
      a.status || '',
      String(a.available_hours ?? 0),
      String(a.actual_hours ?? 0),
      String(a.total_flights ?? 0),
      `${a.utilization_pct ?? 0}%`,
    ]);
  } else if (activeType === 'instructor-utilization') {
    title = `Instructor Utilisation Report (${startDate} to ${endDate})`;
    headers = [
      'Instructor Name', 'Employee ID', 'Rating',
      'Dual Hours', 'Check Hours', 'Solo Hours', 'Total Flying Hrs',
      'Duty Hours', 'FDTL Flying %', 'FDTL Duty %', 'Active Students'
    ];
    const instructors: InstructorUtilRow[] = data.instructors || [];
    rows = instructors.map(i => [
      i.name || '',
      i.employee_id || '',
      i.rating || '',
      String(i.dual_hours ?? 0),
      String(i.check_hours ?? 0),
      String(i.solo_hours ?? 0),
      String(i.total_flying_hrs ?? 0),
      String(i.duty_hours ?? 0),
      `${i.fdtl_flying_pct ?? 0}%`,
      `${i.fdtl_duty_pct ?? 0}%`,
      String(i.active_students ?? 0),
    ]);
  } else if (activeType === 'trainee-hours') {
    title = `Trainee Flying Hours Report (${startDate} to ${endDate})`;
    headers = [
      'Student Name', 'Enrollment No', 'Course Type', 'Instructor',
      'Month Dual Hrs', 'Month Solo Hrs', 'Month Total Hrs',
      'Cumulative Hrs', 'Course Required Hrs', 'Progress %'
    ];
    const students: TraineeHoursRow[] = data.students || [];
    rows = students.map(s => [
      s.name || '',
      s.enrollment_no || '',
      s.course_type || '',
      s.instructor || '',
      String(s.month_dual_hours ?? 0),
      String(s.month_solo_hours ?? 0),
      String(s.month_total_hours ?? 0),
      String(s.cumulative_hours ?? 0),
      String(s.course_required_hours ?? 0),
      `${s.progress_pct ?? 0}%`,
    ]);
  }

  const csvLines = [
    `"${title}"`,
    '',
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ];

  const csvContent = csvLines.join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${activeType}_report_${startDate}_to_${endDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Shared table wrapper ──────────────────────────────────────────────────────
const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
    <table className="w-full text-sm divide-y divide-slate-200 dark:divide-slate-700">{children}</table>
  </div>
);
const Th: React.FC<{ children: React.ReactNode; right?: boolean }> = ({ children, right }) => (
  <th className={`px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400
                  uppercase tracking-wider bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700
                  ${right ? 'text-right' : ''}`}>
    {children}
  </th>
);
const Td: React.FC<{ children: React.ReactNode; right?: boolean; mono?: boolean }> = ({
  children, right, mono,
}) => (
  <td className={`px-3 py-2.5 border-b border-slate-100 dark:border-slate-700/60 text-slate-700 dark:text-slate-300
                  ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''}`}>
    {children}
  </td>
);

// ── 1. SPL Report ─────────────────────────────────────────────────────────────
const SPLReportView: React.FC<{ data: SPLReport }> = ({ data }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="p-4 text-center border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/20">
        <p className="text-4xl font-bold text-amber-600 dark:text-amber-400">{data.total_spls_issued}</p>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">
          SPLs Issued
        </p>
      </Card>
      <Card className="p-4 sm:col-span-2 flex flex-col justify-center">
        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Reporting Period: {data.start_date ?? `${MONTHS[(data.month || 1) - 1]} ${data.year}`} – {data.end_date ?? ''}</p>
        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
          Official Student Pilot Licences (SPL) issued by this Flying Training Organisation during the reporting period.
        </p>
      </Card>
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
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
          {data.students.map((s: SPLStudent, i: number) => (
            <tr key={s.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
              <Td mono>{i + 1}</Td>
              <Td><span className="font-semibold text-slate-900 dark:text-white">{s.name}</span></Td>
              <Td mono>{s.enrollment_no}</Td>
              <Td mono>{s.spl_number}</Td>
              <Td>{s.spl_issued_date}</Td>
              <Td>
                <span className={
                  new Date(s.spl_expiry) < new Date()
                    ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-emerald-600 dark:text-emerald-400 font-semibold'
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
      <div className="text-center py-12 text-slate-400">
        <CheckSquare size={28} className="mx-auto mb-2 opacity-40 text-slate-400" />
        <p className="text-sm font-medium">No SPLs issued during this period</p>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Fleet Utilisation', value: `${data.fleet_utilization_pct}%`, colour: utilColour(data.fleet_utilization_pct) },
          { label: 'Total Flying Hours', value: `${data.total_actual_hours} hr`, colour: '#3b82f6' },
          { label: 'Available Hours', value: `${data.total_available_hours} hr`, colour: '#64748b' },
          { label: 'Total Flights', value: data.total_flights, colour: '#f59e0b' },
        ].map(s => (
          <Card key={s.label} className="p-3 text-center">
            <p className="text-xl font-bold" style={{ color: s.colour }}>{s.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{s.label}</p>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">
          Aircraft Hours – Actual vs Available ({data.num_days ?? 30} days)
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 8, color: '#fff' }}
              labelStyle={{ color: '#f59e0b', fontWeight: 'bold' }}
              itemStyle={{ color: '#cbd5e1' }}
            />
            <Bar dataKey="Actual" stackId="a" radius={[0, 0, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={utilColour(entry.pct)} />
              ))}
            </Bar>
            <Bar dataKey="Available" stackId="a" fill="#e2e8f0" className="dark:fill-slate-700" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

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
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
          {data.aircraft.map((a: AircraftUtilRow) => (
            <tr key={a.aircraft_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
              <Td mono>
                <span className="text-primary-600 dark:text-primary-400 font-bold">{a.registration}</span>
              </Td>
              <Td>{a.aircraft_type}</Td>
              <Td>{a.base}</Td>
              <Td>
                <Badge variant={a.status === 'AOG' ? 'danger' : 'success'}>
                  {a.status}
                </Badge>
              </Td>
              <Td right mono>{a.available_hours}</Td>
              <Td right mono>{a.actual_hours}</Td>
              <Td right mono>{a.total_flights}</Td>
              <Td right mono>
                <span className="font-bold" style={{ color: utilColour(a.utilization_pct) }}>
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
        { label: 'Total Flying Hours', value: `${data.total_flying_hours} hr`, colour: '#3b82f6' },
        { label: 'Total Duty Hours', value: `${data.total_duty_hours} hr`, colour: '#64748b' },
      ].map(s => (
        <Card key={s.label} className="p-3 text-center">
          <p className="text-xl font-bold" style={{ color: s.colour }}>{s.value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{s.label}</p>
        </Card>
      ))}
    </div>

    <Table>
      <thead>
        <tr>
          <Th>Instructor</Th>
          <Th right>Total Fly hr</Th>
          <Th right>Duty hr</Th>
          <Th right>FDTL Fly %</Th>
          <Th right>FDTL Duty %</Th>
          <Th right>Flights</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
        {data.instructors.map((ins: InstructorUtilRow) => (
          <tr key={ins.instructor_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
            <Td>
              <p className="text-slate-900 dark:text-white font-semibold">{ins.name}</p>
              <p className="text-xs text-slate-400 font-mono">{ins.employee_id}</p>
            </Td>
            <Td right mono>{ins.total_flying_hrs}</Td>
            <Td right mono>{ins.duty_hours}</Td>
            <Td right mono>
              <span className="font-bold" style={{ color: fdtlColour(ins.fdtl_flying_pct) }}>
                {ins.fdtl_flying_pct}%
              </span>
            </Td>
            <Td right mono>
              <span className="font-bold" style={{ color: fdtlColour(ins.fdtl_duty_pct) }}>
                {ins.fdtl_duty_pct}%
              </span>
            </Td>
            <Td right mono>{ins.total_flights}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
      Period FDTL limits: flying {data.monthly_flying_limit} hr · duty {data.monthly_duty_limit} hr ({data.num_days ?? 30} days)
    </p>
  </div>
);

// ── 4. Trainee Hours ──────────────────────────────────────────────────────────
const TraineeHoursView: React.FC<{ data: TraineeHoursReport }> = ({ data }) => (
  <div className="space-y-4">
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {[
        { label: 'Total Hours', value: `${data.month_total_hours} hr`, colour: '#3b82f6' },
        { label: 'DUAL', value: `${data.month_dual_hours} hr`, colour: '#f59e0b' },
        { label: 'SOLO', value: `${data.month_solo_hours} hr`, colour: '#10b981' },
        { label: 'CHECK', value: `${data.month_check_hours} hr`, colour: '#f97316' },
      ].map(s => (
        <Card key={s.label} className="p-3 text-center">
          <p className="text-lg font-bold" style={{ color: s.colour }}>{s.value}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{s.label}</p>
        </Card>
      ))}
    </div>

    <Table>
      <thead>
        <tr>
          <Th>#</Th>
          <Th>Student</Th>
          <Th right>DUAL</Th>
          <Th right>SOLO</Th>
          <Th right>CHECK</Th>
          <Th right>Period Total</Th>
          <Th right>Cumulative</Th>
          <Th right>Progress</Th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
        {data.students.map((s: TraineeHoursRow, i: number) => (
          <tr key={s.student_id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
            <Td mono>{i + 1}</Td>
            <Td>
              <p className="text-slate-900 dark:text-white font-semibold">{s.name}</p>
              <p className="text-xs text-slate-400 font-mono">{s.enrollment_no} · {s.course_type}</p>
            </Td>
            <Td right mono>{s.month_dual_hours}</Td>
            <Td right mono>{s.month_solo_hours}</Td>
            <Td right mono>{s.month_check_hours}</Td>
            <Td right mono>
              <span className="text-primary-600 dark:text-primary-400 font-bold">{s.month_total_hours}</span>
            </Td>
            <Td right mono>{s.cumulative_hours}</Td>
            <Td right>
              <div className="flex items-center justify-end gap-2">
                <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${s.progress_pct}%`,
                      backgroundColor: s.progress_pct >= 75 ? '#10b981'
                        : s.progress_pct >= 50 ? '#f59e0b' : '#64748b',
                    }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{s.progress_pct}%</span>
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
    description: 'Student Pilot Licences issued during the selected date range',
    icon: CheckSquare,
  },
  {
    type: 'aircraft-utilization',
    label: 'Aircraft Utilisation',
    description: 'Fleet flying hours vs available hours per aircraft in range',
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
    description: 'Period and cumulative flying hours per student by flight type',
    icon: BarChart2,
  },
];

// ── Main Reports page ─────────────────────────────────────────────────────────
const Reports: React.FC = () => {
  const today = dayjs();
  const [startDate, setStartDate] = useState(today.startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(today.format('YYYY-MM-DD'));
  const [activeType, setActiveType] = useState<ReportType>('trainee-hours');

  const reportUrl = `compliance/reports/${activeType}/?start_date=${startDate}&end_date=${endDate}`;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['report', activeType, startDate, endDate],
    queryFn: async () => {
      const res = await apiClient.get(reportUrl);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const renderReport = () => {
    if (isLoading) {
      return <PageLoader />;
    }
    if (isError) {
      return (
        <div className="text-center py-16 text-red-500 font-medium">
          <p className="text-sm">Failed to generate report: {String(error)}</p>
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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-5">
        <div>
          {/* <p className="text-xs font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-1">
            DGCA CAR-FTO Compliance & Analytics
          </p> */}
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            DGCA Reports
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} />
          <Button
            onClick={() => exportReportToCSV(activeType, data, startDate, endDate)}
            disabled={!data}
            variant="secondary"
            size="sm"
            className="gap-1.5"
          >
            <Download size={14} /> Export Excel / CSV
          </Button>
        </div>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORT_CARDS.map(card => {
          const Icon = card.icon;
          const active = card.type === activeType;
          return (
            <button
              key={card.type}
              onClick={() => setActiveType(card.type)}
              className={`text-left p-4 rounded-xl border transition-all shadow-sm ${active
                ? 'bg-primary-50/50 border-primary-400 dark:bg-primary-950/30 dark:border-primary-600 ring-2 ring-primary-500/20'
                : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-slate-800 dark:border-slate-700 dark:hover:border-slate-600'
                }`}
            >
              <Icon size={18} className={active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400'} />
              <p className={`text-sm font-semibold mt-2 ${active ? 'text-primary-900 dark:text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                {card.label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {card.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Report content */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-5 border-b border-slate-200 dark:border-slate-700 pb-4">
          <activeCard.icon size={18} className="text-primary-600 dark:text-primary-400" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">{activeCard.label} Report</h2>
          <Badge variant="default" className="ml-2 font-mono">
            {dayjs(startDate).format('DD MMM YYYY')} – {dayjs(endDate).format('DD MMM YYYY')}
          </Badge>
        </div>
        {renderReport()}
      </Card>
    </div>
  );
};

export default Reports;