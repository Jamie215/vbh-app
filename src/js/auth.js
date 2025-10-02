// Listen to auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN') {
        currentUser = session.user;
        await updateUIForAuthenticatedUser(session.user);
        await loadUserProgress();
        closeAuthModal();
        
        // Refresh current view to show progress
        if (currentPlaylist) {
            loadVideoTable();
        }
    } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        userProgress = {};
        updateUIForGuestUser();
        
        // Refresh view to hide progress
        if (currentPlaylist) {
            loadVideoTable();
        }
    }
});