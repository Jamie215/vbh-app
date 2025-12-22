// ==================== Navigation Controller ====================
// Single source of truth for all view transitions

// View elements
const views = {
    loading: () => document.getElementById('loading-screen'),
    auth: () => document.getElementById('auth-view'),
    home: () => document.getElementById('home-view'),
    playlist: () => document.getElementById('playlist-view'),
    navbar: () => document.getElementById('navbar'),
    signinForm: () => document.getElementById('signin-view'),
    signupForm: () => document.getElementById('signup-view')
};

// Hide all main views
function hideAllViews() {
    const loading = views.loading();
    const auth = views.auth();
    const home = views.home();
    const playlist = views.playlist();
    
    if (loading) loading.classList.add('hidden');
    if (auth) auth.classList.add('hidden');
    if (home) home.classList.add('hidden');
    if (playlist) playlist.classList.add('hidden');
}

// Show loading screen
function showLoadingScreen() {
    hideAllViews();
    const loading = views.loading();
    if (loading) loading.classList.remove('hidden');
    
    const navbar = views.navbar();
    if (navbar) navbar.classList.add('hidden');
}

// Hide loading screen
function hideLoadingScreen() {
    const loading = views.loading();
    if (loading) loading.classList.add('hidden');
}

// Show auth page (for guests)
function showAuthPage() {
    hideAllViews();
    const auth = views.auth();
    if (auth) auth.classList.remove('hidden');
    
    const navbar = views.navbar();
    if (navbar) navbar.classList.add('hidden');
    
    // Default to sign in view
    showSignInView();
}

// Hide auth page
function hideAuthPage() {
    const auth = views.auth();
    if (auth) auth.classList.add('hidden');
}

// Show home view
function showHome() {
    // Check if user is logged in
    if (!currentUser) {
        showAuthPage();
        return;
    }
    
    hideAllViews();
    const home = views.home();
    if (home) home.classList.remove('hidden');
    
    const navbar = views.navbar();
    if (navbar) navbar.classList.remove('hidden');
    
    // Update nav link active state
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const firstNavLink = document.querySelector('.nav-link');
    if (firstNavLink) firstNavLink.classList.add('active');
    
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

// Clear auth form messages
function clearAuthMessages() {
    const signinMsg = document.getElementById('signin-message');
    const signupMsg = document.getElementById('signup-message');
    
    if (signinMsg) {
        signinMsg.textContent = '';
        signinMsg.className = 'form-message';
    }
    if (signupMsg) {
        signupMsg.textContent = '';
        signupMsg.className = 'form-message';
    }
}

// Show form message
function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `form-message ${isError ? 'error' : 'success'}`;
    }
}

// Placeholder for How to Use page
function showHowToUse() {
    alert('How to Use page coming soon!');
}
