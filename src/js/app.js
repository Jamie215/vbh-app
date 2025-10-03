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
    currentPlaylist = PLAYLISTS.find(p => p.id === playlistId);
    
    if (!currentPlaylist) return;

    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('playlist-view').classList.remove('hidden');

    // Update playlist header
    document.getElementById('playlist-title').textContent = currentPlaylist.title;
    document.getElementById('playlist-description').textContent = currentPlaylist.description;

    // Show appropriate save section based on login status
    const saveBtn = document.getElementById('save-progress-btn');
    const guestNotice = document.getElementById('guest-save-notice');

    if (currentUser) {
        saveBtn.classList.remove('hidden');
        guestNotice.classList.add('hidden');
    } else {
        saveBtn.classList.add('hidden');
        guestNotice.classList.remove('hidden');
    }

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
        
        // Get checked sets from either saved progress or session memory
        let checkedSets = [];
        if (currentUser && todaySession?.progress?.[currentPlaylist.id]?.[video.id]) {
            // Logged in user with saved progress
            checkedSets = todaySession.progress[currentPlaylist.id][video.id] || [];
        } else if (sessionCheckboxes[currentPlaylist.id]?.[video.id]) {
            // Guest or logged-in user's session state
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

// Load today's progress from database (logged in users only)
async function loadTodaySession() {
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('session_date', today)
        .maybeSingle();
    
    if (error) {
        console.error('Error loading session:', error);
        return;
    }

    todaySession = data;

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
}

// Save progress to database (logged in users only)
async function saveProgress() {
    if (!currentUser) {
        showAuthModal();
        return;
    }

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