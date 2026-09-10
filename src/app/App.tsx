import { useState } from 'react'
import type { Message, UserProfile } from '@/types'
import { useUserProfile } from '@/features/profile/useUserProfile'
import { Welcome } from '@/features/welcome/Welcome'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { Home } from '@/features/conversation/Home'
import { Conversation } from '@/features/conversation/Conversation'
import { Reflection } from '@/features/reflection/Reflection'
import { unlockAudio } from '@/voice'

type Screen = 'welcome' | 'onboarding' | 'home' | 'conversation' | 'reflection'

export default function App() {
  const { profile, saveProfile } = useUserProfile()
  const [screen, setScreen] = useState<Screen>(profile?.onboardingCompleted ? 'home' : 'welcome')
  const [initialMessage, setInitialMessage] = useState<string | undefined>()
  const [seedMessages, setSeedMessages] = useState<Message[] | undefined>()
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

  return content
}
