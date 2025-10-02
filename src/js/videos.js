let player;

// Initialize YouTube player
function onYouTubeIframeAPIReady() {
    console.log('YouTube API Ready');
}

// Load video library
function loadVideoLibrary() {
    const grid = document.getElementById('video-grid');
    grid.innerHTML = '';

    VIDEO_MODULES.forEach(video => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}">
            <h3>${video.title}</h3>
            <p>${video.description}</p>
            <button onclick="playVideo('${video.id}', '${video.title}')">Watch Now</button>
        `;
        grid.appendChild(card);
    });
}

// Play video
function playVideo(videoId, title) {
    document.getElementById('video-library').classList.add('hidden');
    document.getElementById('video-player').classList.remove('hidden');
    
    document.getElementById('video-info').innerHTML = `<h2>${title}</h2>`;

    if (player) {
        player.loadVideoById(videoId);
    } else {
        player = new YT.Player('player', {
            height: '480',
            width: '854',
            videoId: videoId,
            playerVars: {
                'playsinline': 1
            }
        });
    }
}

// Close video player
function closeVideo() {
    document.getElementById('video-player').classList.add('hidden');
    document.getElementById('video-library').classList.remove('hidden');
    if (player) {
        player.stopVideo();
    }
}