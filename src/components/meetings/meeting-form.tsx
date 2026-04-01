'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format } from 'date-fns'
import {
  CalendarIcon,
  GripVertical,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'

const STT_PROVIDERS = [
  { value: 'openai', label: 'OpenAI Whisper', description: 'Default — real-time via OpenAI Realtime API' },
  { value: 'elevenlabs', label: 'ElevenLabs Scribe', description: 'Low-latency STT with 90+ languages' },
  { value: 'sarvam', label: 'Sarvam AI', description: 'Optimised for Indian languages (22 supported)' },
] as const

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  date: z.date({ required_error: 'Pick a date' }),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a valid time'),
  agenda_items: z.array(z.object({ value: z.string() })),
  briefing_notes: z.string().optional(),
  participant_ids: z.array(z.string()),
  stt_provider: z.enum(['openai', 'elevenlabs', 'sarvam']),
})

type FormValues = z.infer<typeof schema>

interface MeetingFormProps {
  participants: Profile[]
  organizerId: string
  meetingId?: string
  defaultValues?: Partial<FormValues>
}

export function MeetingForm({
  participants,
  organizerId,
  meetingId,
  defaultValues,
}: MeetingFormProps) {
  const router = useRouter()
  const isEditing = !!meetingId

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      time: '09:00',
      agenda_items: [],
      briefing_notes: '',
      participant_ids: [organizerId],
      stt_provider: 'openai',
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'agenda_items',
  })

  const selectedDate = watch('date')
  const selectedParticipants = watch('participant_ids')

  async function onSubmit(values: FormValues) {
    const [hours, minutes] = values.time.split(':').map(Number)
    const scheduledAt = new Date(values.date)
    scheduledAt.setHours(hours, minutes, 0, 0)

    const supabase = createClient()

    const meetingData = {
      title: values.title,
      scheduled_at: scheduledAt.toISOString(),
      organizer_id: organizerId,
      ai_provider: values.stt_provider,
      agenda_items: values.agenda_items
        .map((item) => item.value.trim())
        .filter(Boolean),
      briefing_notes: values.briefing_notes || null,
    }

    if (isEditing) {
      const { error } = await supabase
        .from('meetings')
        .update(meetingData)
        .eq('id', meetingId)

      if (error) { toast.error('Failed to update meeting'); return }

      // Sync participants
      await supabase.from('meeting_participants').delete().eq('meeting_id', meetingId)
      if (values.participant_ids.length > 0) {
        await supabase.from('meeting_participants').insert(
          values.participant_ids.map((uid) => ({ meeting_id: meetingId, user_id: uid }))
        )
      }

      toast.success('Meeting updated')
      router.push(`/meetings/${meetingId}`)
    } else {
      const { data: newMeeting, error } = await supabase
        .from('meetings')
        .insert(meetingData)
        .select('id')
        .single()

      if (error || !newMeeting) { toast.error('Failed to create meeting'); return }

      if (values.participant_ids.length > 0) {
        await supabase.from('meeting_participants').insert(
          values.participant_ids.map((uid) => ({
            meeting_id: newMeeting.id,
            user_id: uid,
          }))
        )
      }

      toast.success('Meeting created')
      router.push(`/meetings/${newMeeting.id}`)
    }

    router.refresh()
  }

  function toggleParticipant(userId: string) {
    const current = selectedParticipants
    if (userId === organizerId) return // organizer is always included
    const next = current.includes(userId)
      ? current.filter((id) => id !== userId)
      : [...current, userId]
    setValue('participant_ids', next)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="title">Meeting title</Label>
        <Input
          id="title"
          placeholder="Q2 strategy review"
          {...register('title')}
        />
        {errors.title && (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        )}
      </div>

      {/* Date + Time */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  'w-full justify-start text-left font-normal',
                  !selectedDate && 'text-muted-foreground'
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setValue('date', date)}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
              />
            </PopoverContent>
          </Popover>
          {errors.date && (
            <p className="text-xs text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="time">Time</Label>
          <Input id="time" type="time" {...register('time')} />
          {errors.time && (
            <p className="text-xs text-destructive">{errors.time.message}</p>
          )}
        </div>
      </div>

      <Separator />

      {/* Agenda editor */}
      <div className="space-y-3">
        <div>
          <Label>Agenda</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Add agenda items Aria will track during the meeting.
          </p>
        </div>

        {/* TODO: Implement agenda item list
         *
         * Each field in `fields` is an agenda item ({ id, value }).
         * You have access to:
         *   - fields        — current list from useFieldArray
         *   - append({ value: '' })  — add a new empty item
         *   - remove(index) — remove item at index
         *   - register(`agenda_items.${index}.value`) — bind input
         *
         * Design considerations:
         *   - Should items be reorderable (drag-and-drop)? Upward/downward arrows?
         *   - Should pressing Enter in an item auto-add the next?
         *   - Should empty items be stripped on submit? (already handled in onSubmit)
         *
         * Render each item with a numbered label, the input, and a remove button.
         */}
        <AgendaEditor
          fields={fields}
          register={register}
          remove={remove}
          onAdd={() => append({ value: '' })}
        />
      </div>

      <Separator />

      {/* Briefing notes */}
      <div className="space-y-1.5">
        <Label htmlFor="briefing_notes">Briefing notes</Label>
        <p className="text-xs text-muted-foreground">
          Context Aria will have before the meeting starts — background, goals, key
          topics.
        </p>
        <Textarea
          id="briefing_notes"
          rows={4}
          placeholder="e.g. This is the first review since the product launch. Focus on retention metrics and roadmap priorities."
          {...register('briefing_notes')}
        />
      </div>

      <Separator />

      {/* Transcription provider */}
      <div className="space-y-1.5">
        <Label>Transcription provider</Label>
        <p className="text-xs text-muted-foreground">
          Choose which speech-to-text engine Aria uses during this meeting.
        </p>
        <Select
          value={watch('stt_provider')}
          onValueChange={(v) => setValue('stt_provider', v as FormValues['stt_provider'])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STT_PROVIDERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                <div>
                  <span className="font-medium">{p.label}</span>
                  <span className="text-muted-foreground ml-2 text-xs">{p.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Participants */}
      <div className="space-y-3">
        <div>
          <Label>Participants</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select who will attend this meeting.
          </p>
        </div>
        <Card>
          <CardContent className="p-0 divide-y">
            {participants.map((p) => {
              const isOrganizer = p.id === organizerId
              const isSelected = selectedParticipants.includes(p.id)
              const initials = p.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)

              return (
                <label
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors',
                    isOrganizer && 'opacity-70 cursor-default'
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleParticipant(p.id)}
                    disabled={isOrganizer}
                  />
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                  </div>
                  {isOrganizer && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      Organiser
                    </span>
                  )}
                </label>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save changes' : 'Create meeting'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

// ─── AgendaEditor ────────────────────────────────────────────────────────────
// TODO: This is where your contribution matters.
// The surrounding form wires everything up — you define how the list looks and feels.

interface AgendaEditorProps {
  fields: { id: string; value: string }[]
  register: ReturnType<typeof useForm<FormValues>>['register']
  remove: (index: number) => void
  onAdd: () => void
}

function AgendaEditor({ fields, register, remove, onAdd }: AgendaEditorProps) {
  // Implement this component.
  //
  // Suggested approach (5–8 lines of JSX):
  //   - Map over `fields` to render a row per agenda item
  //   - Each row: a numbered label + bound <Input> + a Trash2 remove button
  //   - Below the list: an "+ Add item" button that calls onAdd()
  //
  // Optional enhancements:
  //   - Auto-focus the new input when appending
  //   - Submit on Enter, moving focus to the next item
  //   - Drag handles (GripVertical icon) if you want reordering

  return (
    <div className="space-y-2">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 cursor-grab" />
          <span className="text-sm text-muted-foreground w-5 text-right shrink-0">
            {index + 1}.
          </span>
          <Input
            placeholder={`Agenda item ${index + 1}`}
            {...register(`agenda_items.${index}.value`)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => remove(index)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1"
        onClick={onAdd}
      >
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add item
      </Button>
    </div>
  )
}
