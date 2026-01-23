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
    
    if (signinView) signinView.classList.remove('hidden');
    if (signupView) signupView.classList.add('hidden');
    
    // Clear any messages
    const signinMessage = document.getElementById('signin-message');
    const signupMessage = document.getElementById('signup-message');
    if (signinMessage) signinMessage.textContent = '';
    if (signupMessage) signupMessage.textContent = '';
}

function showSignUpView() {
    const signinView = document.getElementById('signin-view');
    const signupView = document.getElementById('signup-view');
    
    if (signinView) signinView.classList.add('hidden');
    if (signupView) signupView.classList.remove('hidden');
    
    // Clear any messages
    const signinMessage = document.getElementById('signin-message');
    const signupMessage = document.getElementById('signup-message');
    if (signinMessage) signinMessage.textContent = '';
    if (signupMessage) signupMessage.textContent = '';
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
    
    hideAllViews();
    const playlist = views.playlist();
    if (playlist) playlist.classList.remove('hidden');
    
    const navbar = views.navbar();
    if (navbar) navbar.classList.remove('hidden');
}

// Show sign in form
function showSignInView() {
    const signin = views.signinForm();
    const signup = views.signupForm();
    
    if (signin) signin.classList.remove('hidden');
    if (signup) signup.classList.add('hidden');
    
    clearAuthMessages();
}

// Show sign up form
function showSignUpView() {
    const signin = views.signinForm();
    const signup = views.signupForm();
    
    if (signin) signin.classList.add('hidden');
    if (signup) signup.classList.remove('hidden');
    
    clearAuthMessages();
}

// Placeholder for How to Use page
function showHowToUse() {
    alert('How to Use page coming soon!');
}
