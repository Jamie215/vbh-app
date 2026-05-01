// Manual Entry module - allows users to log past workouts they forgot to record

// State for manual entry
let manualEntryProgress = {};
let manualEntryPlaylist = null;
let activePreviewVideoId = null; // Track which exercise has an active video preview
let originalManualEntryProgressSnapshot = null; // Snapshot of progress at modal open to detect changes

// ==================== Open / Close Modal ====================
function openManualEntryModal(prefillDate = null) {
    const modal = document.getElementById('manual-entry-modal');
    if (!modal) return;

    // Reset state
    manualEntryProgress = {};
    manualEntryPlaylist = null;
    originalManualEntryProgressSnapshot = null;

    // Set date constraints
    const dateInput = document.getElementById('manual-entry-date');
    if (dateInput) {
        const today = new Date();
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() - 1); // Yesterday at most

        dateInput.value = prefillDate ||'';
        dateInput.max = maxDate.toISOString().split('T')[0];

        // Floor to the user's account creation date
        if (currentUser?.created_at) {
            dateInput.min = currentUser.created_at.split('T')[0];
        }
    }

    // Reset playlist selector
    const playlistSelect = document.getElementById('manual-entry-playlist');
    if (playlistSelect) {
        playlistSelect.value = '';
        playlistSelect.disabled = true;
    }

    // Clear exercise area
    const exerciseArea = document.getElementById('manual-entry-exercises');
    if (exerciseArea) {
        exerciseArea.innerHTML = `
            <div class="text-center py-12 px-4 text-text-muted">
                <p class="text-base">Select a date then workout to log your exercises</p>
            </div>
        `;
    }

    // Reset save button
    const saveBtn = document.getElementById('manual-entry-save-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Workout';
    }

    // Hide conflict warning
    const conflictWarning = document.getElementById('manual-entry-conflict');
    if (conflictWarning) conflictWarning.classList.add('hidden');

    modal.classList.remove('hidden');
    requestAnimationFrame(() => modal.classList.add('visible'));

    if (prefillDate) {
        onManualEntryDateChange();
    }
}

function closeManualEntryModal() {
    const modal = document.getElementById('manual-entry-modal');
    if (!modal) return;

    // Clean up any active video preview
    if (activePreviewVideoId) {
        closeVideoPreview();
    }

    modal.classList.remove('visible');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 500);
}

// ==================== Date & Playlist Change Handlers ====================
async function onManualEntryDateChange() {
    const dateInput = document.getElementById('manual-entry-date');
    const playlistSelect = document.getElementById('manual-entry-playlist');
    
    if (!dateInput || !dateInput.value) return;

    if (playlistSelect && !playlistSelect.value) {
        playlistSelect.disabled = false;

        // Prefer the playlist that already has data for this date.
        // Fall back to the user's current-week heuristic for fresh dates.
        const existingDay = completionHistory?.[dateInput.value];
        if (existingDay?.['advanced-4-6']) {
            playlistSelect.value = 'advanced-4-6';
        } else if (existingDay?.['beginner-0-3']) {
            playlistSelect.value = 'beginner-0-3';
        } else {
            playlistSelect.value = calculateUserWeek() >= 4 ? 'advanced-4-6' : 'beginner-0-3';
        }
        onManualEntryPlaylistChange();
    }

    renderManualEntryConflictWarning();
    updateManualEntrySaveState();
}

