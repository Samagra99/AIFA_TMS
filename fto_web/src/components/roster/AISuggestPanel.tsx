/**
 * AISuggestPanel / Roster Builder
 */
import { useState, useCallback } from 'react'
import { useFleetStatus, useWeather } from '@/api/hooks'
import {
  useAllPlansForRequest, useSaveAISuggestion, useConfirmRoster,
  type InstructorDailyPlan, type RosterSuggestion, type SuggestedFlight,
} from '@/api/hooks/useRostering'
import { Button, Card, Spinner, Badge } from '@/components/ui'
import { Sparkles, CheckCircle2, XCircle, AlertTriangle, RefreshCw, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface Props {
  planRequestId: string
  planDate:      string
  baseId:        string
  baseIcao:      string
  onRosterConfirmed: () => void
}

export function AISuggestPanel({
  planRequestId, planDate, baseId, baseIcao, onRosterConfirmed,
}: Props) {
  const [generating,  setGenerating]  = useState(false)
  const [suggestion,  setSuggestion]  = useState<RosterSuggestion | null>(null)
  const [savedId,     setSavedId]     = useState<string | null>(null)
  const [editedFlights, setEditedFlights] = useState<SuggestedFlight[]>([])

  const { data: plans     } = useAllPlansForRequest(planRequestId)
  const { data: fleet     } = useFleetStatus(baseId)
  const { data: weather   } = useWeather(baseIcao)
  const saveAI              = useSaveAISuggestion()
  const confirmRoster       = useConfirmRoster()

  // ── Build the Claude / Gemini prompt ────────────────────────────────────────────────
  const buildPrompt = useCallback((): string => {
    if (!plans || !fleet) return ''

    const submittedPlans = (plans as InstructorDailyPlan[]).filter(
      p => p.status === 'submitted' || p.status === 'approved'
    )

    // Pass backend UUIDs + Maintenance Data
    const fleetLines = (fleet ?? [])
      .filter(a => a.status === 'airworthy')
      .map(a =>
        `  - ID: ${a.id} | Tail: ${a.tail_number} (${a.aircraft_type_name}) | ` +
        `Hobbs: ${a.hobbs_total}h | To 50hr: ${Number(a.next_50hr_at ?? 999) - Number(a.hobbs_total)}h | ` +
        `Ferry buffer triggered: ${a.ferry_buffer_triggered}`
      ).join('\n')

    // Pass backend UUIDs + Syllabus/FDTL Data
    const planLines = submittedPlans.map(plan => {
      const entries = (plan.entries ?? []).map(e =>
        `    * Student: ${e.student_name} (ID: ${e.student}) | Exercise: ${e.exercise_code} (ID: ${e.exercise}) | ` +
        `Prereq met: ${e.prereq_met} | CFI override approved: ${e.cfi_override_approved} | ` +
        `Preferred start: ${e.preferred_start ?? 'flexible'} | Duration: ${e.estimated_duration_min} min`
      ).join('\n')
      
      return (
        `  Instructor: ${plan.instructor_name} (ID: ${plan.instructor})\n` +
        `  Available: ${plan.availability_start}–${plan.availability_end}\n` +
        `  FDTL remaining: ${Math.floor(plan.fdtl_remaining / 60)}h ${plan.fdtl_remaining % 60}m\n` +
        `  Sorties:\n${entries || '    (no sorties submitted)'}`
      )
    }).join('\n\n')

    const wxLine = weather
      ? `Wind: ${weather.wind_speed_kt ?? '?'}kt / Temp: ${weather.temp_celsius ?? '?'}°C / DA: ${weather.density_altitude_ft ?? '?'}ft`
      : 'Weather data unavailable'

    return `You are an expert flight operations manager for a DGCA-approved FTO.
Generate a roster for ${planDate} at base ${baseIcao}.

HARD CONSTRAINTS (never violate):
1. ONLY assign aircraft from the FLEET STATUS list using their exact ID. Never assign AOG aircraft.
2. Do not schedule a flight if it would trigger the aircraft's ferry buffer (hours remaining ≤ ferry_buffer_hours).
3. Instructor FDTL must not be exceeded. Each flight consumes estimated_duration_min minutes.
4. ONLY schedule an exercise if prereq_met=true OR cfi_override_approved=true. Use exact Student ID and Exercise ID.
5. Do not schedule overlapping flights for the same instructor or aircraft.
6. Respect each instructor's availability_start and availability_end window.
7. Start/End times must be 24-hour strictly formatted as HH:MM.

FLEET STATUS (airworthy aircraft):
${fleetLines || '  No airworthy aircraft available.'}

WEATHER: ${wxLine}

INSTRUCTOR PLANS:
${planLines || '  No plans submitted.'}

Return ONLY valid JSON:
{
  "flights": [
    {
      "instructor_id": "<exact uuid from prompt>",
      "instructor_name": "<name>",
      "student_id": "<exact uuid from prompt>",
      "student_name": "<name>",
      "exercise_id": "<exact uuid from prompt>",
      "exercise_code": "<code>",
      "aircraft_id": "<exact uuid from prompt>",
      "aircraft_tail": "<tail>",
      "base_id": "${baseId}",
      "flight_type": "dual",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "duration_min": 60,
      "reason": "Why this slot"
    }
  ],
  "unscheduled": [
    {
      "student_name": "<name>",
      "exercise_code": "<code>",
      "reason": "<why this sortie could not be scheduled>"
    }
  ],
  "notes": "Optimization summary",
  "optimization_score": 100
}`
  }, [plans, fleet, weather, planDate, baseIcao, baseId])

  const generate = async () => {
    const prompt = buildPrompt()
    if (!prompt) { toast.error('No submitted plans available'); return }
    setGenerating(true)
    setSuggestion(null)

    try {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method:  'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_FREE_LLM_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1, 
        }),
      })

      if (!response.ok) throw new Error(`API error: ${response.status}`)
      const data = await response.json()
      const raw = data.choices?.[0]?.message?.content ?? ''
      
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      
      const parsed: RosterSuggestion = JSON.parse(jsonMatch[0])
      setSuggestion(parsed)
      setEditedFlights(parsed.flights)

      const saved = await saveAI.mutateAsync({
        planRequestId, suggestion: parsed, prompt_used: prompt,
      })
      setSavedId(saved.id)
      toast.success(`AI roster generated — ${parsed.flights.length} flights`)
    } catch (err) {
      toast.error('AI generation failed. You can create flights manually below.')
      // Display empty UI for manual creation if AI fails
      setSuggestion({ flights: [], unscheduled: [], notes: 'Manual Mode', optimization_score: 0 })
    } finally {
      setGenerating(false)
    }
  }

  // ── MANUAL FALLBACK: Dispatcher can add rows ──────────────────────────────
  const addManualFlight = () => {
    if (!suggestion) {
      setSuggestion({ flights: [], unscheduled: [], notes: 'Manual Mode', optimization_score: 0 })
    }
    setEditedFlights(prev => [...prev, {
      instructor_id: '', instructor_name: 'Manual Assignment',
      student_id: '', student_name: 'TBD',
      exercise_id: '', exercise_code: 'EX-?',
      aircraft_id: '', aircraft_tail: 'TBD',
      base_id: baseId, flight_type: 'dual',
      start_time: '08:00', end_time: '09:00', duration_min: 60, reason: 'Manual'
    }])
  }

  const updateFlightTime = (idx: number, field: 'start_time'|'end_time', value: string) => {
    setEditedFlights(prev => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], [field]: value }
      return copy
    })
  }

  const removeFlight = (idx: number) => {
    setEditedFlights(prev => prev.filter((_, i) => i !== idx))
  }

  const onConfirm = async () => {
    try {
      const result = await confirmRoster.mutateAsync({
        planRequestId,
        entries: editedFlights,
        ai_suggestion_id: savedId ?? undefined,
      })
      toast.success(`Roster confirmed — ${result.created} flights created`)
      if (result.errors?.length) {
        toast.warning(`${result.errors.length} flight(s) had errors — check database limits`)
      }
      onRosterConfirmed()
    } catch {
      toast.error('Failed to confirm roster')
    }
  }

  const submittedCount = (plans as InstructorDailyPlan[] | undefined)
    ?.filter(p => p.status === 'submitted' || p.status === 'approved').length ?? 0
  const totalCount = (plans as InstructorDailyPlan[] | undefined)?.length ?? 0

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">AI & Manual Roster Builder</p>
            <p className="mt-0.5 text-xs text-slate-500">
              {submittedCount}/{totalCount} instructor plans submitted
            </p>
          </div>
          <div className="flex gap-2">
            {suggestion && (
               <Button variant="secondary" onClick={addManualFlight} className="gap-2">
                 <Plus className="h-4 w-4" /> Add Row Manually
               </Button>
            )}
            <Button onClick={generate} loading={generating} disabled={submittedCount === 0} className="gap-2">
              <Sparkles className="h-4 w-4" />
              {suggestion ? 'Regenerate AI' : 'Generate AI Roster'}
            </Button>
          </div>
        </div>
      </Card>

      {generating && (
        <Card className="flex flex-col items-center py-12 text-center">
          <Spinner className="mb-4 h-8 w-8" />
          <p className="font-semibold text-slate-900 dark:text-white">Analysing {submittedCount} plans…</p>
        </Card>
      )}

      {suggestion && !generating && (
        <>
          {suggestion.optimization_score > 0 && (
            <Card className="border-primary-200">
              <p className="font-semibold text-slate-900 dark:text-white mb-2">Optimization Notes (Score: {suggestion.optimization_score})</p>
              <p className="text-sm text-slate-700 italic">"{suggestion.notes}"</p>
            </Card>
          )}

          <div>
            <div className="mb-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Draft Flights</p>
              <p className="text-xs text-slate-500">Adjust the times manually before confirming the roster.</p>
            </div>
            
            <div className="space-y-2">
              {editedFlights.map((f, idx) => (
                <div key={idx} className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-700 dark:bg-slate-800">
                  
                  {/* Editable Times */}
                  <div className="shrink-0 space-y-2">
                    <input 
                      type="time" 
                      value={f.start_time} 
                      onChange={e => updateFlightTime(idx, 'start_time', e.target.value)}
                      className="block w-24 rounded border border-slate-300 px-2 py-1 text-xs font-mono dark:bg-slate-900" 
                    />
                    <input 
                      type="time" 
                      value={f.end_time} 
                      onChange={e => updateFlightTime(idx, 'end_time', e.target.value)}
                      className="block w-24 rounded border border-slate-300 px-2 py-1 text-xs font-mono dark:bg-slate-900" 
                    />
                  </div>

                  <div className="flex-1 min-w-0 mt-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-medium text-slate-900 dark:text-white">{f.instructor_name}</span>
                      <span className="text-slate-400">+</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{f.student_name}</span>
                      <Badge variant="default" className="text-[10px]">{f.exercise_code}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{f.aircraft_tail}</span>
                      <span className="text-xs text-slate-400 italic truncate" title={f.reason}>{f.reason}</span>
                    </div>
                  </div>

                  <button onClick={() => removeFlight(idx)} className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                    <XCircle className="h-5 w-5" />
                  </button>
                </div>
              ))}
              
              {editedFlights.length === 0 && (
                <div className="p-8 text-center text-slate-500 border border-dashed rounded-xl">
                  No flights in draft. Click "Add Row Manually" or Generate AI.
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={onConfirm} loading={confirmRoster.isPending} disabled={editedFlights.length === 0} className="flex-1 gap-2">
              <CheckCircle2 className="h-4 w-4" /> Confirm & Create {editedFlights.length} Flights
            </Button>
          </div>
        </>
      )}
    </div>
  )
}