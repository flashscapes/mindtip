import { useEffect, useState } from 'react'
import type { Character, Message, UserProfile } from '@/types'
import { isSupportStyle } from '@/types'
import { useUserProfile } from '@/features/profile/useUserProfile'
import { Welcome } from '@/features/welcome/Welcome'
import { Home } from '@/features/conversation/Home'
import { Conversation } from '@/features/conversation/Conversation'
import { Reflection } from '@/features/reflection/Reflection'
import { unlockAudio } from '@/voice'
import { STORAGE_KEYS } from '@/lib/constants'
import { getConversationRecord } from '@/services/conversation/ConversationStore'

// 'onboarding' is gone: the former three-screen flow was replaced by the
// two questions the welcome screen now asks in place, so Welcome is what
// produces the profile. See Welcome.tsx.
type Screen = 'welcome' | 'home' | 'conversation' | 'reflection'

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

const CHARACTER_STORAGE_KEY = 'mindtip.conversationCharacter'

// Companion to readPersistedConversation: without this, a raw reload mid-
// conversation restores the transcript but loses which character it was
// with entirely (persona, theme, voice), which would be an immediately
// obvious, jarring failure — not merely a missed nice-to-have.
function readPersistedCharacter(): Character | undefined {
  try {
    const raw = sessionStorage.getItem(CHARACTER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Character) : undefined
  } catch {
    return undefined
  }
}

export default function App() {
  const { profile, saveProfile } = useUserProfile()

  // On mount only: if a mid-conversation session survived a reload, resume
  // directly into it instead of defaulting to Home. Both lazy initializers
  // read the same persisted value once, at startup — never re-evaluated
  // on normal in-app navigation.
  // A profile saved before the style question existed is complete in every
  // other respect but has no answer to it, and its stored supportStyle is a
  // value nothing reads any more. Rather than run on a dead value or
  // silently pick one for them, send them through the welcome questions
  // once; handleWelcomeComplete merges the answers over what they already
  // have, so nothing they told the old flow is lost.
  const needsWelcome = !profile?.onboardingCompleted || !isSupportStyle(profile.supportStyle)

  const [screen, setScreen] = useState<Screen>(() => {
    // Resuming a live conversation still wins -- interrupting one to ask a
    // setup question would be worse than asking it on the way out.
    if (profile?.onboardingCompleted && readPersistedConversation()) return 'conversation'
    return needsWelcome ? 'welcome' : 'home'
  })
  const [initialMessage, setInitialMessage] = useState<string | undefined>()
  const [seedMessages, setSeedMessages] = useState<Message[] | undefined>(() => readPersistedConversation() ?? undefined)
  // Never auto-start voice on a restored conversation — the browser's
  // autoplay policy requires a fresh user gesture anyway, so this would
  // silently fail. The restored transcript is shown as text; voice picks
  // back up normally once the person taps to continue.
  const [autoVoiceStart, setAutoVoiceStart] = useState(false)
  const [reflectionMessages, setReflectionMessages] = useState<Message[]>([])
  // Set once when a character is chosen on Home, persists for the whole
  // conversation (every turn, not just the first) — see Conversation.tsx.
  // Restored on mount alongside the conversation transcript itself (see
  // readPersistedCharacter) so a raw reload mid-conversation doesn't lose
  // the persona/theme even though the transcript survives.
  const [character, setCharacter] = useState<Character | undefined>(() => readPersistedCharacter())
  // Set only when handleStartConversation finds a saved conversation record
  // for the chosen character — see ConversationStore.ts. Holds the actual
  // prior transcript, made available to the AI but never rendered on
  // screen; Conversation.tsx uses its presence to trigger a natural
  // check-in instead of the generic first message.
  const [reentryContext, setReentryContext] = useState<Message[] | undefined>()

  // Mirrors Conversation.tsx's own persistence effect for the transcript —
  // see readPersistedCharacter above for why this exists.
  useEffect(() => {
    if (character) {
      sessionStorage.setItem(CHARACTER_STORAGE_KEY, JSON.stringify(character))
    }
  }, [character])

  // Called by Welcome once both of its questions are answered -- it is the
  // only thing in the app that creates a profile.
  const handleWelcomeComplete = (newProfile: UserProfile) => {
    // Merge rather than replace: an existing profile may carry triggers and
    // whatHelps gathered by the old onboarding flow, plus a stable id the
    // memory store is keyed on. Only the two things just asked are taken
    // from the new one.
    saveProfile(
      profile
        ? {
            ...profile,
            preferredName: newProfile.preferredName ?? profile.preferredName,
            supportStyle: newProfile.supportStyle,
            onboardingCompleted: true
          }
        : newProfile
    )
    setScreen('home')
  }

  const handleStartConversation = (message: string, autoVoice = false, chosenCharacter?: Character) => {
    // The character's key already is the conversation id in this app's
    // model — there's no concept of multiple simultaneous threads with the
    // same character, so no separate id system is needed. 'default' covers
    // the character-less mood-based flow.
    const conversationId = chosenCharacter?.key ?? 'default'
    const existing = getConversationRecord(conversationId)

    if (existing && existing.messages.length > 0) {
      // Resuming: the prior transcript is handed to Conversation.tsx as
      // hidden AI context, not shown on screen and not sent as the usual
      // generic seed message — it generates a grounded check-in instead.
      setInitialMessage(undefined)
      setSeedMessages(undefined)
      setReentryContext(existing.messages)
    } else {
      setInitialMessage(message)
      setSeedMessages(undefined)
      setReentryContext(undefined)
    }
    setAutoVoiceStart(autoVoice)
    setCharacter(chosenCharacter)
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
    setReentryContext(undefined)
    setAutoVoiceStart(true)
    setScreen('conversation')
  }

  let content
  if (screen === 'welcome') {
    content = <Welcome onComplete={handleWelcomeComplete} />
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
        reentryContext={reentryContext}
        autoEnableVoice={autoVoiceStart}
        character={character}
        onProfileLearned={saveProfile}
        onReflectionReady={handleReflectionReady}
        onExit={() => {
          setInitialMessage(undefined)
          setSeedMessages(undefined)
          setReentryContext(undefined)
          setAutoVoiceStart(false)
          setCharacter(undefined)
          sessionStorage.removeItem(STORAGE_KEYS.conversation)
          sessionStorage.removeItem(CHARACTER_STORAGE_KEY)
          setScreen('home')
        }}
      />
    )
  } else if (profile) {
    content = <Home profile={profile} onStart={handleStartConversation} onExploreExperiment={handleContinueFromReflection} />
  } else {
    // Fallback: no profile somehow reached a screen that needs one. Welcome
    // is where a profile comes from, so that is where this goes.
    content = <Welcome onComplete={handleWelcomeComplete} />
  }

  return content
}
