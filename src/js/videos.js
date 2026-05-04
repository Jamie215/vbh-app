// Videos module - handles video playback and set/rep tracking

let player;

// Track reps for each set in the current video
let currentVideoProgress = {};

// Snapshot of currentVideoProgress at modal open — used to disable the Done
// button until something actually changes.
let originalVideoProgressSnapshot = null;

// True if a set has a "completion-related" change vs its original state.
//   - Completion status flipped
//   - OR set is currently completed AND reps/seconds differ
function _setHasMeaningfulChange(originalSet, currentSet) {
    const orig = originalSet || {};
    const curr = currentSet || {};
    
    if ((orig.completed ?? false) !== (curr.completed ?? false)) return true;
    
    if (curr.completed) {
        if ((orig.reps ?? 0) !== (curr.reps ?? 0)) return true;
        if ((orig.seconds ?? 0) !== (curr.seconds ?? 0)) return true;
    }
    
    return false;
}

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
                seconds: currentVideo.seconds,
                completed: false
            };
        }
    }

    originalVideoProgressSnapshot = JSON.stringify(currentVideoProgress);
}

// Open video player modal
function openVideoPlayer() {
    const modal = document.getElementById('video-player-modal');
    const titleEl = document.getElementById('current-video-title');
    const descEl = document.getElementById('current-video-description');
    const isTimeBased = currentVideo.reps === 0 && currentVideo.seconds > 0;
    
    if (titleEl) titleEl.textContent = currentVideo.title;
    if (descEl) descEl.textContent = `Recommended: ${currentVideo.sets} sets of ${isTimeBased ? `${currentVideo.seconds} seconds` : `${currentVideo.reps} reps`}`;
    
    // Render the set tracking panel
    renderSetTrackingPanel();
    
    modal.classList.remove('hidden');
    
    // Create or update YouTube player
    if (player) {
        player.cueVideoById(currentVideo.id);
    } else {
        player = new YT.Player('player', {
            height: '100%',
            width: '100%',
            videoId: currentVideo.id,
            playerVars: {
                'autoplay': 0,
                'playsinline': 1,
                'rel': 0,
            }
        });
    }
}

