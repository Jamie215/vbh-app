// Navigation controller - handles view switching and client-side routing
// ============================================================

// ==================== Routing Infrastructure ====================

// When true, show* functions skip history.pushState (used during popstate)
let _skipPush = false;

/**
 * Push a path to the browser address bar without a page reload.
 * Automatically skipped during popstate handling (back/forward).
 */
function pushRoute(path, state = {}) {
    if (!_skipPush && window.location.pathname !== path) {
        history.pushState(state, '', path);
    }
}

/**
 * Central router — reads the current URL and activates the matching view.
 * Called:
 *   1. After auth resolves on page load (replaces the old showHome() call)
 *   2. On popstate (browser back / forward)
 */
function routeFromURL() {
    const path = window.location.pathname;

    // Dynamic route: /exercises/:playlistId
    const playlistMatch = path.match(/^\/exercises\/(.+)$/);
    if (playlistMatch) {
        const playlistId = playlistMatch[1];
        // showPlaylist() lives in app.js — it handles rendering + view switching
        if (typeof showPlaylist === 'function') {
            showPlaylist(playlistId);
        } else {
            showHome();
        }
        return;
    }

    switch (path) {
        case '/':
        case '/exercises':
            showHome();
            break;
        case '/progress':
            if (typeof showMyProgress === 'function') {
                showMyProgress();
            } else {
                showHome();
            }
            break;
        case '/education':
            showEducation();
            break;
        case '/how-to-use':
            showHowToUse();
            break;
        case '/login':
            showAuthPage();
            showSignInView();
            break;
        case '/signup':
            showAuthPage();
            showSignUpView();
            break;
        case '/forgot-password':
            showAuthPage();
            showForgotPasswordView();
            break;
        case '/reset-password':
            showResetPasswordView();
            break;
        default:
            // Unknown route — fall back
            if (currentUser) {
                showHome();
            } else {
                showAuthPage();
                showSignInView();
            }
    }
}

/**
 * Called by auth.js after sign-in / session restore.
 * Routes to the URL the user is actually on, instead of always going home.
 * 
 * AUTH.JS INTEGRATION — replace your `showHome()` call in handlePostSignIn
 * (or wherever you redirect after successful auth) with:
 *     routeAfterAuth();
 */
function routeAfterAuth() {
    const path = window.location.pathname;
    // If user is on a login/signup page, send them home
    if (path === '/login' || path === '/signup' || path === '/forgot-password' || path === '/reset-password' || path === '/') {
        showHome();
    } else {
        routeFromURL();
    }
}

// Browser back / forward
window.addEventListener('popstate', () => {
    _skipPush = true;
    routeFromURL();
    _skipPush = false;
});


// ==================== View Helpers ====================

/** Hide every top-level view in the app */
function hideAllViews() {
    const ids = ['auth-view', 'home-view', 'playlist-view', 'progress-view', 'education-view'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

/** Close the mobile hamburger menu (if open) */
function closeMobileMenu() {
    const navLinks = document.getElementById('nav-links');
    const icon = document.getElementById('hamburger-icon');
    if (navLinks && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        if (icon) {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-bars');
        }
    }
}


// ==================== Loading Screen ====================

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.add('hidden');
    }
}

function showLoadingScreen() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.classList.remove('hidden');
    }
}


// ==================== Auth Views ====================

function showAuthPage() {
    pushRoute('/login');

    hideAllViews();
    const authView = document.getElementById('auth-view');
    const navbar = document.getElementById('navbar');

    if (authView) authView.classList.remove('hidden');
    if (navbar) navbar.classList.add('hidden');

    unloadEducationIframe();
}

function showSignInView() {
    pushRoute('/login');

    const signinView = document.getElementById('signin-view');
    const signupView = document.getElementById('signup-view');
    const forgotView = document.getElementById('forgot-password-view');
    const resetView = document.getElementById('reset-password-view');

    if (signinView) signinView.classList.remove('hidden');
    if (signupView) signupView.classList.add('hidden');
    if (forgotView) forgotView.classList.add('hidden');
    if (resetView) resetView.classList.add('hidden');

    clearAuthMessages();
}

