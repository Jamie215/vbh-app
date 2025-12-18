// Track current user and state
let currentUser = null;
let userProfile = null;
let currentPlaylist = null;
let currentVideo = null;
let todaySession = null;
let sessionProgress = {};
let completionHistory = {};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
            
        if (session) {
            currentUser = session.user;
            await updateUIForAuthenticatedUser(session.user);
            await loadTodaySession();
            await loadCompletionHistory();
        } else {
            updateUIForGuestUser();
        }
    } catch(error) {
        console.error('Initialization error:', error);
    } finally {
        showHome();
    }
});

// Show home view with playlists
function showHome() {
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('playlist-view').classList.add('hidden');
    
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector('.nav-link')?.classList.add('active');

    loadPlaylists();
}

// Calculate user's weekly progress in the program
function calculateUserWeek() {
    // No history means Week 0
    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        return 0;
    }
    
    const dates = Object.keys(completionHistory).sort();
    if (dates.length === 0) return 0;
    
    const firstDate = new Date(dates[0] + 'T00:00:00');
    const today = new Date();

    const diffTime = today - firstDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    let weekNumber = Math.floor(diffDays / 7) + 1;

    // For Weeks 0-3: Progress never resets regardless of missed weeks
    if (weekNumber <= 3) return weekNumber;

    // For Weeks 4-6: Allow 2 weeks of missing progress before resetting to Week 4
    const mostRecentDate = new Date(dates[dates.length - 1] + 'T00:00:00');
    const daysSinceLastActivity = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24));

    if (daysSinceLastActivity >= 14) return 4;

    return weekNumber
}

// Display the suggested workout playlist for today based on user's progress
function getSuggestedWorkout() {
    const userWeek = calculateUserWeek();

    if (userWeek <= 3) {
        return PLAYLISTS.find(p => p.id === 'beginner-0-3')
    } else {
        return PLAYLISTS.find(p => p.id === 'advanced-4-6')
    }
}

