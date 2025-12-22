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

// ==================== Data Loading Functions ====================
async function loadCompletionHistory() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await window.supabaseClient
            .from('workout_sessions')
            .select('session_date, progress')
            .eq('user_id', currentUser.id)
            .order('session_date', { ascending: true });

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
    } catch (error) {
        console.error('Exception in loadCompletionHistory:', error);
    }   
}

async function loadTodaySession() {
    if (!currentUser) return;

    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await window.supabaseClient
            .from('workout_sessions')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('session_date', today)
            .order('updated_at', { ascending: false })
            .maybeSingle();

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
    } catch (error) {
        console.error('Exception in loadTodaySession:', error);
    }   
}

// ==================== UI Update Functions ====================
async function updateUIForAuthenticatedUser(user) {
    const signoutBtn = document.getElementById('signout-button');
    if (signoutBtn) signoutBtn.classList.remove('hidden');
    
    try {
        const { data: profile } = await window.supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        userProfile = profile;

        const userInfo = document.getElementById('user-info');
        if (userInfo) {
            userInfo.classList.remove('hidden');
            
            const fullName = profile?.full_name || user.email;
            const firstName = fullName.split(' ')[0];
            
            const nameDisplay = document.getElementById('user-name-display');
            const initialDisplay = document.getElementById('user-initial');
            
            if (nameDisplay) nameDisplay.textContent = firstName;
            if (initialDisplay) initialDisplay.textContent = firstName.charAt(0).toUpperCase();
        }
    } catch (error) {
        console.error('Error loading user profile:', error);
    }
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
