// ==================== App State ====================
let currentUser = null;
let userProfile = null;
let currentPlaylist = null;
let currentVideo = null;
let todaySession = null;
let sessionProgress = {};
let completionHistory = {};

// Timeout reference so we can cancel it
let authTimeoutId = null;

// ==================== App Initialization ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing app...');
    
    // Initialize auth form listeners
    if (typeof initAuthFormListeners === 'function') {
        initAuthFormListeners();
    }

    // Check if Supabase client is available
    if (!window.supabaseClient) {
        console.error('Supabase client not initialized');
        hideLoadingScreen();
        showAuthPage();
        return;
    }

    // Initialize auth state listener - this handles everything
    if (typeof initAuthListener === 'function') {
        initAuthListener();
    }
    
    // Safety timeout in case onAuthStateChange never fires (rare edge case)
    // This will be cancelled by the auth listener when it fires
    authTimeoutId = setTimeout(() => {
        console.warn('Auth state change did not fire within timeout, checking session manually...');
        checkSessionManually();
    }, 10000); // 10 seconds - plenty of time for normal auth flow
});

// Cancel the safety timeout - called by auth listener
function cancelAuthTimeout() {
    if (authTimeoutId) {
        clearTimeout(authTimeoutId);
        authTimeoutId = null;
    }
}

// Fallback function if onAuthStateChange doesn't fire
async function checkSessionManually() {
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        
        if (error) {
            console.error('Manual session check error:', error);
            hideLoadingScreen();
            showAuthPage();
            return;
        }
        
        if (session) {
            console.log('Manual check found session, user is authenticated');
            currentUser = session.user;
            
            try {
                await updateUIForAuthenticatedUser(session.user);
            } catch (e) {
                console.error('Error updating UI:', e);
            }
            
            try {
                await loadTodaySession();
            } catch (e) {
                console.error('Error loading today session:', e);
            }
            
            try {
                await loadCompletionHistory();
            } catch (e) {
                console.error('Error loading completion history:', e);
            }
            
            hideLoadingScreen();
            showHome();
        } else {
            console.log('Manual check found no session');
            updateUIForGuestUser();
            hideLoadingScreen();
            showAuthPage();
        }
    } catch (error) {
        console.error('Exception in manual session check:', error);
        hideLoadingScreen();
        showAuthPage();
    }
}

// ==================== Week Calculation ====================
function calculateUserWeek() {
    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        return 0;
    }
    
    const dates = Object.keys(completionHistory).sort();
    if (dates.length === 0) return 0;
    
    const firstDate = new Date(dates[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = today - firstDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let weekNumber = Math.floor(diffDays / 7);

    if (weekNumber <= 3) return weekNumber;

    const mostRecentDate = new Date(dates[dates.length - 1] + 'T00:00:00');
    const daysSinceLastActivity = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24));

    if (daysSinceLastActivity >= 14) return 4;

    return Math.min(weekNumber, 6);
}

function getSuggestedWorkout() {
    const userWeek = calculateUserWeek();

    if (userWeek <= 3) {
        return PLAYLISTS.find(p => p.id === 'beginner-0-3');
    } else {
        return PLAYLISTS.find(p => p.id === 'advanced-4-6');
    }
}

// ==================== Data Loading ====================
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

// ==================== Playlist Completion Helpers ====================
function getPlaylistLastCompletion(playlistId) {
    const playlist = PLAYLISTS.find(p => p.id === playlistId);
    if (!playlist || !completionHistory) return null;

    const dates = Object.keys(completionHistory).sort().reverse();

    for (const date of dates) {
        const progress = completionHistory[date];
        if (progress && progress[playlistId]) {
            let completedCount = 0;
            const totalExercises = playlist.videos.length;

            playlist.videos.forEach(video => {
                const completedSets = progress[playlistId][video.id] || 0;
                if (completedSets > 0) completedCount++;
            });

            if (completedCount > 0) {
                return {
                    date: date,
                    completedExercises: completedCount,
                    totalExercises: totalExercises
                };
            }
        }
    }

    return null;
}

function formatCompletionDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) {
        return 'today';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ==================== Playlist Display ====================
function loadPlaylists() {
    const grid = document.getElementById('playlists-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!currentUser) {
        showAuthPage();
        return;
    }

    // Show sections
    const greetingSection = document.getElementById('user-greeting-section');
    const todaysSection = document.getElementById('todays-workout-section');
    const allWorkoutsSection = document.getElementById('all-workouts-section');
    
    if (greetingSection) greetingSection.classList.remove('hidden');
    if (todaysSection) todaysSection.classList.remove('hidden');
    if (allWorkoutsSection) allWorkoutsSection.classList.remove('hidden');

    // Update user name
    const userName = userProfile?.full_name?.split(' ')[0] || currentUser.email?.split('@')[0] || 'there';
    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = userName;

    // Update week display
    const userWeek = calculateUserWeek();
    const weekDisplay = document.getElementById('user-week');
    if (weekDisplay) weekDisplay.textContent = userWeek;

    // Update greeting message
    const greetingP = document.querySelector('#user-greeting-section p');
    if (greetingP) {
        if (userWeek === 0) {
            greetingP.innerHTML = `Welcome to the program! Start with <strong>Week 0</strong> and take it from there. Let's get started!`;
        } else {
            greetingP.innerHTML = `You've reached <strong>Week ${userWeek}</strong>. Keep it up!`;
        }
    }

    loadTodaysWorkout();

    PLAYLISTS.forEach(playlist => {
        const card = createPlaylistCard(playlist);
        grid.appendChild(card);
    });
}

function createPlaylistCard(playlist) {
    const card = document.createElement('div');
    card.className = 'playlist-card';
    card.onclick = () => showPlaylist(playlist.id);

    const isAdvanced = playlist.id.includes('advanced');
    const overlayClass = isAdvanced ? 'advanced' : 'beginner';
    const weekText = isAdvanced ? 'Advanced<br>Weeks 4-6 Workout' : 'Beginner<br>Weeks 0-3 Workout';

    const completion = getPlaylistLastCompletion(playlist.id);
    let completionHTML = '';
    
    if (completion) {
        const dateStr = formatCompletionDate(completion.date);
        completionHTML = `
            <div class="completion-status">
                <div class="checkmark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                </div>
                <span>You completed ${completion.completedExercises}/${completion.totalExercises} exercises on ${dateStr}</span>
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="playlist-thumbnail-wrapper">
            <img src="${playlist.thumbnail}" alt="${playlist.title}">
            <div class="playlist-overlay ${overlayClass}">
                <span class="week-label">${weekText}</span>
            </div>
        </div>
        <div class="playlist-card-content">
            <h3>${playlist.title}</h3>
            <p>${playlist.description}</p>
            ${completionHTML}
            <a href="#" class="go-to-workout-link" onclick="event.stopPropagation(); showPlaylist('${playlist.id}'); return false;">
                Go to Workout 
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
            </a>
        </div>
    `;

    return card;
}

function loadTodaysWorkout() {
    const container = document.getElementById('todays-workout-card');
    if (!container) return;

    const suggested = getSuggestedWorkout();
    if (!suggested) return;

    const isAdvanced = suggested.id.includes('advanced');
    const overlayClass = isAdvanced ? 'advanced' : 'beginner';
    const weekText = isAdvanced ? 'Advanced<br>Weeks 4-6 Workout' : 'Beginner<br>Weeks 0-3 Workout';
    
    container.innerHTML = `
        <div class="todays-workout-thumbnail">
            <img src="${suggested.thumbnail}" alt="${suggested.title}">
            <div class="playlist-overlay ${overlayClass}">
                <span class="week-label">${weekText}</span>
            </div>
        </div>
        <div class="todays-workout-info">
            <h3>${suggested.title}</h3>
            <p>Your suggested workout for today</p>
            <button class="start-workout-btn" onclick="showPlaylist('${suggested.id}')">Start Workout</button>
        </div>
    `;
}

// ==================== Playlist View ====================
function showPlaylist(playlistId) {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    currentPlaylist = PLAYLISTS.find(p => p.id === playlistId);
    if (!currentPlaylist) return;

    // Hide other views, show playlist view
    const homeView = document.getElementById('home-view');
    const playlistView = document.getElementById('playlist-view');
    const authView = document.getElementById('auth-view');
    
    if (homeView) homeView.classList.add('hidden');
    if (playlistView) playlistView.classList.remove('hidden');
    if (authView) authView.classList.add('hidden');

    // Update playlist info
    const titleEl = document.getElementById('playlist-title');
    const descEl = document.getElementById('playlist-description');
    if (titleEl) titleEl.textContent = currentPlaylist.title;
    if (descEl) descEl.textContent = currentPlaylist.description;

    // Show save button
    const saveBtn = document.getElementById('save-progress-btn');
    if (saveBtn) saveBtn.classList.remove('hidden');

    // Initialize session progress for this playlist
    if (!sessionProgress[playlistId]) {
        sessionProgress[playlistId] = {};
    }

    loadExerciseTable();
}

function getEquipmentBadgeClass(equipmentText) {
    const lowerText = equipmentText.toLowerCase();
    
    if (lowerText.includes('easier')) {
        return 'badge-easier';
    } else if (lowerText.includes('more challenging')) {
        return 'badge-more-challenging';
    } else if (lowerText.includes('challenging')) {
        return 'badge-challenging';
    }
    
    return 'badge-neutral';
}

function loadExerciseTable() {
    const tbody = document.getElementById('exercise-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    currentPlaylist.videos.forEach((video) => {
        const row = document.createElement('tr');
        
        // Video cell
        const videoCell = document.createElement('td');
        videoCell.innerHTML = `
          <div class="exercise-video-cell">
            <div class="video-thumbnail-wrapper" onclick="playExerciseVideo('${video.id}')">
                <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
            </div>
            <span class="exercise-name">${video.title}</span>
          </div>  
        `;
        row.appendChild(videoCell);

        // Sets/reps cell
        const setsRepsCell = document.createElement('td');
        setsRepsCell.innerHTML = `<span class="sets-reps-text">${video.sets} sets of ${video.reps} reps</span>`;
        row.appendChild(setsRepsCell);

        // Equipment cell
        const equipmentCell = document.createElement('td');
        if (video.equipment && Array.isArray(video.equipment) && video.equipment.length > 0) {
            const badges = video.equipment.map(item => {
                const badgeClass = getEquipmentBadgeClass(item);
                return `<span class="equipment-badge ${badgeClass}">${item}</span>`;
            }).join(' ');
            equipmentCell.innerHTML = badges;
        } else if (video.equipment && typeof video.equipment === 'string') {
            equipmentCell.innerHTML = `<span class="equipment-badge">${video.equipment}</span>`;
        } else {
            equipmentCell.innerHTML = `<span class="no-equipment">—</span>`;
        }
        row.appendChild(equipmentCell);

        // Completion cell
        const completionCell = document.createElement('td');
        
        let completedSets = 0;
        if (todaySession?.progress?.[currentPlaylist.id]?.[video.id]) {
            completedSets = todaySession.progress[currentPlaylist.id][video.id] || 0;
        } else if (sessionProgress[currentPlaylist.id]?.[video.id]) {
            completedSets = sessionProgress[currentPlaylist.id][video.id] || 0;
        }
        
        completionCell.innerHTML = `
            <div class="sets-counter">
                <button type="button" 
                        class="counter-btn minus-btn" 
                        onclick="decrementSets('${video.id}', ${video.sets})"
                        ${completedSets <= 0 ? 'disabled' : ''}>
                    −
                </button>
                <input type="number" 
                       id="sets_${video.id}"
                       class="sets-input" 
                       value="${completedSets}" 
                       min="0" 
                       max="${video.sets}"
                       onchange="updateSetsCount('${video.id}', ${video.sets})"
                       readonly>
                <button type="button" 
                        class="counter-btn plus-btn" 
                        onclick="incrementSets('${video.id}', ${video.sets})">
                    +
                </button>
                <span class="sets-label">/ ${video.sets} sets</span>
            </div>
        `;
        row.appendChild(completionCell);

        tbody.appendChild(row);
    });
}

// ==================== Set Counter Functions ====================
function incrementSets(videoId, maxSets) {
    if (!sessionProgress[currentPlaylist.id]) {
        sessionProgress[currentPlaylist.id] = {};
    }

    let currentCount = sessionProgress[currentPlaylist.id][videoId] || 0;
    currentCount++;
    sessionProgress[currentPlaylist.id][videoId] = currentCount;

    updateSetsUI(videoId, currentCount, maxSets);
}

function decrementSets(videoId, maxSets) {
    if (!sessionProgress[currentPlaylist.id]) {
        sessionProgress[currentPlaylist.id] = {};
    }

    let currentCount = sessionProgress[currentPlaylist.id][videoId] || 0;

    if (currentCount > 0) {
        currentCount--;
        sessionProgress[currentPlaylist.id][videoId] = currentCount;
        updateSetsUI(videoId, currentCount, maxSets);
    }
}

function updateSetsCount(videoId, maxSets) {
    const input = document.getElementById(`sets_${videoId}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    value = Math.max(0, Math.min(maxSets, value));

    if (!sessionProgress[currentPlaylist.id]) {
        sessionProgress[currentPlaylist.id] = {};
    }

    sessionProgress[currentPlaylist.id][videoId] = value;
    updateSetsUI(videoId, value, maxSets);
}

function updateSetsUI(videoId, currentCount, maxSets) {
    const input = document.getElementById(`sets_${videoId}`);
    if (!input) return;
    
    const minusBtn = input.previousElementSibling;

    input.value = currentCount;
    if (minusBtn) minusBtn.disabled = currentCount <= 0;
}

// ==================== Save Progress ====================
async function saveProgress() {
    const saveBtn = document.getElementById('save-progress-btn');
    if (!saveBtn) return;
    
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const today = new Date().toISOString().split('T')[0];

    const progressData = {};
    Object.keys(sessionProgress).forEach(playlistId => {
        progressData[playlistId] = sessionProgress[playlistId];
    });

    try {
        const { error } = await window.supabaseClient
            .from('workout_sessions')
            .upsert({
                user_id: currentUser.id,
                session_date: today,
                progress: progressData
            }, {
                onConflict: 'user_id,session_date'
            });

        if (error) {
            console.error('Error saving progress:', error);
            alert('Error saving progress. Please try again.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save My Progress For This Session';
            return;
        }

        await loadTodaySession();
        await loadCompletionHistory();

        saveBtn.classList.add('saved');
        saveBtn.textContent = '✓ Progress Saved!';

        setTimeout(() => {
            saveBtn.classList.remove('saved');
            saveBtn.textContent = 'Save My Progress For This Session';
            saveBtn.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('Exception saving progress:', error);
        alert('Error saving progress. Please try again.');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save My Progress For This Session';
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