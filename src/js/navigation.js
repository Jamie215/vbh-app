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

// ==================== How to Use ====================
function showHowToUse() {
    // Update nav active state
    updateNavActiveState('how-to-use');
    
    // For now, show an alert - you can replace with actual view
    alert('How to Use the Program page coming soon!');
    
    // Reset to home active state since we're not actually navigating
    updateNavActiveState('home');
}

// ==================== Navigation Helper ====================
function updateNavActiveState(activeView) {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        
        const linkText = link.textContent.trim().toLowerCase();
        if (activeView === 'home' && linkText === 'exercises') {
            link.classList.add('active');
        } else if (activeView === 'progress' && linkText === 'my progress') {
            link.classList.add('active');
        } else if (activeView === 'how-to-use' && linkText === 'how to use the program') {
            link.classList.add('active');
        }
    });
}

console.log('Navigation module loaded');