function onManualEntryPlaylistChange() {
    const playlistSelect = document.getElementById('manual-entry-playlist');
    const dateInput = document.getElementById('manual-entry-date');
    if (!playlistSelect || !playlistSelect.value) return;

    const playlistId = playlistSelect.value;
    manualEntryPlaylist = PLAYLISTS.find(p => p.id === playlistId);
    
    if (!manualEntryPlaylist) return;

    // Initialize progress for all exercises
    manualEntryProgress = {};
    manualEntryPlaylist.videos.forEach(video => {
        manualEntryProgress[video.id] = {};
        for (let i = 1; i <= video.sets; i++) {
            manualEntryProgress[video.id][`set${i}`] = {
                reps: video.reps,
                seconds: video.seconds,
                completed: false
            };
        }
    });

    // Load existing data if the date has prior progress for this playlist
    const selectedDate = dateInput?.value;
    if (selectedDate && completionHistory?.[selectedDate]?.[playlistId]) {
        const existingProgress = completionHistory[selectedDate][playlistId];
        Object.keys(existingProgress).forEach(videoId => {
            if (manualEntryProgress[videoId]) {
                manualEntryProgress[videoId] = { ...existingProgress[videoId] };
            }
        });
    }

    originalManualEntryProgressSnapshot = JSON.stringify(manualEntryProgress);

    renderManualEntryExercises();
    renderManualEntryConflictWarning();
    updateManualEntrySaveState();
}

