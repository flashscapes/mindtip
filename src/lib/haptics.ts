/** Light haptic tap for a selection action. Silently does nothing on iOS
 * Safari or any browser without the Vibration API — Apple has never
 * implemented it on WebKit, so this is a real, deliberate platform gap,
 * not a bug. Safe to call unconditionally anywhere. */
export function tapHaptic() {
  navigator.vibrate?.(10)
}
