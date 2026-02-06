/**
 * Fisher-Yates Shuffle, dann erste n Elemente („Spotify-Shuffle“-Stil).
 */
export function shuffleTake<T>(array: T[], take: number): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, take);
}
