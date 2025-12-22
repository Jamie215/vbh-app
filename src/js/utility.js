// Contains all shared state and functions used across multiple modules

// ==================== Global App State ====================
let currentUser = null;
let userProfile = null;
let currentPlaylist = null;
let currentVideo = null;
let todaySession = null;
let sessionProgress = {};
let completionHistory = {};

// Auth timeout reference
let authTimeoutId = null;

// ==================== Auth Timeout Management ====================
function setAuthTimeout(callback, delay) {
    authTimeoutId = setTimeout(callback, delay);
}

function cancelAuthTimeout() {
    if (authTimeoutId) {
        clearTimeout(authTimeoutId);
        authTimeoutId = null;
        console.log('Auth timeout cancelled');
    }
}

// ==================== Helper: Promise with timeout ====================
function withTimeout(promise, ms, errorMessage = 'Operation timed out') {
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), ms);
    });
    return Promise.race([promise, timeout]);
}

// ==================== Data Loading Functions ====================
async function loadCompletionHistory() {
    if (!currentUser) return;
    
    try {
        console.log('loadCompletionHistory: Starting...');
        
        const queryPromise = window.supabaseClient
            .from('workout_sessions')
            .select('session_date, progress')
            .eq('user_id', currentUser.id)
            .order('session_date', { ascending: true });
        
        const { data, error } = await withTimeout(queryPromise, 5000, 'loadCompletionHistory timed out');

        if (error) {
            console.error('Error loading completion history:', error);
            return;
        }

        completionHistory = {};
        data?.forEach(session => {
            if (!completionHistory[session.session_date]) {
                completionHistory[session.session_date] = session.progress;
            }
        });
        
        console.log('loadCompletionHistory: Completed');
    } catch (error) {
        console.error('Exception in loadCompletionHistory:', error.message);
    }   
}

async function loadTodaySession() {
    if (!currentUser) return;

    try {
        console.log('loadTodaySession: Starting...');
        
        const today = new Date().toISOString().split('T')[0];
        
        const queryPromise = window.supabaseClient
            .from('workout_sessions')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('session_date', today)
            .order('updated_at', { ascending: false })
            .maybeSingle();
        
        const { data, error } = await withTimeout(queryPromise, 5000, 'loadTodaySession timed out');

        if (error) {
            console.error('Error loading session:', error);
            return;
        }

        todaySession = data;

        if (data?.progress) {
            Object.keys(data.progress).forEach(playlistId => {
                if (!sessionProgress[playlistId]) {
                    sessionProgress[playlistId] = {};
                }
                Object.keys(data.progress[playlistId]).forEach(videoId => {
                    sessionProgress[playlistId][videoId] = data.progress[playlistId][videoId] || 0;
                });
            });
        }
        
        console.log('loadTodaySession: Completed');
    } catch (error) {
        console.error('Exception in loadTodaySession:', error.message);
    }   
}

// ==================== UI Update Functions ====================
async function updateUIForAuthenticatedUser(user) {
    console.log('updateUIForAuthenticatedUser: Starting with user:', user?.id);
    
    const signoutBtn = document.getElementById('signout-button');
    if (signoutBtn) signoutBtn.classList.remove('hidden');
    
    let profile = null;
    
    try {
        console.log('updateUIForAuthenticatedUser: Attempting profile fetch...');
        
        // Wrap in timeout to prevent hanging forever
        const profilePromise = window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .maybeSingle();
        
        const result = await withTimeout(profilePromise, 5000, 'Profile fetch timed out after 5 seconds');
        
        console.log('updateUIForAuthenticatedUser: Profile query result:', result);
        
        if (result.error) {
            console.error('updateUIForAuthenticatedUser: Profile fetch error:', result.error);
        } else {
            profile = result.data;
        }
    } catch (error) {
        console.error('updateUIForAuthenticatedUser: Exception during profile fetch:', error.message);
        // Continue without profile - don't block the app
    }

    userProfile = profile;

    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.classList.remove('hidden');
        
        // Use profile name, user metadata, or email as fallback
        const fullName = profile?.full_name || user.user_metadata?.full_name || user.email || 'User';
        const firstName = fullName.split(' ')[0];
        
        const nameDisplay = document.getElementById('user-name-display');
        const initialDisplay = document.getElementById('user-initial');
        
        if (nameDisplay) nameDisplay.textContent = firstName;
        if (initialDisplay) initialDisplay.textContent = firstName.charAt(0).toUpperCase();
    }
    
    console.log('updateUIForAuthenticatedUser: Completed');
}

function updateUIForGuestUser() {
    const signoutBtn = document.getElementById('signout-button');
    if (signoutBtn) signoutBtn.classList.add('hidden');
    
    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.classList.add('hidden');
}

// ==================== State Reset ====================
function resetAppState() {
    currentUser = null;
    userProfile = null;
    todaySession = null;
    sessionProgress = {};
    completionHistory = {};
    currentPlaylist = null;
}

console.log('Shared utilities loaded');