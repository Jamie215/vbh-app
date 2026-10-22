// Handles sign up, sign in, sign out and password reset. Accounts are
// handled by the data layer (data.js); in the demo only sign-in and
// sign-out work.

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

    if (password.length < 8) {
        showMessage('signup-message', 'Password must be at least 8 characters', true);
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('signup-message', 'Please enter a valid email address', true);
        return;
    }

    try {
        const { error } = await Data.signUp({ name, email, password });

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
        logError(error, { operation: 'auth_signup' });
        showMessage('signup-message', 'An error occurred. Please try again.', true);
    }
}

// Sign in existing user
async function signIn() {
    // Dismiss mobile keyboard immediately so the viewport restores while the async auth call is in flight
    document.activeElement?.blur();

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    // Validation
    if (!email || !password) {
        showMessage('signin-message', 'Please fill in all fields', true);
        return;
    }

    try {
        const { data: user, error } = await Data.signIn(email, password);

        if (error) {
            showMessage('signin-message', error.message, true);
        } else {
            showMessage('signin-message', 'Signing in...', false);
            // Clear form
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
            
            handlePostSignIn(user);
        }
    } catch (error) {
        logError(error, { operation: 'auth_signin' });
        showMessage('signin-message', 'An error occurred. Please try again.', true);
    }
}

// Handle post sign-in setup.
// Each loader handles its own errors via logError internally — we don't wrap them.
async function handlePostSignIn(user) {
    currentUser = user;

    await updateUIForAuthenticatedUser(user);
    await loadTodaySession();
    await loadCompletionHistory();
    await loadProgramState();
    await loadEducationProgress();

    hideLoadingScreen();
    routeAfterAuth();
}

// Sign out
async function signOut() {
    const confirmed = await showConfirm({
        title: 'Sign out?',
        message: "You'll need to log back in to continue using HandsUP.",
        confirmText: 'Sign Out',
        cancelText: 'Cancel',
        variant: 'danger'
    });
    if (!confirmed) return;

    try {
        const { error } = await Data.signOut();

        if (error) {
            await showAlert({
                title: 'Sign Out Failed',
                message: 'There was a problem signing you out: ' + error.message + '. Please try again.',
                variant: 'danger'
            });
            return;
        }

        resetAppState();
        updateUIForGuestUser();
        showAuthPage();
    } catch (error) {
        logError(error, { operation: 'auth_signout' });
        await showAlert({
            title: 'Sign Out Failed',
            message: 'An error occurred while signing out. Please try again.',
            variant: 'danger'
        });
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
        const { error } = await Data.requestPasswordReset(email);

        if (error) {
            showMessage('forgot-message', error.message, true);
        } else {
            // Always show success to avoid leaking whether an email exists
            showMessage('forgot-message', 'If an account exists with this email, you will receive a password reset link. Please check your inbox (and spam folder).', false);
            document.getElementById('forgot-email').value = '';
        }
    } catch (error) {
        logError(error, { operation: 'auth_password_reset_request' });
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
        const { error } = await Data.updatePassword(password);

        if (error) {
            showMessage('reset-message', error.message, true);
        } else {
            showMessage('reset-message', 'Password updated successfully! Redirecting...', false);

            // Clear form
            document.getElementById('reset-password').value = '';
            document.getElementById('reset-password-confirm').value = '';

            // Redirect to home after a brief pause
            setTimeout(() => {
                if (currentUser) {
                    handlePostSignIn(currentUser);
                } else {
                    showSignInView();
                }
            }, 2000);
        }
    } catch (error) {
        logError(error, { operation: 'auth_password_update' });
        showMessage('reset-message', 'An error occurred. Please try again.', true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Password';
        }
    }
}

// Demo: show the demo account's details on the Log In page
function renderDemoSignInNotice() {
    const notice = document.getElementById('demo-signin-notice');
    if (!notice || !Data.isDemo) return;

    notice.innerHTML = `
        <p class="font-semibold text-text-primary mb-1">Demo version</p>
        <p class="mb-1">Sign in with <strong>${Data.demoAccount.email}</strong> and password <strong>${Data.demoAccount.password}</strong>.</p>
        <p>You can try everything, but changes aren't saved: reloading the page goes back to the sample data.</p>
    `;
    notice.classList.remove('hidden');
}

// Handle Enter key press in auth forms
function initAuthFormListeners() {
    renderDemoSignInNotice();

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
