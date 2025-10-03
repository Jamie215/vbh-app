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

    openVideoPlayer();
}

// Open video player modal
function openVideoPlayer() {
    document.getElementById('video-player-modal').classList.remove('hidden');
    
    document.getElementById('current-video-title').textContent = currentVideo.title;
    document.getElementById('current-video-description').textContent = 
        `${currentVideo.sets} sets of ${currentVideo.reps} reps${currentVideo.equipment ? ' • ' + currentVideo.equipment : ''}`;

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
}