// Render the set tracking panel in the modal
function renderSetTrackingPanel() {
    const panel = document.getElementById('set-tracking-panel');
    if (!panel) return;
    
    let setsHTML = '';
    const isTimeBased = currentVideo.reps === 0 && currentVideo.seconds > 0;
    
    for (let i = 1; i <= currentVideo.sets; i++) {
        const setData = currentVideoProgress[`set${i}`] || { reps: currentVideo.reps, seconds: currentVideo.seconds, completed: false };
        setsHTML += `
            <div class="flex items-center gap-3">
                <span class="w-[45px] text-base font-medium text-text-tertiary">Set ${i}</span>
                <div class="flex items-center border border-border-light rounded-md overflow-hidden">
                    <button type="button" class="rep-btn" onclick="decrementReps(${i}, ${isTimeBased})">
                        <i class="fa-solid fa-minus"></i>
                    </button>
                    <input type="number" 
                           id="reps_set${i}" 
                           class="rep-input" 
                           value="${isTimeBased ? setData.seconds : setData.reps}" 
                           min="0" 
                           max="${isTimeBased ? 120 : 99}"
                           onchange="updateReps(${i}, ${isTimeBased})">
                    <button type="button" class="rep-btn" onclick="incrementReps(${i}, ${isTimeBased})">
                        <i class="fa-solid fa-plus"></i>
                    </button>
                </div>
                <span class="text-base text-text-secondary -ml-1">${isTimeBased ? 'seconds' : 'reps'}</span>
                <label class="relative flex items-center justify-center cursor-pointer ml-auto">
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

    const allChecked = _allSetsCompleted();
    const labelText = allChecked ? 'Deselect all sets' : 'Check all sets';
    
    panel.innerHTML = `
        <div class="mb-2">
            <h3 class="text-[1.1rem] font-semibold text-text-primary mb-2 leading-tight">How many ${isTimeBased ? 'seconds' : 'reps'} and sets did you do?</h3>
            <p class="text-base text-text-secondary leading-relaxed">Tap the plus or minus to change the number of ${isTimeBased ? 'seconds' : 'reps'} you did. Check the box if you completed the set.</p>
        </div>
        <label class="flex items-center cursor-pointer mb-5 select-none">
            <span id="check_all_sets_label" class="text-base font-medium text-text-tertiary ml-24">${labelText}</span>
            <span class="relative flex items-center justify-center ml-auto">
                <input type="checkbox"
                       class="set-checkbox"
                       id="check_all_sets_master"
                       ${allChecked ? 'checked' : ''}
                       onchange="toggleAllSets()">
                <span class="checkmark-box"><i class="fa-solid fa-check"></i></span>
            </span>
        </label>
        <div class="flex flex-col gap-3 mb-6">
            ${setsHTML}
        </div>
        <button type="button" class="done-btn" id="done-btn" disabled onclick="saveVideoProgress()">Save</button>
    `;
}

function _videoProgressHasChanges() {
    if (originalVideoProgressSnapshot === null) return false;
    
    const original = JSON.parse(originalVideoProgressSnapshot);
    
    for (const setKey of Object.keys(currentVideoProgress)) {
        if (!setKey.startsWith('set')) continue;
        if (_setHasMeaningfulChange(original[setKey], currentVideoProgress[setKey])) {
            return true;
        }
    }
    
    return false;
}

function _updateDoneBtnState() {
    const doneBtn = document.getElementById('done-btn');
    if (!doneBtn) return;

    const hasChanges = _videoProgressHasChanges();
    doneBtn.disabled = !hasChanges;
    doneBtn.title = hasChanges 
        ? '' 
        : 'Check at least one set as completed to save';
}

// Increment reps for a set
function incrementReps(setNumber, isTimeBased) {
    const input = document.getElementById(`reps_set${setNumber}`);
    if (!input) return;
    
    const cap = isTimeBased ? 120 : 99;
    let value = parseInt(input.value) || 0;
    value = Math.min(cap, value + (isTimeBased ? 5 : 1));
    input.value = value;
    
    const field = isTimeBased ? 'seconds' : 'reps';
    currentVideoProgress[`set${setNumber}`] = {
        ...currentVideoProgress[`set${setNumber}`],
        [field]: value
    };
    _updateDoneBtnState();
}

// Decrement reps for a set
function decrementReps(setNumber, isTimeBased) {
    const input = document.getElementById(`reps_set${setNumber}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    value = Math.max(0, value - (isTimeBased ? 5 : 1));
    input.value = value;

    const field = isTimeBased ? 'seconds' : 'reps';
    currentVideoProgress[`set${setNumber}`] = {
        ...currentVideoProgress[`set${setNumber}`],
        [field]: value
    };
    _updateDoneBtnState();
}

// Update reps from input change
function updateReps(setNumber, isTimeBased) {
    const input = document.getElementById(`reps_set${setNumber}`);
    if (!input) return;
    
    const cap = isTimeBased ? 120 : 99;
    let value = parseInt(input.value) || 0;
    value = Math.max(0, Math.min(cap, value));
    input.value = value;

    const field = isTimeBased ? 'seconds' : 'reps';
    currentVideoProgress[`set${setNumber}`] = {
        ...currentVideoProgress[`set${setNumber}`],
        [field]: value
    };
    _updateDoneBtnState();
}

function toggleSetCompleted(setNumber) {
    const checkbox = document.getElementById(`completed_set${setNumber}`);
    if (!checkbox) return;

    currentVideoProgress[`set${setNumber}`] = {
        ...currentVideoProgress[`set${setNumber}`],
        completed: checkbox.checked
    };

    _updateMasterCheckbox();
    _updateDoneBtnState();
}

// True iff every set in the current video is marked completed.
function _allSetsCompleted() {
    if (!currentVideo || !currentVideo.sets) return false;
    for (let i = 1; i <= currentVideo.sets; i++) {
        if (!currentVideoProgress[`set${i}`]?.completed) return false;
    }
    return true;
}

// Sync master checkbox + label text to the current set states.
function _updateMasterCheckbox() {
    const master = document.getElementById('check_all_sets_master');
    const label = document.getElementById('check_all_sets_label');
    if (!master || !label) return;

    const allChecked = _allSetsCompleted();
    master.checked = allChecked;
    label.textContent = allChecked ? 'Deselect all sets' : 'Check all sets';
}

// Master toggles all sets based on its own checked state.
function toggleAllSets() {
    const master = document.getElementById('check_all_sets_master');
    if (!master || !currentVideo) return;

    const shouldCheck = master.checked;

    for (let i = 1; i <= currentVideo.sets; i++) {
        const checkbox = document.getElementById(`completed_set${i}`);
        if (checkbox) checkbox.checked = shouldCheck;
        currentVideoProgress[`set${i}`] = {
            ...currentVideoProgress[`set${i}`],
            completed: shouldCheck
        };
    }

    _updateMasterCheckbox();
    _updateDoneBtnState();
}

// Save video progress to database and close modal
async function saveVideoProgress() {
    const videoId = currentVideo.id;
    const playlistId = currentPlaylist.id;
    
    // Initialize session progress structure if needed
    if (!sessionProgress[playlistId]) {
        sessionProgress[playlistId] = {};
    }
    
    // "Uncheck = removed exercise" — if no sets were marked completed,
    // drop this exercise from progress entirely instead of saving an empty record.
    const hasAnyCompletedSet = Object.keys(currentVideoProgress).some(k =>
        k.startsWith('set') && currentVideoProgress[k]?.completed
    );
    
    if (hasAnyCompletedSet) {
        sessionProgress[playlistId][videoId] = { ...currentVideoProgress };
    } else {
        delete sessionProgress[playlistId][videoId];
    }
    
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
        if (Object.keys(sessionProgress[pId]).length > 0) {
            progressData[pId] = sessionProgress[pId];
        }
    });

    try {
        const isEmpty = Object.keys(progressData).length === 0;

        let dbError;
        if (isEmpty) {
            // Today's last logged exercise was just unchecked away — drop the row
            // rather than leaving an empty progress object behind.
            const { error } = await window.supabaseClient
                .from('workout_sessions')
                .delete()
                .eq('user_id', currentUser.id)
                .eq('session_date', today);
            dbError = error;
        } else {
            const { error } = await window.supabaseClient
                .from('workout_sessions')
                .upsert({
                    user_id: currentUser.id,
                    session_date: today,
                    progress: progressData
                }, {
                    onConflict: 'user_id,session_date'
                });
            dbError = error;
        }

        if (dbError) {
            console.error('Error saving progress:', dbError);
            alert('Error saving progress. Please try again.');
            if (doneBtn) {
                doneBtn.disabled = false;
                doneBtn.innerHTML = 'Save';
            }
            return;
        }

        // Reload data to update UI
        await loadTodaySession();
        await loadCompletionHistory();
        updatePlaylistProgressRing();
        checkAndShowFinalSessionModal();
        loadExerciseTable();

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
            doneBtn.innerHTML = 'Save';
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
        doneBtn.innerHTML = 'Save';
    }
}

console.log('Videos module loaded');