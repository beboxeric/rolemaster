// Quick heuristic language detection. Used by Surface C (Copilot) for mirroring.

export function detectLanguage(text) {
  if (!text) return 'en';
  const cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  const latin = (text.match(/[A-Za-z]/g) || []).length;
  if (cjk === 0) return 'en';
  if (latin === 0) return 'zh';
  if (cjk >= latin / 2) return 'zh';
  if (latin >= cjk * 4) return 'en';
  return 'mixed';
}
