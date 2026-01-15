// Main application logic - playlist display, exercise tracking, etc.

// ==================== App Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
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

    // Set up auth listener for sign-out events (synchronous only)
    if (typeof initAuthListener === 'function') {
        initAuthListener();
    }
    
    // Initialize session - this handles the initial page load
    initializeSession();
});

// Initialize session on page load
async function initializeSession() {
    console.log('initializeSession: Starting...');
    
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        console.log('initializeSession: getSession completed', { hasSession: !!session, error });
        
        if (error) {
            console.error('initializeSession: Session error:', error);
            hideLoadingScreen();
            showAuthPage();
            return;
        }
        
        if (session) {
            console.log('initializeSession: User is authenticated, loading data...');
            currentUser = session.user;
            
            try {
                await updateUIForAuthenticatedUser(session.user);
            } catch (e) {
                console.error('initializeSession: Error in updateUIForAuthenticatedUser:', e);
            }
            
            try {
                await loadTodaySession();
            } catch (e) {
                console.error('initializeSession: Error in loadTodaySession:', e);
            }
            
            try {
                await loadCompletionHistory();
            } catch (e) {
                console.error('initializeSession: Error in loadCompletionHistory:', e);
            }
            
            hideLoadingScreen();
            showHome();
            console.log('initializeSession: Done!');
        } else {
            console.log('initializeSession: No session, showing auth page');
            updateUIForGuestUser();
            hideLoadingScreen();
            showAuthPage();
        }
    } catch (error) {
        console.error('initializeSession: Exception:', error);
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

// ==================== Progress Ring Calculation ====================
function calculatePlaylistProgress(playlistId) {
    const playlist = PLAYLISTS.find(p => p.id === playlistId);
    if (!playlist) return { completed:0 , total: 0, percentage: 0};

    const totalExercises = playlist.videos.length;
    let completedExercises = 0;

    // Fetch recently saved data for completionHistory
    let savedProgress = null;
    if (completionHistory) {
        const dates = Object.keys(completionHistory).sort().reverse();
        for (const date of dates) {
            if (completionHistory[date] && completionHistory[date][playlistId] {
                savedProgress = completionHistory[date][playlistId];
                break;
            }
    }

    // Count completed exercises
    playlist.videos.forEach(video => {
        const videoProgress = savedProgress ? savedProgress[video.id] : null;

        if (videoProgress) {
            if (typeof videoProgress === 'object' && !Array.isArray(videoProgress)) {
                const hasCompletedSet = Object.keys(videoProgress).some(key => {
                    return key.startsWith('set') && videoProgress[key]?.completed === true;
                });
                if (hasCompletedSet) completedExercises++;
            }
        }
    });

    const percentage = totalExercises > 0 ? Math.round((completedExercises / totalExercises)*100) : 0;

    return {
        completed: completedExercises,
        total: totalExercises,
        percentage: percentage
    };
}

// Generate SVG progress ring HTML
function generateProgressRing(percentage, size = 80, strokeWidth = 6) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percentage / 100) * circumference;
    const center = size / 2;

    return `
        <div class="progress-ring-container" style="width: ${size}px; height: ${size}px;">
            <svg class="progress-ring" width="${size}" height="${size}">
                <circle
                    class="progress-ring-bg"
                    cx="${center}"
                    cy="${center}"
                    r="${radius}"
                    stroke-width="${strokeWidth}"
                />
                <circle
                    class="progress-ring-fill"
                    cx="${center}"
                    cy="${center}"
                    r="${radius}"
                    stroke-width="${strokeWidth}"
                    stroke-dasharray="${circumference}"
                    stroke-dashoffset="${offset}"
                    transform="rotate(-90 ${center} ${center})"
                />
            </svg>
            <div class="progress-ring-text">
                <span class="progress-percentage">${percentage}%</span>
            </div>
        </div>
    `;
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
                const videoProgress = progress[playlistId][video.id];
                
                if (videoProgress) {
                    // Check if it's the new structure (object with set1, set2, etc.)
                    if (typeof videoProgress === 'object' && !Array.isArray(videoProgress)) {
                        // Count if any set is completed
                        const hasCompletedSet = Object.keys(videoProgress).some(key => {
                            return key.startsWith('set') && videoProgress[key]?.completed === true;
                        });
                        if (hasCompletedSet) completedCount++;
                    } 
                    // Backward compatibility: old structure where videoProgress is a number
                    else if (typeof videoProgress === 'number' && videoProgress > 0) {
                        completedCount++;
                    }
                }
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
        if (dateStr === 'today') {
            completionHTML = `
            <div class="completion-status">
                <div class="checkmark">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                </div>
                <span>You completed ${completion.completedExercises}/${completion.totalExercises} exercises ${dateStr}</span>
            </div>
        `;
        } else {
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
    }
    
    card.innerHTML = `
        <div class="playlist-thumbnail-wrapper">
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
    
    // Calculate progress for the suggested workout
    const progress = calculatePlaylistProgress(suggested.id);
    const progressRing = generateProgressRing(progress.eprcentage, 70, 5);
    
    container.innerHTML = `
        <div class="todays-workout-thumbnail">
            <div class="playlist-overlay ${overlayClass}">
                <span class="week-label">${weekText}</span>
            </div>
        </div>
        <div class="todays-workout-info">
            <h3>${suggested.title}</h3>
            <p>Your suggested workout for today</p>
            <div class="todays-workout-progress">
                ${progressRing}
                <span class="progress-label">${progress.completed}/${progress.total} exercises done</span>
            </div>
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

    // Update playlist info with new title format
    const titleEl = document.getElementById('playlist-title');
    const descEl = document.getElementById('playlist-description');
    
    // Create formatted title like "Beginner 3-6 Exercises"
    const isAdvanced = currentPlaylist.id.includes('advanced');
    const formattedTitle = isAdvanced ? 'Advanced 4-6 Exercises' : 'Beginner 0-3 Exercises';
    
    if (titleEl) titleEl.textContent = formattedTitle;
    if (descEl) descEl.innerHTML = `<strong><u>Instructions</u></strong>: Go through the below exercises at your own pace. Click to watch the videos to see how each exercise is done. Tap 'Save Progress' to keep your place in the workout.`;

    // Show save button
    const saveBtn = document.getElementById('save-progress-btn');
    if (saveBtn) saveBtn.classList.remove('hidden');

    // Initialize session progress for this playlist
    if (!sessionProgress[playlistId]) {
        sessionProgress[playlistId] = {};
    }

    updatePlaylistProgressRing();

    loadExerciseTable();
}

// Update progress ring in playlist view
function updatePlaylistProgressRing() {
    if (!currentPlaylist) return;

    const progressContainer = document.getElementById('playlist-progress-ring');
    if (!progressContainer) return;

    const progress = calculatePlaylistProgress(currentPlaylist.id);

    progressContainer.innerHTML = `
        ${generateProgressRing(progress.percentage, 60, 5)}
        <span class="progress-label">${progress.completed}/${progress.total} exercises</span>
    `;
}

// Get equipment display name (strip difficulty hints for cleaner display)
function getEquipmentDisplayName(equipmentText) {
    // Remove parenthetical hints like "(Easier)" or "(More Challenging)"
    return equipmentText.replace(/\s*\([^)]*\)\s*/g, '').trim();
}

