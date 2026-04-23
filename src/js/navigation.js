// Navigation controller - handles view switching and client-side routing

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
 *   1. After auth resolves on page load
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
            showExercises();
        }
        return;
    }

    switch (path) {
        case '/':
            showHome();
            break;
        case '/exercises':
            showExercises();
            break;
        case '/progress':
            if (typeof showMyProgress === 'function') {
                showMyProgress();
            } else {
                showExercises();
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
    const ids = ['auth-view', 'home-view', 'exercises-view', 'playlist-view', 'progress-view', 'education-view'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

/** Close the mobile hamburger menu (if open) and collapse dropdown */
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
    // Also collapse the dropdown and profile menu
    const dropdown = document.getElementById('nav-dropdown');
    if (dropdown) dropdown.classList.remove('open');
    const profile = document.getElementById('user-info');
    if (profile) profile.classList.remove('open');
    document.body.classList.remove('dropdown-active');
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

    setFooterVisibility(false);
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
    // Clear all active states on top-level nav links and dropdown items
    document.querySelectorAll('.nav-link, .nav-dropdown-item').forEach(el => {
        el.classList.remove('active');
    });

    // Views that live inside the Exercise Program dropdown
    const dropdownViews = ['exercises', 'progress', 'how-to-use'];
    const parentToggle = document.querySelector('.nav-dropdown-toggle');

    if (activeView === 'home') {
        const homeLink = document.querySelector('.nav-link[href="/"]');
        if (homeLink) homeLink.classList.add('active');
    } else if (dropdownViews.includes(activeView)) {
        if (parentToggle) parentToggle.classList.add('active');
        const hrefMap = { 'exercises': '/exercises', 'progress': '/exercises/progress', 'how-to-use': '/exercises/how-to-use' };
        const child = document.querySelector(`.nav-dropdown-item[href="${hrefMap[activeView]}"]`);
        if (child) child.classList.add('active');
    } else if (activeView === 'education') {
        const eduLink = document.querySelector('.nav-link[href="/education"]');
        if (eduLink) eduLink.classList.add('active');
    }
}

function showHome() {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    pushRoute('/');
    
    hideAllViews();
    const homeView = document.getElementById('home-view');
    const navbar = document.getElementById('navbar');

    if (homeView) homeView.classList.remove('hidden');
    if (navbar) navbar.classList.remove('hidden');

    setFooterVisibility(true);

    updateNavActiveState('home');
    if (typeof loadHomeView === 'function') {
        loadHomeView();
    }
}

// ==================== Exercises View ====================

function showExercises() {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    pushRoute('/exercises');

    hideAllViews();
    const exercisesView = document.getElementById('exercises-view');
    const navbar = document.getElementById('navbar');

    if (exercisesView) exercisesView.classList.remove('hidden');
    if (navbar) navbar.classList.remove('hidden');

    setFooterVisibility(true);

    updateNavActiveState('exercises');

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

    pushRoute('/exercises/how-to-use');
    updateNavActiveState('how-to-use');

    // Placeholder — replace with actual view when ready
    alert('How to Use page coming soon!');

    // Reset since we're not actually navigating to a new view yet
    // Remove these two lines once the real How to Use view exists:
    updateNavActiveState('exercises');
    showExercises();
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

    setFooterVisibility(false);
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


// ==================== Dropdown Menu ====================

/** Toggle the Exercise Program dropdown (used on both mobile and desktop click) */
function toggleDropdown(event) {
    event.preventDefault();
    event.stopPropagation();

    const dropdown = document.getElementById('nav-dropdown');
    if (dropdown) {
        dropdown.classList.toggle('open');
        document.body.classList.toggle('dropdown-active', dropdown.classList.contains('open'));
    }

    // Close profile dropdown if open
    const profile = document.getElementById('user-info');
    if (profile) profile.classList.remove('open');
}

/** Close dropdown when clicking outside of it (desktop) */
document.addEventListener('click', function (e) {
    const dropdown = document.getElementById('nav-dropdown');
    if (dropdown && !dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
        document.body.classList.remove('dropdown-active');
    }

    const profile = document.getElementById('user-info');
    if (profile && !profile.contains(e.target)) {
        profile.classList.remove('open');
    }
});


// ==================== Profile Dropdown ====================

/** Toggle the profile/avatar dropdown */
function toggleProfileDropdown(event) {
    event.preventDefault();
    event.stopPropagation();

    const profile = document.getElementById('user-info');
    if (profile) profile.classList.toggle('open');

    // Close nav dropdown if open
    const navDropdown = document.getElementById('nav-dropdown');
    if (navDropdown) {
        navDropdown.classList.remove('open');
        document.body.classList.remove('dropdown-active');
    }
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


/**
 * Desktop hover: disable iframe pointer-events while cursor is
 * anywhere inside .nav-dropdown (toggle + menu).
 * Also close mobile menu/dropdown when any nav item is clicked.
 */
document.addEventListener('DOMContentLoaded', function () {
    const dropdown = document.getElementById('nav-dropdown');

    // Hover handlers — disable iframe pointer-events while dropdown is active
    if (dropdown) {
        dropdown.addEventListener('mouseenter', function () {
            document.body.classList.add('dropdown-active');
        });
        dropdown.addEventListener('mouseleave', function () {
            // Only remove if not held open via click (.open)
            if (!dropdown.classList.contains('open')) {
                document.body.classList.remove('dropdown-active');
            }
        });
    }

    // Close mobile menu and dropdown when any nav link or dropdown item is clicked
    document.querySelectorAll('.nav-link[href], .nav-dropdown-item').forEach(function (link) {
        link.addEventListener('click', function () {
            closeMobileMenu();
        });
    });
});

// Footer 
function setFooterVisibility(visible) {
    const footer = document.getElementById('footer');
    if (footer) footer.classList.toggle('hidden', !visible);
}

// Help Modal
function showHelpModal() {
    const existing = document.getElementById('help-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'help-modal';
    overlay.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4';
    overlay.onclick = (e) => { if (e.target === overlay) closeHelpModal(); };
    overlay.innerHTML = `
        <div class="bg-white rounded-xl p-4 max-w-[900px] w-full relative">
            <button onclick="closeHelpModal()" class="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-text-primary border-none cursor-pointer hover:bg-gray-100 z-10" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="aspect-video w-full rounded-lg overflow-hidden bg-black">
                <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0&modestbranding=1" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full h-full"></iframe>
            </div>
        </div>
    `;
    document.getElementById('app').appendChild(overlay);
}

function closeHelpModal() {
    const modal = document.getElementById('help-modal');
    if (modal) modal.remove();
}

console.log('Navigation module loaded');