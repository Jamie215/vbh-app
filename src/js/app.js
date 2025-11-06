// Track current user and state
let currentUser = null;
let currentPlaylist = null;
let currentVideo = null;
let todaySession = null;
let sessionCheckboxes = {};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
            
        if (session) {
            currentUser = session.user;
            await updateUIForAuthenticatedUser(session.user);
            await loadTodaySession();
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
    loadPlaylists();
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
        document.getElementById('recent-activity-section').classList.add('hidden');
        return;
    }

    // Load recent activity
    loadRecentActivity();

    PLAYLISTS.forEach(playlist => {
        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.onclick = () => showPlaylist(playlist.id);
        
        card.innerHTML = `
            <img src="${playlist.thumbnail}" alt="${playlist.title}">
            <div class="playlist-card-content">
                <h3>${playlist.title}</h3>
                <p>${playlist.description}</p>
                <span class="video-count">${playlist.videos.length} exercises</span>
            </div>
        `;
        grid.appendChild(card);
    });
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
    if (!sessionCheckboxes[playlistId]) {
        sessionCheckboxes[playlistId] = {};
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
        if (video.equipment) {
            equipmentCell.innerHTML = `<span class="equipment-badge">${video.equipment}</span>`;
        } else {
            equipmentCell.innerHTML = `<span class="no-equipment">—</span>`;
        }
        row.appendChild(equipmentCell);

        const completionCell = document.createElement('td');
        const progressKey = `${currentPlaylist.id}_${video.id}`;
        
        // Get checked sets from saved progress
        let checkedSets = [];
        if (todaySession?.progress?.[currentPlaylist.id]?.[video.id]) {
            checkedSets = todaySession.progress[currentPlaylist.id][video.id] || [];
        } else if (sessionCheckboxes[currentPlaylist.id]?.[video.id]) {
            checkedSets = sessionCheckboxes[currentPlaylist.id][video.id] || [];
        }

        let checkboxesHTML = '<div class="sets-checkboxes">';
        for (let i = 1; i <= video.sets; i++) {
            const isChecked = checkedSets.includes(i);
            checkboxesHTML += `
                <div class="set-checkbox-item">
                    <input type="checkbox"
                            id="set_${video.id}_${i}"
                            ${isChecked ? 'checked' : ''}
                            onchange="toggleSetCheckbox('${video.id}', ${i})">
                    <label for="set_${video.id}_${i}">Set ${i}</label>
                </div>
            `;
        }
        checkboxesHTML += '</div>';
        completionCell.innerHTML = checkboxesHTML;
        row.appendChild(completionCell);

        tbody.appendChild(row);
    });
}

// Toggle set checkbox
async function toggleSetCheckbox(videoId, setNumber) {
    if (!sessionCheckboxes[currentPlaylist.id]) {
        sessionCheckboxes[currentPlaylist.id] = {};
    }
    if (!sessionCheckboxes[currentPlaylist.id][videoId]) {
        sessionCheckboxes[currentPlaylist.id][videoId] = [];
    }

    let checkedSets = sessionCheckboxes[currentPlaylist.id][videoId];

    // Toggle the set in memory
    if (checkedSets.includes(setNumber)) {
        sessionCheckboxes[currentPlaylist.id][videoId] = checkedSets.filter(s => s !== setNumber);
    } else {
        checkedSets.push(setNumber);
        checkedSets.sort((a, b) => a - b);
        sessionCheckboxes[currentPlaylist.id][videoId] = checkedSets;
    }
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
                if (!sessionCheckboxes[playlistId]) {
                    sessionCheckboxes[playlistId] = {};
                }
                Object.keys(data.progress[playlistId]).forEach(videoId => {
                    sessionCheckboxes[playlistId][videoId] = data.progress[playlistId][videoId] || [];
                });
            });
        }
    } catch (error) {
        console.error('Exception in loadTodaySession:', error);
    }   
}

