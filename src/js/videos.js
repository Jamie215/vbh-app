// Videos module - handles video playback and set/rep tracking

let player;

// Track reps for each set in the current video
let currentVideoProgress = {};

function onYouTubeIframeAPIReady() {
    console.log('YouTube API Ready');
}

// Play video from table
function playExerciseVideo(videoId) {
    const video = currentPlaylist.videos.find(v => v.id === videoId);
    if (!video) return;

    currentVideo = {
        ...video,
        playlistId: currentPlaylist.id
    };

    // Initialize progress for this video
    initializeVideoProgress();
    
    openVideoPlayer();
}

// Initialize progress tracking for current video
function initializeVideoProgress() {
    const videoId = currentVideo.id;
    const playlistId = currentPlaylist.id;
    
    // Check if we have existing progress from session
    if (sessionProgress[playlistId]?.[videoId]) {
        currentVideoProgress = { ...sessionProgress[playlistId][videoId] };
    } else if (todaySession?.progress?.[playlistId]?.[videoId]) {
        currentVideoProgress = { ...todaySession.progress[playlistId][videoId] };
    } else {
        // Initialize empty progress
        currentVideoProgress = {};
        for (let i = 1; i <= currentVideo.sets; i++) {
            currentVideoProgress[`set${i}`] = {
                reps: currentVideo.reps,
                completed: false
            };
        }
    }
}

// Open video player modal
function openVideoPlayer() {
    const modal = document.getElementById('video-player-modal');
    const titleEl = document.getElementById('current-video-title');
    const descEl = document.getElementById('current-video-description');
    
    if (titleEl) titleEl.textContent = currentVideo.title;
    if (descEl) descEl.textContent = `Recommended: ${currentVideo.sets} sets of ${currentVideo.reps} reps`;
    
    // Render the set tracking panel
    renderSetTrackingPanel();
    
    modal.classList.remove('hidden');
    
    // Create or update YouTube player
    if (player) {
        player.loadVideoById(currentVideo.id);
    } else {
        player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: currentVideo.id,
            playerVars: {
                'playsinline': 1,
                'rel': 0,
                'modestbranding': 1
            }
        });
    }
}

// Render the set tracking panel in the modal
function renderSetTrackingPanel() {
    const panel = document.getElementById('set-tracking-panel');
    if (!panel) return;
    
    let setsHTML = '';
    
    for (let i = 1; i <= currentVideo.sets; i++) {
        const setData = currentVideoProgress[`set${i}`] || { reps: currentVideo.reps, completed: false };
        
        setsHTML += `
            <div class="set-row">
                <span class="set-label">Set ${i}</span>
                <div class="rep-counter">
                    <button type="button" class="rep-btn" onclick="decrementReps(${i})">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                    <input type="number" 
                           id="reps_set${i}" 
                           class="rep-input" 
                           value="${setData.reps}" 
                           min="0" 
                           max="99"
                           onchange="updateReps(${i})">
                    <button type="button" class="rep-btn" onclick="incrementReps(${i})">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
                <span class="reps-label">reps</span>
                <label class="set-checkbox-wrapper">
                    <input type="checkbox" 
                           class="set-checkbox" 
                           id="completed_set${i}"
                           ${setData.completed ? 'checked' : ''}
                           onchange="toggleSetCompleted(${i})">
                    <span class="checkmark-box"><i class="fa-solid fa-check"></i></span>
                </label>
            </div>
        `;
    }
    
    panel.innerHTML = `
        <div class="tracking-header">
            <h3>How many reps and sets did you do?</h3>
            <p>Tap the plus or minus to change the number of reps you did. Check the box if you completed the set.</p>
        </div>
        <div class="sets-list">
            ${setsHTML}
        </div>
        <button type="button" class="done-btn" id="done-btn" onclick="saveVideoProgress()">Done</button>
    `;
}

// Increment reps for a set
function incrementReps(setNumber) {
    const input = document.getElementById(`reps_set${setNumber}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    value++;
    input.value = value;
    
    currentVideoProgress[`set${setNumber}`] = {
        ...currentVideoProgress[`set${setNumber}`],
        reps: value
    };
}

// Decrement reps for a set
function decrementReps(setNumber) {
    const input = document.getElementById(`reps_set${setNumber}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    if (value > 0) {
        value--;
        input.value = value;
        
        currentVideoProgress[`set${setNumber}`] = {
            ...currentVideoProgress[`set${setNumber}`],
            reps: value
        };
    }
}

// Update reps from input change
function updateReps(setNumber) {
    const input = document.getElementById(`reps_set${setNumber}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    value = Math.max(0, Math.min(99, value));
    input.value = value;
    
    currentVideoProgress[`set${setNumber}`] = {
        ...currentVideoProgress[`set${setNumber}`],
        reps: value
    };
}

// Toggle set completion checkbox
function toggleSetCompleted(setNumber) {
    const checkbox = document.getElementById(`completed_set${setNumber}`);
    if (!checkbox) return;
    
    currentVideoProgress[`set${setNumber}`] = {
        ...currentVideoProgress[`set${setNumber}`],
        completed: checkbox.checked
    };
}

// Save video progress to database and close modal
async function saveVideoProgress() {
    const videoId = currentVideo.id;
    const playlistId = currentPlaylist.id;
    
    // Initialize session progress structure if needed
    if (!sessionProgress[playlistId]) {
        sessionProgress[playlistId] = {};
    }
    
    // Save the detailed progress to session
    sessionProgress[playlistId][videoId] = { ...currentVideoProgress };
    
    // Update Done button to show saving state
    const doneBtn = document.getElementById('done-btn');
    if (doneBtn) {
        doneBtn.disabled = true;
        doneBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    // Save to database
    const today = new Date().toISOString().split('T')[0];

    const progressData = {};
    Object.keys(sessionProgress).forEach(pId => {
        progressData[pId] = sessionProgress[pId];
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
            if (doneBtn) {
                doneBtn.disabled = false;
                doneBtn.innerHTML = 'Done';
            }
            return;
        }

        // Reload data to update UI
        await loadTodaySession();
        await loadCompletionHistory();

        // Update progress ring in playlist view
        if (typeof updatePlaylistProgressRing === 'function') {
            updatePlaylistProgressRing();
        }

        // Show success state briefly then close
        if (doneBtn) {
            doneBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
        }

        setTimeout(() => {
            closeVideo();
        }, 500);

    } catch (error) {
        console.error('Exception saving progress:', error);
        alert('Error saving progress. Please try again.');
        if (doneBtn) {
            doneBtn.disabled = false;
            doneBtn.innerHTML = 'Done';
        }
    }
}

// Close video player
function closeVideo() {
    document.getElementById('video-player-modal').classList.add('hidden');
    if (player) {
        player.stopVideo();
    }
    
    // Reset done button state for next time
    const doneBtn = document.getElementById('done-btn');
    if (doneBtn) {
        doneBtn.disabled = false;
        doneBtn.innerHTML = 'Done';
    }
}

console.log('Videos module loaded');
