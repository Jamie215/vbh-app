// Handles sign up, sign in, sign out, and auth state changes

// Flag to track if initial session has been handled by app.js
let initialSessionHandled = false;

// Detect password recovery flow from URL hash BEFORE session routing
// Supabase appends #access_token=...&type=recovery&... to the redirect URL
let isPasswordRecovery = false;

function detectPasswordRecovery() {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
        console.log('Password recovery flow detected from URL');
        isPasswordRecovery = true;
        return true;
    }
    return false;
}

function markInitialSessionHandled() {
    initialSessionHandled = true;
}

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
            
            handlePostSignIn(data.user);
        }
    } catch (error) {
        console.error('Sign in error:', error);
        showMessage('signin-message', 'An error occurred. Please try again.', true);
    }
}

// Handle post sign-in setup (called directly from signIn, not from onAuthStateChange)
async function handlePostSignIn(user) {
    console.log('handlePostSignIn: Setting up user session...');
    currentUser = user;
    
    try {
        await updateUIForAuthenticatedUser(user);
    } catch (e) {
        console.error('handlePostSignIn: Error updating UI:', e);
    }
    
    try {
        await loadTodaySession();
    } catch (e) {
        console.error('handlePostSignIn: Error loading today session:', e);
    }
    
    try {
        await loadCompletionHistory();
    } catch (e) {
        console.error('handlePostSignIn: Error loading completion history:', e);
    }
    
    hideLoadingScreen();
    showHome();
    console.log('handlePostSignIn: Complete');
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
        // onAuthStateChange will fire SIGNED_OUT synchronously
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

// Forgot password - show the form
function showForgotPassword() {
    showForgotPasswordView();
}

// Send password reset email
async function sendPasswordReset() {
    const email = document.getElementById('forgot-email').value.trim();

    if (!email) {
        showMessage('forgot-message', 'Please enter your email address', true);
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('forgot-message', 'Please enter a valid email address', true);
        return;
    }

    const submitBtn = document.getElementById('forgot-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
    }

    try {
        // redirectTo should point to your deployed app URL
        // Supabase will append the recovery token to this URL
        const currentOrigin = window.location.origin;
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: currentOrigin
        });

        if (error) {
            showMessage('forgot-message', error.message, true);
        } else {
            // Always show success to avoid leaking whether an email exists
            showMessage('forgot-message', 'If an account exists with this email, you will receive a password reset link. Please check your inbox (and spam folder).', false);
            document.getElementById('forgot-email').value = '';
        }
    } catch (error) {
        console.error('Password reset error:', error);
        showMessage('forgot-message', 'An error occurred. Please try again.', true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
        }
    }
}

// Update password (called from the reset password form)
async function updatePassword() {
    const password = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-password-confirm').value;

    if (!password || !confirmPassword) {
        showMessage('reset-message', 'Please fill in both fields', true);
        return;
    }

    if (password.length < 6) {
        showMessage('reset-message', 'Password must be at least 6 characters', true);
        return;
    }

    if (password !== confirmPassword) {
        showMessage('reset-message', 'Passwords do not match', true);
        return;
    }

    const submitBtn = document.getElementById('reset-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Updating...';
    }

    try {
        const { error } = await window.supabaseClient.auth.updateUser({
            password: password
        });

        if (error) {
            showMessage('reset-message', error.message, true);
        } else {
            showMessage('reset-message', 'Password updated successfully! Redirecting...', false);

            // Clear recovery state
            isPasswordRecovery = false;

            // Clean the hash from the URL
            if (window.history.replaceState) {
                window.history.replaceState(null, '', window.location.pathname);
            }

            // Clear form
            document.getElementById('reset-password').value = '';
            document.getElementById('reset-password-confirm').value = '';

            // Redirect to home after a brief pause
            setTimeout(() => {
                // The user is already authenticated via the recovery token
                if (currentUser) {
                    showHome();
                } else {
                    showSignInView();
                }
            }, 2000);
        }
    } catch (error) {
        console.error('Password update error:', error);
        showMessage('reset-message', 'An error occurred. Please try again.', true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Password';
        }
    }
}

// Listen to auth state changes
function initAuthListener() {
    if (!window.supabaseClient) {
        console.error('Supabase client not available');
        hideLoadingScreen();
        showAuthPage();
        return;
    }

    // Callback must be synchronous
    window.supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event, 'Session:', !!session);
        
        switch (event) {
            case 'INITIAL_SESSION':
                if (isPasswordRecovery) {
                    console.log('INITIAL_SESSION during recovery - showing reset form');
                    if (session?.user) {
                        currentUser = session.user;
                    }
                    hideLoadingScreen();
                    showResetPasswordView();
                } else {
                    console.log('INITIAL_SESSION - handled by app.js');
                }
                break;
                
            case 'SIGNED_IN':
                if (isPasswordRecovery) {
                    console.log('SIGNED_IN during recovery - deferring to PASSWORD_RECOVERY handler');
                    if (session?.user) {
                        currentUser = session.user;
                    }
                    hideLoadingScreen();
                    showResetPasswordView();
                } else {
                    console.log('SIGNED_IN - handled by signIn()');
                }
                break;
                
            case 'SIGNED_OUT':
                console.log('SIGNED_OUT - resetting app state');
                resetAppState();
                updateUIForGuestUser();
                hideLoadingScreen();
                showAuthPage();
                break;
                
            case 'TOKEN_REFRESHED':
                // Just update the user reference (synchronous)
                if (session) {
                    currentUser = session.user;
                }
                break;
                
            case 'USER_UPDATED':
                // Update user reference (synchronous)
                if (session?.user) {
                    currentUser = session.user;
                }
                break;

            case 'PASSWORD_RECOVERY':
                console.log('PASSWORD_RECOVERY - showing reset password form');
                // User clicked the reset link in their email
                // Supabase has already verified the token and created a session
                if (session?.user) {
                    currentUser = session.user;
                }
                hideLoadingScreen();
                showResetPasswordView();
                break;
                
            default:
                console.log('Unhandled auth event:', event);
        }
    });
    
    console.log('Auth listener initialized (synchronous)');
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

    // Forgot password form
    const forgotEmail = document.getElementById('forgot-email');
    if (forgotEmail) {
        forgotEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendPasswordReset();
        });
    }

    // Reset password form
    const resetPassword = document.getElementById('reset-password');
    const resetPasswordConfirm = document.getElementById('reset-password-confirm');

    if (resetPassword) {
        resetPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') updatePassword();
        });
    }

    if (resetPasswordConfirm) {
        resetPasswordConfirm.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') updatePassword();
        });
    }
}

console.log('Auth module loaded');