import { useState } from 'react'
import type { UserProfile } from '@/types'
import { useUserProfile } from '@/features/profile/useUserProfile'
import { Onboarding } from '@/features/onboarding/Onboarding'
import { Home } from '@/features/conversation/Home'
import { Conversation } from '@/features/conversation/Conversation'

type Screen = 'welcome' | 'onboarding' | 'home' | 'conversation'

export default function App() {
  const { profile, saveProfile } = useUserProfile()
  const [screen, setScreen] = useState<Screen>(profile?.onboardingCompleted ? 'home' : 'welcome')
  const [initialMessage, setInitialMessage] = useState<string | undefined>()

  const handleOnboardingComplete = (newProfile: UserProfile) => {
    saveProfile(newProfile)
    setScreen('home')
  }

  const handleStartConversation = (message: string) => {
    setInitialMessage(message)
    setScreen('conversation')
  }

  if (screen === 'welcome') {
    return (
      <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-8 text-center">
        <p className="font-display font-light text-[40px] text-ivory mb-4">MindTip</p>
        <p className="font-sans text-[15px] text-mist max-w-[240px] mb-14 leading-relaxed">
          A companion that remembers what actually helps you.
        </p>
        <button
          onClick={() => setScreen('onboarding')}
          className="font-sans text-[15px] text-ivory hover:text-bronze transition-colors duration-300"
          style={{ borderBottom: '1px solid rgba(244,241,234,0.24)', paddingBottom: '4px' }}
        >
          Begin
        </button>
      </div>
    )
  }

  if (screen === 'onboarding') {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  if (screen === 'conversation' && profile) {
    return (
      <Conversation
        profile={profile}
        initialMessage={initialMessage}
        onExit={() => {
          setInitialMessage(undefined)
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
