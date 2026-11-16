const stepReducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

for (const feed of document.querySelectorAll('[data-creative-steps]')) {
  const cards = [...feed.children];
  const navigation = feed.nextElementSibling;
  const previous = navigation.querySelector('[data-previous-step]');
  const next = navigation.querySelector('[data-next-step]');
  const count = navigation.querySelector('output');
  let current = 0;
  let requested = 0;
  let transition;
  let leavingCard;
  const predecode = feed.hasAttribute('data-predecode');

  const restart = feed.hasAttribute('data-restart');
  const forwardLabel = next.getAttribute('aria-label');
  const forwardIcon = next.textContent;

  for (const video of feed.querySelectorAll('video')) video.loop = false;

  function finishTransition() {
    transition?.cancel();
    if (!leavingCard) return;
    leavingCard.hidden = true;
    leavingCard.inert = false;
    leavingCard.classList.remove('creative-step-leaving', 'creative-motion-playing');
    leavingCard = null;
  }

  function showStep(index, play = false) {
    const crossfade = index !== current && play && !stepReducedMotion.matches;
    finishTransition();
    const outgoing = cards[current];
    outgoing.querySelector('video')?.pause();
    current = index;

    cards.forEach((card, position) => { card.hidden = position !== index; });
    if (crossfade) {
      leavingCard = outgoing;
      outgoing.hidden = false;
      outgoing.inert = true;
      outgoing.classList.add('creative-step-leaving');
      transition = outgoing.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 280,
        easing: 'ease-in-out',
        fill: 'forwards',
      });
      transition.onfinish = finishTransition;
    } else {
      outgoing.classList.remove('creative-motion-playing');
    }
    count.value = `${index + 1} / ${cards.length}`;
    previous.disabled = index === 0;
    const atEnd = index === cards.length - 1;
    next.disabled = atEnd && !restart;
    if (restart) {
      next.textContent = atEnd ? '↻' : forwardIcon;
      next.setAttribute('aria-label', atEnd ? 'Почати заново' : forwardLabel);
    }

    if (!play || stepReducedMotion.matches) return;

    const card = cards[index];
    const video = card.querySelector('video');
    if (video) {
      video.currentTime = 0;
      if (crossfade) {
        void transition.finished.then(() => {
          if (cards[current] === card && !stepReducedMotion.matches) return video.play();
        }).catch(() => {});
      } else {
        void video.play().catch(() => {});
      }
    }

    const layers = card.querySelectorAll('.creative-motion img');
    if (layers.length) {
      Promise.all([...layers].map(image => image.decode())).then(() => {
        if (cards[current] === card && !stepReducedMotion.matches) {
          card.classList.add('creative-motion-playing');
        }
      }).catch(() => {}); // The static creative remains visible if a layer fails.
    }
  }

  async function moveStep(index) {
    entryObserver.disconnect();
    if (index < 0 || index >= cards.length) return;
    requested = index;
    if (index === current) return;

    if (!predecode) {
      showStep(index, true);
      return;
    }

    const video = cards[index].querySelector('video');
    const image = video ? new Image() : cards[index].querySelector('img');
    if (video) image.src = video.poster;
    image.loading = 'eager';
    try {
      await image.decode();
    } catch {
      const source = image.parentElement?.querySelector('source');
      if (source) {
        source.remove();
        try {
          await image.decode();
        } catch {
          if (requested === index) requested = current;
          return;
        }
      } else {
        if (requested === index) requested = current;
        return;
      }
    }

    if (requested === index && current !== index) showStep(index, true);
  }

  const entryObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.intersectionRatio >= 0.5)) return;
    entryObserver.disconnect();
    showStep(current, true);
  }, { threshold: 0.5 });

  previous.addEventListener('click', () => void moveStep(requested - 1));
  next.addEventListener('click', () => {
    const restartAtEnd = restart && current === cards.length - 1;
    void moveStep(restartAtEnd ? 0 : requested + 1);
  });
  stepReducedMotion.addEventListener('change', () => {
    if (stepReducedMotion.matches) showStep(current);
  });

  feed.classList.add('creative-feed-stepped');
  feed.parentElement.classList.add('creative-steps-layout');
  navigation.hidden = false;
  showStep(0);
  entryObserver.observe(feed);
}
