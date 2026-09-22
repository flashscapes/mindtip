import type { AIContext } from '../../src/services/ai/AIProvider'

// How this person wants to be met when they're stuck, chosen on the welcome
// screen. Each is phrased as a delivery instruction -- emphasis, pacing,
// what to lead with -- deliberately NOT as a personality, because the
// personality is the character's job. See STYLE_SUBORDINATE_TO_PERSONA
// below for the rule that keeps the two from fighting.
const SUPPORT_STYLE_LABELS: Record<string, string> = {
  analytical:
    'Wants the problem named and taken apart directly. Lead with the substance, skip the warm-up, and be concrete about what is actually going on.',
  empathetic:
    'Wants to feel genuinely heard before anything else. Acknowledge what this is costing them, in your own voice, before you move toward the problem.',
  big_picture:
    'Wants the wider frame — where this sits in the longer arc of their life, what it is really an instance of — rather than only the immediate incident.',
  tactical:
    'Wants angles and moves. Offer concrete, non-obvious options they likely have not considered, and be specific about what to actually do.'
}

// The whole point of the style is that it changes delivery, not identity.
// Without this line the model reliably drifts: asked to be "warm and
// empathetic", the Noir Detective stops being a noir detective. Stated as
// an explicit precedence rule so the persona always wins a genuine
// conflict, and the style is expressed only as far as that persona allows.
const STYLE_SUBORDINATE_TO_PERSONA =
  'Apply that support style to HOW you deliver — what you lead with, your emphasis, your pacing, how much you sit with something before moving. ' +
  'Do NOT apply it to who you are. The character voice, worldview and manner described above are fixed and always take precedence. ' +
  'Where the style and the character pull against each other, stay fully in character and express the style only as far as that character naturally would — ' +
  'a detective offers warmth like a detective, not like a therapist. Never announce or name the style.'

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
    // Only meaningful when a persona is actually in play -- in the
    // character-less flow there is nothing for the style to be
    // subordinate to, and the line would read as a dangling reference.
    ...(character ? [STYLE_SUBORDINATE_TO_PERSONA] : []),
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
