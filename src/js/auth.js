// Sign up new user
async function signUp() {
    const name = document.getElementById('signup-name').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    if (!name || !email || !password) {
        showMessage('signup-message', 'Please fill in all fields', true);
        return;
    }

    if (password.length < 6) {
        showMessage('signup-message', 'Password must be at least 6 characters', true);
        return;
    }

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
        showMessage('signup-message', 'Check your email for verification link!', false);
        // Optionally switch to sign in tab after a delay
        setTimeout(() => {
            switchAuthTab('signin');
        }, 3000);
    }
}

// Sign in existing user
async function signIn() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
        showMessage('signin-message', 'Please fill in all fields', true);
        return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        showMessage('signin-message', error.message, true);
    } else {
        showMessage('signin-message', 'Sign in successful!', false);
        closeAuthModal();
    }
}

// Sign out
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert('Error signing out: ' + error.message);
    }
}

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        updateUIForAuthenticatedUser(session.user);
        closeAuthModal();
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        updateUIForGuestUser();
    }
});