async function loadCompletionHistory() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await supabase
            .from('workout_sessions')
            .select('session_date, progress')
            .eq('user_id', currentUser.id)
            .order('session_date', { ascending: true });

        if (error) {
            console.error('Error loading completion history:', error);
            return;
        }

        completionHistory = {};
        data.forEach(session => {
            if (!completionHistory[session.session_date]) {
                completionHistory[session.session_date] = session.progress;
            }
        });
    } catch (error) {
        console.error('Exception in loadCompletionHistory:', error);
    }   
}

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
    today.setHours(0,0,0,0);

    const dateOnly = new Date(date);
    dateOnly.setHours(0,0,0,0);

    if (dateOnly.getTime() === today.getTime()) {
        return 'today';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Load and display playlists
function loadPlaylists() {
    const grid = document.getElementById('playlists-grid');
    grid.innerHTML = '';

    // Show authentication for guests
    if (!currentUser) {
        grid.innerHTML = `
            <div class="auth-prompt">
                <h3>Sign in to access exercise modules</h3>
                <p>Create an account or sign in to view and track your exercise progress.</p>
                <button onclick="showAuthModal()" class="primary-button">Sign In / Sign Up</button>
            </div>
        `;
        // Hide recent activity for guests
        document.getElementById('user-greeting-section').classList.add('hidden');
        document.getElementById('todays-workout-section').classList.add('hidden');
        document.getElementById('all-workouts-section').classList.add('hidden');

        return;
    }

    document.getElementById('user-greeting-section').classList.remove('hidden');
    document.getElementById('todays-workout-section').classList.remove('hidden');
    document.getElementById('all-workouts-section').classList.remove('hidden');

    const userName = userProfile?.full_name?.split(' ')[0] || currentUser.email?.split('@')[0] || 'there';
    document.getElementById('user-name').textContent = userName;
    const userWeek = calculateUserWeek();
    const weekDisplay = document.getElementById('user-week');
    weekDisplay.textContent = userWeek;

    const greetingP = document.querySelector('#user-greeting-section p');
    if (userWeek === 0) {
        greetingP.innerHTML = `Welcome to the program! Start with <strong>Week 0</strong> and take it from there. Let's get started!`;
    } else {
        greetingP.innerHTML = `You've reached <strong>Week ${userWeek}</strong>. Keep it up!`;
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

    // Determine overlay style based on playlist type
    const isAdvanced = playlist.id.includes('advanced');
    const overlayClass = isAdvanced ? 'advanced' : 'beginner';
    const weekText = isAdvanced ? 'Advanced<br>Weeks 4-6 Workout' : 'Beginner<br>Weeks 0-3 Workout';

    // Get completion status
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
    const section = document.getElementById('todays-workout-section');
    const container = document.getElementById('todays-workout-card');

    if(!currentUser) {
        section.classList.add('hidden');
        return;
    }

    section.classList.remove('hidden');
    const suggested = getSuggestedWorkout();

    if (!suggested) {
        section.classList.add('hidden');
        return;
    }

    const isAdvanced = suggested.id.includes('advanced');
    const overlayClass = isAdvanced ? 'advanced' : 'beginner';
    const weekText = isAdvanced ? 'Advanced<br>Weeks 3-6 Workout' : 'Beginner<br>Weeks 0-3 Workout';
    
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

// Helper function to determine equipment badge class based on difficulty
function getEquipmentBadgeClass(equipmentText) {
    const lowerText = equipmentText.toLowerCase();
    
    // Check for difficulty keywords (order matters - check "more challenging" before "challenging")
    if (lowerText.includes('easier')) {
        return 'badge-easier';
    } else if (lowerText.includes('more challenging')) {
        return 'badge-more-challenging';
    } else if (lowerText.includes('challenging')) {
        return 'badge-challenging';
    }
    
    // Default neutral badge
    return 'badge-neutral';
}

// Show specific playlist with video table
function showPlaylist(playlistId) {
    // Require authentication to view playlists
    if (!currentUser) {
        showAuthModal();
        return;
    }

    currentPlaylist = PLAYLISTS.find(p => p.id === playlistId);
    
    if (!currentPlaylist) return;

    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('playlist-view').classList.remove('hidden');

    // Update playlist header
    document.getElementById('playlist-title').textContent = currentPlaylist.title;
    document.getElementById('playlist-description').textContent = currentPlaylist.description;

    // Show save button (always visible since user must be logged in)
    const saveBtn = document.getElementById('save-progress-btn');
    saveBtn.classList.remove('hidden');

    // Initialize session checkboxes for this playlist
    if (!sessionProgress[playlistId]) {
        sessionProgress[playlistId] = {};
    }

    loadExerciseTable();
}

// Load video table
function loadExerciseTable() {
    const tbody = document.getElementById('exercise-table-body');
    tbody.innerHTML = '';

    currentPlaylist.videos.forEach((video) => {
        const row = document.createElement('tr');
        
        const videoCell =document.createElement('td');
        videoCell.innerHTML = `
          <div class="exercise-video-cell">
            <div class="video-thumbnail-wrapper" onclick="playExerciseVideo('${video.id}')">
                <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail">
            </div>
            <span class="exercise-name">${video.title}</span>
          </div>  
        `;
        row.appendChild(videoCell);

        const setsRepsCell = document.createElement('td');
        setsRepsCell.innerHTML = `<span class="sets-reps-text">${video.sets} sets of ${video.reps} reps</span>`;
        row.appendChild(setsRepsCell);

        const equipmentCell = document.createElement('td');
        if (video.equipment && Array.isArray(video.equipment) && video.equipment.length > 0) {
            const badges = video.equipment.map(item => {
                const badgeClass = getEquipmentBadgeClass(item);
                return `<span class="equipment-badge ${badgeClass}">${item}</span>`;
            }).join(' ');
            equipmentCell.innerHTML = badges;
        } else if (video.equipment && typeof video.equipment === 'string') {
            // Fallback for old string format
            equipmentCell.innerHTML = `<span class="equipment-badge">${video.equipment}</span>`;
        } else {
            equipmentCell.innerHTML = `<span class="no-equipment">—</span>`;
        }
        row.appendChild(equipmentCell);

        const completionCell = document.createElement('td');
        
        // Get completed sets from saved progress
        let completedSets = 0;
        if (todaySession?.progress?.[currentPlaylist.id]?.[video.id]) {
            completedSets = todaySession.progress[currentPlaylist.id][video.id] || 0;
        } else if (sessionProgress[currentPlaylist.id]?.[video.id]) {
            completedSets = sessionProgress[currentPlaylist.id][video.id] || 0;
        }
        
        // Create number input with +/- buttons
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
                        onclick="incrementSets('${video.id}', ${video.sets})"
                        ${completedSets >= video.sets ? 'disabled' : ''}>
                    +
                </button>
                <span class="sets-label">/ ${video.sets} sets</span>
            </div>
        `;
        row.appendChild(completionCell);

        tbody.appendChild(row);
    });
}

// Increment sets completed
function incrementSets(videoId, maxSets) {
    if (!sessionProgress[currentPlaylist.id]) {
        sessionProgress[currentPlaylist.id] = {};
    }

    let currentCount = sessionProgress[currentPlaylist.id][videoId] || 0;

    currentCount++;
    sessionProgress[currentPlaylist.id][videoId] = currentCount;

    updateSetsUI(videoId, currentCount, maxSets);
}

// Decrement sets completed
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
    const minusBtn = input.previousElementSibling;
    const plusBtn = input.nextElementSibling;

    input.value = currentCount;

    minusBtn.disabled = currentCount <= 0;
    // plusBtn.disabled = currentCount >= maxSets;
}
 
// Load today's progress from database
async function loadTodaySession() {
    if (!currentUser) return;

    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('session_date', today)
            .order('updated_at', { ascending: false })
            .maybeSingle();

        console.log('Session query result:', { data, error });
        
        if (error) {
            console.error('Error loading session:', error);
            return;
        }

        todaySession = data;
        console.log('Today session set:', todaySession);

        // Populate session checkboxes with saved data
        if (data?.progress) {
            Object.keys(data.progress).forEach(playlistId => {
                if (!sessionProgress[playlistId]) {
                    sessionProgress[playlistId] = {};
                }
                Object.keys(data.progress[playlistId]).forEach(videoId => {
                    sessionProgress[playlistId][videoId] = data.progress[playlistId][videoId] || [];
                });
            });
        }
    } catch (error) {
        console.error('Exception in loadTodaySession:', error);
    }   
}


// Helper function to build a playlist card
function buildPlaylistCard(playlist, progress, isToday, formattedDate) {
    // Calculate completion stats
    let completedExercises = 0;
    const totalExercises = playlist.videos.length;
    
    // Check each video - count as completed if user has logged ANY sets
    playlist.videos.forEach(video => {
        const completedSets = progress[video.id] || 0;
        // Exercise is completed if at least one set is logged
        if (completedSets > 0) {
            completedExercises++;
        }
    });

    // Create completion message based on whether it's today
    const completionMessage = isToday 
        ? `Completed ${completedExercises}/${totalExercises} exercises today, ${formattedDate}`
        : `Completed ${completedExercises}/${totalExercises} exercises on ${formattedDate}`;
        
    // Create card with same styling as library playlists
    return `
        <div class="playlist-card" onclick="showPlaylist('${playlist.id}')">
            <img src="${playlist.thumbnail}" alt="${playlist.title}">
            <div class="playlist-card-content">
                <h3>${playlist.title}</h3>
                <p>${playlist.description}</p>
                <div class="recent-activity-stats">
                    <span class="completion-date">${completionMessage}</span>
                </div>
            </div>
        </div>
    `;
}

// Save progress to database (logged in users only)
async function saveProgress() {
    const saveBtn = document.getElementById('save-progress-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const today = new Date().toISOString().split('T')[0];

    // Build progress object from sessionProgress
    const progressData = {};
    Object.keys(sessionProgress).forEach(playlistId => {
        progressData[playlistId] = sessionProgress[playlistId];
    });

    const { error } = await supabase
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

    // Update button to show success
    saveBtn.classList.add('saved');
    saveBtn.textContent = '✓ Progress Saved!';

    setTimeout(() => {
        saveBtn.classList.remove('saved');
        saveBtn.textContent = 'Save My Progress For This Session';
        saveBtn.disabled = false;
    }, 2000);
}

// Update UI for authenticated user
async function updateUIForAuthenticatedUser(user) {
    document.getElementById('auth-button').classList.add('hidden');
    document.getElementById('signout-button').classList.remove('hidden');
    
    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    const userInfo = document.getElementById('user-info');
    userInfo.classList.remove('hidden');
    userInfo.innerHTML = `Welcome, ${profile?.full_name || user.email}!`;
}

// Update UI for guest user
function updateUIForGuestUser() {
    document.getElementById('auth-button').classList.remove('hidden');
    document.getElementById('signout-button').classList.add('hidden');
    document.getElementById('user-info').classList.add('hidden');
}

// Show auth modal
function showAuthModal() {
    document.getElementById('auth-modal').classList.remove('hidden');
}

// Close auth modal
function closeAuthModal() {
    document.getElementById('auth-modal').classList.add('hidden');
    clearAuthMessages();
}

// Switch auth tabs
function switchAuthTab(tab) {
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const tabs = document.querySelectorAll('.tab-button');

    if (tab === 'signin') {
        signinForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        tabs[0].classList.add('active');
        tabs[1].classList.remove('active');
    } else {
        signinForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
        tabs[0].classList.remove('active');
        tabs[1].classList.add('active');
    }
    
    clearAuthMessages();
}

// Clear auth messages
function clearAuthMessages() {
    document.getElementById('signin-message').textContent = '';
    document.getElementById('signup-message').textContent = '';
    document.getElementById('signin-message').className = 'form-message';
    document.getElementById('signup-message').className = 'form-message';
}

// Show message helper
function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.className = `form-message ${isError ? 'error' : 'success'}`;
}