// ==================== Authentication Controller ====================
// Handles sign up, sign in, sign out, and auth state changes

// Sign up new user
async function signUp() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    // Validation
    if (!name || !email || !password) {
        showMessage('signup-message', 'Please fill in all fields', true);
        return;
    }

    if (password.length < 6) {
        showMessage('signup-message', 'Password must be at least 6 characters', true);
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('signup-message', 'Please enter a valid email address', true);
        return;
    }

    try {
        const { data, error } = await window.supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: name
                }
            }
        });

        if (error) {
            showMessage('signup-message', error.message, true);
        } else {
            showMessage('signup-message', 'Account created successfully!', false);
            
            // Clear form
            document.getElementById('signup-name').value = '';
            document.getElementById('signup-email').value = '';
            document.getElementById('signup-password').value = '';
        }
    } catch (error) {
        console.error('Sign up error:', error);
        showMessage('signup-message', 'An error occurred. Please try again.', true);
    }
}

// Sign in existing user
async function signIn() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Validation
    if (!email || !password) {
        showMessage('signin-message', 'Please fill in all fields', true);
        return;
    }

    try {
        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            if (error.message.includes('Invalid login credentials')) {
                showMessage('signin-message', 'Invalid email or password', true);
            } else if (error.message.includes('Email not confirmed')) {
                showMessage('signin-message', 'Please verify your email before signing in', true);
            } else {
                showMessage('signin-message', error.message, true);
            }
        } else {
            showMessage('signin-message', 'Signing in...', false);
            // Clear form
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
            // Auth state change listener will handle the rest
        }
    } catch (error) {
        console.error('Sign in error:', error);
        showMessage('signin-message', 'An error occurred. Please try again.', true);
    }
}

// Sign out
async function signOut() {
    const confirmed = confirm('Are you sure you want to sign out?');
    if (!confirmed) return;

    try {
        const { error } = await window.supabaseClient.auth.signOut();
        
        if (error) {
            alert('Error signing out: ' + error.message);
        }
        // Auth state change listener will handle the rest
    } catch (error) {
        console.error('Sign out error:', error);
        alert('An error occurred while signing out.');
    }
}

// Toggle password visibility
function togglePasswordVisibility(inputId, toggleId) {
    const passwordInput = document.getElementById(inputId);
    const toggleBtn = document.getElementById(toggleId);

    if (passwordInput && toggleBtn) {
        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            toggleBtn.textContent = 'Hide';
        } else {
            passwordInput.type = 'password';
            toggleBtn.textContent = 'Show';
        }
    }
}

// Forgot password placeholder
function showForgotPassword() {
    alert('Forgot password feature coming soon!');
}

// Listen to auth state changes
function initAuthListener() {
    if (!window.supabaseClient) {
        console.error('Supabase client not available');
        return;
    }

    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, 'Session:', !!session);
        
        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session) {
            currentUser = session.user;
            await updateUIForAuthenticatedUser(session.user);
            await loadTodaySession();
            await loadCompletionHistory();
            hideLoadingScreen();
            showHome();
        } else if (event === 'INITIAL_SESSION' && !session) {
            // No existing session on page load - show auth page
            updateUIForGuestUser();
            hideLoadingScreen();
            showAuthPage();
        } else if (event === 'SIGNED_OUT') {
            currentUser = null;
            userProfile = null;
            todaySession = null;
            sessionProgress = {};
            completionHistory = {};
            currentPlaylist = null;
            updateUIForGuestUser();
            hideLoadingScreen();
            showAuthPage();
        } else if (event === 'USER_UPDATED' && session?.user) {
            currentUser = session.user;
            await updateUIForAuthenticatedUser(session.user);
        }
    });
}

// Handle Enter key press in auth forms
function initAuthFormListeners() {
    const loginEmail = document.getElementById('login-email');
    const loginPassword = document.getElementById('login-password');
    
    if (loginEmail) {
        loginEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') signIn();
        });
    }
    
    if (loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') signIn();
        });
    }
    
    const signupName = document.getElementById('signup-name');
    const signupEmail = document.getElementById('signup-email');
    const signupPassword = document.getElementById('signup-password');
    
    if (signupName) {
        signupName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') signUp();
        });
    }
    
    if (signupEmail) {
        signupEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') signUp();
        });
    }
    
    if (signupPassword) {
        signupPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') signUp();
        });
    }
}