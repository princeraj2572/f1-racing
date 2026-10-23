/**
 * Wraps each word of an element in a masked span so it can slide up from below its own line.
 * Returns the inner spans to animate. Safe to call once per element.
 */
export function splitWords(el: HTMLElement): HTMLElement[] {
  const text = el.textContent ?? '';
  const words = text.split(/\s+/).filter(Boolean);
  const inner: HTMLElement[] = [];
  el.replaceChildren();
  words.forEach((word, i) => {
    const mask = document.createElement('span');
    mask.className = 'w';
    const span = document.createElement('span');
    span.className = 'w__i';
    span.textContent = word;
    mask.append(span);
    el.append(mask);
    if (i < words.length - 1) el.append(' ');
    inner.push(span);
  });
  return inner;
}
