import { useRef, useCallback, useEffect, useMemo } from 'react'
import FullCalendar from '@fullcalendar/react'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction'
import type { EventDropArg } from '@fullcalendar/core'
// NEW: Safe import workaround for FullCalendar's missing TS Draggable export
import { Draggable } from '@fullcalendar/interaction'
import { useCheckConstraints } from '@/api/hooks/useScheduling'
import { toast } from 'sonner'
import { Search, X } from 'lucide-react'
import type { Flight } from '@/api/types'
import type { SuggestedFlight } from '@/api/hooks/useRostering'

// Flight type → colour
const FT_COLOR: Record<string, string> = {
  dual:               '#0284c7',
  solo:               '#059669',
  cross_country_dual: '#7c3aed',
  cross_country_solo: '#6d28d9',
  night_dual:         '#1e3a8a',
  night_solo:         '#1e40af',
  instrument:         '#b45309',
  ferry:              '#9f1239',
  proficiency_check:  '#374151',
}

// Status → text label
const STATUS_LABEL: Record<string, string> = {
  draft:      'Drf',
  scheduled:  'Sch',
  confirmed:  'Cfm',
  dispatched: 'Dsp',
  airborne:   '✈',
  completed:  '✓',
  cancelled:  '✗',
}

interface Resource {
  id:    string
  title: string
  group?: string
  extendedProps?: Record<string, unknown>
}

interface Props {
  date:                   string           // YYYY-MM-DD
  flights:                Flight[]
  suggested?:             SuggestedFlight[]
  resources:              Resource[]
  resourceMode:           'instructor' | 'aircraft'
  resourceSearch?:        string
  onResourceSearchChange?:(val: string) => void
  onEventDrop:            (flightId: string, newStart: Date, newEnd: Date, newResourceId: string) => void
  onEventClick:           (flightId: string) => void
  onTimeSlotSelect?:      (start: Date, end: Date, resourceId: string) => void
  editable:               boolean
  externalEventsRef?:     React.RefObject<HTMLDivElement>
  onExternalDrop?:        (info: any) => void
}

