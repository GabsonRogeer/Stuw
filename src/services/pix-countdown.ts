const CYCLE_SECONDS = 10 * 60;
const VISUAL_SECONDS = 3 * CYCLE_SECONDS;

// The provider's persisted deadline is authoritative, including its transport margin.
// The three ten-minute segments cover its final thirty minutes; no cycle extends it.
export function pixCountdown(expiresAt: string, now: number) {
  const deadline = Date.parse(expiresAt);
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) return null;
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const visual = Math.min(VISUAL_SECONDS, remaining);
  const cycle = Math.min(3, Math.floor((VISUAL_SECONDS - visual) / CYCLE_SECONDS) + 1);
  const cycleRemaining = remaining === 0 ? 0 : visual - (3 - cycle) * CYCLE_SECONDS;
  const format = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return {
    remaining,
    label: format(remaining),
    cycle,
    cycleLabel: format(cycleRemaining),
    inCycles: remaining <= VISUAL_SECONDS,
    segments: [0, 1, 2].map((index) =>
      Math.max(0, Math.min(1, (visual - (2 - index) * CYCLE_SECONDS) / CYCLE_SECONDS)),
    ),
  };
}
