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

// User Agreement
const AGREEMENT_VERSION = '0.1-draft';

function showAgreementModal() {
    const existing = document.getElementById('agreement-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'agreement-modal';
    overlay.className = 'fixed inset-0 bg-black/70 flex items-center justify-center z-[1000] p-4';

    overlay.innerHTML = `
        <div class="bg-white rounded-xl max-w-[700px] w-full max-h-[85vh] flex flex-col relative">
            <button onclick="closeAgreementModal()" class="absolute -top-3 -right-3 w-9 h-9 rounded-full bg-white shadow-md flex items-center justify-center text-text-primary border-none cursor-pointer hover:bg-gray-100 z-10" aria-label="Close">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <div class="px-8 pt-8 pb-4 border-b border-border-light shrink-0">
                <h2 class="text-2xl font-bold text-text-primary">HandsUP User Agreement</h2>
                <p class="text-base text-text-secondary mt-1">Version ${AGREEMENT_VERSION} · Please read carefully</p>
            </div>
            <div id="agreement-scroll-content" class="flex-1 overflow-y-auto px-8 py-6 min-h-0 text-base text-text-secondary leading-relaxed">
                ${getAgreementPlaceholderHTML()}
            </div>
            <div class="px-8 py-5 border-t border-border-light shrink-0">
                <p id="agreement-scroll-hint" class="text-sm text-text-secondary text-center mb-3">
                    <i class="fa-solid fa-arrow-down mr-1"></i> Please scroll to the bottom to enable the agreement button
                </p>
                <div class="flex justify-end gap-3">
                    <button type="button" onclick="closeAgreementModal()" class="py-2.5 px-6 bg-white text-text-secondary border-[1.5px] border-border-light rounded-lg text-base font-medium cursor-pointer transition-all hover:bg-subtle">Cancel</button>
                    <button type="button" id="agreement-accept-btn" disabled onclick="acceptAgreement()" class="py-2.5 px-6 bg-brand text-white border-none rounded-lg text-base font-semibold cursor-pointer transition-all hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed">I Agree</button>
                </div>
            </div>
        </div>
    `;

    document.getElementById('app').appendChild(overlay);

    const scrollContent = document.getElementById('agreement-scroll-content');
    const acceptBtn = document.getElementById('agreement-accept-btn');
    const hint = document.getElementById('agreement-scroll-hint');

    const checkScrolledToBottom = () => {
        const { scrollTop, scrollHeight, clientHeight } = scrollContent;
        const atBottom = scrollHeight - scrollTop - clientHeight < 10;
        if (atBottom) {
            acceptBtn.disabled = false;
            if (hint) hint.classList.add('hidden');
        }
    };

    scrollContent.addEventListener('scroll', checkScrolledToBottom);
    requestAnimationFrame(checkScrolledToBottom);
}

function closeAgreementModal() {
    const modal = document.getElementById('agreement-modal');
    if (modal) modal.remove();
}

function acceptAgreement() {
    const checkbox = document.getElementById('signup-agreement-checkbox');
    if (checkbox) checkbox.checked = true;
    closeAgreementModal();
}

// Placeholder content — replace with the finalized agreement once PI/REB/legal
// review is complete. Should be substantial enough to require scrolling.
function getAgreementPlaceholderHTML() {
    return `
        <p class="mt-4 mb-4"><em>This is a placeholder for the HandsUP User Agreement. The full agreement is currently under review by the Principal Investigator and the Research Ethics Board.</em></p>
        <h3 class="text-base font-semibold text-text-primary mt-6 mb-2">1. Eligibility and Study Participation</h3>
        <p class="mb-4">Access to the application is limited to participants enrolled in the study who have signed the Consent Form.</p>
        <h3 class="text-base font-semibold text-text-primary mt-6 mb-2">2. Intellectual Property and Content Use</h3>
        <p class="mb-4">All exercise videos, the education module, and other content within the application are protected by copyright. Participants are granted a limited, personal license to access the content for the purposes of the study only. Downloading, recording, redistribution, or sharing of any content is not permitted.</p>
        <h3 class="text-base font-semibold text-text-primary mt-6 mb-2">3. Health and Safety Disclaimer</h3>
        <p class="mb-4">The application is provided for research and educational purposes and is not a substitute for medical advice. Participants should consult their healthcare provider before beginning the exercise program and stop immediately if they experience pain, dizziness, or other unusual symptoms.</p>
        <h3 class="text-base font-semibold text-text-primary mt-6 mb-2">4. Personal Information and Privacy</h3>
        <p class="mb-4">Your name, email, and study data are collected and stored securely as described in your Consent Form.</p>
        <h3 class="text-base font-semibold text-text-primary mt-6 mb-2">5. Account Responsibilities</h3>
        <p class="mb-4">You agree to keep your account credentials confidential and to use only your own account.</p>
        <h3 class="text-base font-semibold text-text-primary mt-6 mb-2">6. Acceptable Use, Withdrawal, and Liability</h3>
        <p class="mb-4">Additional terms covering acceptable use of the application, your right to withdraw from the study, and limitations of liability will appear in the final version.</p>
        <p>For questions, contact the research team at <a href="mailto:research.hulc@gmail.com" class="text-brand hover:underline">research.hulc@gmail.com</a>.</p>
    `;
}

// Sign up new user
async function signUp() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const agreementCheckbox = document.getElementById('signup-agreement-checkbox');

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

    if (!agreementCheckbox || !agreementCheckbox.checked) {
        showMessage('signup-message', 'Please agree to the User Agreement to continue', true);
        return;
    }

    try {
        const { data, error } = await window.supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    full_name: name,
                    agreement_version: AGREEMENT_VERSION,
                    agreement_accepted_at: new Date().toISOString()
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
            if (agreementCheckbox) agreementCheckbox.checked = false;
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
        logError(error, { operation: 'auth_signin' });
        showMessage('signin-message', 'An error occurred. Please try again.', true);
    }
}

// Handle post sign-in setup (called directly from signIn, not from onAuthStateChange).
// Each loader handles its own errors via logError internally — we don't wrap them.
async function handlePostSignIn(user) {
    console.log('handlePostSignIn: Setting up user session...');
    currentUser = user;

    await updateUIForAuthenticatedUser(user);
    await loadTodaySession();
    await loadCompletionHistory();
    await loadProgramState();
    await loadEducationProgress();

    hideLoadingScreen();
    routeAfterAuth();
    console.log('handlePostSignIn: Complete');
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
        const { error } = await window.supabaseClient.auth.signOut();

        if (error) {
            await showAlert({
                title: 'Sign Out Failed',
                message: 'There was a problem signing you out: ' + error.message + '. Please try again.',
                variant: 'danger'
            });
        }
        // onAuthStateChange will fire SIGNED_OUT synchronously
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