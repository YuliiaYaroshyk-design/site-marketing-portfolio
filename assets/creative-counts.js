for (const feed of document.querySelectorAll('.creative-feed:not([data-creative-steps])')) {
  const cards = Array.from(feed.children);
  if (!cards.length) continue;
  if (cards.length === 1 && cards[0].querySelector('video')) continue;

  const count = document.createElement('p');
  count.className = 'creative-count';
  const hasArrows = feed.hasAttribute('data-creative-arrows');
  const arrows = [];
  if (hasArrows) {
    const navigation = document.createElement('div');
    navigation.className = 'creative-feed-nav';
    for (const [direction, symbol, label] of [[-1, '←', 'Попередній слайд'], [1, '→', 'Наступний слайд']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = symbol;
      button.setAttribute('aria-label', label);
      button.addEventListener('click', () => {
        const distance = cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left;
        const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
        feed.scrollBy({ left: direction * distance, behavior });
      });
      arrows.push(button);
    }
    navigation.append(arrows[0], count, arrows[1]);
    feed.after(navigation);
  } else {
    feed.after(count);
  }

  function updateCount() {
    if (hasArrows) {
      arrows[0].disabled = feed.scrollLeft <= 1;
      arrows[1].disabled = feed.scrollLeft >= feed.scrollWidth - feed.clientWidth - 1;
    }
    const viewport = feed.getBoundingClientRect();
    const visible = cards.flatMap((card, index) => {
      const bounds = card.getBoundingClientRect();
      const overlap = Math.min(bounds.right, viewport.right) - Math.max(bounds.left, viewport.left);
      return overlap > 1 ? [index + 1] : [];
    });
    if (!visible.length) return;

    const first = visible[0];
    const last = visible[visible.length - 1];
    const position = first === last ? String(first) : `${first}–${last}`;
    const label = `${position} / ${cards.length}`;
    if (count.textContent !== label) count.textContent = label;
  }

  feed.addEventListener('scroll', updateCount, { passive: true });
  const observer = new ResizeObserver(updateCount);
  observer.observe(feed);
  updateCount();
}
