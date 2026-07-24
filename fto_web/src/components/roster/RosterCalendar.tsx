import { useRef, useCallback, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import resourceTimelinePlugin from '@fullcalendar/resource-timeline'
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction'
import type { EventDropArg } from '@fullcalendar/core'
// NEW: Safe import workaround for FullCalendar's missing TS Draggable export
import { Draggable } from '@fullcalendar/interaction'
import { useCheckConstraints } from '@/api/hooks/useScheduling'
import { toast } from 'sonner'
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
  extendedProps?: Record<string, unknown>
}

interface Props {
  date:         string           // YYYY-MM-DD
  flights:      Flight[]
  suggested?:   SuggestedFlight[]
  resources:    Resource[]
  resourceMode: 'instructor' | 'aircraft'
  onEventDrop:  (flightId: string, newStart: Date, newEnd: Date, newResourceId: string) => void
  onEventClick: (flightId: string) => void
  onTimeSlotSelect?: (start: Date, end: Date, resourceId: string) => void
  editable:     boolean
  externalEventsRef?: React.RefObject<HTMLDivElement>
  onExternalDrop?: (info: any) => void
}

export function RosterCalendar({
  date, flights, suggested = [], resources,
  resourceMode, onEventDrop, onEventClick, onTimeSlotSelect, editable, externalEventsRef, onExternalDrop
}: Props) {
  const calRef = useRef<FullCalendar>(null)
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

  // Convert Flight records → FullCalendar events
  const confirmedEvents = flights
    .filter(f => f.status !== 'cancelled')
    .map(f => ({
      id:           f.id,
      resourceId:   resourceMode === 'instructor' ? f.instructor : f.aircraft,
      start:        f.scheduled_start,
      end:          f.scheduled_end,
      title:        buildEventTitle(f),
      backgroundColor: FT_COLOR[f.flight_type] ?? '#475569',
      borderColor:  f.status === 'airborne' ? '#22c55e' : 'transparent',
      extendedProps:{ type: 'confirmed', flight: f },
    }))

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
    if (info.start.getTime() < Date.now() - 5 * 60 * 1000) {
      toast.error('Backdated Flight Creation Prohibited', {
        description: 'Cannot create a new flight in the past. To reschedule an un-executed past flight, drag it to a future time slot.'
      })
      return
    }
    if (onTimeSlotSelect) {
      onTimeSlotSelect(info.start, info.end, info.resource ? info.resource.id : '')
    }
  }, [onTimeSlotSelect])

  return (
    <div className="roster-calendar h-full [&_.fc-event-ai]:border-dashed [&_.fc-event-ai]:border-2">
      <FullCalendar
        ref={calRef}
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        initialView="resourceTimelineDay"
        initialDate={date}
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
        resourceAreaHeaderContent={resourceMode === 'instructor' ? 'Instructor' : 'Aircraft'}
        resourceAreaWidth="160px"
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
  const flight    = info.event.extendedProps.flight as Flight | undefined
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
  return (
    <div className="px-2 py-1">
      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
        {info.resource.title}
      </div>
      {fdtl !== undefined && (
        <div className={`text-xs ${fdtl < 120 ? 'text-amber-600' : 'text-slate-400'}`}>
          FDTL: {Math.floor(fdtl / 60)}h{fdtl % 60 > 0 ? `${fdtl % 60}m` : ''} left
        </div>
      )}
    </div>
  )
}
