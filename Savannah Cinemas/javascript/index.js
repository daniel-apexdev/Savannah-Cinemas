(function() {
    'use strict';

    // ============================================================
    // CONFIGURATION
    // ============================================================

    const CONFIG = {
        API_KEY: 'a0b31df2c8c2865ebe236c9e1eb7cbd9',
        IMAGE_BASE: 'https://image.tmdb.org/t/p/w500',
        BACKDROP_BASE: 'https://image.tmdb.org/t/p/original',
        AUTOPLAY_DELAY: 6000,
        MAX_PAGES: 10
    };

    // ============================================================
    // DOM REFS
    // ============================================================

    const DOM = {
        heroSlides: document.getElementById('heroSlides'),
        heroDots: document.getElementById('heroDots'),
        heroPrev: document.getElementById('heroPrev'),
        heroNext: document.getElementById('heroNext'),
        heroCarousel: document.getElementById('heroCarousel'),
        carouselTrack: document.getElementById('carouselTrack'),
        carouselPrev: document.getElementById('carouselPrev'),
        carouselNext: document.getElementById('carouselNext'),
        mobileMenu: document.getElementById('mobileMenu'),
        mobileOverlay: document.getElementById('mobileOverlay'),
        menuToggle: document.getElementById('menuToggle'),
        mobileMenuClose: document.getElementById('mobileMenuClose'),
        profileWrapper: document.getElementById('profileWrapper')
    };

    // ============================================================
    // STATE
    // ============================================================

    let state = {
        allMovies: [],
        currentSlide: 0,
        autoplayInterval: null,
        isTransitioning: false,
        isMobile: window.innerWidth <= 768
    };

    // ============================================================
    // API FUNCTIONS
    // ============================================================

    async function fetchAllPopularMovies() {
        let allMoviesData = [];
        let page = 1;
        let totalPages = 1;

        try {
            const firstResponse = await fetch(
                `https://api.themoviedb.org/3/movie/popular?api_key=${CONFIG.API_KEY}&page=1`
            );

            if (!firstResponse.ok) {
                throw new Error(`API Error: ${firstResponse.status}`);
            }

            const firstData = await firstResponse.json();
            totalPages = Math.min(firstData.total_pages, CONFIG.MAX_PAGES);
            allMoviesData = allMoviesData.concat(firstData.results);

            for (page = 2; page <= totalPages; page++) {
                const response = await fetch(
                    `https://api.themoviedb.org/3/movie/popular?api_key=${CONFIG.API_KEY}&page=${page}`
                );
                if (!response.ok) continue;
                const data = await response.json();
                allMoviesData = allMoviesData.concat(data.results);
            }

            return allMoviesData;
        } catch (error) {
            console.error('Error fetching movies:', error);
            return getFallbackMovies();
        }
    }

    function getFallbackMovies() {
        return [{
            id: 1,
            title: 'Deadpool & Wolverine',
            overview: 'The merc with a mouth teams up with Wolverine for an epic adventure.',
            tagline: 'Get ready for the ultimate team-up.',
            poster_path: '/8cdWjvZQUDoUJvW6sLFLq7JVJ2q.jpg',
            backdrop_path: '/8cdWjvZQUDoUJvW6sLFLq7JVJ2q.jpg',
            vote_average: 8.5,
            release_date: '2024-07-24'
        }];
    }

    // ============================================================
    // UTILITY FUNCTIONS
    // ============================================================

    function getRatingStars(rating) {
        const fullStars = Math.floor(rating / 2);
        let stars = '';
        for (let i = 0; i < 5; i++) {
            stars += i < fullStars ? '★' : '☆';
        }
        return stars;
    }

    function formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        return dateStr.substring(0, 4);
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ============================================================
    // RENDER FUNCTIONS
    // ============================================================

    function renderHeroSlides(movies) {
        if (!movies || movies.length === 0) {
            DOM.heroSlides.innerHTML = `
                <div class="hero-slide" style="min-height:60vh;display:flex;align-items:center;justify-content:center;">
                    No movies available
                </div>
            `;
            return;
        }

        const heroMovies = movies.slice(0, 5);

        DOM.heroSlides.innerHTML = heroMovies.map((movie, index) => {
            const year = formatDate(movie.release_date);
            const stars = getRatingStars(movie.vote_average || 0);
            const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '0.0';
            const backdrop = movie.backdrop_path ? `${CONFIG.BACKDROP_BASE}${movie.backdrop_path}` : '';

            return `
                <div class="hero-slide" style="background-image: url('${backdrop}');" data-index="${index}">
                    <div class="hero-slide-content">
                        <p class="label">🎬 Now Showing</p>
                        <h2 class="movie-title">${movie.title || 'Untitled'}</h2>
                        <p class="movie-year">${year}</p>
                        <p class="tagline">"${movie.tagline || 'Experience the story.'}"</p>
                        <p class="description">${movie.overview || 'No description available.'}</p>
                        <div class="rating-row">
                            <span class="stars">${stars}</span>
                            <span class="rating-number">${rating}</span>
                            <span class="rating-label">/ 10 · Popular</span>
                        </div>
                        <div class="btn-row">
                            <button class="btn btn-primary" onclick="window.bookMovie(${movie.id}, '${movie.title.replace(/'/g, "\\'")}')">
                                🎫 Book tickets
                            </button>
                            <button class="btn btn-ghost" onclick="window.viewMovie(${movie.id})">
                                Learn more →
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        // Generate dots
        DOM.heroDots.innerHTML = heroMovies.map((_, index) =>
            `<button class="hero-dot ${index === 0 ? 'active' : ''}" data-index="${index}" onclick="window.goToSlide(${index})"></button>`
        ).join('');

        updateSlidePosition(0);
    }

    function renderCarousel(movies) {
        if (!movies || movies.length === 0) {
            DOM.carouselTrack.innerHTML = '<p style="color: var(--paper-dim); padding: 20px;">No movies available.</p>';
            return;
        }

        const carouselMovies = movies.slice(5);

        if (carouselMovies.length === 0) {
            DOM.carouselTrack.innerHTML = '<p style="color: var(--paper-dim); padding: 20px;">More movies coming soon.</p>';
            return;
        }

        DOM.carouselTrack.innerHTML = carouselMovies.map(movie => {
            const year = formatDate(movie.release_date);
            const rating = movie.vote_average ? movie.vote_average.toFixed(1) : '0.0';

            return `
                <div class="carousel-card" data-id="${movie.id}" onclick="window.viewMovie(${movie.id})">
                    <div class="film-poster" style="background-image: url(${CONFIG.IMAGE_BASE}${movie.poster_path});">
                        <span class="rating-badge">★ ${rating}</span>
                    </div>
                    <p class="c-title">${movie.title || 'Untitled'}</p>
                    <p class="c-meta">${year} · Popular</p>
                </div>
            `;
        }).join('');
    }

    function updateSlidePosition(index) {
        const slides = DOM.heroSlides.querySelectorAll('.hero-slide');
        if (!slides.length) return;

        const slideWidth = slides[0].offsetWidth || 100;
        DOM.heroSlides.style.transform = `translateX(-${index * slideWidth}px)`;

        document.querySelectorAll('.hero-dot').forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });

        state.currentSlide = index;
    }

    // ============================================================
    // CAROUSEL NAVIGATION
    // ============================================================

    function goToSlide(index) {
        if (state.isTransitioning || index === state.currentSlide) return;
        state.isTransitioning = true;

        const slides = DOM.heroSlides.querySelectorAll('.hero-slide');
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;

        updateSlidePosition(index);
        resetAutoplay();

        setTimeout(() => {
            state.isTransitioning = false;
        }, 500);
    }

    function nextSlide() {
        const slides = DOM.heroSlides.querySelectorAll('.hero-slide');
        goToSlide((state.currentSlide + 1) % slides.length);
    }

    function prevSlide() {
        const slides = DOM.heroSlides.querySelectorAll('.hero-slide');
        goToSlide((state.currentSlide - 1 + slides.length) % slides.length);
    }

    // ============================================================
    // AUTO-PLAY
    // ============================================================

    function startAutoplay() {
        if (state.autoplayInterval) clearInterval(state.autoplayInterval);
        state.autoplayInterval = setInterval(nextSlide, CONFIG.AUTOPLAY_DELAY);
    }

    function resetAutoplay() {
        if (state.autoplayInterval) {
            clearInterval(state.autoplayInterval);
            startAutoplay();
        }
    }

    function stopAutoplay() {
        if (state.autoplayInterval) {
            clearInterval(state.autoplayInterval);
            state.autoplayInterval = null;
        }
    }

    // ============================================================
    // SCROLL FUNCTIONS
    // ============================================================

    function scrollCarousel(direction) {
        const cardWidth = DOM.carouselTrack.querySelector('.carousel-card')?.offsetWidth || 170;
        const gap = 18;
        const scrollAmount = (cardWidth + gap) * 2;

        if (direction === 'left') {
            DOM.carouselTrack.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
        } else {
            DOM.carouselTrack.scrollBy({ left: scrollAmount, behavior: 'smooth' });
        }
    }

    // ============================================================
    // MOBILE MENU FUNCTIONS
    // ============================================================

    function openMobileMenu() {
        DOM.mobileMenu.classList.add('open');
        DOM.mobileOverlay.classList.add('active');
        DOM.menuToggle.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeMobileMenu() {
        DOM.mobileMenu.classList.remove('open');
        DOM.mobileOverlay.classList.remove('active');
        DOM.menuToggle.classList.remove('active');
        document.body.style.overflow = '';
    }

    function toggleMobileMenu() {
        if (DOM.mobileMenu.classList.contains('open')) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }
    }

    // ============================================================
    // WINDOW HANDLERS
    // ============================================================

    function handleResize() {
        const wasMobile = state.isMobile;
        state.isMobile = window.innerWidth <= 768;

        // Close mobile menu on resize to desktop
        if (wasMobile && !state.isMobile) {
            closeMobileMenu();
        }

        // Update slide position on resize
        const slides = DOM.heroSlides.querySelectorAll('.hero-slide');
        if (slides.length && slides[0]) {
            const slideWidth = slides[0].offsetWidth || 100;
            DOM.heroSlides.style.transform = `translateX(-${state.currentSlide * slideWidth}px)`;
        }
    }

    // ============================================================
    // PROFILE DROPDOWN
    // ============================================================

    let closeTimer = null;

    function setupProfile() {
        DOM.profileWrapper.addEventListener('mouseenter', function() {
            clearTimeout(closeTimer);
            this.classList.add('is-open');
        });

        DOM.profileWrapper.addEventListener('mouseleave', function() {
            closeTimer = setTimeout(() => {
                this.classList.remove('is-open');
            }, 150);
        });

        // Touch support for mobile
        DOM.profileWrapper.addEventListener('click', function(e) {
            if (window.innerWidth <= 768) {
                e.stopPropagation();
                this.classList.toggle('is-open');
            }
        });

        document.addEventListener('click', function(e) {
            if (window.innerWidth <= 768 && !DOM.profileWrapper.contains(e.target)) {
                DOM.profileWrapper.classList.remove('is-open');
            }
        });
    }

    // ============================================================
    // SETUP MOBILE MENU
    // ============================================================

    function setupMobileMenu() {
        // Toggle button
        DOM.menuToggle.addEventListener('click', toggleMobileMenu);
        
        // Close button inside menu
        DOM.mobileMenuClose.addEventListener('click', closeMobileMenu);
        
        // Overlay click to close
        DOM.mobileOverlay.addEventListener('click', closeMobileMenu);
        
        // Close menu on link click
        DOM.mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', closeMobileMenu);
        });
        
        // Close on Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && DOM.mobileMenu.classList.contains('open')) {
                closeMobileMenu();
            }
        });
    }

    // ============================================================
    // GLOBAL FUNCTIONS (exposed to window for onclick)
    // ============================================================

    window.goToSlide = goToSlide;
    window.nextSlide = nextSlide;
    window.prevSlide = prevSlide;

    window.bookMovie = function(movieId, title) {
        console.log(`🎟️ Booking tickets for: ${title} (ID: ${movieId})`);
        // Direct navigation to booking page
        window.location.href = `booking.html?movie=${movieId}&title=${encodeURIComponent(title)}`;
    };

    window.viewMovie = function(movieId) {
        const movie = state.allMovies.find(m => m.id === movieId);
        if (movie) {
            console.log(`📽️ Viewing: ${movie.title}`);
            // Direct navigation to movie detail page
            window.location.href = `movie.html?id=${movieId}`;
        }
    };

    // ============================================================
    // INITIALIZATION
    // ============================================================

    async function init() {
        try {
            // Fetch movies
            state.allMovies = await fetchAllPopularMovies();

            if (state.allMovies && state.allMovies.length > 0) {
                renderHeroSlides(state.allMovies);
                renderCarousel(state.allMovies);
                setTimeout(startAutoplay, 2000);
            } else {
                console.warn('No movies returned from API');
            }

            // Setup profile
            setupProfile();
            
            // Setup mobile menu
            setupMobileMenu();

            // Event listeners
            DOM.heroPrev.addEventListener('click', function(e) {
                e.preventDefault();
                stopAutoplay();
                prevSlide();
                setTimeout(startAutoplay, 3000);
            });

            DOM.heroNext.addEventListener('click', function(e) {
                e.preventDefault();
                stopAutoplay();
                nextSlide();
                setTimeout(startAutoplay, 3000);
            });

            DOM.carouselPrev.addEventListener('click', function(e) {
                e.stopPropagation();
                scrollCarousel('left');
            });

            DOM.carouselNext.addEventListener('click', function(e) {
                e.stopPropagation();
                scrollCarousel('right');
            });

            // Keyboard navigation
            document.addEventListener('keydown', function(e) {
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    stopAutoplay();
                    prevSlide();
                    setTimeout(startAutoplay, 3000);
                } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    stopAutoplay();
                    nextSlide();
                    setTimeout(startAutoplay, 3000);
                }
            });

            // Pause on hover
            DOM.heroCarousel.addEventListener('mouseenter', stopAutoplay);
            DOM.heroCarousel.addEventListener('mouseleave', startAutoplay);

            // Resize
            const debouncedResize = debounce(handleResize, 250);
            window.addEventListener('resize', debouncedResize);

            // Handle visibility change
            document.addEventListener('visibilitychange', function() {
                if (document.hidden) {
                    stopAutoplay();
                } else {
                    startAutoplay();
                }
            });

            console.log('🎬 Savannah Cinemas initialized');

        } catch (error) {
            console.error('Error initializing:', error);
        }
    }

    // ============================================================
    // START
    // ============================================================

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }

})();