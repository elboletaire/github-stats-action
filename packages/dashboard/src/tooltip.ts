// One floating tooltip, shown on hover and on tap. A touch tap outside any chart hides it.

const CHART_CLASS = 'tipzone';

function tipEl(): HTMLElement {
  return document.getElementById('tip') as HTMLElement;
}

export function showTip(html: string, ev: { clientX: number; clientY: number }): void {
  const tip = tipEl();
  tip.innerHTML = html;
  tip.style.display = 'block';
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  let x = ev.clientX + 14;
  let y = ev.clientY + 14;
  if (x + w > innerWidth - 8) x = ev.clientX - w - 14;
  if (y + h > innerHeight - 8) y = ev.clientY - h - 14;
  tip.style.left = `${Math.max(8, x)}px`;
  tip.style.top = `${Math.max(8, y)}px`;
}

export function hideTip(): void {
  tipEl().style.display = 'none';
}

/** Shows `fn`'s tooltip while the pointer moves over `node` and when it is tapped. */
export function tipOn(node: Element, fn: (ev: PointerEvent) => void): void {
  node.classList.add(CHART_CLASS);
  node.addEventListener('pointermove', (ev) => fn(ev as PointerEvent));
  node.addEventListener('pointerdown', (ev) => fn(ev as PointerEvent));
  // a touch tip stays until the next tap elsewhere, so only a mouse leaving hides it
  node.addEventListener('pointerleave', (ev) => {
    if ((ev as PointerEvent).pointerType !== 'touch') hideTip();
  });
}

export function installTouchDismiss(): void {
  document.addEventListener('pointerdown', (ev) => {
    const target = ev.target as Element;
    if (ev.pointerType === 'touch' && !target.closest?.(`.${CHART_CLASS}`)) hideTip();
  });
}