export function RosterCalendar({
  date, flights, suggested = [], resources,
  resourceMode, resourceSearch, onResourceSearchChange,
  onEventDrop, onEventClick, onTimeSlotSelect, editable, externalEventsRef, onExternalDrop
}: Props) {
  const calendarRef = useRef<any>(null)
  
  useEffect(() => {
    const timer = setTimeout(() => {
      calendarRef.current?.getApi()?.updateSize()
    }, 150)
    return () => clearTimeout(timer)
  }, [date, resources, resourceMode])
  const checkConstraints = useCheckConstraints()

  // NEW: Initialize Draggable for the external sidebar items
  useEffect(() => {
    if (externalEventsRef?.current && editable) {
      const draggable = new Draggable(externalEventsRef.current, {
        itemSelector: '.fc-external-event',
        eventData: function(eventEl: HTMLElement) {
          return {
            title: eventEl.innerText,
            extendedProps: { planData: JSON.parse(eventEl.getAttribute('data-plan') || '{}') }
          }
        }
      })
      return () => draggable.destroy()
    }
  }, [externalEventsRef, editable])

  // Build a map of latest actual on-block time per resource for completed flights
  // Used to detect turnaround conflicts (next flight starts before previous flight's actual on-block)
  const latestActualEndByResource = useMemo(() => {
    const map: Record<string, Date> = {}
    flights
      .filter(f => f.status === 'completed' && f.actual_end)
      .forEach(f => {
        const resourceId = resourceMode === 'instructor' ? f.instructor : f.aircraft
        if (!resourceId) return
        const end = new Date(f.actual_end!)
        if (!map[resourceId] || end > map[resourceId]) {
          map[resourceId] = end
        }
      })
    return map
  }, [flights, resourceMode])

  // Convert Flight records → FullCalendar events
  const confirmedEvents = flights
    .filter(f => f.status !== 'cancelled')
    .map(f => {
      const isCompleted = f.status === 'completed'
      // For completed flights, use actual block times if available; fall back to scheduled
      const eventStart = (isCompleted && f.actual_start) ? f.actual_start : f.scheduled_start
      const eventEnd   = (isCompleted && f.actual_end)   ? f.actual_end   : f.scheduled_end

      // Detect turnaround conflict: this flight's scheduled start falls before a PRECEDING
      // flight's actual on-block time on the same resource
      const resourceId = resourceMode === 'instructor' ? f.instructor : f.aircraft
      const prevActualEnd = resourceId ? latestActualEndByResource[resourceId] : undefined
      const isTurnaroundConflict = !isCompleted &&
        prevActualEnd &&
        new Date(f.scheduled_start) < prevActualEnd

      return {
        id:           f.id,
        resourceId,
        start:        eventStart,
        end:          eventEnd,
        title:        buildEventTitle(f),
        backgroundColor: FT_COLOR[f.flight_type] ?? '#475569',
        borderColor:  isTurnaroundConflict
          ? '#ef4444'                                         // red = turnaround conflict
          : f.status === 'airborne' ? '#22c55e' : 'transparent',
        classNames:   isTurnaroundConflict ? ['fc-event-turnaround-conflict'] : [],
        extendedProps: {
          type: 'confirmed',
          flight: f,
          isTurnaroundConflict,
          prevActualEnd: prevActualEnd?.toISOString(),
        },
      }
    })

  // Convert AI suggested flights → FullCalendar events (dashed border)
  const suggestedEvents = suggested.map((s, i) => ({
    id:           `ai-${i}`,
    resourceId:   resourceMode === 'instructor' ? s.instructor_id : s.aircraft_id,
    start:        `${date}T${s.start_time}:00`,
    end:          `${date}T${s.end_time}:00`,
    title:        `${s.exercise_code} — ${s.student_name.split(' ')[1] ?? s.student_name}`,
    backgroundColor: FT_COLOR[s.flight_type] ?? '#475569',
    borderColor:  '#f59e0b',
    classNames:   ['fc-event-ai'],
    extendedProps:{ type: 'suggested', suggested: s },
  }))

  const handleDrop = useCallback(async (info: EventDropArg) => {
    const { event, revert } = info
    const flight = event.extendedProps.flight as Flight | undefined
    if (!flight) { revert(); return }

    // Prohibit dropping into past slots (allowing past flights to be dragged to FUTURE slots)
    if (event.start!.getTime() < Date.now() - 5 * 60 * 1000) {
      toast.error('Rescheduling Prohibited', {
        description: 'Cannot move flight into a past time slot. Drag it to a current or future time slot to reschedule.'
      })
      revert()
      return
    }

    const duration = (event.end!.getTime() - event.start!.getTime()) / 60_000
    try {
      const result = await checkConstraints.mutateAsync({
        student_id:       flight.student ?? undefined,
        instructor_id:    flight.instructor,
        aircraft_id:      flight.aircraft,
        duration_minutes: Math.round(duration),
      })
      if (!result.all_passed) {
        result.blocking_failures.forEach(f =>
          toast.error(`Constraint: ${f.rule}`, { description: f.detail })
        )
        revert()
        return
      }
      onEventDrop(flight.id, event.start!, event.end!,
        (info.newResource?.id ?? (resourceMode === 'instructor' ? flight.instructor : flight.aircraft)))
    } catch {
      revert()
    }
  }, [checkConstraints, onEventDrop, resourceMode])

  const handleResize = useCallback((info: EventResizeDoneArg) => {
    const flight = info.event.extendedProps.flight as Flight | undefined
    if (!flight) { info.revert(); return }
    if (info.event.start!.getTime() < Date.now() - 5 * 60 * 1000) {
      toast.error('Rescheduling Prohibited', { description: 'Cannot resize flight into a past time slot.' })
      info.revert()
      return
    }
    onEventDrop(flight.id, info.event.start!, info.event.end!, flight.instructor)
  }, [onEventDrop])

  const handleSelect = useCallback((info: any) => {
    if (onTimeSlotSelect) {
      onTimeSlotSelect(info.start, info.end, info.resource ? info.resource.id : '')
    }
  }, [onTimeSlotSelect])

  const scrollTime = useMemo(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - 30)
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`
  }, [])

  return (
    <div className="roster-calendar h-full [&_.fc-event-ai]:border-dashed [&_.fc-event-ai]:border-2">
      <FullCalendar
        ref={calendarRef}
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        initialView="resourceTimelineDay"
        initialDate={date}
        scrollTime={scrollTime}
        scrollTimeReset={false}
        schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
        resources={resources}
        events={[...confirmedEvents, ...suggestedEvents]}
        editable={editable}
        droppable={editable}
        selectable={editable}
        selectMirror={true}
        select={handleSelect}
        eventDrop={handleDrop}
        eventResize={handleResize}
        drop={(info) => {
          // NEW: Triggers when an external element is dropped onto the calendar
          if (onExternalDrop) onExternalDrop(info)
        }}
        eventClick={info => {
          const flight = info.event.extendedProps.flight as Flight | undefined
          if (flight) onEventClick(flight.id)
        }}
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        resourceAreaWidth={200}
        resourceGroupField={resourceMode === 'aircraft' ? 'group' : undefined}
        resourceGroupLabelContent={(arg) => (
          <span className="font-bold text-xs text-primary-700 dark:text-primary-300 tracking-wide px-1">
            {arg.groupValue}
          </span>
        )}
        resourceAreaHeaderContent={() => (
          <div className="flex flex-col gap-1.5 p-1.5">
            <div className="flex items-center justify-between px-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              <span>{resourceMode === 'instructor' ? 'Instructor' : 'Aircraft'}</span>
              <span className="text-[10px] font-normal text-slate-400">({resources.length})</span>
            </div>
            {onResourceSearchChange && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={resourceSearch ?? ''}
                  onChange={e => onResourceSearchChange(e.target.value)}
                  placeholder={`Search ${resourceMode === 'instructor' ? 'instructors...' : 'aircraft...'}`}
                  className="w-full rounded border border-slate-200 bg-white pl-7 pr-6 py-1 text-xs text-slate-900 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                {resourceSearch && (
                  <button
                    onClick={() => onResourceSearchChange('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
        height="100%"
        headerToolbar={{
          left:   '',
          center: 'title',
          right:  '',
        }}
        eventContent={renderEvent}
        resourceLabelContent={renderResource}
        nowIndicator
      />
    </div>
  )
}

function buildEventTitle(f: Flight): string {
  const status = STATUS_LABEL[f.status] ?? ''
  const type   = f.flight_type.replace(/_/g, ' ').split(' ').map(w => w[0]).join('').toUpperCase()
  return `${status} ${type}`.trim()
}

function renderEvent(info: { event: any; timeText: string }) {
  const suggested = info.event.extendedProps.suggested as SuggestedFlight | undefined
  const isAI      = info.event.extendedProps.type === 'suggested'

  return (
    <div className="px-1 py-0.5 text-xs leading-tight truncate">
      {isAI && <span className="mr-1 rounded bg-amber-400/30 px-0.5 text-amber-200 text-[9px] font-bold">AI</span>}
      <span className="font-semibold">{info.event.title}</span>
      {suggested && (
        <div className="opacity-80 truncate">{suggested.exercise_code}</div>
      )}
    </div>
  )
}

function renderResource(info: { resource: any }) {
  const fdtl = info.resource.extendedProps?.fdtl_remaining_min as number | undefined
  const hoursRemaining = info.resource.extendedProps?.hours_remaining as number | undefined
  const ferryTriggered = info.resource.extendedProps?.ferry_buffer_triggered as boolean | undefined

  return (
    <div className="px-2 py-1">
      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
        {info.resource.title}
      </div>
      {fdtl !== undefined && (
        <div className={`text-xs ${fdtl < 120 ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
          FDTL: {Math.floor(fdtl / 60)}h{fdtl % 60 > 0 ? `${fdtl % 60}m` : ''} left
        </div>
      )}
      {hoursRemaining !== undefined && (
        <div className={`text-xs ${ferryTriggered ? 'text-red-600 font-semibold' : hoursRemaining < 10 ? 'text-amber-600' : 'text-slate-400'}`}>
          {hoursRemaining.toFixed(1)}h to insp.{ferryTriggered ? ' — ferry due' : ''}
        </div>
      )}
    </div>
  )
}
