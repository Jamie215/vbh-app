// Navigation controller - handles view switching

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

// ==================== Auth Page ====================
function showAuthPage() {
    const authView = document.getElementById('auth-view');
    const homeView = document.getElementById('home-view');
    const playlistView = document.getElementById('playlist-view');
    const progressView = document.getElementById('progress-view');
    const educationView = document.getElementById('education-view');
    const navbar = document.getElementById('navbar');
    
    if (authView) authView.classList.remove('hidden');
    if (homeView) homeView.classList.add('hidden');
    if (playlistView) playlistView.classList.add('hidden');
    if (progressView) progressView.classList.add('hidden');
    if (educationView) educationView.classList.add('hidden');
    if (navbar) navbar.classList.add('hidden');

    unloadEducationIframe();
}

function showSignInView() {
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
    const signinView = document.getElementById('signin-view');
    const signupView = document.getElementById('signup-view');
    const forgotView = document.getElementById('forgot-password-view');
    const resetView = document.getElementById('reset-password-view');
    
    if (signinView) signinView.classList.add('hidden');
    if (signupView) signupView.classList.remove('hidden');
    if (forgotView) forgotView.classList.add('hidden');
    if (resetView) resetView.classList.add('hidden');
    
    // Clear any messages
    clearAuthMessages();
}

function showForgotPasswordView() {
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

function showResetPasswordView() {
    const authView = document.getElementById('auth-view');
    const homeView = document.getElementById('home-view');
    const playlistView = document.getElementById('playlist-view');
    const progressView = document.getElementById('progress-view');
    const navbar = document.getElementById('navbar');
    
    // Show auth container, hide everything else
    if (authView) authView.classList.remove('hidden');
    if (homeView) homeView.classList.add('hidden');
    if (playlistView) playlistView.classList.add('hidden');
    if (progressView) progressView.classList.add('hidden');
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
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        
        // Match link text to active view
        const linkText = link.textContent.toLowerCase();
        if (activeView === 'home' && linkText.includes('exercises')) {
            link.classList.add('active');
        } else if (activeView === 'progress' && linkText.includes('progress')) {
            link.classList.add('active');
        } else if (activeView === 'education' && linkText.includes('education')) {
            link.classList.add('active');
        }
    });
}

// ==================== Home View ====================
function showHome() {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    const authView = document.getElementById('auth-view');
    const homeView = document.getElementById('home-view');
    const playlistView = document.getElementById('playlist-view');
    const progressView = document.getElementById('progress-view');
    const educationView = document.getElementById('education-view');
    const navbar = document.getElementById('navbar');
    
    if (authView) authView.classList.add('hidden');
    if (homeView) homeView.classList.remove('hidden');
    if (playlistView) playlistView.classList.add('hidden');
    if (progressView) progressView.classList.add('hidden');
    if (educationView) educationView.classList.add('hidden');
    if (navbar) navbar.classList.remove('hidden');

    // Update nav link active states
    updateNavActiveState('home');

    // Load playlists data
    if (typeof loadPlaylists === 'function') {
        loadPlaylists();
    }
}

// Show playlist view
function showPlaylistView(playlistId) {
    if (!currentUser) {
        showAuthPage();
        return;
    }
    
    const authView = document.getElementById('auth-view');
    const homeView = document.getElementById('home-view');
    const playlistView = document.getElementById('playlist-view');
    const progressView = document.getElementById('progress-view');
    const educationView = document.getElementById('education-view');
    const navbar = document.getElementById('navbar');
    
    if (authView) authView.classList.add('hidden');
    if (homeView) homeView.classList.add('hidden');
    if (playlistView) playlistView.classList.remove('hidden');
    if (progressView) progressView.classList.add('hidden');
    if (educationView) educationView.classList.add('hidden');
    if (navbar) navbar.classList.remove('hidden');
}

// Placeholder for How to Use page
function showHowToUse() {
    alert('How to Use page coming soon!');
}

// Education View

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
            window.eduProgress = data.progress || null;
            window.eduBookmark = data.bookmark || '';
        }
    } catch (error) {
        console.error('Exception loading education progress:', error);
    }
}

// Called by the Rise iframe via postMessage when progress is updated
window.parent.saveEducationProgress = function (progress) {
    window.eduProgress = progress;

    if (_eduSaveTimer) clearTimeout(_eduSaveTimer);

    // Debounce saves to avoid excessive writes if user is rapidly progressing through content
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
window.parent.saveEducationBookmark = function (lessonId) {
    window.eduBookmark = lessonId || '';
};

async function showEducation() {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    const authView = document.getElementById('auth-view');
    const homeView = document.getElementById('home-view');
    const playlistView = document.getElementById('playlist-view');
    const progressView = document.getElementById('progress-view');
    const educationView = document.getElementById('education-view');
    const navbar = document.getElementById('navbar');
    const iframe = document.getElementById('education-iframe');
    
    if (authView) authView.classList.add('hidden');
    if (homeView) homeView.classList.add('hidden');
    if (playlistView) playlistView.classList.add('hidden');
    if (progressView) progressView.classList.add('hidden');
    if (educationView) educationView.classList.remove('hidden');
    // Hide navbar for immersive experience, but can be toggled back on if needed
    if (navbar) navbar.classList.remove('hidden');

    // Wait for progress to load so Rise can read it on init,
    // but always load the iframe even if the fetch fails
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
    const navbar = document.getElementById('navbar');
    
    if (educationView) educationView.classList.add('hidden');
    if (navbar) navbar.classList.remove('hidden');

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

    // Swap icon between bars and X
    if (navLinks.classList.contains('open')) {
        icon.classList.remove('fa-bars');
        icon.classList.add('fa-xmark');
    } else {
        icon.classList.remove('fa-xmark');
        icon.classList.add('fa-bars');
    }
}

// Close menu when a nav link is clicked (smooth UX)
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.nav-link').forEach(function (link) {
        link.addEventListener('click', function () {
            var navLinks = document.getElementById('nav-links');
            var icon = document.getElementById('hamburger-icon');
            if (navLinks && navLinks.classList.contains('open')) {
                navLinks.classList.remove('open');
                if (icon) {
                    icon.classList.remove('fa-xmark');
                    icon.classList.add('fa-bars');
                }
            }
        });
    });
});