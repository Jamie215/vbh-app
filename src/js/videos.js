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
        // Initialize fresh progress - each set tracks reps done and completion
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
    document.getElementById('video-player-modal').classList.remove('hidden');
    document.getElementById('current-video-title').textContent = currentVideo.title;
    document.getElementById('current-video-description').textContent = 
        `Recommended: ${currentVideo.sets} sets of ${currentVideo.reps} reps`;

    // Render the set tracking panel
    renderSetTrackingPanel();

    // Load video
    if (player) {
        player.loadVideoById(currentVideo.id);
    } else {
        player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: currentVideo.id,
            playerVars: {
                'playsinline': 1,
                'modestbranding': 1,
                'rel': 0
            }
        });
    }
}

// Render the set tracking panel on the right side
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
                    <button type="button" class="rep-btn minus" onclick="decrementReps(${i})">−</button>
                    <input type="number" 
                           id="reps_set${i}" 
                           class="rep-input" 
                           value="${setData.reps}" 
                           min="0" 
                           max="99"
                           onchange="updateReps(${i})">
                    <button type="button" class="rep-btn plus" onclick="incrementReps(${i})">+</button>
                </div>
                <span class="reps-label">reps</span>
                <label class="set-checkbox-wrapper">
                    <input type="checkbox" 
                           id="completed_set${i}" 
                           class="set-checkbox" 
                           ${setData.completed ? 'checked' : ''}
                           onchange="toggleSetCompleted(${i})">
                    <span class="checkmark-box"></span>
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
        <button type="button" class="done-btn" onclick="saveVideoProgress()">Done</button>
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

// Save video progress and close modal
function saveVideoProgress() {
    const videoId = currentVideo.id;
    const playlistId = currentPlaylist.id;
    
    // Initialize session progress structure if needed
    if (!sessionProgress[playlistId]) {
        sessionProgress[playlistId] = {};
    }
    
    // Save the detailed progress
    sessionProgress[playlistId][videoId] = { ...currentVideoProgress };
    
    // Also calculate and store completed sets count for backward compatibility
    let completedSets = 0;
    for (let i = 1; i <= currentVideo.sets; i++) {
        if (currentVideoProgress[`set${i}`]?.completed) {
            completedSets++;
        }
    }
    
    // Close the modal
    closeVideo();
}

// Close video player
function closeVideo() {
    document.getElementById('video-player-modal').classList.add('hidden');
    if (player) {
        player.stopVideo();
    }
}