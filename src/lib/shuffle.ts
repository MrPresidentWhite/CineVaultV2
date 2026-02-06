/**
 * Spotify-Stil Shuffle: Fisher-Yates mit Bias-Korrektur + Rotation.
 * Entspricht dem alten CineVault random.ts – mehr Variation, weniger repetitive Top-Ergebnisse.
 */
function spotifyShuffle<T>(items: T[], limit: number): T[] {
  const a = [...items];
  const n = a.length;
  if (n === 0) return [];
  if (n <= limit) return a;

  // Fisher–Yates mit leichter Bias-Korrektur (mehr Gewicht Richtung Ende)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(
      Math.pow(Math.random(), 1.1 + Math.random() * 0.3) * (i + 1)
    );
    [a[i], a[j]] = [a[j], a[i]];
  }

  // Rotation: gleiche Top-Ergebnisse vermeiden
  const offset = Math.floor(Math.random() * Math.min(limit, n));
  const rotated = a.slice(offset).concat(a.slice(0, offset));

  return rotated.slice(0, limit);
}

/**
 * Nimmt aus dem Array eine zufällige Auswahl im Spotify-Shuffle-Stil.
 */
export function shuffleTake<T>(array: T[], take: number): T[] {
  return spotifyShuffle(array, take);
}
