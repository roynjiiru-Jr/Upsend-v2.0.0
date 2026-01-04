// Slideshow functionality
let currentSlide = 0;
let totalSlides = 0;
let touchStartX = 0;
let touchEndX = 0;

function initSlideshow() {
    const container = document.getElementById('slideshow-container');
    if (!container) return;
    
    totalSlides = container.children.length;
    
    // Attach click handlers to navigation buttons
    const prevBtn = document.getElementById('prev-slide-btn');
    const nextBtn = document.getElementById('next-slide-btn');
    
    if (prevBtn) {
        prevBtn.onclick = function() { slideshowPrevious(); };
    }
    
    if (nextBtn) {
        nextBtn.onclick = function() { slideshowNext(); };
    }
    
    // Attach click handlers to dots
    const dots = document.querySelectorAll('.slide-dot');
    dots.forEach((dot, index) => {
        dot.onclick = function() { slideshowGoTo(index); };
    });
    
    // Touch/swipe support
    container.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });
    
    container.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSlideshowSwipe();
    });
}

function handleSlideshowSwipe() {
    const swipeThreshold = 50;
    if (touchEndX < touchStartX - swipeThreshold) {
        slideshowNext();
    }
    if (touchEndX > touchStartX + swipeThreshold) {
        slideshowPrevious();
    }
}

function slideshowNext() {
    currentSlide = (currentSlide + 1) % totalSlides;
    updateSlideshowDisplay();
}

function slideshowPrevious() {
    currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
    updateSlideshowDisplay();
}

function slideshowGoTo(index) {
    currentSlide = index;
    updateSlideshowDisplay();
}

function updateSlideshowDisplay() {
    const container = document.getElementById('slideshow-container');
    if (!container) return;
    
    const offset = -currentSlide * 100;
    container.style.transform = 'translateX(' + offset + '%)';
    
    // Update dots
    const dots = document.querySelectorAll('.slide-dot');
    dots.forEach((dot, idx) => {
        if (idx === currentSlide) {
            dot.classList.remove('bg-opacity-50');
            dot.classList.add('bg-opacity-100');
        } else {
            dot.classList.remove('bg-opacity-100');
            dot.classList.add('bg-opacity-50');
        }
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        setTimeout(initSlideshow, 500);
    });
} else {
    setTimeout(initSlideshow, 500);
}
