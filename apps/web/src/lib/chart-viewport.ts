/** Size for the expanded chart modal: 88% of the viewport width capped at
 * 1240px, and 66% of the viewport height. Pure so it can be unit-tested;
 * callers recompute it when the window resizes. */
export function chartViewport(
  windowWidth: number,
  windowHeight: number,
): { width: number; height: number } {
  return {
    width: Math.min(1240, Math.floor(windowWidth * 0.88)),
    height: Math.floor(windowHeight * 0.66),
  };
}
