// Show auth section
function showAuthSection() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('main-section').classList.add('hidden');
}

// Show main app
async function showMainApp(user) {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('main-section').classList.remove('hidden');

    // Load user profile
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profile) {
        document.getElementById('user-info').innerHTML = `
            Welcome, ${profile.full_name || profile.email}!
        `;
    }

    loadVideoLibrary();
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        showMainApp(session.user);
    } else {
        showAuthSection();
    }
});