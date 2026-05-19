// Anchored capability popover (PATCH-16). Click any RC chip on /rolepacks
// or /curators/library and a small floating card opens next to the chip
// with the capability description in the current locale. Mobile (≤720px)
// switches to a bottom-sheet at the viewport bottom so the chip stays
// visible above the popover. Esc / outside-click / ✕ close. Cap object
// already carries name + description per locale from the API.

import { useEffect, useRef } from 'react';

const MOBILE_QUERY = '(max-width: 720px)';

export function RcPopover({ cap, anchor, lang, onClose }) {
  const popRef = useRef(null);

  // Esc + outside-click dismiss. Outside-click uses mousedown so it fires
  // before any subsequent chip's click handler — prevents flash of
  // "close → reopen" when toggling between chips.
  useEffect(() => {
    if (!cap) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onMouseDown = (e) => {
      const pop = popRef.current;
      if (!pop) return;
      if (pop.contains(e.target)) return;
      // Anchor chip handles its own toggle via onRcClick — let its onClick fire.
      if (anchor && anchor.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [cap, anchor, onClose]);

  // Position the popover on open + on scroll/resize while open. Desktop:
  // anchor below the chip, viewport-edge clamp, flip up if no room. Mobile:
  // CSS handles fixed bottom-sheet positioning — we only clear inline
  // styles so the CSS rules win.
  useEffect(() => {
    if (!cap || !anchor) return;
    const reposition = () => {
      const pop = popRef.current;
      if (!pop) return;
      const isMobile = window.matchMedia(MOBILE_QUERY).matches;
      if (isMobile) {
        pop.style.top = '';
        pop.style.left = '';
        pop.classList.remove('flip-up');
        pop.style.setProperty('--arrow-x', '0px');
        return;
      }
      const r = anchor.getBoundingClientRect();
      const popW = pop.offsetWidth;
      const popH = pop.offsetHeight;
      const margin = 10;
      const vw = document.documentElement.clientWidth;
      const vh = document.documentElement.clientHeight;
      let left = r.left + window.scrollX;
      if (left + popW > window.scrollX + vw - margin) left = window.scrollX + vw - popW - margin;
      if (left < window.scrollX + margin) left = window.scrollX + margin;
      let top = r.bottom + window.scrollY + 8;
      let flipUp = false;
      if (r.bottom + popH + 12 > vh) {
        top = r.top + window.scrollY - popH - 8;
        flipUp = true;
      }
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      pop.classList.toggle('flip-up', flipUp);
      const chipCenterX = r.left + r.width / 2 + window.scrollX;
      const arrowX = Math.max(16, Math.min(popW - 28, chipCenterX - left - 6));
      pop.style.setProperty('--arrow-x', arrowX + 'px');
    };
    reposition();
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition, { passive: true });
    return () => {
      window.removeEventListener('scroll', reposition);
      window.removeEventListener('resize', reposition);
    };
  }, [cap, anchor]);

  if (!cap) return null;
  const name = (lang === 'zh' ? cap.name?.zh : cap.name?.en) || cap.name?.en || cap.name?.zh || '';
  const desc = (lang === 'zh' ? cap.description?.zh : cap.description?.en) || cap.description?.en || cap.description?.zh || '';
  return (
    <div ref={popRef} className="lr-cap-popover is-visible" role="dialog"
      aria-labelledby="lr-cap-popover-id">
      <button type="button" className="lr-cap-popover__close" onClick={onClose}
        aria-label={lang === 'zh' ? '关闭' : 'Close'}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      </button>
      <div className="lr-cap-popover__head">
        <span className="lr-cap-popover__id" id="lr-cap-popover-id">{cap.rc_label || cap.id}</span>
        <span className="lr-cap-popover__name">{name}</span>
      </div>
      <p className="lr-cap-popover__desc">
        {desc || (lang === 'zh' ? '能力伙伴尚未提供说明文字。' : 'No description provided yet.')}
      </p>
    </div>
  );
}
