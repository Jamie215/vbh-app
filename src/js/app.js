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

/**
 * Returns the pure calendar-based week number (days since first session / 7).
 * Used for discrepancy comparison against the session-gated program week.
 */
function calculateCalendarWeek() {
    if (!completionHistory || Object.keys(completionHistory).length === 0) return 0;

    const dates = Object.keys(completionHistory).sort();
    if (dates.length === 0) return 0;

    const firstDate = new Date(dates[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
    return Math.min(Math.floor(diffDays / 7), 6);
}

/**
 * Returns all dates where the user logged completed activity for the advanced playlist.
 */
function getAdvancedSessionDates() {
    if (!completionHistory) return [];

    const dates = [];
    for (const dateStr of Object.keys(completionHistory).sort()) {
        const dayProgress = completionHistory[dateStr];
        if (dayProgress && dayProgress['advanced-4-6']) {
            const advancedProgress = dayProgress['advanced-4-6'];
            const hasActivity = Object.values(advancedProgress).some(videoProgress => {
                if (typeof videoProgress === 'object' && !Array.isArray(videoProgress)) {
                    return Object.keys(videoProgress).some(key =>
                        key.startsWith('set') && videoProgress[key]?.completed === true
                    );
                }
                return typeof videoProgress === 'number' && videoProgress > 0;
            });
            if (hasActivity) dates.push(dateStr);
        }
    }
    return dates;
}

/**
 * Core function that computes the program week state for weeks 4-6.
 * Returns detailed state used by calculateUserWeek(), alerts, and checkWeek6Activity().
 *
 * Weeks 0-3: purely calendar-based (days since first session / 7).
 * Weeks 4-6: session-gated — requires 2 advanced sessions per program week to advance.
 *
 * 7-day window rules:
 *   - Window anchors to the advance date of the previous week (initially day 28).
 *   - If 2 sessions fall within the window → advance the day after the window expires.
 *   - If session 2 falls outside the window → advance the day after session 2.
 *   - New window starts on the advance date.
 *   - 14+ days of inactivity → reset to week 4.
 */
function getProgramWeekState() {
    const empty = { programWeek: 0, calendarWeek: 0, windowAnchor: null, sessionsInCurrentWeek: 0 };

    if (!completionHistory || Object.keys(completionHistory).length === 0) return empty;

    const allDates = Object.keys(completionHistory).sort();
    if (allDates.length === 0) return empty;

    const firstDate = new Date(allDates[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
    const calendarWeek = Math.min(Math.floor(diffDays / 7), 6);

    // Weeks 0-3: purely calendar-based
    if (calendarWeek <= 3) {
        return { programWeek: calendarWeek, calendarWeek, windowAnchor: null, sessionsInCurrentWeek: 0 };
    }

    // Check 14-day inactivity reset
    const mostRecentDate = new Date(allDates[allDates.length - 1] + 'T00:00:00');
    const daysSinceLastActivity = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24));

    if (daysSinceLastActivity >= 14) {
        return { programWeek: 4, calendarWeek, windowAnchor: null, sessionsInCurrentWeek: 0, wasReset: true };
    }

    // Weeks 4+: session-gated progression
    const advancedSessions = getAdvancedSessionDates();

    let programWeek = 4;
    // Initial window anchor: day 28 from first-ever session (start of calendar week 4)
    let windowAnchor = new Date(firstDate);
    windowAnchor.setDate(windowAnchor.getDate() + 28);

    let sessionsInCurrentWeek = 0;

    for (const sessionDateStr of advancedSessions) {
        const sessionDate = new Date(sessionDateStr + 'T00:00:00');

        // Skip sessions before the current program week's window
        if (sessionDate < windowAnchor) continue;

        sessionsInCurrentWeek++;

        if (sessionsInCurrentWeek >= 2) {
            // Determine advance date based on whether session 2 is within the window
            const windowEnd = new Date(windowAnchor);
            windowEnd.setDate(windowEnd.getDate() + 7);

            let advanceDate;
            if (sessionDate < windowEnd) {
                // Both sessions within the 7-day window → advance when window expires
                advanceDate = new Date(windowEnd);
            } else {
                // Session 2 spilled outside the window → advance day after session 2
                advanceDate = new Date(sessionDate);
                advanceDate.setDate(advanceDate.getDate() + 1);
            }

            if (today >= advanceDate) {
                programWeek++;
                if (programWeek >= 6) {
                    programWeek = 6;
                    windowAnchor = advanceDate;
                    // Count any remaining sessions that fall on/after the new anchor
                    sessionsInCurrentWeek = (sessionDate >= advanceDate) ? 1 : 0;
                    break;
                }
                windowAnchor = advanceDate;
                // Does this session also count toward the new program week?
                sessionsInCurrentWeek = (sessionDate >= advanceDate) ? 1 : 0;
            } else {
                // Prerequisite met but advance date not yet reached
                break;
            }
        }
    }

    // If we reached week 6, recount sessions from the anchor point
    if (programWeek === 6 && windowAnchor) {
        sessionsInCurrentWeek = 0;
        const anchorTime = windowAnchor.getTime();
        for (const sessionDateStr of advancedSessions) {
            const sd = new Date(sessionDateStr + 'T00:00:00');
            if (sd.getTime() >= anchorTime) {
                sessionsInCurrentWeek++;
            }
        }
    }

    return {
        programWeek: Math.min(programWeek, 6),
        calendarWeek,
        windowAnchor,
        sessionsInCurrentWeek
    };
}

/**
 * Main week calculation function used throughout the app.
 * Weeks 0-3: calendar-based. Weeks 4-6: session-gated via getProgramWeekState().
 */
function calculateUserWeek() {
    return getProgramWeekState().programWeek;
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
function calculatePlaylistProgress(playlistId, todayOnly = false) {
    const playlist = PLAYLISTS.find(p => p.id === playlistId);
    if (!playlist) return { completed: 0, total: 0, percentage: 0 };

    const totalExercises = playlist.videos.length;
    let completedExercises = 0;

    // Get saved progress
    let savedProgress = null;
    
    if (todayOnly) {
        // Only look at today's session
        const today = new Date().toISOString().split('T')[0];
        if (completionHistory && completionHistory[today] && completionHistory[today][playlistId]) {
            savedProgress = completionHistory[today][playlistId];
        }
    } else {
        // Look at most recent saved session (original behavior)
        if (completionHistory) {
            const dates = Object.keys(completionHistory).sort().reverse();
            for (const date of dates) {
                if (completionHistory[date] && completionHistory[date][playlistId]) {
                    savedProgress = completionHistory[date][playlistId];
                    break;
                }
            }
        }
    }

    if (!savedProgress) {
        return { completed: 0, total: totalExercises, percentage: 0 };
    }

    // Count completed exercises
    playlist.videos.forEach(video => {
        const videoProgress = savedProgress[video.id];
        
        if (videoProgress) {
            // Check if it's the new structure (object with set1, set2, etc.)
            if (typeof videoProgress === 'object' && !Array.isArray(videoProgress)) {
                const hasCompletedSet = Object.keys(videoProgress).some(key => {
                    return key.startsWith('set') && videoProgress[key]?.completed === true;
                });
                if (hasCompletedSet) completedExercises++;
            } 
            // Backward compatibility: old structure where videoProgress is a number
            else if (typeof videoProgress === 'number' && videoProgress > 0) {
                completedExercises++;
            }
        }
    });

    const percentage = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

    return {
        completed: completedExercises,
        total: totalExercises,
        percentage: percentage
    };
}

// Store chart instances to destroy before re-creating
let todaysWorkoutChart = null;
let playlistViewChart = null;

// Create a Chart.js doughnut progress ring
function createProgressRing(canvasId, percentage, size = 70) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    // Set canvas size
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [percentage, 100 - percentage],
                backgroundColor: [
                    '#10b981', // Completed - green
                    '#e5e7eb'  // Remaining - light gray
                ],
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: {
                animateRotate: true,
                duration: 800
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw: function(chart) {
                const ctx = chart.ctx;
                const centerX = chart.width / 2;
                const centerY = chart.height / 2;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.fillStyle = '#1a1a2e';
                ctx.fillText(`${percentage}%`, centerX, centerY);
                ctx.restore();
            }
        }]
    });

    return chart;
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
    const state = getProgramWeekState();
    const userWeek = state.programWeek;
    const weekDisplay = document.getElementById('user-week');
    if (weekDisplay) weekDisplay.textContent = userWeek;

    // Update greeting message
    const greetingP = document.querySelector('#user-greeting-section p');
    if (greetingP) {
        if (userWeek === 0) {
            greetingP.innerHTML = `Welcome to the program! Start with <strong>Week 0</strong> and take it from there. Let's get started!`;
        } else if (userWeek >= 4 && userWeek < 6) {
            const sessionsLeft = 2 - state.sessionsInCurrentWeek;
            if (sessionsLeft > 0) {
                greetingP.innerHTML = `You're on <strong>Week ${userWeek}</strong>. ${sessionsLeft === 1 ? '1 more session' : '2 sessions'} to go this week to advance — keep it up!`;
            } else {
                greetingP.innerHTML = `You've reached <strong>Week ${userWeek}</strong> and completed your sessions. The next week will unlock soon!`;
            }
        } else {
            greetingP.innerHTML = `You've reached <strong>Week ${userWeek}</strong>. Keep it up!`;
        }
    }

    if (typeof renderProgressAlert === 'function') {
        renderProgressAlert();
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
    
    // Calculate progress for the suggested workout (today only)
    const progress = calculatePlaylistProgress(suggested.id, true);
    
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
                <canvas id="todays-progress-ring"></canvas>
                <span class="progress-label">${progress.completed}/${progress.total} exercises done</span>
            </div>
            <button class="start-workout-btn" onclick="showPlaylist('${suggested.id}')">Start Workout</button>
        </div>
    `;

    // Destroy existing chart if it exists
    if (todaysWorkoutChart) {
        todaysWorkoutChart.destroy();
        todaysWorkoutChart = null;
    }

    // Create progress ring after DOM is updated
    setTimeout(() => {
        todaysWorkoutChart = createProgressRing('todays-progress-ring', progress.percentage, 70);
    }, 0);
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
    if (descEl) descEl.innerHTML = `<strong><u>Instructions</u></strong>: Go through the below exercises at your own pace. Click to watch the videos to see how each exercise is done. Your progress is saved automatically when you click 'Done' in the exercise modal.`;

    // Initialize session progress for this playlist
    if (!sessionProgress[playlistId]) {
        sessionProgress[playlistId] = {};
    }

    // Update progress ring in playlist view
    updatePlaylistProgressRing();

    loadExerciseTable();
}

// Update progress ring in playlist view
function updatePlaylistProgressRing() {
    if (!currentPlaylist) return;
    
    const progressContainer = document.getElementById('playlist-progress-ring');
    if (!progressContainer) return;

    const progress = calculatePlaylistProgress(currentPlaylist.id, true);
    
    // Update the container HTML with canvas and label
    progressContainer.innerHTML = `
        <canvas id="playlist-view-progress-ring"></canvas>
        <span class="progress-label">${progress.completed}/${progress.total} exercises</span>
    `;

    // Destroy existing chart if it exists
    if (playlistViewChart) {
        playlistViewChart.destroy();
        playlistViewChart = null;
    }

    // Create progress ring after DOM is updated
    setTimeout(() => {
        playlistViewChart = createProgressRing('playlist-view-progress-ring', progress.percentage, 60);
    }, 0);
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

console.log('App module loaded');