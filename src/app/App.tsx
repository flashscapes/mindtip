import { useState } from 'react'
import type { UserProfile } from '@/types'
import { useUserProfile } from '@/features/profile/useUserProfile'
import { Welcome } from '@/features/welcome/Welcome'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { Home } from '@/features/conversation/Home'
import { Conversation } from '@/features/conversation/Conversation'

type Screen = 'welcome' | 'onboarding' | 'home' | 'conversation'

export default function App() {
  const { profile, saveProfile } = useUserProfile()
  const [screen, setScreen] = useState<Screen>(profile?.onboardingCompleted ? 'home' : 'welcome')
  const [initialMessage, setInitialMessage] = useState<string | undefined>()
  const [autoVoiceStart, setAutoVoiceStart] = useState(false)

  const handleOnboardingComplete = (newProfile: UserProfile) => {
    saveProfile(newProfile)
    setScreen('home')
  }

  const handleStartConversation = (message: string, autoVoice = false) => {
    setInitialMessage(message)
    setAutoVoiceStart(autoVoice)
    setScreen('conversation')
  }

  if (screen === 'welcome') {
    return <Welcome onComplete={() => setScreen('onboarding')} />
  }

  if (screen === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  if (screen === 'conversation' && profile) {
    return (
      <Conversation
        profile={profile}
        initialMessage={initialMessage}
        autoEnableVoice={autoVoiceStart}
        onExit={() => {
          setInitialMessage(undefined)
          setAutoVoiceStart(false)
          setScreen('home')
        }}
      />
    )
  }

  if (profile) {
    return <Home profile={profile} onStart={handleStartConversation} />
  }

  // Fallback: no profile somehow reached a screen that needs one.
  return <Onboarding onComplete={handleOnboardingComplete} />
}
