// Slideshow functionality for event images
window.initSlideshow = function() {
  const container = document.getElementById('slideshow-container');
  if (!container) return;

  const slides = container.querySelectorAll('img');
  if (slides.length <= 1) return;

  let currentIndex = 0;
  let autoplayTimer = null;

  function goToSlide(index) {
    currentIndex = (index + slides.length) % slides.length;
    container.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Update dot indicators
    document.querySelectorAll('.slide-dot').forEach((dot, i) => {
      dot.classList.toggle('bg-opacity-100', i === currentIndex);
      dot.classList.toggle('bg-opacity-50', i !== currentIndex);
    });
  }

  function nextSlide() {
    goToSlide(currentIndex + 1);
  }

  function prevSlide() {
    goToSlide(currentIndex - 1);
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayTimer = setInterval(nextSlide, 4000);
  }

  function stopAutoplay() {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  // Bind navigation buttons
  const prevBtn = document.getElementById('prev-slide-btn');
  const nextBtn = document.getElementById('next-slide-btn');

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      stopAutoplay();
      prevSlide();
      startAutoplay();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      stopAutoplay();
      nextSlide();
      startAutoplay();
    });
  }

  // Bind dot indicators
  document.querySelectorAll('.slide-dot').forEach((dot) => {
    dot.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.slideIndex || '0');
      stopAutoplay();
      goToSlide(idx);
      startAutoplay();
    });
  });

  // Touch/swipe support
  let touchStartX = 0;
  container.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  });

  container.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      stopAutoplay();
      if (diff > 0) nextSlide();
      else prevSlide();
      startAutoplay();
    }
  });

  // Start autoplay
  startAutoplay();
};
