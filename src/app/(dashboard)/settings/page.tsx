import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, voice_profiles(*)')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/sign-in')

  const voiceProfile = Array.isArray(profile.voice_profiles)
    ? profile.voice_profiles[0] ?? null
    : profile.voice_profiles

  const initials = profile.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Your account and preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Profile</CardTitle>
          <CardDescription>Your account information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="text-sm">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{profile.name}</p>
              <p className="text-sm text-muted-foreground">{profile.email}</p>
            </div>
            <Badge variant="outline" className="ml-auto capitalize">
              {profile.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Voice Profile</CardTitle>
          <CardDescription>
            Used by Aria to identify you during meetings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {voiceProfile ? (
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <p className="font-medium capitalize">
                  {voiceProfile.enrollment_status.replace('_', ' ')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {voiceProfile.samples_count} voice sample
                  {voiceProfile.samples_count !== 1 ? 's' : ''} recorded
                </p>
              </div>
              <Badge
                variant={
                  voiceProfile.enrollment_status === 'enrolled' ? 'default' : 'secondary'
                }
              >
                {voiceProfile.enrollment_status === 'enrolled' ? 'Ready' : 'Incomplete'}
              </Badge>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No voice profile yet. Ask an admin to start your enrollment.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
