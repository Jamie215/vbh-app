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
    const navbar = document.getElementById('navbar');
    
    if (authView) authView.classList.remove('hidden');
    if (homeView) homeView.classList.add('hidden');
    if (playlistView) playlistView.classList.add('hidden');
    if (progressView) progressView.classList.add('hidden');
    if (navbar) navbar.classList.add('hidden');
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
    const navbar = document.getElementById('navbar');
    
    if (authView) authView.classList.add('hidden');
    if (homeView) homeView.classList.remove('hidden');
    if (playlistView) playlistView.classList.add('hidden');
    if (progressView) progressView.classList.add('hidden');
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
    const navbar = document.getElementById('navbar');
    
    if (authView) authView.classList.add('hidden');
    if (homeView) homeView.classList.add('hidden');
    if (playlistView) playlistView.classList.remove('hidden');
    if (progressView) progressView.classList.add('hidden');
    if (navbar) navbar.classList.remove('hidden');
}

// Placeholder for How to Use page
function showHowToUse() {
    alert('How to Use page coming soon!');
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