let player;

// Initialize YouTube player
function onYouTubeIframeAPIReady() {
    console.log('YouTube API Ready');
}

// Load video library
function loadVideoLibrary() {
    const grid = document.getElementById('video-grid');
    grid.innerHTML = '';

    if (VIDEO_MODULES.length === 0) {
        grid.innerHTML = '<p>No videos available yet. Check back soon!</p>';
        return;
    }

    VIDEO_MODULES.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}">
            <div class="video-card-content">
                <h3>${video.title}</h3>
                <p>${video.description}</p>
                <button onclick="handleVideoClick('${video.id}', '${video.title}')">Watch Now</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

// Handle video click - check if user is authenticated
function handleVideoClick(videoId, title) {
    if (currentUser) {
        playVideo(videoId, title);
    } else {
        // Show auth modal if not logged in
        showAuthModal();
        // Optionally store the video they wanted to watch
        sessionStorage.setItem('pendingVideo', JSON.stringify({id: videoId, title: title}));
    }
}

// Play video (only if authenticated)
function playVideo(videoId, title) {
    document.getElementById('video-player-modal').classList.remove('hidden');
    
    document.getElementById('video-info').innerHTML = `<h2>${title}</h2>`;

    if (player) {
        player.loadVideoById(videoId);
    } else {
        player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: videoId,
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

// Check for pending video after sign in
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
        const pendingVideo = sessionStorage.getItem('pendingVideo');
        if (pendingVideo) {
            const video = JSON.parse(pendingVideo);
            sessionStorage.removeItem('pendingVideo');
            // Small delay to let modal close
            setTimeout(() => {
                playVideo(video.id, video.title);
            }, 300);
        }
    }
});