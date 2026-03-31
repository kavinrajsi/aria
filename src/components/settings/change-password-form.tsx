'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { changePassword } from '@/lib/actions/auth'

export function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)

    const current = (data.get('current') as string).trim()
    const next = (data.get('new') as string).trim()
    const confirm = (data.get('confirm') as string).trim()

    if (next.length < 8) {
      toast.error('New password must be at least 8 characters.')
      return
    }
    if (next !== confirm) {
      toast.error('Passwords do not match.')
      return
    }

    startTransition(async () => {
      const result = await changePassword(current, next)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Password updated.')
        form.reset()
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="current">Current password</Label>
        <div className="relative">
          <Input
            id="current"
            name="current"
            type={showCurrent ? 'text' : 'password'}
            autoComplete="current-password"
            required
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground"
            onClick={() => setShowCurrent((v) => !v)}
          >
            {showCurrent ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="new">New password</Label>
        <div className="relative">
          <Input
            id="new"
            name="new"
            type={showNew ? 'text' : 'password'}
            autoComplete="new-password"
            required
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground"
            onClick={() => setShowNew((v) => !v)}
          >
            {showNew ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="confirm">Confirm new password</Label>
        <div className="relative">
          <Input
            id="confirm"
            name="confirm"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            required
            className="pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            tabIndex={-1}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 text-muted-foreground"
            onClick={() => setShowConfirm((v) => !v)}
          >
            {showConfirm ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? 'Updating…' : 'Update password'}
      </Button>
    </form>
  )
}