// ==================== Render Exercise Entry Form ====================
function renderManualEntryExercises() {
    const container = document.getElementById('manual-entry-exercises');
    if (!container || !manualEntryPlaylist) return;

    let html = '';

    manualEntryPlaylist.videos.forEach((video, index) => {
        const videoProgress = manualEntryProgress[video.id] || {};
        
        let setsHTML = '';
        const isTimeBased = video.reps === 0 && video.seconds > 0;

        for (let i = 1; i <= video.sets; i++) {
            const setData = videoProgress[`set${i}`] || { reps: video.reps, seconds: video.seconds, completed: false };
            
            setsHTML += `
                <div class="flex items-center gap-3">
                    <span class="w-10 text-base font-medium text-text-tertiary max-md: text-sm">Set ${i}</span>
                    <div class="flex items-center border border-border-light rounded-md overflow-hidden">
                        <button type="button" class="rep-btn" onclick="manualDecrementReps('${video.id}', ${i}, ${isTimeBased})">
                            <i class="fa-solid fa-minus"></i>
                        </button>
                        <input type="number" 
                               id="manual_reps_${video.id}_set${i}" 
                               class="rep-input" 
                               value="${isTimeBased ? setData.seconds : setData.reps}" 
                               min="0" 
                               max="${isTimeBased ? '120' : '99'}"
                               onchange="manualUpdateReps('${video.id}', ${i}, ${isTimeBased})">
                        <button type="button" class="rep-btn" onclick="manualIncrementReps('${video.id}', ${i}, ${isTimeBased})">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    <span class="text-base text-text-secondary -ml-1">${isTimeBased ? 'seconds' : 'reps'}</span>
                    <label class="relative flex items-center justify-center cursor-pointer ml-auto">
                        <input type="checkbox" 
                               class="set-checkbox" 
                               id="manual_completed_${video.id}_set${i}"
                               ${setData.completed ? 'checked' : ''}
                               onchange="manualToggleSet('${video.id}', ${i})">
                        <span class="checkmark-box"><i class="fa-solid fa-check"></i></span>
                    </label>
                </div>
            `;
        }

        // Check all sets button for this exercise
        const checkAllBtnHTML = `
            <button class="check-all-btn" onclick="manualCheckAllExerciseSets('${video.id}', ${video.sets})" title="Mark all sets complete">
                <i class="fa-solid fa-check-double"></i> Check All Sets
            </button>`;

        html += `
            <div class="bg-subtle border border-border-light rounded-[10px] p-4 px-5 mb-3">
                <div class="mb-3">
                    <div class="flex items-start gap-3 max-md:flex-col">
                        <span class="w-7 h-7 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white text-base font-bold flex items-center justify-center shrink-0 mt-0.5 max-md:mt-0">${index + 1}</span>
                        <div class="manual-exercise-thumb-wrapper" id="manual-preview-${video.id}" onclick="toggleVideoPreview('${video.id}')">
                            <img src="${video.thumbnail}" alt="${video.title}" class="w-full h-full object-cover block">
                            <span class="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors hover:bg-black/50"><i class="fa-solid fa-play text-white text-base"></i></span>
                        </div>
                        <div>
                            <h4 class="text-base font-semibold text-text-primary mb-0.5">${video.title}</h4>
                            <p class="text-base text-text-secondary">Recommended: ${video.sets} sets of ${isTimeBased ? video.seconds : video.reps} ${isTimeBased ? 'seconds' : 'reps'} ${video.needsEachSide ? ' (each side)' : ''}</p>
                            ${checkAllBtnHTML}
                        </div>
                    </div>
                </div>
                <div class="flex flex-col gap-2 pl-10 max-md:pl-0">
                    ${setsHTML}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ==================== Tap-to-Preview Video ====================
function toggleVideoPreview(videoId) {
    const wrapper = document.getElementById(`manual-preview-${videoId}`);
    if (!wrapper) return;

    // If this video is already active, close it
    if (activePreviewVideoId === videoId) {
        closeVideoPreview();
        return;
    }

    // Close any existing preview first
    if (activePreviewVideoId) {
        closeVideoPreview();
    }

    // Find the video data for the thumbnail fallback
    const video = manualEntryPlaylist?.videos.find(v => v.id === videoId);
    if (!video) return;

    activePreviewVideoId = videoId;

    // Swap thumbnail for muted, looping YouTube embed
    wrapper.onclick = null; // Remove click handler while embed is active
    wrapper.classList.add('preview-active');
    wrapper.innerHTML = `
        <div class="relative w-full h-full">
            <iframe 
                src="https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&rel=0&playsinline=1"
                frameborder="0"
                allow="autoplay"
                class="w-full h-full block rounded-md">
            </iframe>
            <button type="button" class="absolute top-1 right-1 w-[22px] h-[22px] rounded-full bg-black/60 text-white border-none text-base flex items-center justify-center cursor-pointer transition-colors z-[1] hover:bg-black/85" onclick="event.stopPropagation(); closeVideoPreview();" title="Close preview">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;
}

function closeVideoPreview() {
    if (!activePreviewVideoId) return;

    const wrapper = document.getElementById(`manual-preview-${activePreviewVideoId}`);
    const video = manualEntryPlaylist?.videos.find(v => v.id === activePreviewVideoId);
    const videoId = activePreviewVideoId;

    activePreviewVideoId = null;

    if (wrapper && video) {
        wrapper.classList.remove('preview-active');
        wrapper.innerHTML = `
            <img src="${video.thumbnail}" alt="${video.title}" class="w-full h-full object-cover block">
            <span class="absolute inset-0 flex items-center justify-center bg-black/35 transition-colors hover:bg-black/50"><i class="fa-solid fa-play text-white text-base"></i></span>
        `;
        wrapper.onclick = () => toggleVideoPreview(videoId);
    }
}

// ==================== Rep/Set Controls ====================
function manualIncrementReps(videoId, setNumber, isTimeBased) {
    const input = document.getElementById(`manual_reps_${videoId}_set${setNumber}`);
    if (!input) return;
    
    const cap = isTimeBased ? 120 : 99;
    let value = parseInt(input.value) || 0;
    value = Math.min(cap, value + (isTimeBased ? 5 : 1));
    input.value = value;
    
    if (!manualEntryProgress[videoId]) manualEntryProgress[videoId] = {};
    const field = isTimeBased ? 'seconds' : 'reps';
    manualEntryProgress[videoId][`set${setNumber}`] = {
        ...manualEntryProgress[videoId][`set${setNumber}`],
        [field]: value
    };
}

function manualDecrementReps(videoId, setNumber, isTimeBased) {
    const input = document.getElementById(`manual_reps_${videoId}_set${setNumber}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    value = Math.max(0, value - (isTimeBased ? 5 : 1));
    input.value = value;

    if (!manualEntryProgress[videoId]) manualEntryProgress[videoId] = {};
    const field = isTimeBased ? 'seconds' : 'reps';
    manualEntryProgress[videoId][`set${setNumber}`] = {
        ...manualEntryProgress[videoId][`set${setNumber}`],
        [field]: value
    };

}

function manualUpdateReps(videoId, setNumber, isTimeBased) {
    const input = document.getElementById(`manual_reps_${videoId}_set${setNumber}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    value = Math.max(0, Math.min(99, value));
    input.value = value;
    
    if (!manualEntryProgress[videoId]) manualEntryProgress[videoId] = {};
    const field = isTimeBased ? 'seconds' : 'reps';
    manualEntryProgress[videoId][`set${setNumber}`] = {
        ...manualEntryProgress[videoId][`set${setNumber}`],
        [field]: value
    };
}

function manualToggleSet(videoId, setNumber) {
    const checkbox = document.getElementById(`manual_completed_${videoId}_set${setNumber}`);
    if (!checkbox) return;
    
    if (!manualEntryProgress[videoId]) manualEntryProgress[videoId] = {};
    manualEntryProgress[videoId][`set${setNumber}`] = {
        ...manualEntryProgress[videoId][`set${setNumber}`],
        completed: checkbox.checked
    };

    updateManualEntrySaveState();
    renderManualEntryConflictWarning();
}

function manualCheckAllExerciseSets(videoId, totalSets) {
    for (let i = 1; i <= totalSets; i++) {
        const checkbox = document.getElementById(`manual_completed_${videoId}_set${i}`);
        if (checkbox) {
            checkbox.checked = true;
            manualToggleSet(videoId, i);
        }
    }
}

// ==================== Save State Management ====================
// Renders the appropriate conflict / context warning based on live state.
// Called whenever date, playlist, or checkbox state changes.
function renderManualEntryConflictWarning() {
    const conflictWarning = document.getElementById('manual-entry-conflict');
    const dateInput = document.getElementById('manual-entry-date');
    const playlistSelect = document.getElementById('manual-entry-playlist');
    if (!conflictWarning) return;

    const selectedDate = dateInput?.value;
    const playlistId = playlistSelect?.value;

    if (!selectedDate) {
        conflictWarning.classList.add('hidden');
        return;
    }

    const dayData = completionHistory?.[selectedDate];
    if (!dayData) {
        conflictWarning.classList.add('hidden');
        return;
    }

    const isEditingThisPlaylist = !!(playlistId && dayData[playlistId]);
    const hasOtherPlaylistData = Object.keys(dayData).some(pid => pid !== playlistId);

    // Is anything currently checked in the form?
    const hasAnyCompletedSet = manualEntryProgress && Object.values(manualEntryProgress).some(videoData =>
        Object.keys(videoData).some(k => k.startsWith('set') && videoData[k]?.completed)
    );

    let icon, message;

    if (isEditingThisPlaylist && !hasAnyCompletedSet) {
        // Deletion case
        icon = 'fa-triangle-exclamation';
        message = "Saving with no sets checked will <strong>clear this playlist's data</strong> for this day.";
    } else if (isEditingThisPlaylist) {
        // Replacement case
        icon = 'fa-circle-info';
        message = "You already have data for this playlist on this day. Saving will replace it with these entries.";
    } else if (hasOtherPlaylistData) {
        // Adding alongside another playlist on the same day
        icon = 'fa-circle-info';
        message = "You already have a different playlist logged for this day. Your new entries will be added alongside.";
    } else {
        conflictWarning.classList.add('hidden');
        return;
    }

    conflictWarning.classList.remove('hidden');
    conflictWarning.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;
}

function _manualEntryHasChanges() {
    if (originalManualEntrySnapshot === null) return false;
    return JSON.stringify(manualEntryProgress) !== originalManualEntrySnapshot;
}

function updateManualEntrySaveState() {
    const saveBtn = document.getElementById('manual-entry-save-btn');
    const dateInput = document.getElementById('manual-entry-date');
    const playlistSelect = document.getElementById('manual-entry-playlist');
    
    if (!saveBtn) return;

    const hasDate = !!(dateInput && dateInput.value);
    const hasPlaylist = !!(playlistSelect && playlistSelect.value);
    
    // Disable unless date+playlist are set AND the form state differs from
    // what was originally loaded. This single rule handles new entries,
    // edits, and "uncheck everything to delete".
    saveBtn.disabled = !(hasDate && hasPlaylist && _manualEntryHasChanges());
    
    renderManualEntryConflictWarning();
}

// ==================== Toast Notification ====================
function showManualEntryToast(message, icon = 'fa-circle-info', type = 'info') {
    // Remove any existing toast
    const existing = document.getElementById('manual-entry-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'manual-entry-toast';
    
    const bgStyle = type === 'advance' 
        ? 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);'
        : 'background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);';
    
    toast.className = 'fixed bottom-8 left-1/2 flex items-center gap-3 py-3.5 px-6 rounded-[10px] text-base font-medium text-white z-[2000] max-w-[90vw] opacity-0 transition-all duration-300';
    toast.style.cssText = `transform: translateX(-50%) translateY(20px); box-shadow: 0 8px 24px rgba(0,0,0,0.15); ${bgStyle}`;
    toast.innerHTML = `
        <i class="fa-solid ${icon} text-[1.1rem] shrink-0"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 10000);
}

// ==================== Save Manual Entry ====================
async function saveManualEntry() {
    const saveBtn = document.getElementById('manual-entry-save-btn');
    const dateInput = document.getElementById('manual-entry-date');
    const playlistSelect = document.getElementById('manual-entry-playlist');

    if (!dateInput?.value || !playlistSelect?.value || !currentUser) return;

    const selectedDate = dateInput.value;
    const playlistId = playlistSelect.value;

    // Show saving state
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    }

    try {
        // Build the progress data - merge with any existing data for that date
        let progressData = {};

        // Load existing session for this date if it exists
        if (completionHistory && completionHistory[selectedDate]) {
            progressData = JSON.parse(JSON.stringify(completionHistory[selectedDate]));
        }

        // Did the user mark any set as completed across all exercises?
        const hasAnyCompletedSet = Object.values(manualEntryProgress).some(videoData =>
            Object.keys(videoData).some(k =>
                k.startsWith('set') && videoData[k]?.completed
            )
        );

        if (hasAnyCompletedSet) {
            // Strip exercises with no completed sets — "uncheck = removed exercise"
            const cleanedProgress = {};
            Object.keys(manualEntryProgress).forEach(videoId => {
                const videoData = manualEntryProgress[videoId];
                const hasCompleted = Object.keys(videoData).some(k =>
                    k.startsWith('set') && videoData[k]?.completed
                );
                if (hasCompleted) {
                    cleanedProgress[videoId] = videoData;
                }
            });
            progressData[playlistId] = cleanedProgress;
        } else {
            // Editing existing data and unchecked everything → delete this playlist for the day
            delete progressData[playlistId];
        }

        // Upsert to database
        const { error } = await window.supabaseClient
            .from('workout_sessions')
            .upsert({
                user_id: currentUser.id,
                session_date: selectedDate,
                progress: progressData
            }, {
                onConflict: 'user_id,session_date'
            });

        if (error) {
            console.error('Error saving manual entry:', error);
            alert('Error saving workout. Please try again.');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Workout';
            }
            return;
        }

        // Reload data to update all UI
        await loadTodaySession();
        await loadCompletionHistory();

        // Show success state
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
        }

        // Close modal after brief delay and refresh progress page
        setTimeout(() => {
            closeManualEntryModal();

            // Refresh progress view if it's currently visible
            const progressView = document.getElementById('progress-view');
            if (progressView && !progressView.classList.contains('hidden')) {
                loadProgressStats();
                renderWorkoutHistoryChart();
                renderDetailPanel();
                loadRecentActivity();
            }

            // Show toast for program state changes
            if (!completedBefore && completedAfter) {
                showManualEntryToast(
                    "You've completed the 6-week program! 🎉 Congratulations!",
                    'fa-trophy',
                    'success'
                );
            } else if (weekAfter > weekBefore) {
                showManualEntryToast(
                    `You've advanced to Week ${weekAfter}! Keep up the great work 💪`,
                    'fa-arrow-up',
                    'advance'
                );
            }
        }, 800);

    } catch (error) {
        console.error('Exception saving manual entry:', error);
        alert('Error saving workout. Please try again.');
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Workout';
        }
    }
}

console.log('Manual entry module loaded');