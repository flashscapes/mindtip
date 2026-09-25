// Turning a spoken answer to "What should I call you?" into a usable name.
// Kept free of React so it can be exercised directly -- these rules are the
// difference between being greeted correctly forever and being called "Ow".

// Spoken answers to "what should I call you?" are rarely a bare name --
// people say "I'm Alvin" or "it's Alvin". Without this the whole sentence
// becomes preferredName and every screen greets them as "Good morning, My
// name is Alvin". Typed answers pass through this too and are unaffected,
// since they almost never carry a prefix.
const SPOKEN_NAME_PREFIX =
  /^(?:(?:hi|hey|hello|yeah|yes)[,\s]+)*(?:i'?m|my name is|my name's|it'?s|its|call me|this is|i am)\s+(.+)$/i

// Sounds Whisper produces from a breath, a false start, or a mis-decoded
// short name -- "Ow" for "Al" is a real observed case. None of them is a
// name, and accepting one means being called it in every screen forever,
// so the question is asked again instead.
const NOT_A_NAME = new Set([
  'ow', 'oh', 'ooh', 'uh', 'um', 'uhm', 'hmm', 'hm', 'mm', 'ah', 'aah', 'ha',
  'ouch', 'wow', 'yeah', 'yep', 'yes', 'no', 'nope', 'okay', 'ok', 'hi',
  'hey', 'hello', 'what', 'huh', 'sorry', 'thanks', 'thank you', 'you',
  'me', 'my name', 'nothing', 'none'
])

export function isPlausibleName(value: string): boolean {
  const normalized = value.trim().toLowerCase().replace(/[^a-z\s']/g, '').replace(/\s+/g, ' ').trim()
  if (!normalized) return false
  return !NOT_A_NAME.has(normalized)
}

export function cleanName(raw: string): string {
  const strip = (s: string) => s.trim().replace(/^[\s,.!?]+|[\s,.!?]+$/g, '')
  let text = strip(raw)
  const match = text.match(SPOKEN_NAME_PREFIX)
  if (match) text = strip(match[1])
  // A dictated ramble should not become someone's name. Three words is
  // generous for a real one ("Mary Anne Smith") and still cuts a sentence
  // off before it can become a greeting.
  return text.split(/\s+/).slice(0, 3).join(' ').slice(0, 40)
}
