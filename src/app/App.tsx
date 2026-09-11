import { useState } from 'react'
import type { Message, UserProfile } from '@/types'
import { useUserProfile } from '@/features/profile/useUserProfile'
import { Welcome } from '@/features/welcome/Welcome'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { Home } from '@/features/conversation/Home'
import { Conversation } from '@/features/conversation/Conversation'
import { Reflection } from '@/features/reflection/Reflection'
import { unlockAudio } from '@/voice'
import { STORAGE_KEYS } from '@/lib/constants'

type Screen = 'welcome' | 'onboarding' | 'home' | 'conversation' | 'reflection'

// Reads back whatever Conversation.tsx last persisted, if anything — see
// the audit note there. Returns null (not an empty array) when nothing
// usable is stored, so callers can tell "no persisted conversation" apart
// from "an empty one".
function readPersistedConversation(): Message[] | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.conversation)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Message[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null
  } catch {
    return null
  }
}

export default function App() {
  const { profile, saveProfile } = useUserProfile()

  // On mount only: if a mid-conversation session survived a reload, resume
  // directly into it instead of defaulting to Home. Both lazy initializers
  // read the same persisted value once, at startup — never re-evaluated
  // on normal in-app navigation.
  const [screen, setScreen] = useState<Screen>(() => {
    if (profile?.onboardingCompleted && readPersistedConversation()) return 'conversation'
    return profile?.onboardingCompleted ? 'home' : 'welcome'
  })
  const [initialMessage, setInitialMessage] = useState<string | undefined>()
  const [seedMessages, setSeedMessages] = useState<Message[] | undefined>(() => readPersistedConversation() ?? undefined)
  // Never auto-start voice on a restored conversation — the browser's
  // autoplay policy requires a fresh user gesture anyway, so this would
  // silently fail. The restored transcript is shown as text; voice picks
  // back up normally once the person taps to continue.
  const [autoVoiceStart, setAutoVoiceStart] = useState(false)
  const [reflectionMessages, setReflectionMessages] = useState<Message[]>([])

  const handleOnboardingComplete = (newProfile: UserProfile) => {
    saveProfile(newProfile)
    setScreen('home')
  }

  const handleStartConversation = (message: string, autoVoice = false) => {
    setInitialMessage(message)
    setSeedMessages(undefined)
    setAutoVoiceStart(autoVoice)
    setScreen('conversation')
  }

  const handleReflectionReady = (messages: Message[]) => {
    setReflectionMessages(messages)
    setScreen('reflection')
  }

  const handleContinueFromReflection = (seed: Message[]) => {
    // A real tap, so this can unlock audio the same way Home's mood submit
    // does — if voice was on before the reflection, it stays on afterward.
    unlockAudio()
    setInitialMessage(undefined)
    setSeedMessages(seed)
    setAutoVoiceStart(true)
    setScreen('conversation')
  }

  let content
  if (screen === 'welcome') {
    content = <Welcome onComplete={() => setScreen('onboarding')} />
  } else if (screen === 'onboarding') {
    content = <Onboarding onComplete={handleOnboardingComplete} />
  } else if (screen === 'reflection' && profile) {
    content = (
      <Reflection
        messages={reflectionMessages}
        profile={profile}
        onContinueTalking={handleContinueFromReflection}
        onExit={() => setScreen('home')}
      />
    )
  } else if (screen === 'conversation' && profile) {
    content = (
      <Conversation
        profile={profile}
        initialMessage={initialMessage}
        seedMessages={seedMessages}
        autoEnableVoice={autoVoiceStart}
        onReflectionReady={handleReflectionReady}
        onExit={() => {
          setInitialMessage(undefined)
          setSeedMessages(undefined)
          setAutoVoiceStart(false)
          sessionStorage.removeItem(STORAGE_KEYS.conversation)
          setScreen('home')
        }}
      />
    )
  } else if (profile) {
    content = <Home profile={profile} onStart={handleStartConversation} onExploreExperiment={handleContinueFromReflection} />
  } else {
    // Fallback: no profile somehow reached a screen that needs one.
    content = <Onboarding onComplete={handleOnboardingComplete} />
  }

  return content
}
