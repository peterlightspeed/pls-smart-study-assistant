/** SVG ring for the productivity score (0-100). */
export function progressRing(value, { size = 96, stroke = 10, label = "" } = {}) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${label || `Score ${v} out of 100`}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--pls-border)" stroke-width="${stroke}"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--pls-primary)" stroke-width="${stroke}" stroke-linecap="round"
      stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - v / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})" style="transition:stroke-dashoffset .5s var(--pls-ease)"/>
    <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-size="${size * 0.3}" font-weight="600" fill="var(--pls-text)">${v}</text></svg>`;
}
