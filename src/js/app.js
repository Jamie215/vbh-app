// Track current user and state
let currentUser = null;
let currentPlaylist = null;
let currentVideo = null;
let userProgress = {};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        currentUser = session.user;
        await updateUIForAuthenticatedUser(session.user);
        await loadUserProgress();
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
                <span class="video-count">${playlist.videos.length} videos</span>
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
    document.getElementById('video-count').textContent = `${currentPlaylist.videos.length} videos`;

    // Show progress if logged in
    if (currentUser) {
        const completed = currentPlaylist.videos.filter(v => 
            userProgress[`${playlistId}_${v.id}`]?.completed
        ).length;
        const progressEl = document.getElementById('playlist-progress');
        progressEl.classList.remove('hidden');
        progressEl.textContent = `Progress: ${completed}/${currentPlaylist.videos.length} completed`;
    }

    // Load video table
    loadVideoTable();
}

// Load video table
function loadVideoTable() {
    const tbody = document.getElementById('video-table-body');
    tbody.innerHTML = '';

    currentPlaylist.videos.forEach((video, index) => {
        const progressKey = `${currentPlaylist.id}_${video.id}`;
        const progress = userProgress[progressKey];
        
        let statusBadge = '<span class="status-badge status-not-started">Not Started</span>';
        if (progress?.completed) {
            statusBadge = '<span class="status-badge status-completed">✓ Completed</span>';
        } else if (progress?.started) {
            statusBadge = '<span class="status-badge status-in-progress">In Progress</span>';
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="col-order">${video.order}</td>
            <td class="col-title">
                <div class="video-title">${video.title}</div>
            </td>
            <td class="col-description">
                <div class="video-description">${video.description}</div>
            </td>
            <td class="col-duration">${video.duration}</td>
            <td class="col-status">${currentUser ? statusBadge : '-'}</td>
            <td class="col-action">
                <button class="btn-watch" onclick="playVideoFromTable('${video.id}')">
                    ▶ Watch
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
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