import type { AIContext } from '../../src/services/ai/AIProvider'

const SUPPORT_STYLE_LABELS: Record<string, string> = {
  validate_first: 'Wants validation before anything else.',
  action_first: 'Wants the plan — skip the validation.',
  blend: 'Wants brief validation, then action.'
}

/**
 * Builds the structured, user-specific context block appended after the
 * system prompt — see section 23 of the spec. This is the seam that keeps
 * personalization out of the personality prompt: MindTip's voice never
 * changes, only the facts it's given about this particular user.
 */
export function buildUserContextBlock(context: AIContext): string {
  const { profile, relevantMemories, recentMessages, character } = context

  const lines: string[] = []

  if (character) {
    lines.push(
      'CHARACTER PERSONA FOR THIS CONVERSATION',
      `You are speaking as: ${character.label}`,
      character.personaPrompt,
      ''
    )
  }

  lines.push(
    'USER PROFILE',
    `Preferred name: ${profile.preferredName ?? 'not given'}`,
    `Support style: ${SUPPORT_STYLE_LABELS[profile.supportStyle] ?? profile.supportStyle}`,
    '',
    'LIKELY TRIGGERS',
    profile.triggers.length ? profile.triggers.join(', ') : 'none stated',
    '',
    'WHAT HELPS',
    profile.whatHelps.length ? profile.whatHelps.join(', ') : 'none stated',
    '',
    "WHAT DOESN'T HELP",
    profile.whatDoesntHelp.length ? profile.whatDoesntHelp.join(', ') : 'none stated'
  )

  if (relevantMemories.length > 0) {
    lines.push('', 'RELEVANT MEMORIES')
    relevantMemories.forEach(m => lines.push(`- (${m.type}, confidence ${m.confidence}) ${m.content}`))
  }

  if (recentMessages.length > 0) {
    lines.push('', 'RECENT CONVERSATION')
    recentMessages.forEach(m => lines.push(`${m.role === 'user' ? 'User' : 'MindTip'}: ${m.content}`))
  }

  return lines.join('\n')
}
