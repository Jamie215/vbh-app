// Track current user and state
let currentUser = null;
let currentPlaylist = null;
let currentVideo = null;
let userProgress = {};
let todayProgress = {};


// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await updateUIForAuthenticatedUser(session.user);
        await loadTodayProgress();
    } else {
        updateUIForGuestUser();
    }

    showHome();
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

    // Show finish workou button only if logged in
    const finishBtn = document.getElementById('finish-workout-btn');
    if (currentUser) {
        finishBtn.classList.remove('hidden');
        updateFinishButtonState();
    } else {
        finishBtn.classList.add('hidden');
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
        equipmentCell.innerHTML = `<span class="sets-reps-text">${video.sets} sets of ${video.reps} reps</span>`;
        if (video.equipment) {
            equipmentCell.innerHTML = `<span class="equipment-badge">${video.equipment}</span>`;
        } else {
            equipmentCell.innerHTML = `<span class="no-equipment">—</span>`;
        }
        row.appendChild(equipmentCell);

        const completionCell = document.createElement('td');
        if (currentUser) {
            const progressKey = `${currentPlaylist.id}_${video.id}`;
            const completedSets = todayProgress[progressKey]?.completed_sets || [];

            let checkboxesHTML = '<div class="sets-checkboxes">';
            for (let i=1; i <= video.sets; i++) {
                const isChecked = completedSets.includes(i);
                checkboxesHTML += `
                    <div class="set-checkbox-item">
                        <input type="checkbox"
                                id="set_${video.id}+${i}"
                                ${isChecked ? 'checked': ''}
                                onchange="toggleSet('${video.id}', ${i})">
                        <label for="set_${video.id}_${i}">Set ${i}</label>
                    </div>
                `;
            }
            checkboxesHTML += '</div>';
            completionCell.innerHTML = checkboxesHTML;
        } else {
            completionCell.innerHTML = `
                <div class="login-prompt">
                        <a href="#" onclick="showAuthModal(); return false;">Sign in</a> to track sets
                </div>
            `;
        }
        row.appendChild(completionCell);

        tbody.appendChild(row);
    });
}

// Load today's progress
async function loadTodayProgress() {
    if (!currentUser) return;

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('exercise_progress')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('session_date', today);
    
    if (error) {
        console.error('Error loading progress: ', error);
        return;
    }

    todayProgress = {};
    data.forEach(progress => {
        const key = `${progress.playlist_id}_${progress.video_id}`;
        todayProgress[key] = progress;
    });
}

// Toggle set completion
async function toggleSet(videoId, setNumber) {
    if (!currentUser) {
        showAuthModal();
        return;
    }

    const progressKey = `${currentPlaylist.id}_${videoId}`;
    let completedSets = todayProgress[progressKey]?.completed_sets || [];

    if (completedSets.includes(setNumber)) {
        completedSets = completedSets.filter(s => s!== setNumber);
    } else {
        completedSets.push(setNumber);
        completedSets.sort((a, b) => a - b)
    }

    // Save to database
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('exercise_progress')
        .upsert({
            user_id: currentUser.id,
            playlist_id: currentPlaylist.id,
            video_id: videoId,
            session_date: today,
            completed_sets: completedSets,
            is_workout_complete: false
        }, {
            onConflict: 'user_id,playlist_id,video_id,session_date'
        })
        .select()
        .single();
    if (error) {
        console.error('Error saving progress:', error);
        alert('Error saving progress. Please try again.');
        // Revert checkbox
        const checkbox = document.getElementById(`set_${videoId}_${setNumber}`);
        checkbox.checked = !checkbox.checked;
        return;
    }

    todayProgress[progressKey] = data;

    updateFinishButtonState(); 
}

// Update finish workout button state
function updateFinishButtonState() {
    const finishBtn = document.getElementById('finish-workout-btn');
    
    // Check if all sets are completed
    const allSetsComplete = currentPlaylist.videos.every(video => {
        const progressKey = `${currentPlaylist.id}_${video.id}`;
        const completedSets = todayProgress[progressKey]?.completed_sets || [];
        return completedSets.length === video.sets;
    });

    if (allSetsComplete) {
        finishBtn.disabled = false;
        finishBtn.textContent = 'Finish Workout';
    } else {
        finishBtn.disabled = true;
        finishBtn.textContent = 'Complete All Sets First';
    }
}

// Finish workout
async function finishWorkout() {
    if (!currentUser) {
        showAuthModal();
        return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Mark all exercises as workout complete
    const updates = currentPlaylist.videos.map(video => {
        const progressKey = `${currentPlaylist.id}_${video.id}`;
        const completedSets = todayProgress[progressKey]?.completed_sets || [];
        
        return {
            user_id: currentUser.id,
            playlist_id: currentPlaylist.id,
            video_id: video.id,
            session_date: today,
            completed_sets: completedSets,
            is_workout_complete: true
        };
    });

    const { error } = await supabase
        .from('exercise_progress')
        .upsert(updates, {
            onConflict: 'user_id,playlist_id,video_id,session_date'
        });

    if (error) {
        console.error('Error finishing workout:', error);
        alert('Error saving workout completion. Please try again.');
        return;
    }

    // Reload progress
    await loadTodayProgress();

    alert('🎉 Congratulations! Workout completed!');
    
    // Optionally go back to home
    // showHome();
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

// Load user progress from Supabase
async function loadUserProgress() {
    if (!currentUser) return;

    // We'll implement this after creating the progress table
    // For now, just use memory
    userProgress = {};
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