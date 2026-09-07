import { useCallback, useState } from 'react'
import type { UserProfile } from '@/types'
import { STORAGE_KEYS } from '@/lib/constants'

function readProfile(): UserProfile | null {
  const raw = localStorage.getItem(STORAGE_KEYS.profile)
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserProfile
  } catch (err) {
    console.error('Stored profile was corrupted and could not be read — treating as first launch.', err)
    return null
  }
}

/**
 * V1 persistence is localStorage. Swapping to a real backend later means
 * changing this hook's internals only — components consume the same shape.
 */
export function useUserProfile() {
  const [profile, setProfileState] = useState<UserProfile | null>(() => readProfile())

  const saveProfile = useCallback((profile: UserProfile) => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile))
    setProfileState(profile)
  }, [])

  const clearProfile = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.profile)
    setProfileState(null)
  }, [])

  return { profile, saveProfile, clearProfile }
}