// Load most recent workout session
async function loadRecentActivity() {
    if (!currentUser) {
        document.getElementById('recent-activity-section').classList.add('hidden');
        return;
    }

    try {
        const today = new Date().toISOString().split('T')[0];

        // Get today's session if available
        const { data: todayData, error: todayError } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('session_date', today)
            .maybeSingle()

        if (todayError) {
            console.error('Error loading recent activity: ', todayError);
            return;
        }

        // Get most recent previous session before today
        const { data: lastData, error: lastError } = await supabase
            .from('workout_sessions')
            .select('*')
            .eq('user_id', currentUser.id)
            .lt('session_date', today)
            .order('session_date', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (lastError) {
            console.error('Error loading last session: ', lastError);
        }

        const sessions = [];
        if (todayData?.progress && Object.keys(todayData.progress).length > 0) {
            sessions.push(todayData);
        }
        if (lastData?.progress && Object.keys(lastData.progress).length > 0) {
            sessions.push(lastData);
        }

        if (sessions.length === 0) {
            document.getElementById('recent-activity-section').classList.add('hidden');
            return;
        }

        displayRecentActivity(sessions);
    } catch (error) {
        console.error('Error loading recent activity: ', error);
        document.getElementById('recent-activity-section').classList.add('hidden');
        return;
    }
}

function displayRecentActivity(sessions) {
    const recentActivityCard = document.getElementById('recent-activity-card');
    const recentActivitySection = document.getElementById('recent-activity-section');

    if (!sessions || sessions.length === 0) {
        recentActivitySection.classList.add('hidden');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    let allSectionsHTML = '';

    // Process each session
    sessions.forEach(session => {
        const isToday = session.session_date === today;

        // Format the date for display
        let formattedDate;
        if(isToday) {
            formattedDate = new Date().toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        } else {
            const sessionDate = new Date(session.session_date + 'T00:00:00');
            formattedDate = sessionDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
            });
        }

        // Build cards for all playlist in this session
        let sessionCardsHTML = '';
        const playlistIds = Object.keys(session.progress);

        playlistIds.forEach(playlistId => {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist) return;

            const playlistProgress = session.progress[playlistId];
            // Pass the formatted date to the card builder
            sessionCardsHTML += buildPlaylistCard(playlist, playlistProgress, formattedDate);
        });

        // Add this session group
        if (sessionCardsHTML) {
            allSectionsHTML += `
                <div class="session-group">
                    <div class="session-playlists-grid">
                        ${sessionCardsHTML}
                    </div>
                </div>
            `;
        }
    });

    recentActivityCard.innerHTML = allSectionsHTML;
    recentActivitySection.classList.remove('hidden');
}

// Helper function to build a playlist card
function buildPlaylistCard(playlist, progress, formattedDate) {
    // Calculate completion stats
    let completedExercises = 0;
    const totalExercises = playlist.videos.length;
    
    // Check each video - count as completed if user has logged ANY sets
    playlist.videos.forEach(video => {
        const completedSets = progress[video.id] || [];
        // Exercise is completed if at least one set is logged
        if (completedSets.length > 0) {
            completedExercises++;
        }
    });

    // Create completion message based on whether it's today
    const completionMessage = isToday 
        ? `Completed today, ${formattedDate}`
        : `Completed ${formattedDate}`;
        
    // Create card with same styling as library playlists
    return `
        <div class="playlist-card" onclick="showPlaylist('${playlist.id}')">
            <img src="${playlist.thumbnail}" alt="${playlist.title}">
            <div class="playlist-card-content">
                <h3>${playlist.title}</h3>
                <p>${playlist.description}</p>
                <div class="recent-activity-stats">
                    <span class="video-count">✓ ${completedExercises}/${totalExercises} exercises</span>
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

    // Build progress object from sessionCheckboxes
    const progressData = {};
    Object.keys(sessionCheckboxes).forEach(playlistId => {
        progressData[playlistId] = sessionCheckboxes[playlistId];
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

    // Reload progress to sync
    await loadTodaySession();

    // Update recent activity on home page
    await loadRecentActivity();

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