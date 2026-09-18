// Lightweight per-turn latency instrumentation for the voice pipeline.
//
// Deliberately NOT React state and NOT a ref inside a component -- marking
// a timestamp is a plain write to a module-level object, so it can never
// trigger a re-render no matter how often it's called. This is the
// opposite design from the debugLog mechanism in voice.ts (which is meant
// to be seen live, and pays a throttled-but-nonzero render cost for that);
// timing marks are meant to be gathered silently through a full turn and
// only turned into a human-readable report once, at the end.
//
// Usage: mark(stage) at each of the 12 pipeline points as they happen,
// then call finishTurnAndReport() once the turn is fully complete (last
// audio segment finished playing, or the turn errored out) to get a
// formatted stage-by-stage breakdown and reset for the next turn.

export type TimingStage =
  | 'mic_turn_end'          // VAD detects end of speech, finishTurn() called
  | 'capture_finalized'      // recorder fully stopped, blob assembled
  | 'transcribe_request_start'
  | 'transcribe_response'
  | 'ai_request_start'
  | 'ai_first_chunk'         // first streamed chunk (character convos only; same as ai_complete otherwise)
  | 'ai_complete'
  | 'sentence_ready'         // full reply text handed to speakResponse
  | 'tts_request_start'      // first sentence's TTS fetch begins
  | 'tts_first_audio'        // first sentence's audio blob ready
  | 'playback_start';        // first sentence's audio.play() actually begins

interface SegmentTiming {
  index: number;
  fetchStart: number;
  fetchEnd: number;
  playStart: number;
  playEnd: number;
}

let marks: Partial<Record<TimingStage, number>> = {};
let segments: SegmentTiming[] = [];

export function resetTurnTiming(): void {
  marks = {};
  segments = [];
}

export function mark(stage: TimingStage): void {
  // Only record the first occurrence per turn for stages that could
  // otherwise fire more than once (defensive; each should really fire
  // exactly once per turn).
  if (marks[stage] === undefined) {
    marks[stage] = performance.now();
  }
}

export function markSegment(index: number, field: keyof SegmentTiming, time?: number): void {
  const t = time ?? performance.now();
  let seg = segments.find(s => s.index === index);
  if (!seg) {
    seg = { index, fetchStart: 0, fetchEnd: 0, playStart: 0, playEnd: 0 };
    segments.push(seg);
  }
  seg[field] = t;
}

// Formats whatever marks were actually recorded into a compact, readable
// stage-by-stage delta report. Missing stages (e.g. ai_first_chunk on the
// non-streaming default path) are simply skipped rather than shown as
// errors -- this instrumentation describes whatever pipeline actually ran.
export function buildTimingReport(): string {
  const order: TimingStage[] = [
    'mic_turn_end', 'capture_finalized', 'transcribe_request_start', 'transcribe_response',
    'ai_request_start', 'ai_first_chunk', 'ai_complete', 'sentence_ready',
    'tts_request_start', 'tts_first_audio', 'playback_start'
  ];
  const present = order.filter(s => marks[s] !== undefined);
  if (present.length < 2) return '(insufficient timing data for this turn)';

  const lines: string[] = [];
  const turnStart = marks[present[0]]!;
  for (let i = 1; i < present.length; i++) {
    const prevStage = present[i - 1];
    const stage = present[i];
    const delta = marks[stage]! - marks[prevStage]!;
    lines.push(`  ${prevStage} → ${stage}: ${delta.toFixed(0)}ms`);
  }
  const totalEnd = marks[present[present.length - 1]]!;
  lines.push(`  TOTAL (${present[0]} → ${present[present.length - 1]}): ${(totalEnd - turnStart).toFixed(0)}ms`);

  if (segments.length > 0) {
    lines.push('  --- TTS segments ---');
    for (const seg of segments.sort((a, b) => a.index - b.index)) {
      const fetchMs = seg.fetchEnd && seg.fetchStart ? (seg.fetchEnd - seg.fetchStart).toFixed(0) : '?';
      const gapToPlayMs = seg.playStart && seg.fetchEnd ? (seg.playStart - seg.fetchEnd).toFixed(0) : '?';
      const playMs = seg.playEnd && seg.playStart ? (seg.playEnd - seg.playStart).toFixed(0) : '?';
      lines.push(`  segment ${seg.index}: fetch=${fetchMs}ms, gap-to-play=${gapToPlayMs}ms, playback=${playMs}ms`);
    }
  }

  return lines.join('\n');
}

export function finishTurnAndReport(onDebug: (msg: string) => void): void {
  onDebug(`Turn timing report:\n${buildTimingReport()}`);
  resetTurnTiming();
}
