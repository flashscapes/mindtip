import { useState } from 'react'
import type { UserProfile } from '@/types'
import { useUserProfile } from '@/features/profile/useUserProfile'
import { Welcome } from '@/features/welcome/Welcome'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { Home } from '@/features/conversation/Home'
import { Conversation } from '@/features/conversation/Conversation'

type Screen = 'welcome' | 'onboarding' | 'home' | 'conversation'

// Fixed on every screen so we can always tell, at a glance or in a
// screenshot, whether a given load is actually running the latest deployed
// code — this app's aggressive PWA caching has repeatedly made that
// ambiguous otherwise.
function BuildStamp() {
  return (
    <div
      className="fixed bottom-1 right-2 z-50 font-sans text-[9px] text-mist/50 pointer-events-none select-none"
      style={{ fontFamily: 'monospace' }}
    >
      build {__BUILD_SHA__} · {__BUILD_TIME__.slice(0, 16).replace('T', ' ')}
    </div>
  )
}

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

  let content
  if (screen === 'welcome') {
    content = <Welcome onComplete={() => setScreen('onboarding')} />
  } else if (screen === 'onboarding') {
    content = <Onboarding onComplete={handleOnboardingComplete} />
  } else if (screen === 'conversation' && profile) {
    content = (
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
  } else if (profile) {
    content = <Home profile={profile} onStart={handleStartConversation} />
  } else {
    // Fallback: no profile somehow reached a screen that needs one.
    content = <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <>
      {content}
      <BuildStamp />
    </>
  )
}