function showSignUpView() {
    pushRoute('/signup');

    const signinView = document.getElementById('signin-view');
    const signupView = document.getElementById('signup-view');
    const forgotView = document.getElementById('forgot-password-view');
    const resetView = document.getElementById('reset-password-view');

    if (signinView) signinView.classList.add('hidden');
    if (signupView) signupView.classList.remove('hidden');
    if (forgotView) forgotView.classList.add('hidden');
    if (resetView) resetView.classList.add('hidden');

    clearAuthMessages();
}

function showForgotPasswordView() {
    pushRoute('/forgot-password');

    const signinView = document.getElementById('signin-view');
    const signupView = document.getElementById('signup-view');
    const forgotView = document.getElementById('forgot-password-view');
    const resetView = document.getElementById('reset-password-view');

    if (signinView) signinView.classList.add('hidden');
    if (signupView) signupView.classList.add('hidden');
    if (forgotView) forgotView.classList.remove('hidden');
    if (resetView) resetView.classList.add('hidden');

    clearAuthMessages();
}

// Alias used by onclick in index.html
function showForgotPassword() {
    showForgotPasswordView();
}

function showResetPasswordView() {
    pushRoute('/reset-password');

    hideAllViews();
    const authView = document.getElementById('auth-view');
    const navbar = document.getElementById('navbar');

    if (authView) authView.classList.remove('hidden');
    if (navbar) navbar.classList.add('hidden');

    // Within auth, only show the reset password form
    const signinView = document.getElementById('signin-view');
    const signupView = document.getElementById('signup-view');
    const forgotView = document.getElementById('forgot-password-view');
    const resetView = document.getElementById('reset-password-view');

    if (signinView) signinView.classList.add('hidden');
    if (signupView) signupView.classList.add('hidden');
    if (forgotView) forgotView.classList.add('hidden');
    if (resetView) resetView.classList.remove('hidden');

    clearAuthMessages();
}


// ==================== Nav Active State ====================

function updateNavActiveState(activeView) {
    // Clear all active states
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    // Map views to their nav link selectors
    const viewMap = {
        'home':       '[href="/exercises"]',
        'progress':   '[href="/progress"]',
        'education':  '[href="/education"]',
        'how-to-use': '[href="/how-to-use"]'
    };

    const selector = viewMap[activeView];
    if (!selector) return;

    const link = document.querySelector(selector);
    if (link) link.classList.add('active');

    // If the active link lives inside the dropdown, also highlight the parent
    const parentLink = document.querySelector('.nav-dropdown > .nav-link');
    if (activeView === 'home' || activeView === 'progress' || activeView === 'how-to-use') {
        if (parentLink) parentLink.classList.add('active');
    }
}

// ==================== Home View ====================

function showHome() {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    pushRoute('/exercises');

    hideAllViews();
    const homeView = document.getElementById('home-view');
    const navbar = document.getElementById('navbar');

    if (homeView) homeView.classList.remove('hidden');
    if (navbar) navbar.classList.remove('hidden');

    updateNavActiveState('home');

    if (typeof loadPlaylists === 'function') {
        loadPlaylists();
    }
}


// ==================== How to Use ====================

function showHowToUse() {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    pushRoute('/how-to-use');
    updateNavActiveState('how-to-use');

    // Placeholder — replace with actual view when ready
    alert('How to Use page coming soon!');

    // Reset since we're not actually navigating to a new view yet
    // Remove these two lines once the real How to Use view exists:
    updateNavActiveState('home');
    showHome();
}


// ==================== Education View ====================

// Cached progress that the Rise iframe reads synchronously on initial load
window.eduProgress = null;
window.eduBookmark = '';

