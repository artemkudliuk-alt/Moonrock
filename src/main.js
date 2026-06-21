/* ==========================================================================
   Moonrock Bali — Premium Video Scrubbing & Interaction Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // --- CONFIGURATION & CONSTANTS ---
  const stopTimes = [
    0.0,    // Screen 1 (Hero Loop)
    4.0,    // Screen 2: Welcome & Location (00:00:04:00)
    9.0,    // Screen 3: Panoramic Living (00:00:09:00)
    14.050, // Screen 4: Infinity Pool (14:03 @60fps)
    19.050, // Screen 5: Open Spaces (19:03 @60fps)
    24.100, // Screen 6: Master Bedroom (24:06 @60fps)
    29.200  // Screen 7: Night Final (29:12 @60fps)
  ];

  const scrubSpeedFactor = 2.5; // Video speed multiplier during transition
  const scrollCooldownMs = 1600; // Cooldown between transitions

  // --- STATE VARIABLES ---
  let currentSlide = 1;
  let isTransitioning = false;
  let lastScrollTime = 0;
  
  // Video Scrubbing State
  let targetTime = 0.0;
  let sourceTime = 0.0;
  let transitionStartTime = 0;
  let transitionDuration = 0;

  // Touch Swipe State
  let touchStartY = 0;

  // --- DOM ELEMENTS ---
  const preloader = document.getElementById('preloader');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  
  const heroVideo = document.getElementById('hero-video');
  const scrollVideo = document.getElementById('scroll-video');
  
  const activeSlideNum = document.getElementById('active-slide-num');
  const timelineFill = document.getElementById('timeline-fill');
  const slides = document.querySelectorAll('.slide');
  
  const menuBtn = document.getElementById('menu-btn');
  const menuCloseBtn = document.getElementById('menu-close-btn');
  const menuOverlay = document.getElementById('menu-overlay');
  
  const bookingForm = document.getElementById('booking-form');
  const toastContainer = document.getElementById('toast-container');

  // --- BLOB CACHING & PRELOADER ---
  const isMobileOrTablet = window.innerWidth <= 1024;
  const scrollVideoUrl = isMobileOrTablet ? '/Video_scroll_720_opt.mp4?v=2' : '/Video_scroll_opt.mp4?v=2';
  const scrollVideoSize = isMobileOrTablet ? 23859200 : 45690000; // ~22.7MB vs ~43.5MB

  const assetsToLoad = [
    { url: '/Hero_banner video.mp4?v=2', size: 16303593, loaded: 0 },
    { url: scrollVideoUrl, size: scrollVideoSize, loaded: 0 }
  ];

  const totalBytes = assetsToLoad.reduce((acc, item) => acc + item.size, 0);
  let loadedBlobs = [];

  function preloadAssets() {
    assetsToLoad.forEach((asset, index) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', asset.url, true);
      xhr.responseType = 'blob';

      xhr.onprogress = (e) => {
        if (e.lengthComputable) {
          asset.loaded = e.loaded;
        } else {
          asset.loaded = Math.min(e.loaded, asset.size);
        }
        updateProgressBar();
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          loadedBlobs[index] = URL.createObjectURL(xhr.response);
          checkLoadingComplete();
        } else {
          handlePreloadError(index, `Status ${xhr.status}`);
        }
      };

      xhr.onerror = () => {
        handlePreloadError(index, 'Network Error');
      };

      xhr.send();
    });
  }

  function updateProgressBar() {
    const totalLoaded = assetsToLoad.reduce((acc, item) => acc + item.loaded, 0);
    const percent = Math.floor((totalLoaded / totalBytes) * 100);
    const clampedPercent = Math.min(percent, 99); // Hold at 99% until blobs are fully created
    
    progressBar.style.width = `${clampedPercent}%`;
    if (progressText) {
      progressText.innerText = `PRELOADING EXPERIENCE ${clampedPercent}%`;
    }
  }

  function checkLoadingComplete() {
    if (loadedBlobs[0] && loadedBlobs[1]) {
      progressBar.style.width = '100%';
      if (progressText) {
        progressText.innerText = 'PRELOADING EXPERIENCE 100%';
      }

      // Assign Blobs
      heroVideo.src = loadedBlobs[0];
      scrollVideo.src = loadedBlobs[1];

      // Prepare video play-pause handshake for iOS and general performance
      scrollVideo.load();
      scrollVideo.play().then(() => {
        scrollVideo.pause();
      }).catch(err => console.log('Video warm-up handshake completed.'));

      // Fade out preloader
      setTimeout(() => {
        preloader.classList.add('fade-out');
        setTimeout(() => {
          slides[0].classList.add('active');
        }, 300);
      }, 600);
    }
  }

  function handlePreloadError(index, reason) {
    console.warn(`Preload failed for ${assetsToLoad[index].url} (${reason}). Falling back to stream.`);
    heroVideo.src = assetsToLoad[0].url;
    scrollVideo.src = scrollVideoUrl;
    
    preloader.classList.add('fade-out');
    slides[0].classList.add('active');
  }

  // Start preloading immediately
  preloadAssets();


  // --- VIDEO SCRUBBING ENGINE (requestAnimationFrame) ---

  function animateVideoScrub(timestamp) {
    if (!isTransitioning) return;

    if (!transitionStartTime) transitionStartTime = timestamp;
    const progress = (timestamp - transitionStartTime) / transitionDuration;

    if (progress >= 1.0) {
      // Transition finished
      scrollVideo.currentTime = targetTime;
      isTransitioning = false;
      
      // If we returned to Slide 1, switch back to Hero Video loop
      if (targetTime === 0.0) {
        heroVideo.classList.add('active');
        scrollVideo.classList.remove('active');
      }
      
      // Trigger slide content reveals
      updateActiveClasses();
    } else {
      // Linearly interpolate time
      const currentTime = sourceTime + (targetTime - sourceTime) * progress;
      
      // On Android/Chrome, prevent decoder choke by skipping seeking if previous seek is not done
      if (!scrollVideo.seeking) {
        scrollVideo.currentTime = currentTime;
      }
      
      // Continue animation loop
      requestAnimationFrame(animateVideoScrub);
    }
  }

  function goToSlide(targetSlideIndex) {
    if (isTransitioning) return;
    if (targetSlideIndex < 1 || targetSlideIndex > 7) return;
    if (targetSlideIndex === currentSlide) return;

    const now = Date.now();
    if (now - lastScrollTime < scrollCooldownMs) return;
    lastScrollTime = now;

    const sourceSlideIndex = currentSlide;
    currentSlide = targetSlideIndex;

    // Time calculations
    sourceTime = stopTimes[sourceSlideIndex - 1];
    targetTime = stopTimes[targetSlideIndex - 1];

    // Delta time calculation
    const deltaTime = Math.abs(targetTime - sourceTime);
    // Transition duration at constant speed factor (in ms)
    transitionDuration = (deltaTime / scrubSpeedFactor) * 1000;
    
    // Safety fallback for instantaneous transitions
    if (transitionDuration === 0) transitionDuration = 100;

    isTransitioning = true;
    transitionStartTime = 0;

    // Cross-fade videos:
    // If moving AWAY from Slide 1: hide hero video, show scroll video
    if (sourceSlideIndex === 1) {
      heroVideo.classList.remove('active');
      scrollVideo.classList.add('active');
      scrollVideo.currentTime = 0.0;
    }
    
    // If returning to Slide 1: keep scroll video active until it finishes scrubbing back
    if (targetSlideIndex === 1) {
      heroVideo.classList.remove('active');
      scrollVideo.classList.add('active');
    }

    // Slide transition classes
    slides.forEach((slide, idx) => {
      const slideNum = idx + 1;
      slide.classList.remove('active', 'prev');
      
      if (slideNum < currentSlide) {
        slide.classList.add('prev');
      }
    });

    // Start scrubbing frame loop
    requestAnimationFrame(animateVideoScrub);
  }

  function updateActiveClasses() {
    slides.forEach((slide, idx) => {
      const slideNum = idx + 1;
      slide.classList.remove('active', 'prev');
      if (slideNum === currentSlide) {
        slide.classList.add('active');
      } else if (slideNum < currentSlide) {
        slide.classList.add('prev');
      }
    });

    // Update timeline indicator
    if (activeSlideNum) {
      activeSlideNum.innerText = currentSlide.toString().padStart(2, '0');
    }
    if (timelineFill) {
      const progressPercent = ((currentSlide - 1) / (slides.length - 1)) * 100;
      timelineFill.style.height = `${progressPercent}%`;
    }

    // Update Header Navigation Active Links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      const target = parseInt(link.getAttribute('data-goto'), 10);
      link.classList.toggle('active', target === currentSlide);
    });
  }


  // --- USER INTERFACE EVENTS (Wheel, Key, Touch) ---

  // Mouse wheel scroll handler
  window.addEventListener('wheel', (e) => {
    // If overlay menu is open, let standard scroll events proceed inside it
    if (menuOverlay.classList.contains('open')) return;

    const activeSlide = document.querySelector('.slide.active');
    if (activeSlide && activeSlide.scrollHeight > activeSlide.clientHeight) {
      // If we scroll down and haven't reached the bottom of the slide, let native scroll happen
      if (e.deltaY > 0 && activeSlide.scrollTop + activeSlide.clientHeight < activeSlide.scrollHeight - 5) {
        return;
      }
      // If we scroll up and haven't reached the top of the slide, let native scroll happen
      if (e.deltaY < 0 && activeSlide.scrollTop > 5) {
        return;
      }
    }

    e.preventDefault(); // Lock native scroll
    if (e.deltaY > 20) {
      goToSlide(currentSlide + 1);
    } else if (e.deltaY < -20) {
      goToSlide(currentSlide - 1);
    }
  }, { passive: false });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (menuOverlay.classList.contains('open')) return;
    
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      goToSlide(currentSlide + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      goToSlide(currentSlide - 1);
    }
  });

  // Touch Swipe Gesture handler
  window.addEventListener('touchstart', (e) => {
    if (menuOverlay.classList.contains('open')) return;
    touchStartY = e.touches[0].clientY;
  });

  window.addEventListener('touchmove', (e) => {
    if (menuOverlay.classList.contains('open')) return;
    
    const activeSlide = document.querySelector('.slide.active');
    if (activeSlide && activeSlide.scrollHeight > activeSlide.clientHeight) {
      const currentY = e.touches[0].clientY;
      const diffY = touchStartY - currentY; // > 0 means swiping UP (scrolling DOWN)
      
      // If scrolling down and not at the bottom of the slide container
      if (diffY > 0 && activeSlide.scrollTop + activeSlide.clientHeight < activeSlide.scrollHeight - 2) {
        return;
      }
      // If scrolling up and not at the top of the slide container
      if (diffY < 0 && activeSlide.scrollTop > 2) {
        return;
      }
    }
    
    // Prevent default bounce and scrolling behaviour on mobile
    if (e.cancelable) e.preventDefault();
  }, { passive: false });

  window.addEventListener('touchend', (e) => {
    if (menuOverlay.classList.contains('open')) return;

    const touchEndY = e.changedTouches[0].clientY;
    const diffY = touchStartY - touchEndY;

    const activeSlide = document.querySelector('.slide.active');
    if (activeSlide && activeSlide.scrollHeight > activeSlide.clientHeight) {
      // Only switch slides when we reach the physical boundaries of the scrollable slide
      if (diffY > 50 && activeSlide.scrollTop + activeSlide.clientHeight >= activeSlide.scrollHeight - 5) {
        goToSlide(currentSlide + 1);
      } else if (diffY < -50 && activeSlide.scrollTop <= 5) {
        goToSlide(currentSlide - 1);
      }
    } else {
      if (diffY > 50) {
        goToSlide(currentSlide + 1);
      } else if (diffY < -50) {
        goToSlide(currentSlide - 1);
      }
    }
  });


  // Global links (header, overlay menu, in-page buttons)
  document.addEventListener('click', (e) => {
    const targetElement = e.target.closest('[data-goto]');
    if (targetElement) {
      e.preventDefault();
      const targetIndex = parseInt(targetElement.getAttribute('data-goto'), 10);
      
      // Close overlay menu first if open
      if (menuOverlay.classList.contains('open')) {
        closeMenu();
        setTimeout(() => {
          goToSlide(targetIndex);
        }, 400); // Wait for menu slide out before starting transition
      } else {
        goToSlide(targetIndex);
      }
    }
  });


  // --- OVERLAY HAMBURGER MENU ---

  function openMenu() {
    menuOverlay.classList.add('open');
    // Rotate hamburger spans to X form
    const spans = document.querySelectorAll('.hamburger-icon span');
    spans[0].style.transform = 'translateY(6px) rotate(45deg)';
    spans[1].style.transform = 'translateY(-6px) rotate(-45deg)';
  }

  function closeMenu() {
    menuOverlay.classList.remove('open');
    // Reset hamburger spans
    const spans = document.querySelectorAll('.hamburger-icon span');
    spans[0].style.transform = 'none';
    spans[1].style.transform = 'none';
  }

  menuBtn.addEventListener('click', () => {
    if (menuOverlay.classList.contains('open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  menuCloseBtn.addEventListener('click', closeMenu);


  // --- MAGNETIC BUTTONS EFFECT ---

  const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  if (!isMobile) {
    document.querySelectorAll('[data-magnetic]').forEach(element => {
      element.addEventListener('mousemove', (e) => {
        const bound = element.getBoundingClientRect();
        
        // Calculate offset from center of the button
        const x = e.clientX - bound.left - (bound.width / 2);
        const y = e.clientY - bound.top - (bound.height / 2);
        
        // Translate with a damping ratio of 0.35
        element.style.setProperty('--mx', `${x * 0.35}px`);
        element.style.setProperty('--my', `${y * 0.35}px`);
        element.style.setProperty('will-change', 'transform');
      });

      element.addEventListener('mouseleave', () => {
        // Return to 0 position
        element.style.setProperty('--mx', '0px');
        element.style.setProperty('--my', '0px');
        
        element.addEventListener('transitionend', () => {
          element.style.setProperty('will-change', 'auto');
        }, { once: true });
      });
    });
  }


  // --- TOAST NOTIFICATIONS & FORM SUBMISSION ---

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-success-icon"></span><span>${message}</span>`;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove toast
    setTimeout(() => {
      toast.style.animation = 'toastIn 0.5s ease reverse';
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, 3500);
  }

  // Specs and Suites click alerts
  const btnSpecs = document.getElementById('btn-specs');
  const btnSuites = document.getElementById('btn-suites');

  if (btnSpecs) {
    btnSpecs.addEventListener('click', () => {
      showToast('PDF BROCHURE DOWNLOAD STARTED');
    });
  }

  if (btnSuites) {
    btnSuites.addEventListener('click', () => {
      showToast('SPECIFICATION SHEET DOWNLOAD STARTED');
    });
  }

  // Booking Form Submission
  if (bookingForm) {
    bookingForm.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = document.getElementById('form-name').value;
      const email = document.getElementById('form-email').value;
      
      showToast(`THANK YOU, ${name.toUpperCase()}! REQUEST RECEIVED.`);
      
      // Reset form
      bookingForm.reset();
    });
  }


  // --- INTERACTIVE VIDEO DEBUGGER OVERLAY ---

  let debugMode = false;
  let debugOverlay = null;

  function createDebugOverlay() {
    debugOverlay = document.createElement('div');
    debugOverlay.id = 'video-debug-overlay';
    debugOverlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      background: rgba(13, 13, 13, 0.95);
      color: #F7F5F0;
      padding: 20px;
      z-index: 99999;
      font-family: monospace;
      border: 1px solid #C5A880;
      font-size: 12px;
      line-height: 1.5;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      display: none;
    `;
    
    debugOverlay.innerHTML = `
      <div style="font-weight: bold; color: #C5A880; margin-bottom: 10px; letter-spacing: 0.1em;">VIDEO DEBUGGER</div>
      <div>Current Time: <span id="debug-time" style="color: #fff; font-weight: bold;">0.000</span>s</div>
      <div>Current Slide: <span id="debug-slide">1</span></div>
      <hr style="border: 0; border-top: 1px solid rgba(247,245,240,0.1); margin: 12px 0;">
      <div style="opacity: 0.7; font-size: 10px; display: flex; flex-direction: column; gap: 4px;">
        <span>[A] / [S] : Шаг -/+ 1 кадр (0.016s)</span>
        <span>[Q] / [W] : Шаг -/+ 10 кадров (0.166s)</span>
        <span>[D] : Скрыть отладчик</span>
      </div>
    `;
    document.body.appendChild(debugOverlay);
  }

  createDebugOverlay();

  function updateDebugInfo() {
    if (!debugOverlay) return;
    document.getElementById('debug-time').innerText = scrollVideo.currentTime.toFixed(3);
    document.getElementById('debug-slide').innerText = currentSlide;
  }

  // Keyboard debug listener
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    
    if (key === 'd') {
      debugMode = !debugMode;
      debugOverlay.style.display = debugMode ? 'block' : 'none';
      if (debugMode) {
        // Show scroll video for debugging
        heroVideo.classList.remove('active');
        scrollVideo.classList.add('active');
        updateDebugInfo();
        showToast('DEBUG MODE ACTIVE');
      } else {
        // Return to normal screen state
        goToSlide(currentSlide);
      }
      return;
    }

    if (!debugMode) return;

    // Manual frame stepping when debug mode is active
    const frameTime = 1 / 60; // 60fps frame duration (~0.0166s)
    let newTime = scrollVideo.currentTime;

    if (key === 'a') {
      newTime = Math.max(0, newTime - frameTime);
      scrollVideo.currentTime = newTime;
      e.preventDefault();
    } else if (key === 's') {
      newTime = Math.min(scrollVideo.duration, newTime + frameTime);
      scrollVideo.currentTime = newTime;
      e.preventDefault();
    } else if (key === 'q') {
      newTime = Math.max(0, newTime - frameTime * 10);
      scrollVideo.currentTime = newTime;
      e.preventDefault();
    } else if (key === 'w') {
      newTime = Math.min(scrollVideo.duration, newTime + frameTime * 10);
      scrollVideo.currentTime = newTime;
      e.preventDefault();
    }

    updateDebugInfo();
  });

  // Also update debug info during transitions if active
  scrollVideo.addEventListener('timeupdate', () => {
    if (debugMode) {
      updateDebugInfo();
    }
  });

});
