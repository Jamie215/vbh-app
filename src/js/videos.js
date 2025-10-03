let player;

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

    // Mark as started if logged in
    if (currentUser) {
        markVideoStarted();
    }

    openVideoPlayer();
}

// Open video player modal
function openVideoPlayer() {
    document.getElementById('video-player-modal').classList.remove('hidden');
    
    document.getElementById('current-video-title').textContent = currentVideo.title;
    document.getElementById('current-video-description').textContent = 
        `${currentVideo.sets} sets of ${currentVideo.reps} reps${currentVideo.equipment ? ' • ' + currentVideo.equipment : ''}`;

    // Show/hide progress tracker
    const progressTracker = document.getElementById('progress-tracker');
    
    if (currentUser) {
        progressTracker.classList.remove('hidden');
        updateCompletionButton();
    } else {
        progressTracker.classList.add('hidden');
    }

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

// Close video player
function closeVideo() {
    document.getElementById('video-player-modal').classList.add('hidden');
    if (player) {
        player.stopVideo();
    }
    
    // Refresh the table if we're on a playlist view
    if (currentPlaylist) {
        loadExerciseTable();
    }
}

// Mark video as started
async function markVideoStarted() {
    const progressKey = `${currentVideo.playlistId}_${currentVideo.id}`;
    
    if (!userProgress[progressKey]) {
        userProgress[progressKey] = {
            started: true,
            completed: false,
            startedAt: new Date().toISOString()
        };
        
        // TODO: Save to Supabase when we create the progress table
        console.log('Video started:', progressKey);
    }
}

// Mark video as complete
async function markVideoComplete() {
    if (!currentUser) {
        alert('Please sign in to track your progress');
        showAuthModal();
        return;
    }

    const progressKey = `${currentVideo.playlistId}_${currentVideo.id}`;
    
    userProgress[progressKey] = {
        started: true,
        completed: true,
        completedAt: new Date().toISOString()
    };

    // TODO: Save to Supabase
    console.log('Video completed:', progressKey);

    // Update UI
    updateCompletionButton();
    
    // Show success message
    const statusEl = document.getElementById('completion-status');
    statusEl.textContent = '✓ Marked as complete!';
    
    setTimeout(() => {
        statusEl.textContent = '';
    }, 3000);
}

// Update completion button state
function updateCompletionButton() {
    const progressKey = `${currentVideo.playlistId}_${currentVideo.id}`;
    const progress = userProgress[progressKey];
    const btn = document.getElementById('mark-complete-btn');
    
    if (progress?.completed) {
        btn.textContent = '✓ Completed';
        btn.classList.add('completed');
        btn.disabled = true;
    } else {
        btn.textContent = '✓ Mark as Complete';
        btn.classList.remove('completed');
        btn.disabled = false;
    }
}