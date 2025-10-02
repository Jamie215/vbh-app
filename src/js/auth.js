// Sign up new user
async function signUp() {
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

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
        alert('Error signing up: ' + error.message);
    } else {
        alert('Check your email for verification link!');
    }
}

// Sign in existing user
async function signIn() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
    });

    if (error) {
        alert('Error signing in: ' + error.message);
    }
}

// Sign out
async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        alert('Error signing out: ' + error.message);
    }
}

// Check auth state
supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
        showMainApp(session.user);
    } else {
        showAuthSection();
    }
});