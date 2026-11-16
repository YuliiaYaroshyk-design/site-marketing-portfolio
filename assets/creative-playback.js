const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const animations = new Map();

for (const video of document.querySelectorAll('video[data-play-on-scroll]')) {
  animations.set(video, playing => {
    if (playing) {
      if (video.currentTime > 0) video.currentTime = 0;
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  });
}

for (const source of document.querySelectorAll('picture > source[data-motion-srcset]')) {
  animations.set(source.parentElement.querySelector('img'), playing => {
    if (playing) source.srcset = source.dataset.motionSrcset;
    else source.removeAttribute('srcset');
  });
}

const feeds = new Map();
const visible = new Set();
const playing = new Set();
const playbackThreshold = 0.5;

for (const target of animations.keys()) {
  const feed = target.closest('.creative-feed');
  if (!feed || feeds.has(feed)) continue;

  const cards = [...feed.children];
  const openingAnimation = [...feed.querySelectorAll('video, img')]
    .find(media => animations.has(media));
  feed.classList.add('creative-feed-with-motion');
  feeds.set(feed, { cards, openingAnimation });
  feed.addEventListener('scroll', updatePlayback, { passive: true });
}

function updatePlayback() {
  const next = new Set();
  if (!reducedMotion.matches && !document.hidden) {
    for (const target of visible) {
      if (!target.closest('.creative-feed')) next.add(target);
    }

    for (const [feed, { cards, openingAnimation }] of feeds) {
      const viewport = feed.getBoundingClientRect();
      const maxScroll = feed.scrollWidth - feed.clientWidth;
      const progress = maxScroll > 0 ? Math.min(1, Math.max(0, feed.scrollLeft / maxScroll)) : 0;
      // Move the active point across the viewport so every card can become
      // active, including the last few cards when scrolling ends.
      const cardWidth = cards[0].getBoundingClientRect().width;
      const inset = Math.min(cardWidth, feed.clientWidth) / 2;
      const activePoint = feed.clientWidth < 2 * cardWidth
        ? viewport.left + feed.clientWidth / 2
        : viewport.left + inset + progress * (feed.clientWidth - 2 * inset);
      const current = cards.find(card => {
        const bounds = card.getBoundingClientRect();
        return bounds.right + 6 > activePoint;
      });
      const target = current?.querySelector('video, img');
      if (visible.has(target)) {
        next.add(target);
      } else if (feed.hasAttribute('data-play-visible-video')) {
        // Keep a visible video playing when the active point lands on a still.
        let visibleVideo;
        let closestDistance = Infinity;
        for (const video of feed.querySelectorAll('video[data-play-on-scroll]')) {
          if (!visible.has(video)) continue;
          const bounds = video.getBoundingClientRect();
          const distance = Math.abs(bounds.left + bounds.width / 2 - activePoint);
          if (distance < closestDistance) {
            visibleVideo = video;
            closestDistance = distance;
          }
        }
        if (visibleVideo) next.add(visibleVideo);
      } else if (current === cards[0] && visible.has(openingAnimation)) {
        next.add(openingAnimation);
      }
    }
  }

  for (const target of playing) {
    if (next.has(target)) continue;
    animations.get(target)(false);
    playing.delete(target);
  }

  for (const target of next) {
    if (playing.has(target)) continue;
    animations.get(target)(true);
    playing.add(target);
  }
}

const observer = new IntersectionObserver(entries => {
  for (const { target, intersectionRatio } of entries) {
    if (intersectionRatio >= playbackThreshold) visible.add(target);
    else visible.delete(target);
  }
  updatePlayback();
}, { threshold: playbackThreshold });

for (const target of animations.keys()) observer.observe(target);
reducedMotion.addEventListener('change', updatePlayback);
document.addEventListener('visibilitychange', updatePlayback);

const resizeObserver = new ResizeObserver(updatePlayback);
for (const feed of feeds.keys()) resizeObserver.observe(feed);

const preloadObserver = new IntersectionObserver(entries => {
  if (reducedMotion.matches) return;
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    const videos = target.matches('video') ? [target] : target.querySelectorAll('video[data-play-on-scroll]');
    for (const video of videos) video.preload = 'auto';
    preloadObserver.unobserve(target);
  }
}, { rootMargin: '650px 0px' });

for (const video of document.querySelectorAll('video[data-play-on-scroll]')) {
  preloadObserver.observe(video.closest('.creative-feed') ?? video);
}
