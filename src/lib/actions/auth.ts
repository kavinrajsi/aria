'use server'

import { createClient } from '@/lib/supabase/server'

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'Not authenticated' }

  // Verify the current password by attempting a sign-in
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (verifyError) return { error: 'Current password is incorrect' }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) return { error: updateError.message }

  return {}
}
