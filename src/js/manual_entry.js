// Manual Entry module - allows users to log past workouts they forgot to record

// State for manual entry
let manualEntryProgress = {};
let manualEntryPlaylist = null;

// ==================== Open / Close Modal ====================
function openManualEntryModal() {
    const modal = document.getElementById('manual-entry-modal');
    if (!modal) return;

    // Reset state
    manualEntryProgress = {};
    manualEntryPlaylist = null;

    // Set date constraints
    const dateInput = document.getElementById('manual-entry-date');
    if (dateInput) {
        const today = new Date();
        const maxDate = new Date(today);
        maxDate.setDate(maxDate.getDate() - 1); // Yesterday at most

        const minDate = new Date(today);
        minDate.setDate(minDate.getDate() - 14); // 2 weeks back

        dateInput.value = '';
        dateInput.max = maxDate.toISOString().split('T')[0];
        dateInput.min = minDate.toISOString().split('T')[0];
    }

    // Reset playlist selector
    const playlistSelect = document.getElementById('manual-entry-playlist');
    if (playlistSelect) {
        playlistSelect.value = '';
    }

    // Clear exercise area
    const exerciseArea = document.getElementById('manual-entry-exercises');
    if (exerciseArea) {
        exerciseArea.innerHTML = `
            <div class="manual-entry-empty-state">
                <i class="fa-solid fa-dumbbell"></i>
                <p>Select a date and workout to log your exercises</p>
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
}

function closeManualEntryModal() {
    const modal = document.getElementById('manual-entry-modal');
    if (!modal) return;

    modal.classList.remove('visible');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

// ==================== Date & Playlist Change Handlers ====================
async function onManualEntryDateChange() {
    const dateInput = document.getElementById('manual-entry-date');
    const playlistSelect = document.getElementById('manual-entry-playlist');
    const conflictWarning = document.getElementById('manual-entry-conflict');
    
    if (!dateInput || !dateInput.value) return;

    const selectedDate = dateInput.value;

    // Check if there's existing data for this date
    if (completionHistory && completionHistory[selectedDate]) {
        if (conflictWarning) {
            conflictWarning.classList.remove('hidden');
            conflictWarning.innerHTML = `
                <i class="fa-solid fa-circle-info"></i>
                <span>You already have workout data for this date. New entries will be combined with existing data.</span>
            `;
        }
    } else {
        if (conflictWarning) conflictWarning.classList.add('hidden');
    }

    // Auto-suggest a playlist based on the date's program week
    if (playlistSelect && !playlistSelect.value) {
        // Simple heuristic: if user is on week 4+, suggest advanced
        const userWeek = calculateUserWeek();
        if (userWeek >= 4) {
            playlistSelect.value = 'advanced-4-6';
        } else {
            playlistSelect.value = 'beginner-0-3';
        }
        onManualEntryPlaylistChange();
    }

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

    renderManualEntryExercises();
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
        for (let i = 1; i <= video.sets; i++) {
            const setData = videoProgress[`set${i}`] || { reps: video.reps, completed: false };
            
            setsHTML += `
                <div class="manual-set-row">
                    <span class="manual-set-label">Set ${i}</span>
                    <div class="rep-counter">
                        <button type="button" class="rep-btn" onclick="manualDecrementReps('${video.id}', ${i})">
                            <i class="fa-solid fa-minus"></i>
                        </button>
                        <input type="number" 
                               id="manual_reps_${video.id}_set${i}" 
                               class="rep-input" 
                               value="${setData.reps}" 
                               min="0" 
                               max="99"
                               onchange="manualUpdateReps('${video.id}', ${i})">
                        <button type="button" class="rep-btn" onclick="manualIncrementReps('${video.id}', ${i})">
                            <i class="fa-solid fa-plus"></i>
                        </button>
                    </div>
                    <span class="reps-label">reps</span>
                    <label class="set-checkbox-wrapper">
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

        // Equipment badges
        let equipmentHTML = '';
        if (video.equipment && Array.isArray(video.equipment)) {
            const badges = video.equipment.map(item => {
                const difficulty = getEquipmentDifficulty(item);
                const displayName = getEquipmentDisplayName(item);
                return `<span class="equipment-badge badge-${difficulty}">
                    <span class="equipment-dot dot-${difficulty}"></span>
                    ${displayName}
                </span>`;
            });
            equipmentHTML = badges.join('<span class="equipment-separator">or</span>');
        }

        html += `
            <div class="manual-exercise-card">
                <div class="manual-exercise-header">
                    <div class="manual-exercise-info">
                        <span class="manual-exercise-number">${index + 1}</span>
                        <div>
                            <h4>${video.title}</h4>
                            <p class="manual-exercise-rec">Recommended: ${video.sets} sets of ${video.reps} reps${video.needsEachSide ? ' (each side)' : ''}</p>
                            ${equipmentHTML ? `<div class="manual-exercise-equipment">${equipmentHTML}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div class="manual-sets-container">
                    ${setsHTML}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// ==================== Rep/Set Controls ====================
function manualIncrementReps(videoId, setNumber) {
    const input = document.getElementById(`manual_reps_${videoId}_set${setNumber}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    value++;
    input.value = value;
    
    if (!manualEntryProgress[videoId]) manualEntryProgress[videoId] = {};
    manualEntryProgress[videoId][`set${setNumber}`] = {
        ...manualEntryProgress[videoId][`set${setNumber}`],
        reps: value
    };
}

function manualDecrementReps(videoId, setNumber) {
    const input = document.getElementById(`manual_reps_${videoId}_set${setNumber}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    if (value > 0) {
        value--;
        input.value = value;
        
        if (!manualEntryProgress[videoId]) manualEntryProgress[videoId] = {};
        manualEntryProgress[videoId][`set${setNumber}`] = {
            ...manualEntryProgress[videoId][`set${setNumber}`],
            reps: value
        };
    }
}

function manualUpdateReps(videoId, setNumber) {
    const input = document.getElementById(`manual_reps_${videoId}_set${setNumber}`);
    if (!input) return;
    
    let value = parseInt(input.value) || 0;
    value = Math.max(0, Math.min(99, value));
    input.value = value;
    
    if (!manualEntryProgress[videoId]) manualEntryProgress[videoId] = {};
    manualEntryProgress[videoId][`set${setNumber}`] = {
        ...manualEntryProgress[videoId][`set${setNumber}`],
        reps: value
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
}

// ==================== Save State Management ====================
function updateManualEntrySaveState() {
    const saveBtn = document.getElementById('manual-entry-save-btn');
    const dateInput = document.getElementById('manual-entry-date');
    const playlistSelect = document.getElementById('manual-entry-playlist');
    
    if (!saveBtn) return;

    const hasDate = dateInput && dateInput.value;
    const hasPlaylist = playlistSelect && playlistSelect.value;
    
    // Check if at least one set is marked completed
    let hasCompletedSet = false;
    if (hasPlaylist && manualEntryProgress) {
        for (const videoId of Object.keys(manualEntryProgress)) {
            const videoData = manualEntryProgress[videoId];
            for (const setKey of Object.keys(videoData)) {
                if (setKey.startsWith('set') && videoData[setKey]?.completed) {
                    hasCompletedSet = true;
                    break;
                }
            }
            if (hasCompletedSet) break;
        }
    }

    saveBtn.disabled = !(hasDate && hasPlaylist && hasCompletedSet);
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

        // Merge manual entry progress into the selected playlist
        progressData[playlistId] = { ...manualEntryProgress };

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