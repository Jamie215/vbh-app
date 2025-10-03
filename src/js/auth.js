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

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showMessage('signup-message', 'Please enter a valid email address', true);
        return;
    }

    // Sign up with Supabase
    const { data, error } = await supabase.auth.signUp({
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
        // Check if email confirmation is required
        if (data.user && !data.session) {
            showMessage('signup-message', 'Success! Please check your email to verify your account.', false);
        } else {
            showMessage('signup-message', 'Account created successfully!', false);
            // Will be handled by auth state change listener
        }
        
        // Clear form
        document.getElementById('signup-name').value = '';
        document.getElementById('signup-email').value = '';
        document.getElementById('signup-password').value = '';
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

    // Sign in with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
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
    }
}

// Sign out
async function signOut() {
    const confirmed = confirm('Are you sure you want to sign out?');
    if (!confirmed) return;

    const { error } = await supabase.auth.signOut();
    
    if (error) {
        alert('Error signing out: ' + error.message);
    } else {
        // Will be handled by auth state change listener
        alert('Successfully signed out!');
    }
}

// Listen to auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('Auth event:', event); // For debugging
    
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        await updateUIForAuthenticatedUser(session.user);
        await loadTodayProgress();
        closeAuthModal();
        
        // Refresh current view to show progress
        if (currentPlaylist) {
            showPlaylist(currentPlaylist.id);
        }
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        todayProgress = {};
        updateUIForGuestUser();
        
        // Refresh view to hide progress
        if (currentPlaylist) {
            showPlaylist(currentPlaylist.id);
        }
    } else if (event === 'USER_UPDATED') {
        // Handle user profile updates
        if (session?.user) {
            currentUser = session.user;
            await updateUIForAuthenticatedUser(session.user);
        }
    }
});

// Handle Enter key press in auth forms
document.addEventListener('DOMContentLoaded', () => {
    // Sign in form
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
    
    // Sign up form
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
});