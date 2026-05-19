// Inline-SVG QR-code placeholder. Three corner finder squares + a
// scattered dot pattern. Looks unmistakeably like a QR; replace with
// a real WeChat QR <img> when available.

export function QRPlaceholder({ onDark = false }) {
  return (
    <div className={'lr-qr' + (onDark ? ' lr-qr-on-dark' : '')} aria-label="QR code placeholder">
      <svg viewBox="0 0 120 120" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        {/* finder squares (top-left, top-right, bottom-left) */}
        {[
          [6, 6], [86, 6], [6, 86],
        ].map(([x, y], i) => (
          <g key={i}>
            <rect x={x} y={y} width="28" height="28" rx="2" fill="none" stroke="currentColor" strokeWidth="6" />
            <rect x={x + 10} y={y + 10} width="8" height="8" />
          </g>
        ))}
        {/* scattered modules — fixed pseudo-random pattern so it always looks like a QR */}
        {[
          [44,12,8],[60,12,4],[68,16,4],[44,20,4],[52,24,8],[44,32,4],[60,32,8],
          [44,40,4],[52,44,4],[60,48,8],[40,52,4],[48,56,8],[60,60,4],[68,60,4],
          [76,56,8],[88,52,4],[100,52,4],[40,64,8],[56,68,4],[68,68,8],[80,72,4],[96,68,4],
          [44,80,4],[56,80,8],[40,88,4],[60,92,4],[72,88,8],[88,92,4],[100,84,4],
          [40,100,4],[52,104,8],[64,100,4],[80,104,4],[96,100,8],[44,108,4],[60,112,4],
        ].map(([x, y, s], i) => (
          <rect key={`d${i}`} x={x} y={y} width={s} height={s} />
        ))}
      </svg>
    </div>
  );
}