// Get equipment difficulty level
function getEquipmentDifficulty(equipmentText) {
    const lowerText = equipmentText.toLowerCase();
    
    if (lowerText.includes('easier')) {
        return 'easier';
    } else if (lowerText.includes('more challenging')) {
        return 'more-challenging';
    } else if (lowerText.includes('challenging')) {
        return 'challenging';
    }
    
    return 'neutral';
}

function loadExerciseTable() {
    const tbody = document.getElementById('exercise-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    currentPlaylist.videos.forEach((video, index) => {
        const row = document.createElement('tr');
        
        // Order column
        const orderCell = document.createElement('td');
        orderCell.className = 'col-order';
        orderCell.textContent = index + 1;
        row.appendChild(orderCell);
        
        // Name column (thumbnail + title)
        const nameCell = document.createElement('td');
        nameCell.className = 'col-name';
        nameCell.innerHTML = `
          <div class="exercise-video-cell">
            <div class="video-thumbnail-wrapper" onclick="playExerciseVideo('${video.id}')">
                <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
            </div>
            <span class="exercise-name">${video.title}</span>
          </div>  
        `;
        row.appendChild(nameCell);

        // Sets/reps column
        const setsRepsCell = document.createElement('td');
        setsRepsCell.className = 'col-sets-reps';
        
        // Handle "each side" notation for single-leg exercises
        const needsEachSide = video.title.toLowerCase().includes('single leg') || 
                             video.title.toLowerCase().includes('hand squeeze');
        const setsRepsText = needsEachSide 
            ? `${video.sets} sets of ${video.reps} reps<br><span class="each-side">(each side)</span>`
            : `${video.sets} sets of ${video.reps} reps`;
        
        setsRepsCell.innerHTML = `<span class="sets-reps-text">${setsRepsText}</span>`;
        row.appendChild(setsRepsCell);

        // Equipment column with colored dots and "or" separators
        const equipmentCell = document.createElement('td');
        equipmentCell.className = 'col-equipment';
        
        if (video.equipment && Array.isArray(video.equipment) && video.equipment.length > 0) {
            const badges = video.equipment.map((item, i) => {
                const difficulty = getEquipmentDifficulty(item);
                const displayName = getEquipmentDisplayName(item);
                const dotClass = `dot-${difficulty}`;
                
                return `<span class="equipment-badge badge-${difficulty}">
                    <span class="equipment-dot ${dotClass}"></span>
                    ${displayName}
                </span>`;
            });
            
            // Join with "or" separator
            equipmentCell.innerHTML = badges.join('<span class="equipment-separator">or</span>');
        } else if (video.equipment && typeof video.equipment === 'string') {
            const difficulty = getEquipmentDifficulty(video.equipment);
            const displayName = getEquipmentDisplayName(video.equipment);
            equipmentCell.innerHTML = `<span class="equipment-badge badge-${difficulty}">
                <span class="equipment-dot dot-${difficulty}"></span>
                ${displayName}
            </span>`;
        } else {
            equipmentCell.innerHTML = `<span class="equipment-badge badge-none">
                <span class="equipment-dot dot-none"></span>
                None Needed
            </span>`;
        }
        row.appendChild(equipmentCell);

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
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

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
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Progress';
            return;
        }

        await loadTodaySession();
        await loadCompletionHistory();

        saveBtn.classList.add('saved');
        saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Progress Saved!';

        setTimeout(() => {
            saveBtn.classList.remove('saved');
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Progress';
            saveBtn.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('Exception saving progress:', error);
        alert('Error saving progress. Please try again.');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Progress';
    }
}

console.log('App module loaded');
