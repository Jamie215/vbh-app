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

// Helper function to handle authenticated user setup
async function handleAuthenticatedUser(user) {
    console.log('handleAuthenticatedUser: Starting...');
    currentUser = user;
    console.log('handleAuthenticatedUser: currentUser set');
    
     try {
        console.log('handleAuthenticatedUser: Calling updateUIForAuthenticatedUser...');
        await updateUIForAuthenticatedUser(user);
        console.log('handleAuthenticatedUser: updateUIForAuthenticatedUser completed');
    } catch (e) {
        console.error('handleAuthenticatedUser: Error in updateUIForAuthenticatedUser:', e);
    }
    
    try {
        console.log('handleAuthenticatedUser: Calling loadTodaySession...');
        await loadTodaySession();
        console.log('handleAuthenticatedUser: loadTodaySession completed');
    } catch (e) {
        console.error('handleAuthenticatedUser: Error in loadTodaySession:', e);
    }
    
    try {
        console.log('handleAuthenticatedUser: Calling loadCompletionHistory...');
        await loadCompletionHistory();
        console.log('handleAuthenticatedUser: loadCompletionHistory completed');
    } catch (e) {
        console.error('handleAuthenticatedUser: Error in loadCompletionHistory:', e);
    }
    
    console.log('handleAuthenticatedUser: Calling hideLoadingScreen...');
    hideLoadingScreen();
    console.log('handleAuthenticatedUser: hideLoadingScreen completed');
    
    console.log('handleAuthenticatedUser: Calling showHome...');
    showHome();
    console.log('handleAuthenticatedUser: showHome completed');
}

// Listen to auth state changes
function initAuthListener() {
    if (!window.supabaseClient) {
        console.error('Supabase client not available');
        hideLoadingScreen();
        showAuthPage();
        return;
    }

    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth event:', event, 'Session:', !!session);
        
        // Cancel safety timeout as soon as any auth event fires
        cancelAuthTimeout();
        
        switch (event) {
            case 'SIGNED_IN':
            case 'INITIAL_SESSION':
                if (session) {
                    console.log('Calling handleAuthenticatedUser...');
                    await handleAuthenticatedUser(session.user);
                    console.log('handleAuthenticatedUser returned');
                } else {
                    // INITIAL_SESSION with no session = not logged in
                    updateUIForGuestUser();
                    hideLoadingScreen();
                    showAuthPage();
                }
                break;
                
            case 'SIGNED_OUT':
                resetAppState();
                updateUIForGuestUser();
                hideLoadingScreen();
                showAuthPage();
                break;
                
            case 'TOKEN_REFRESHED':
                if (session) {
                    currentUser = session.user;
                }
                break;
                
            case 'USER_UPDATED':
                if (session?.user) {
                    currentUser = session.user;
                    try {
                        await updateUIForAuthenticatedUser(session.user);
                    } catch (e) {
                        console.error('Error updating UI:', e);
                    }
                }
                break;
                
            default:
                console.log('Unhandled auth event:', event);
        }
    });
    
    console.log('Auth listener initialized');
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

console.log('Auth module loaded');