// Save queue to debounce rapid writes from Rise
let _eduSaveTimer = null;

// Load education progress from Supabase and cache it for the iframe to read
async function loadEducationProgress() {
    if (!currentUser) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('education_progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (error) {
            console.error('Error loading education progress:', error);
            return;
        }

        if (data) {
            console.log('Loaded education progress:', data);
            window.eduProgress = data.progress || null;
            window.eduBookmark = data.bookmark || '';
        }
    } catch (error) {
        console.error('Exception loading education progress:', error);
    }
}

// Called by the Rise iframe via postMessage when progress is updated
window.saveEducationProgress = function (progress) {
    window.eduProgress = progress;

    if (_eduSaveTimer) clearTimeout(_eduSaveTimer);

    _eduSaveTimer = setTimeout(async () => {
        if (!currentUser) return;
        try {
            const { error } = await window.supabaseClient
                .from('education_progress')
                .upsert({
                    user_id: currentUser.id,
                    progress: window.eduProgress,
                    bookmark: window.eduBookmark
                }, {
                    onConflict: 'user_id'
                });
        } catch (error) {
            console.error('Exception saving education progress:', error);
        }
    }, 1000);
};

// Called by the Rise iframe via postMessage when bookmark is updated
window.saveEducationBookmark = function (lessonId) {
    window.eduBookmark = lessonId || '';
};

async function showEducation() {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    pushRoute('/education');

    hideAllViews();
    const educationView = document.getElementById('education-view');
    const navbar = document.getElementById('navbar');
    const iframe = document.getElementById('education-iframe');

    if (educationView) educationView.classList.remove('hidden');
    if (navbar) navbar.classList.remove('hidden');

    // Load progress then set iframe src (only once)
    if (iframe && !iframe.src) {
        try {
            await loadEducationProgress();
        } catch (e) {
            console.warn('Could not load education progress, starting fresh:', e);
        }
        iframe.src = 'education/content/index.html';
    }

    updateNavActiveState('education');
}

function hideEducation() {
    const educationView = document.getElementById('education-view');
    if (educationView) educationView.classList.add('hidden');
    showHome();
}

// Only used on sign-out to fully tear down the iframe
function unloadEducationIframe() {
    const iframe = document.getElementById('education-iframe');
    if (iframe) {
        iframe.removeAttribute('src');
    }
    window.eduProgress = null;
    window.eduBookmark = '';
}


// ==================== Mobile Hamburger Menu ====================

function toggleMobileMenu() {
    const navLinks = document.getElementById('nav-links');
    const icon = document.getElementById('hamburger-icon');

    navLinks.classList.toggle('open');

    if (navLinks.classList.contains('open')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-xmark');
    } else {
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
    }
}

function toggleDropdownMenu(event) {
    if (window.innerWidth >= 1024) return;

    event.preventDefault();
    event.stopPropagation();

    const dropdown = document.querySelector('.nav-dropdown-menu');
    if (dropdown) {
        dropdown.classList.toggle('open');
    }
}

function closeMobileMenu() {
    const navLinks = document.getElementById('nav-links');
    const icon = document.getElementById('hamburger-icon');
    if (navLinks && navLinks.classList.contains('open')) {
        navLinks.classList.remove('open');
        if (icon) {
            icon.classList.remove('fa-xmark');
            icon.classList.add('fa-bars');
        }
    }
    // Also collapse the dropdown
    const dropdown = document.querySelector('.nav-dropdown');
    if (dropdown) dropdown.classList.remove('open');
}

// Close menu when any nav link is clicked
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.nav-link').forEach(function (link) {
        link.addEventListener('click', function () {
            closeMobileMenu();
        });
    });

    const parentLink = document.querySelector('.nav-dropdown > .nav-link');
    if (parentLink) {
        parentLink.addEventListener('click', toggleDropdownMenu);
    }
});

console.log('Navigation module loaded');