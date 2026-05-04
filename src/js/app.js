// Main application logic - playlist display, exercise tracking, etc.

// ==================== App Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');
    
    // Initialize auth form listeners
    if (typeof initAuthFormListeners === 'function') {
        initAuthFormListeners();
    }

    // Check if Supabase client is available
    if (!window.supabaseClient) {
        console.error('Supabase client not initialized');
        hideLoadingScreen();
        showAuthPage();
        return;
    }

    // Set up auth listener for sign-out events (synchronous only)
    if (typeof initAuthListener === 'function') {
        initAuthListener();
    }

    // Detect password recovery flow from URL hash BEFORE session routing
    if (typeof detectPasswordRecovery === 'function') {
        detectPasswordRecovery();
    }
    
    // Initialize session - this handles the initial page load
    initializeSession();
});

// Initialize session on page load
async function initializeSession() {
    console.log('initializeSession: Starting...');

    // If this is a password recovery redirect, the auth listener handles it — skip normal routing
    if (isPasswordRecovery) {
        console.log('initializeSession: Password recovery flow detected, skipping normal routing');
        return;
    }
    
    try {
        const { data: { session }, error } = await window.supabaseClient.auth.getSession();
        console.log('initializeSession: getSession completed', { hasSession: !!session, error });
        
        if (error) {
            console.error('initializeSession: Session error:', error);
            hideLoadingScreen();
            showAuthPage();
            return;
        }
        
        if (session) {
            console.log('initializeSession: User is authenticated, loading data...');
            currentUser = session.user;
            
            try {
                await updateUIForAuthenticatedUser(session.user);
            } catch (e) {
                console.error('initializeSession: Error in updateUIForAuthenticatedUser:', e);
            }
            
            try {
                await loadTodaySession();
            } catch (e) {
                console.error('initializeSession: Error in loadTodaySession:', e);
            }
            
            try {
                await loadCompletionHistory();
            } catch (e) {
                console.error('initializeSession: Error in loadCompletionHistory:', e);
            }

            try {
                await loadEducationProgress();
            } catch (e) {
                console.error('initializeSession: Error in loadEducationProgress:', e);
            }
            
            hideLoadingScreen();
            routeAfterAuth();
            console.log('initializeSession: Done!');
        } else {
            console.log('initializeSession: No session, showing auth page');
            updateUIForGuestUser();
            hideLoadingScreen();
            showAuthPage();
        }
    } catch (error) {
        console.error('initializeSession: Exception:', error);
        hideLoadingScreen();
        showAuthPage();
    }
}

// ==================== Education Lesson Map ====================
// Maps Rise lesson IDs (used as bookmarks) to display titles.
// IDs come from the Rise course payload baked into education/content/index.html.
// Sections (module headers) are excluded — bookmarks only land on `blocks`-type lessons.
const EDUCATION_LESSONS = {
    'HS-DDqUH8jqNhXAgn7LRSrXgcYkQIg_N': { title: 'Introduction to the Program',             module: 'Welcome' },
    'IBYtsdmc0E3aAbnrfc-gisULQGx0cI6y': { title: 'Distal Radius Fractures',                 module: 'Module 1' },
    'SNEXsbc0L8BIG7sJoEAsMxCMt1JHgAAm': { title: 'Fracture Risk Assessment Tools',          module: 'Module 1' },
    '_C0-_2v5ZXfW323j44DoRvHM-JVsTiob': { title: 'Osteoporosis and Fracture Risk',          module: 'Module 1' },
    'C6jHPCIpOhmKeh1sh_8OYW0-ZiJIRaRY': { title: 'Exercise Guidelines',                     module: 'Module 2' },
    'c-6P8hqKcFTzrjzx5jYN44lIKapLeVoI': { title: 'Osteoporosis Exercise Recommendations',   module: 'Module 2' },
    '_d5y9Cv61f6BrASFHtjjqZAaxV4LT5e2': { title: 'Safe Movement Recommendations',           module: 'Module 2' },
    'yD8VGvKEfTqfddlEzytLv2qr1EquxGXp': { title: 'Nutrition for Bone Health',               module: 'Module 3' },
    'vFlI7sLW2luytUlohBkDt8iG53oYfEUj': { title: 'Fall Hazards',                            module: 'Module 4' },
    '2C1cX5Kv17nnWVWLf15Hs89rrtDloU_B': { title: 'Behaviour Change Plan',                   module: 'Module 4' },
    'jQNd6-oi-KwIjhrNoADU7VuIx_r7o708': { title: 'Medication',                              module: 'Module 5' },
    'oWKAiyGlytIFyF8BnPH3_f0xVQLSBaqq': { title: 'Conversations With Your Healthcare Team', module: 'Module 5' },
    'eN51e76Rdpb3K9lYu97DvddHkza2xAgK': { title: 'Project Acknowledgements',                module: 'About the Project' }
};

/**
 * Resolves the lesson the user last viewed in the e-learning module.
 * Tries bookmark first, then falls back to progress.currentLesson.
 * Returns { title, module } or null if nothing resolves.
 */
function getEducationResumeLesson() {
    const bookmark = window.eduBookmark;
    if (bookmark && EDUCATION_LESSONS[bookmark]) return EDUCATION_LESSONS[bookmark];

    const current = window.eduProgress?.currentLesson;
    if (current && EDUCATION_LESSONS[current]) return EDUCATION_LESSONS[current];

    return null;
}

/**
 * Returns 'completed' | 'in_progress' | 'untouched' for a given lesson ID.
 * Completion is based solely on percentComplete === 100, which is the field
 * Rise actively maintains across all lesson versions.
 */
function getLessonStatus(lessonId) {
    const lesson = window.eduProgress?.lessons?.[lessonId];
    if (!lesson) return 'untouched';
    if (lesson.percentComplete === 100) return 'completed';
    return 'in_progress';
}

/**
 * Aggregates lesson statuses across all known lessons in EDUCATION_LESSONS.
 */
function getEducationStats() {
    const ids = Object.keys(EDUCATION_LESSONS);
    const stats = { total: ids.length, completed: 0, in_progress: 0, untouched: 0 };
    for (const id of ids) stats[getLessonStatus(id)]++;
    return stats;
}

/**
 * Returns true if the user has a meaningful e-learning record
 * (a row exists in education_progress and we can resolve some lesson).
 */
function hasEducationProgress() {
    return window.eduProgress !== null && getEducationResumeLesson() !== null;
}

// ==================== Week Calculation ====================

/**
 * Returns the pure calendar-based week number (days since first session / 7).
 * Used for discrepancy comparison against the session-gated program week.
 */
function calculateCalendarWeek() {
    if (!completionHistory || Object.keys(completionHistory).length === 0) return 0;

    const dates = Object.keys(completionHistory).sort();
    if (dates.length === 0) return 0;

    const firstDate = new Date(dates[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24));
    return Math.min(Math.floor(diffDays / 7), 6);
}

/**
 * Returns all dates where the user logged completed activity for the advanced playlist.
 */
function getAdvancedSessionDates() {
    if (!completionHistory) return [];

    const dates = [];
    for (const dateStr of Object.keys(completionHistory).sort()) {
        const dayProgress = completionHistory[dateStr];
        if (dayProgress && dayProgress['advanced-4-6']) {
            const advancedProgress = dayProgress['advanced-4-6'];
            const hasActivity = Object.values(advancedProgress).some(videoProgress => {
                if (typeof videoProgress === 'object' && !Array.isArray(videoProgress)) {
                    return Object.keys(videoProgress).some(key =>
                        key.startsWith('set') && videoProgress[key]?.completed === true
                    );
                }
                return typeof videoProgress === 'number' && videoProgress > 0;
            });
            if (hasActivity) dates.push(dateStr);
        }
    }
    return dates;
}

/**
 * Replays session-gated progression on a slice of dates and returns true if
 * the user ever reached week 6 with 2+ sessions logged. Used to lock in
 * "completed" status so it survives later inactivity, edits, or gaps.
 */
function _didEverComplete(advancedSessionDates, fromDate) {
    if (!advancedSessionDates.length) return false;

    let programWeek = 4;
    let windowAnchor = new Date(fromDate);
    windowAnchor.setDate(windowAnchor.getDate() + 28);

    let sessionsInWeek = 0;

    for (const sessionDateStr of advancedSessionDates) {
        const sessionDate = new Date(sessionDateStr + 'T00:00:00');
        if (sessionDate < windowAnchor) continue;

        sessionsInWeek++;

        if (sessionsInWeek >= 2) {
            // Completion: week 6 with 2 sessions
            if (programWeek === 6) return true;

            // Otherwise advance and continue
            const windowEnd = new Date(windowAnchor);
            windowEnd.setDate(windowEnd.getDate() + 7);

            const advanceDate = sessionDate < windowEnd
                ? new Date(windowEnd)
                : (() => { const d = new Date(sessionDate); d.setDate(d.getDate() + 1); return d; })();

            programWeek++;
            windowAnchor = advanceDate;
            sessionsInWeek = (sessionDate >= advanceDate) ? 1 : 0;
        }
    }

    return false;
}

/**
 * Core function that computes the program week state for weeks 4-6.
 * Returns detailed state used by calculateUserWeek(), alerts, and checkWeek6Activity().
 *
 * Weeks 0-3: purely calendar-based (days since first session / 7).
 * Weeks 4-6: session-gated — requires 2 advanced sessions per program week to advance.
 *
 * 7-day window rules:
 *   - Window anchors to the advance date of the previous week (initially day 28).
 *   - If 2 sessions fall within the window → advance the day after the window expires.
 *   - If session 2 falls outside the window → advance the day after session 2.
 *   - New window starts on the advance date.
 *   - 14+ days of inactivity → reset to week 4.
 *   - When resetted, the windor anchor resets to the date of resumed activity.
 */
function getProgramWeekState() {
    const empty = { programWeek: 0, calendarWeek: 0, windowAnchor: null, sessionsInCurrentWeek: 0 };

    if (!completionHistory || Object.keys(completionHistory).length === 0) return empty;

    const allDates = Object.keys(completionHistory).sort();
    if (allDates.length === 0) return empty;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the "effective" first date: the most recent resume after a 14+ day gap,
    // or the original first session if no such gap exists.
    // Pre-gap sessions don't count toward post-reset progression.
    const sessionDates = allDates.map(d => new Date(d + 'T00:00:00'));
    const originalFirstDate = sessionDates[0];

    const diffDaysFromOriginal = Math.floor((today - originalFirstDate) / 86400000);
    const calendarWeek = Math.min(Math.floor(diffDaysFromOriginal / 7), 6);
    
    // Weeks 0-3: purely calendar-based, no reset logic
    if (calendarWeek <= 3) {
        return { programWeek: calendarWeek, calendarWeek, windowAnchor: null, sessionsInCurrentWeek: 0 };
    }

    // Weeks 4-6: compute effectiveFirstDate for the gap-aware progression
    let effectiveFirstIdx = 0;

    for (let i = 1; i < sessionDates.length; i++) {
        const gapDays = Math.floor((sessionDates[i] - sessionDates[i - 1]) / 86400000);
        if (gapDays >= 14) effectiveFirstIdx = i;
    }
    const effectiveFirstDate = sessionDates[effectiveFirstIdx];

    // ── Completion check: did the user already finish the program in this run?
    // Once true, completion is permanent for this effective period — survives
    // inactivity, gaps, and stale windowAnchors.
    const advancedSessionsInRun = getAdvancedSessionDates().filter(dateStr => {
        return new Date(dateStr + 'T00:00:00') >= effectiveFirstDate;
    });

    if (_didEverComplete(advancedSessionsInRun, effectiveFirstDate)) {
        return {
            programWeek: 6,
            calendarWeek,
            windowAnchor: null,
            sessionsInCurrentWeek: 2,
            completed: true
        };
    }

    // Check 14-day inactivity reset (only for non-completed users)
    const mostRecentDate = new Date(allDates[allDates.length - 1] + 'T00:00:00');
    const daysSinceLastActivity = Math.floor((today - mostRecentDate) / 86400000);

    if (daysSinceLastActivity >= 14) {
        return { programWeek: 4, calendarWeek, windowAnchor: null, sessionsInCurrentWeek: 0, wasReset: true };
    }

    let programWeek = 4;
    let windowAnchor = new Date(effectiveFirstDate);
    windowAnchor.setDate(windowAnchor.getDate() + 28);

    let sessionsInCurrentWeek = 0;

    for (const sessionDateStr of advancedSessionsInRun) {
        const sessionDate = new Date(sessionDateStr + 'T00:00:00');
        if (sessionDate < windowAnchor) continue;
        sessionsInCurrentWeek++;

        if (sessionsInCurrentWeek >= 2) {
            const windowEnd = new Date(windowAnchor);
            windowEnd.setDate(windowEnd.getDate() + 7);

            let advanceDate;
            if (sessionDate < windowEnd) {
                advanceDate = new Date(windowEnd);
            } else {
                advanceDate = new Date(sessionDate);
                advanceDate.setDate(advanceDate.getDate() + 1);
            }

            if (today >= advanceDate) {
                programWeek++;
                if (programWeek >= 6) {
                    windowAnchor = advanceDate;
                    sessionsInCurrentWeek = (sessionDate >= advanceDate) ? 1 : 0;
                    break;
                }
                windowAnchor = advanceDate;
                sessionsInCurrentWeek = (sessionDate >= advanceDate) ? 1 : 0;
            } else {
                break;
            }
        }
    }

    if (programWeek === 6 && windowAnchor) {
        sessionsInCurrentWeek = 0;
        const anchorTime = windowAnchor.getTime();
        for (const sessionDateStr of advancedSessionsInRun) {
            const sd = new Date(sessionDateStr + 'T00:00:00');
            if (sd.getTime() >= anchorTime) sessionsInCurrentWeek++;
        }
    }

    return {
        programWeek: Math.min(programWeek, 6),
        calendarWeek,
        windowAnchor,
        sessionsInCurrentWeek
    };
}

/**
 * Main week calculation function used throughout the app.
 * Weeks 0-3: calendar-based. Weeks 4-6: session-gated via getProgramWeekState().
 */
function calculateUserWeek() {
    return getProgramWeekState().programWeek;
}

/**
 * Returns true if the user has completed the full 6-week program.
 * Completed = program week 6 with 2+ sessions logged.
 */
function isProgramCompleted() {
    const state = getProgramWeekState();
    return state.completed === true || (state.programWeek === 6 && state.sessionsInCurrentWeek >= 2);
}

/**
 * Checks if the user is about to begin their final session of the program
 * (week 6, 1 session done, no advanced activity logged today).
 * If so, shows a congratulatory modal.
 */
function checkAndShowFinalSessionModal() {
    const state = getProgramWeekState();

    // Must be on week 6 with exactly 1 session completed
    if (state.programWeek !== 6 || state.sessionsInCurrentWeek !== 1) return;

    // Check if today already has advanced activity (don't re-trigger)
    const today = new Date().toISOString().split('T')[0];
    const advancedDates = getAdvancedSessionDates();
    if (advancedDates.includes(today)) return;

    // Check if already dismissed this session
    const dismissed = sessionStorage.getItem('dismissedFinalSessionModal');
    if (dismissed) return;

    // Show the modal
    showFinalSessionModal();
}

/**
 * Renders and displays the final session congratulatory modal.
 */
function showFinalSessionModal() {
    // Remove existing modal if present
    const existing = document.getElementById('final-session-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'final-session-modal';
    overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] opacity-0 transition-opacity duration-300';
    overlay.innerHTML = `
        <div class="bg-white rounded-2xl py-10 px-8 max-w-[440px] w-[90%] text-center scale-90 transition-transform duration-300" style="box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
            <div class="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style="background: radial-gradient(ellipse farthest-corner at right bottom, #FEDB37 0%, #FDB931 8%, #9f7928 30%, #8A6E2F 40%, transparent 80%), radial-gradient(ellipse farthest-corner at left top, #FFFFFF 0%, #FFFFAC 8%, #D1B464 25%, #5d4a1f 62.5%, #5d4a1f 100%);">
                <i class="fa-solid fa-star text-[1.75rem] text-white"></i>
            </div>
            <h2 class="text-2xl font-bold text-text-primary mb-3">You're Almost at the Finish Line!</h2>
            <p class="text-base text-[#4a5568] leading-relaxed mb-2">
                This is your <strong>final session</strong> of the 6-week program. 
            </p>
            <p class="text-base text-[#718096] mb-6">
                Complete today's workout and you'll have officially finished the entire program. Let's make it count! 💪
            </p>
            <button class="text-white border-none py-3 px-10 rounded-lg text-base font-semibold cursor-pointer transition-all hover:-translate-y-px" style="background: linear-gradient(135deg, #10b981, #059669); box-shadow: none;" onmouseenter="this.style.boxShadow='0 4px 12px rgba(16,185,129,0.3)'" onmouseleave="this.style.boxShadow='none'" onclick="closeFinalSessionModal()">Let's Go!</button>
        </div>
    `;

    document.getElementById('app').appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('div').style.transform = 'scale(1)';
    });
}
/**
 * Closes the final session modal and marks it as dismissed for this session.
 */
function closeFinalSessionModal() {
    const modal = document.getElementById('final-session-modal');
    if (modal) {
        modal.style.opacity = '0';
        const inner = modal.querySelector('div');
        if (inner) inner.style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 300);
    }
    sessionStorage.setItem('dismissedFinalSessionModal', 'true');
}

/**
 * Checks if the user just completed the program by finishing all exercises
 * in their 2nd session of week 6. Call this after saving progress.
 * Returns true if the modal was shown.
 */
function checkAndShowProgramCompletionModal() {
    // Must be on program week 6
    const state = getProgramWeekState();
    if (state.programWeek !== 6) return false;

    // Today must be an advanced session (the 2nd one in week 6)
    const today = new Date().toISOString().split('T')[0];
    const advancedDates = getAdvancedSessionDates();
    if (!advancedDates.includes(today)) return false;

    // Check if today's advanced playlist progress is 100%
    const progress = calculatePlaylistProgress('advanced-4-6', true);
    if (progress.percentage < 100) return false;

    // Check if already shown this session
    const dismissed = sessionStorage.getItem('dismissedCompletionModal');
    if (dismissed) return false;

    showProgramCompletionModal();
    return true;
}

/**
 * Renders and displays the program completion celebration modal.
 */
function showProgramCompletionModal() {
    // Remove existing if present
    const existing = document.getElementById('program-completion-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'program-completion-modal';
    overlay.className = 'fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] opacity-0 transition-opacity duration-300';
    overlay.innerHTML = `
        <div class="bg-white rounded-2xl py-10 px-8 max-w-[440px] w-[90%] text-center scale-90 transition-transform duration-300" style="box-shadow: 0 20px 60px rgba(0,0,0,0.15);">
            <div class="w-[72px] h-[72px] rounded-full flex items-center justify-center mx-auto mb-5" style="background: radial-gradient(ellipse farthest-corner at right bottom, #FEDB37 0%, #FDB931 8%, #9f7928 30%, #8A6E2F 40%, transparent 80%), radial-gradient(ellipse farthest-corner at left top, #FFFFFF 0%, #FFFFAC 8%, #D1B464 25%, #5d4a1f 62.5%, #5d4a1f 100%);">
                <i class="fa-solid fa-trophy text-[2rem] text-white"></i>
            </div>
            <h2 class="text-2xl font-bold text-text-primary mb-3">Congratulations! 🎉</h2>
            <p class="text-base text-[#4a5568] leading-relaxed mb-2">
                You've officially completed the <strong>6-week HandsUP program</strong>! 
            </p>
            <p class="text-base text-[#718096] mb-6">
                You're welcome to keep going with the Advanced exercises at your own pace. Keep up the great work!
            </p>
            <button class="text-white border-none py-3 px-10 rounded-lg text-base font-semibold cursor-pointer transition-all hover:-translate-y-px" style="background: linear-gradient(135deg, #7c3aed, #6d28d9); box-shadow: none;" onmouseenter="this.style.boxShadow='0 4px 12px rgba(124,58,237,0.3)'" onmouseleave="this.style.boxShadow='none'" onclick="closeProgramCompletionModal()">Okay</button>
        </div>
    `;

    document.getElementById('app').appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.style.opacity = '1';
        overlay.querySelector('div').style.transform = 'scale(1)';
    });
}

/**
 * Closes the program completion modal.
 */
function closeProgramCompletionModal() {
    const modal = document.getElementById('program-completion-modal');
    if (modal) {
        modal.style.opacity = '0';
        const inner = modal.querySelector('div');
        if (inner) inner.style.transform = 'scale(0.9)';
        setTimeout(() => modal.remove(), 300);
    }
    sessionStorage.setItem('dismissedCompletionModal', 'true');
}

/**
 * Returns the Date object for the start of the user's current exercise week,
 * or null if there's no meaningful start (no history, reset, or completed).
 * Same logic as getExerciseWeekStartPhrase but returns the raw date.
 */
function getExerciseWeekStartDate(state) {
    if (!state || state.wasReset) return null;
    if (!completionHistory || Object.keys(completionHistory).length === 0) return null;
    if (state.programWeek === 6 && state.sessionsInCurrentWeek >= 2) return null;

    const allDates = Object.keys(completionHistory).sort();
    if (!allDates.length) return null;

    const firstDate = new Date(allDates[0] + 'T00:00:00');
    const weekStartDate = state.windowAnchor
        ? new Date(state.windowAnchor)
        : new Date(firstDate.getTime() + state.programWeek * 7 * 86400000);

    weekStartDate.setHours(0, 0, 0, 0);
    return weekStartDate;
}

/**
 * Returns a human-readable phrase for when the user's current exercise week began,
 * suitable for embedding in a sentence (e.g., "this Wednesday", "on Apr 15").
 * Returns null if there's no session history or the user is in a reset state.
 * @param {object} state - result of getProgramWeekState()
 */
function getExerciseWeekStartPhrase(state) {
    const weekStartDate = getExerciseWeekStartDate(state);
    if (!weekStartDate) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diff = Math.floor((today - weekStartDate) / 86400000);
    const dayName = weekStartDate.toLocaleDateString('en-US', { weekday: 'long' });

    if (diff < 0) return null;
    if (diff === 0) return 'today';
    if (diff === 1) return `yesterday (${dayName})`;

    // "this {day}" vs "last {day}" by calendar-week boundaries (Monday-based,
    // matching the home view's calendar strip).
    const startOfThisWeek = _getStartOfCurrentWeek();
    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);

    if (weekStartDate >= startOfThisWeek) return `this ${dayName}`;
    if (weekStartDate >= startOfLastWeek) return `last ${dayName}`;
    return `on ${weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function getSuggestedWorkout() {
    const userWeek = calculateUserWeek();

    if (userWeek <= 3) {
        return PLAYLISTS.find(p => p.id === 'beginner-0-3');
    } else {
        return PLAYLISTS.find(p => p.id === 'advanced-4-6');
    }
}

// ==================== Progress Ring Calculation ====================
function calculatePlaylistProgress(playlistId, todayOnly = false) {
    const playlist = PLAYLISTS.find(p => p.id === playlistId);
    if (!playlist) return { completed: 0, total: 0, percentage: 0 };

    const totalExercises = playlist.videos.length;
    let completedExercises = 0;

    // Get saved progress
    let savedProgress = null;
    
    if (todayOnly) {
        // Only look at today's session
        const today = new Date().toISOString().split('T')[0];
        if (completionHistory && completionHistory[today] && completionHistory[today][playlistId]) {
            savedProgress = completionHistory[today][playlistId];
        }
    } else {
        // Look at most recent saved session (original behavior)
        if (completionHistory) {
            const dates = Object.keys(completionHistory).sort().reverse();
            for (const date of dates) {
                if (completionHistory[date] && completionHistory[date][playlistId]) {
                    savedProgress = completionHistory[date][playlistId];
                    break;
                }
            }
        }
    }

    if (!savedProgress) {
        return { completed: 0, total: totalExercises, percentage: 0 };
    }

    // Count completed exercises
    playlist.videos.forEach(video => {
        const videoProgress = savedProgress[video.id];
        
        if (videoProgress) {
            // Check if it's the new structure (object with set1, set2, etc.)
            if (typeof videoProgress === 'object' && !Array.isArray(videoProgress)) {
                const hasCompletedSet = Object.keys(videoProgress).some(key => {
                    return key.startsWith('set') && videoProgress[key]?.completed === true;
                });
                if (hasCompletedSet) completedExercises++;
            } 
            // Backward compatibility: old structure where videoProgress is a number
            else if (typeof videoProgress === 'number' && videoProgress > 0) {
                completedExercises++;
            }
        }
    });

    const percentage = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

    return {
        completed: completedExercises,
        total: totalExercises,
        percentage: percentage
    };
}

// Store chart instances to destroy before re-creating
let todaysWorkoutChart = null;
let playlistViewChart = null;

// Create a Chart.js doughnut progress ring
function createProgressRing(canvasId, percentage, size = 70) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;

    // Set canvas size
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');

    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [percentage, 100 - percentage],
                backgroundColor: [
                    '#10b981', // Completed - green
                    '#e5e7eb'  // Remaining - light gray
                ],
                borderWidth: 0,
                cutout: '75%'
            }]
        },
        options: {
            responsive: false,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            },
            animation: {
                animateRotate: true,
                duration: 800
            }
        },
        plugins: [{
            id: 'centerText',
            beforeDraw: function(chart) {
                const ctx = chart.ctx;
                const centerX = chart.width / 2;
                const centerY = chart.height / 2;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.fillStyle = '#1a1a2e';
                ctx.fillText(`${percentage}%`, centerX, centerY);
                ctx.restore();
            }
        }]
    });

    return chart;
}

// ==================== Playlist Completion Helpers ====================
function getPlaylistLastCompletion(playlistId) {
    const playlist = PLAYLISTS.find(p => p.id === playlistId);
    if (!playlist || !completionHistory) return null;

    const dates = Object.keys(completionHistory).sort().reverse();

    for (const date of dates) {
        const progress = completionHistory[date];
        if (progress && progress[playlistId]) {
            let completedCount = 0;
            const totalExercises = playlist.videos.length;

            playlist.videos.forEach(video => {
                const videoProgress = progress[playlistId][video.id];
                
                if (videoProgress) {
                    // Check if it's the new structure (object with set1, set2, etc.)
                    if (typeof videoProgress === 'object' && !Array.isArray(videoProgress)) {
                        // Count if any set is completed
                        const hasCompletedSet = Object.keys(videoProgress).some(key => {
                            return key.startsWith('set') && videoProgress[key]?.completed === true;
                        });
                        if (hasCompletedSet) completedCount++;
                    } 
                    // Backward compatibility: old structure where videoProgress is a number
                    else if (typeof videoProgress === 'number' && videoProgress > 0) {
                        completedCount++;
                    }
                }
            });

            if (completedCount > 0) {
                return {
                    date: date,
                    completedExercises: completedCount,
                    totalExercises: totalExercises
                };
            }
        }
    }

    return null;
}

function formatCompletionDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) {
        return 'today';
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ==================== Playlist Display ====================
function loadPlaylists() {
    const grid = document.getElementById('playlists-grid');
    if (!grid) return;

    grid.innerHTML = '';

    if (!currentUser) {
        showAuthPage();
        return;
    }    

    // Show sections
    const greetingSection = document.getElementById('user-greeting-section');
    const todaysSection = document.getElementById('todays-workout-section');
    const allWorkoutsSection = document.getElementById('all-workouts-section');
    
    if (greetingSection) greetingSection.classList.remove('hidden');
    if (todaysSection) todaysSection.classList.remove('hidden');
    if (allWorkoutsSection) allWorkoutsSection.classList.remove('hidden');

    // Update user name
    const userName = userProfile?.full_name?.split(' ')[0] || currentUser.email?.split('@')[0] || 'there';
    const userNameEl = document.getElementById('home-user-name');
    if (userNameEl) userNameEl.textContent = userName;

    // Compute program week state
    const state = getProgramWeekState();
    const userWeek = state.programWeek;
    const programCompleted = isProgramCompleted();

    // Update greeting message
    const greetingP = document.querySelector('#user-greeting-section p');
    const weekStartPhrase = getExerciseWeekStartPhrase(state);

    if (greetingP) {
        if (programCompleted) {
            greetingP.innerHTML = `${userName}, you've completed the <strong>6-week program</strong>! Feel free to continue the exercises at your own pace.`;
        } else if (state.wasReset) {
            greetingP.innerHTML = `Welcome back, ${userName}! It's been a while — you're restarting at <strong>Week 4</strong>. Log a session to pick up where you left off.`;
        } else if (userWeek === 0) {
            greetingP.innerHTML = `${userName}, welcome to the program. Let's get started!`;
        } else if (userWeek >= 4 && userWeek < 6) {
            const sessionsLeft = 2 - state.sessionsInCurrentWeek;
            if (sessionsLeft > 0) {
                greetingP.innerHTML = `${userName}, you're on <strong>Week ${userWeek}</strong>. ${sessionsLeft === 1 ? '1 more session' : '2 sessions'} to go this week to advance — keep it up!`;
            } else {
                greetingP.innerHTML = `${userName}, you've reached <strong>Week ${userWeek}</strong> and already completed your sessions for this week. Well done!`;
            }
        } else if (userWeek === 6) {
            const sessionsLeft = 2 - state.sessionsInCurrentWeek;
            greetingP.innerHTML = `${userName}, you're on the <strong>final week</strong>! ${sessionsLeft === 1 ? '1 more session' : '2 sessions'} to go to complete the program — you've got this!`;
        } else {
            greetingP.innerHTML = `${userName}, you've reached <strong>Week ${userWeek}</strong>. Keep it up!`;
        }
    }

    // Week-start context line (shown when we have a valid phrase)
    const existingWsl = document.getElementById('week-start-label');
    if (existingWsl) existingWsl.remove();

    if (weekStartPhrase && greetingSection) {
        const wsl = document.createElement('p');
        wsl.id = 'week-start-label';
        wsl.className = 'text-sm text-text-muted mt-1.5';
        wsl.innerHTML = `<i class="fa-regular fa-calendar mr-1.5"></i>Week ${userWeek} began ${weekStartPhrase}`;
        greetingSection.appendChild(wsl);
    }

    if (typeof renderProgressAlert === 'function') {
        renderProgressAlert();
    }

    // Check if user is about to begin their final session of the program
    checkAndShowFinalSessionModal();

    loadTodaysWorkout();

    PLAYLISTS.forEach(playlist => {
        const card = createPlaylistCard(playlist);
        grid.appendChild(card);
    });
}

function createPlaylistCard(playlist) {
    const card = document.createElement('div');
    card.className = 'bg-white rounded-card overflow-hidden shadow-card border border-border transition-all duration-200 cursor-pointer hover:-translate-y-1 hover:shadow-heavy';
    card.onclick = () => showPlaylist(playlist.id);

    const isAdvanced = playlist.id.includes('advanced');
    const thumbnail = isAdvanced
        ? '<img src="/assets/img/advanced_playlist_thumbnail.png" alt="Advanced Workout" class="w-full h-full block">'
        : '<img src="/assets/img/beginner_playlist_thumbnail.png" alt="Beginner Workout" class="w-full h-full block">';

    const completion = getPlaylistLastCompletion(playlist.id);
    let completionHTML = '';
    
    if (completion) {
        const dateStr = formatCompletionDate(completion.date);
        const dateLabel = dateStr === 'today' ? dateStr : `on ${dateStr}`;
        completionHTML = `
            <div class="flex items-center gap-2 mb-3">
                <div class="w-5 h-5 bg-success rounded-full flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="w-3 h-3"><path d="M20 6L9 17l-5-5"/></svg>
                </div>
                <span class="text-base text-success font-medium">You completed ${completion.completedExercises}/${completion.totalExercises} exercises ${dateLabel}</span>
            </div>
        `;
    }
    
    card.innerHTML = `
        <div class="h-[180px] relative overflow-hidden">
            ${thumbnail}
        </div>
        <div class="p-5">
            <h3 class="text-[1.1rem] font-semibold text-text-primary mb-1">${playlist.title}</h3>
            <p class="text-text-secondary text-base mb-3">${playlist.description}</p>
            ${completionHTML}
            <a href="/exercises/${playlist.id}" class="inline-flex items-center gap-1 text-[#1e3a5f] text-base font-semibold no-underline hover:text-brand" onclick="event.stopPropagation(); showPlaylist('${playlist.id}'); return false;">
                Go to Workout 
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
        </div>
    `;

    return card;
}

function loadTodaysWorkout() {
    const container = document.getElementById('todays-workout-card');
    if (!container) return;

    const suggested = getSuggestedWorkout();
    if (!suggested) return;

    const isAdvanced = suggested.id.includes('advanced');
    const thumbnail = isAdvanced
        ? '<img src="/assets/img/advanced_playlist_thumbnail.png" alt="Advanced Workout" class="w-full h-full block">'
        : '<img src="/assets/img/beginner_playlist_thumbnail.png" alt="Beginner Workout" class="w-full h-full block">';
    
    // Calculate progress for the suggested workout (today only)
    const progress = calculatePlaylistProgress(suggested.id, true);

    // Update button label if there is a completed workout
    const buttonLabel = progress.completed > 0 ? 'Continue Workout' : 'Start Workout';
    
    container.innerHTML = `
        <h2 class="text-xl font-semibold text-text-primary mb-4">Today's Workout</h2>
        <div class="flex flex-row gap-8 w-full max-md:flex-col max-md:gap-4">
            <div class="h-[180px] rounded-lg overflow-hidden relative">
                ${thumbnail}
            </div>
            <div class="flex-1 min-w-200">
                <p class="text-text-secondary text-base mb-4">Your suggested workout for today</p>
                <h3 class="text-xl font-semibold text-text-primary mb-2">${suggested.title}</h3>
                <div class="flex items-center gap-3 mb-4 max-md:flex-col max-md:items-start">
                    <canvas id="todays-progress-ring"></canvas>
                    <span class="text-base text-text-tertiary font-medium">${progress.completed}/${progress.total} exercises done</span>
                </div>
                <button class="bg-teal text-white border-none py-3 px-6 text-base font-semibold rounded-md cursor-pointer transition-colors hover:bg-teal-dark" onclick="showPlaylist('${suggested.id}')">${buttonLabel}</button>
            </div>
        </div>
    `;

    // Destroy existing chart if it exists
    if (todaysWorkoutChart) {
        todaysWorkoutChart.destroy();
        todaysWorkoutChart = null;
    }

    // Create progress ring after DOM is updated
    setTimeout(() => {
        todaysWorkoutChart = createProgressRing('todays-progress-ring', progress.percentage, 70);
    }, 0);
}

// ==================== Playlist View ====================
function showPlaylist(playlistId) {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    currentPlaylist = PLAYLISTS.find(p => p.id === playlistId);
    if (!currentPlaylist) return;

    pushRoute('/exercises/' + playlistId);
    hideAllViews();

    const playlistView = document.getElementById('playlist-view');
    const navbar = document.getElementById('navbar');

    if (playlistView) playlistView.classList.remove('hidden');
    if (navbar) navbar.classList.remove('hidden');

    // Update playlist info with new title format
    const titleEl = document.getElementById('playlist-title');
    const descEl = document.getElementById('playlist-description');
    
    // Create formatted title like "Beginner 3-6 Exercises"
    const isAdvanced = currentPlaylist.id.includes('advanced');
    const formattedTitle = isAdvanced ? 'Advanced 4-6 Exercises' : 'Beginner 0-3 Exercises';
    
    if (titleEl) titleEl.textContent = formattedTitle;
    if (descEl) descEl.innerHTML = `<strong><u>Instructions</u></strong>: Go through the below exercises at your own pace. Click to watch the videos to see how each exercise is done. Your progress is saved automatically when you click 'Done' in the exercise modal.`;

    // Initialize session progress for this playlist
    if (!sessionProgress[playlistId]) {
        sessionProgress[playlistId] = {};
    }

    // Update playlist view
    updatePlaylistProgressRing();
    loadExerciseTable();
}

// Update progress ring in playlist view
function updatePlaylistProgressRing() {
    if (!currentPlaylist) return;
    
    const progressContainer = document.getElementById('playlist-progress-ring');
    if (!progressContainer) return;

    const progress = calculatePlaylistProgress(currentPlaylist.id, true);
    
    // Update the container HTML with canvas and label
    progressContainer.innerHTML = `
        <canvas id="playlist-view-progress-ring"></canvas>
        <span class="text-base text-text-tertiary font-medium text-center">${progress.completed}/${progress.total} exercises</span>
    `;

    // Destroy existing chart if it exists
    if (playlistViewChart) {
        playlistViewChart.destroy();
        playlistViewChart = null;
    }

    // Create progress ring after DOM is updated
    setTimeout(() => {
        playlistViewChart = createProgressRing('playlist-view-progress-ring', progress.percentage, 60);
    }, 0);
}

// Get equipment display name (strip difficulty hints for cleaner display)
function getEquipmentDisplayName(equipmentText) {
    // Remove parenthetical hints like "(Easier)" or "(More Challenging)"
    return equipmentText.replace(/\s*\([^)]*\)\s*/g, '').trim();
}

// Get equipment difficulty level
function getEquipmentDifficulty(equipmentText, isMultiEquipment) {
    const lowerText = equipmentText.toLowerCase();
    if (isMultiEquipment) {
        if (lowerText.includes('support')) {
            return 'support';
        } else if (lowerText.includes('challenging')) {
            return 'challenging';
        }
        else return 'baseline';
    }
    else return 'neutral';
}

function loadExerciseTable() {
    const tbody = document.getElementById('exercise-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';

    const today = new Date().toISOString().split('T')[0]; 
    const todayCompletedExercises = completionHistory?.[today]?.[currentPlaylist.id] || {};

    currentPlaylist.videos.forEach((video, index) => {
        // New structure with sets
        const row = document.createElement('tr');
        row.className = `[&:last-child_td]:border-b-0 ${todayCompletedExercises[video.id] ? 'bg-green-100 hover:bg-green-200' : 'bg-white hover:bg-[#fafbfc]'}`;
        
        // Order column
        const orderCell = document.createElement('td');
        orderCell.className = 'py-5 px-6 border-b border-border-subtle align-middle text-center font-medium text-text-secondary text-base max-lg:py-4 max-lg:px-4 max-md:hidden';
        orderCell.textContent = index + 1;
        row.appendChild(orderCell);
        
        // Name column (thumbnail + title)
        const nameCell = document.createElement('td');
        nameCell.className = 'py-4 px-6 border-b border-border-subtle align-middle text-text-primary max-lg:py-4 max-lg:px-4 max-md:py-3 max-md:px-3';
        nameCell.innerHTML = `
          <div class="flex items-center gap-4 max-md:gap-2">
            <div class="video-thumb" onclick="playExerciseVideo('${video.id}')">
                <img src="${video.thumbnail}" alt="${video.title}">
            </div>
            <span class="font-semibold text-base text-text-primary">${video.title}</span>
          </div>  
        `;
        row.appendChild(nameCell);

        // Sets/reps column
        const setsRepsCell = document.createElement('td');
        setsRepsCell.className = 'py-5 px-6 border-b border-border-subtle align-middle text-center max-lg:py-4 max-lg:px-4 max-md:py-3 max-md:px-3 max-[540px]:hidden';
        
        const needsEachSide = video.needsEachSide === true;

        // Identify if reps are iterations or seconds based on title keywords
        const isTimeBase = video.reps === 0 && video.seconds > 0;
        const repsLabel = isTimeBase ? `${video.seconds} seconds` : `${video.reps} reps`;
        const setsRepsText = needsEachSide 
            ? `${video.sets} sets of ${repsLabel}<br><span class="block text-base text-text-secondary">(each side)</span>`
            : `${video.sets} sets of ${repsLabel}`;
        
        setsRepsCell.innerHTML = `<span class="text-text-tertiary text-base leading-relaxed">${setsRepsText}</span>`;
        row.appendChild(setsRepsCell);

        // Equipment column with colored dots and "or" separators
        const equipmentCell = document.createElement('td');
        equipmentCell.className = 'py-5 px-6 border-b border-border-subtle align-middle max-lg:py-4 max-lg:px-4 max-md:hidden';
        const isMultiEquipment = video.equipment && Array.isArray(video.equipment) && video.equipment.length > 1;
        if (video.equipment && Array.isArray(video.equipment) && video.equipment.length > 0) {
            const badges = video.equipment.map((item, i) => {
                const difficulty = getEquipmentDifficulty(item, isMultiEquipment);
                const displayName = getEquipmentDisplayName(item);
                const dotClass = `dot-${difficulty}`;
                
                return `<span class="equipment-badge badge-${difficulty}">
                    <span class="equipment-dot ${dotClass}"></span>
                    ${displayName}
                </span>`;
            });
            
            // Join with "or" separator
            equipmentCell.innerHTML = badges.join('<span class="equipment-separator">or</span>');
        } else if (video.equipment && typeof video.equipment === 'string') {
            const difficulty = getEquipmentDifficulty(video.equipment, isMultiEquipment);
            const displayName = getEquipmentDisplayName(video.equipment);
            equipmentCell.innerHTML = `<span class="equipment-badge badge-${difficulty}">
                <span class="equipment-dot dot-${difficulty}"></span>
                ${displayName}
            </span>`;
        } else {
            equipmentCell.innerHTML = `<span class="equipment-badge badge-none">
                <span class="equipment-dot dot-none"></span>
                None Needed
            </span>`;
        }
        row.appendChild(equipmentCell);

        tbody.appendChild(row);
    });
}

let viewedWeekStart = null; // tracks which week the calendar strip is showing
let selectedHomeDate = null;

// Returns true if the given ISO date is eligible for manual entry
function _isDateEligibleForManualEntry(isoDate) {
    const todayISO = _dateToISO(new Date());
    if (!currentUser?.created_at || isoDate > todayISO) return false; // future dates not allowed

    const accountCreatedISO = currentUser.created_at.split('T')[0];
    return isoDate >= accountCreatedISO; // only allow dates on or after account creation
}

// Home View
function loadHomeView() {
    if (!currentUser) return;
    viewedWeekStart = null; // reset to current week
    selectedHomeDate = null; // reset to today
    renderHomeGreeting();
    renderClinicBanner();
    renderExerciseProgressCard();
    renderTotalDaysCard();
    renderCalendarStrip();
    renderTodayCard();
    renderEducationHomeCard();
}

function renderHomeGreeting() {
    const el = document.getElementById('home-user-name');
    if (!el) return;
    const name = userProfile?.full_name?.split(' ')[0] || currentUser.email?.split('@')[0] || 'there';

    const hour = new Date().getHours();
    let prefix;
    if (hour < 12)      prefix = 'Good morning,';
    else if (hour < 17) prefix = 'Good afternoon,';
    else                prefix = 'Good evening,';

    const h1 = el.closest('h1');
    if (h1) {
        h1.innerHTML = `${prefix} <span id="home-user-name">${name}</span>`;
    } else {
        el.textContent = name;
    }
}

// ---------- Date helpers ----------
function _dateToISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function _getStartOfCurrentWeek() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const day = d.getDay(); // 0 = Sun
    d.setDate(d.getDate() - day);
    return d;
}

function _dayHasAnyCompletedExercise(dayProgress) {
    if (!dayProgress) return false;
    for (const playlistId of Object.keys(dayProgress)) {
        const pp = dayProgress[playlistId];
        for (const videoId of Object.keys(pp)) {
            const vp = pp[videoId];
            if (vp && typeof vp === 'object' && !Array.isArray(vp)) {
                if (Object.keys(vp).some(k => k.startsWith('set') && vp[k]?.completed)) return true;
            } else if (typeof vp === 'number' && vp > 0) {
                return true;
            }
        }
    }
    return false;
}

// ---------- Clinic reminder banner ----------
const CLINIC_MILESTONE_DAYS = [21, 42]; // end of week 3, end of week 6

function getActiveClinicMilestone() {
    if (!completionHistory || Object.keys(completionHistory).length === 0) return null;
    const firstDate = new Date(Object.keys(completionHistory).sort()[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSince = Math.floor((today - firstDate) / 86400000);
    for (const mDay of CLINIC_MILESTONE_DAYS) {
        if (daysSince >= mDay && daysSince < mDay + 7) {
            return `week-${Math.floor(mDay / 7)}`;
        }
    }
    return null;
}

function _getDismissedClinicReminders() {
    try {
        const raw = localStorage.getItem('clinicRemindersDismissed');
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function renderClinicBanner() {
    const container = document.getElementById('home-clinic-banner');
    if (!container) return;
    const milestone = getActiveClinicMilestone();
    if (!milestone || _getDismissedClinicReminders().includes(milestone)) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="flex items-center gap-3 py-3 px-4 mb-6 bg-white rounded-lg border border-border-light border-brand-dark">
            <i class="fa-solid fa-circle-info text-brand-dark shrink-0"></i>
            <span class="flex-1 text-base">Reminder: Schedule or attend your next clinic visit at Hand and Upper Limb Center</span>
            <button onclick="dismissClinicReminder()" class="w-7 h-7 rounded-full text-text-muted hover:bg-black/5 flex items-center justify-center bg-transparent border-none cursor-pointer" aria-label="Dismiss">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;
}

function dismissClinicReminder() {
    const milestone = getActiveClinicMilestone();
    if (!milestone) return;
    const dismissed = _getDismissedClinicReminders();
    if (!dismissed.includes(milestone)) {
        dismissed.push(milestone);
        localStorage.setItem('clinicRemindersDismissed', JSON.stringify(dismissed));
    }
    renderClinicBanner();
}

function renderExerciseProgressCard() {
    const container = document.getElementById('home-exercise-progress');
    if (!container) return;

    const state = getProgramWeekState();
    const userWeek = state.programWeek;
    const completed = isProgramCompleted();
    const weekStartPhrase = getExerciseWeekStartPhrase(state);
    const hasHistory = completionHistory && Object.keys(completionHistory).length > 0;

    container.innerHTML = `<h2 class="text-[2.5rem] font-bold text-brand-dark leading-none mb-4">Week ${userWeek}</h2>
        <div class="mb-5 flex flex-row text-base text-text-secondary leading-relaxed">
            <i class="fa-solid fa-flag text-violet-400 mr-1.5 mt-1"></i> ${weekStartPhrase ? 'Your week started ' + weekStartPhrase : (completed ? 'You have completed the program!' : (hasHistory ? 'Your progress will appear here as you log workouts.' : 'No workouts logged yet. Your progress will appear here as you log workouts.'))}
        </div>
    `;
}

// ---------- Total days card ----------
function renderTotalDaysCard() {
    const container = document.getElementById('home-total-days');
    if (!container) return;
    const total = completionHistory ? Object.keys(completionHistory).length : 0;
    container.innerHTML = `
        <h3 class="text-base font-semibold text-text-primary mb-3">Total Days of Workout</h3>
        <span class="text-[2.5rem] font-bold text-brand-dark leading-none">${total}</span>
        <span class="text-base text-text-secondary mt-1">Days</span>
    `;
}

// ---------- Calendar strip ----------
function renderCalendarHeader() {
    const container = document.getElementById('home-calendar-header');
    if (!container) return;

    if (!viewedWeekStart) viewedWeekStart = _getStartOfCurrentWeek();

    const start = new Date(viewedWeekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);

    // Month label — handles single month, cross-month, and cross-year weeks
    let monthLabel;
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
        monthLabel = start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (start.getFullYear() === end.getFullYear()) {
        const a = start.toLocaleDateString('en-US', { month: 'short' });
        const b = end.toLocaleDateString('en-US', { month: 'short' });
        monthLabel = `${a} – ${b} ${end.getFullYear()}`;
    } else {
        const a = `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getFullYear()}`;
        const b = `${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getFullYear()}`;
        monthLabel = `${a} – ${b}`;
    }

    container.innerHTML = `
        <span class="text-base font-semibold text-text-primary">${monthLabel}</span>
    `;
}

function renderCalendarStrip() {
    const container = document.getElementById('home-calendar-strip');
    if (!container) return;

    // Ensure state is initialized (e.g., if called before loadHomeView)
    renderCalendarHeader();
    if (!viewedWeekStart) viewedWeekStart = _getStartOfCurrentWeek();

    const start = new Date(viewedWeekStart);
    
    const todayISO = _dateToISO(new Date());
    const effectiveSelectedISO = selectedHomeDate || todayISO;
    const labels = ['S', 'M', 'T', 'W', 'Th', 'F', 'Sa'];

    const currentWeekStart = _getStartOfCurrentWeek();
    const canGoForward = start.getTime() < currentWeekStart.getTime();
    const canGoBack = _canNavigatePreviousWeek(start);

    const exerciseStart = getExerciseWeekStartDate(getProgramWeekState());
    const exerciseStartISO = exerciseStart ? _dateToISO(exerciseStart) : null;
    const exerciseWeek = exerciseStart ? calculateUserWeek() : null;

    let daysHTML = '';
    for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        const iso = _dateToISO(d);
        const isToday = iso === todayISO;
        const isSelected = iso === effectiveSelectedISO;
        const isExerciseWeekStart = iso === exerciseStartISO;
        const isFuture = d.getTime() > new Date(todayISO + 'T00:00:00').getTime();
        const isBeforeAccountCreation = currentUser.created_at? iso < currentUser.created_at.split('T')[0] : false;
        const isDisabled = isFuture || isBeforeAccountCreation;

        const hasActivity = completionHistory?.[iso] && _dayHasAnyCompletedExercise(completionHistory[iso]);

        let dayBoxClass = 'border-2 border-transparent transition-colors';
        if (isSelected) {
            dayBoxClass += ' bg-brand text-white';
        } else if (isToday) {
            dayBoxClass += ' border-brand-dark text-text-primary';
        } else {
            dayBoxClass += ' text-text-primary hover:bg-[#f1f5f9]';
        }

        const disabledAttr = isDisabled ? 'disabled' : '';
        const cursorClass = isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer';

        const isAccountCreation = currentUser?.created_at && iso === currentUser.created_at.split('T')[0];
        let tooltipText = '';
        if (isToday) {
            tooltipText = "This is today's session";
        } else if (isAccountCreation) {
            tooltipText = "You can only log workouts from this date onward — when you created your account";
        } else if (isBeforeAccountCreation) {
            tooltipText = "Before your account was created";
        }

        daysHTML += `
            <button type="button" class="flex-1 flex flex-col items-center gap-1 min-w-0 bg-transparent border-none p-0 ${cursorClass}"
                    onclick="selectCalendarDay('${iso}')" ${disabledAttr} aria-label="View ${iso}" ${tooltipText ? `data-tippy-content="${tooltipText}"` : ''}>
                <div class="h-3 flex items-center justify-center">
                    ${isExerciseWeekStart ? `<i class="fa-solid fa-flag text-violet-400 text-base leading-none" data-tippy-content="Week ${exerciseWeek} of your exercise program started this day"></i>` : ''}
                </div>
                <span class="text-sm text-text-secondary font-medium max-md:text-xs">${labels[i]}</span>
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-base font-semibold transition-colors ${dayBoxClass} max-lg:w-8 max-lg:h-8 max-lg:text-sm max-md:w-8 max-md:h-8 max-md:text-sm">${d.getDate()}</div>
                <div class="h-2 flex items-center">${hasActivity ? '<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>' : ''}</div>
            </button>
        `;
    }

    const chevronClass = 'shrink-0 self-center w-8 h-8 rounded-full flex items-center justify-center bg-transparent border-none text-text-secondary cursor-pointer transition-colors hover:bg-[#f1f5f9] hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary max-md:w-6 max-md:h-6';

    container.innerHTML = `
        <button class="${chevronClass}" onclick="navigateCalendarWeek(-1)" ${!canGoBack ? 'disabled' : ''} aria-label="Previous week">
            <i class="fa-solid fa-chevron-left"></i>
        </button>
        ${daysHTML}
        <button class="${chevronClass}" onclick="navigateCalendarWeek(1)" ${!canGoForward ? 'disabled' : ''} aria-label="Next week">
            <i class="fa-solid fa-chevron-right"></i>
        </button>
    `;

    // Attach Tippy tooltips
    if (typeof tippy === 'function') {
        tippy('[data-tippy-content]', {
            theme: 'material',
            placement: 'top',
            animation: 'shift-away',
        });
    }
}

// Returns true if there's at least one logged session in a week earlier than the given week start.
function _canNavigatePreviousWeek(currentViewedStart) {
    if (!currentUser?.created_at) return false;

    const accountCreatedISO = new Date(currentUser.created_at.split('T')[0] + 'T00:00:00');

    // Find the start of the week containing the account creating session
    const accountCreatedWeekStart = new Date(accountCreatedISO);
    accountCreatedWeekStart.setHours(0, 0, 0, 0);
    const day = accountCreatedWeekStart.getDay();
    accountCreatedWeekStart.setDate(accountCreatedWeekStart.getDate() - day);

    return currentViewedStart.getTime() > accountCreatedWeekStart.getTime();
}

// direction: -1 = back, +1 = forward
function navigateCalendarWeek(direction) {
    if (!viewedWeekStart) viewedWeekStart = _getStartOfCurrentWeek();
    const newStart = new Date(viewedWeekStart);
    newStart.setDate(newStart.getDate() + (direction * 7));

    // Re-check bounds defensively (handles rapid clicks)
    const currentWeekStart = _getStartOfCurrentWeek();
    if (direction > 0 && newStart.getTime() > currentWeekStart.getTime()) return;
    if (direction < 0 && !_canNavigatePreviousWeek(viewedWeekStart)) return;

    viewedWeekStart = newStart;
    renderCalendarStrip();
}

function selectCalendarDay(isoDate) {
    const todayISO = _dateToISO(new Date());
    if (isoDate > todayISO) return; // future dates not selectable

    if (currentUser?.created_at && isoDate < currentUser.created_at.split('T')[0]) return;

    selectedHomeDate = isoDate === todayISO ? null : isoDate; // toggle if clicking the already selected date
    renderCalendarStrip();
    renderTodayCard(); // re-render the purple card to show stats for the selected day
}

function renderTodayCard() {
    const container = document.getElementById('home-today-card');
    if (!container) return;

    const todayISO = _dateToISO(new Date());
    const targetISO = selectedHomeDate || todayISO;
    const isToday = targetISO === todayISO;
    const accountCreatedISO = currentUser.created_at.split('T')[0];
    const isAccountCreationDay = accountCreatedISO && targetISO === accountCreatedISO;

    const target = new Date(targetISO + 'T00:00:00');
    const dayName = target.toLocaleDateString('en-US', { weekday: 'long' });
    const month = target.toLocaleDateString('en-US', { month: 'long' });
    const date = target.getDate();
    const count = _countCompletedExercisesForDate(targetISO);

    const headerLabel = isToday
        ? `Today, ${dayName} ${month} ${date}`
        : `${dayName}, ${month} ${date}`;

    // Show log-past-workout button only for past dates within manual entry window
    const showLogButton = !isToday && _isDateEligibleForManualEntry(targetISO);

    let bottomContent;
    if (count === 0 && !isToday) {
        // Past day with no activity — show invitation to log
        bottomContent = `
            <p class="text-base opacity-90 mb-4">No workout logged this day.</p>
            ${showLogButton ? `
                <button onclick="openManualEntryModal('${targetISO}')" class="mt-4 py-2 px-4 bg-white text-brand-dark rounded-md text-sm font-medium border-none cursor-pointer transition-all hover:-translate-y-px">
                    <i class="fa-solid fa-plus"></i> Log Past Workout
                </button>` : ''}
        `;
    } else {
        // Today (any count) or past day with activity
        bottomContent = `
            <div class="flex flex-col">
                <p class="text-[3.5rem] font-bold leading-none mb-1">${count}</p>
                <p class="text-base opacity-90"><i class="fa-solid fa-dumbbell fa-rotate-by mr-1" style="--fa-rotate-angle: 135deg;"></i> Exercises Completed</p>
            </div>
            ${showLogButton ? `
                <button onclick="openManualEntryModal('${targetISO}')" class="mt-4 py-2 px-4 bg-white text-brand-dark rounded-md text-sm font-medium border-none cursor-pointer transition-all hover:-translate-y-px">
                    <i class="fa-solid fa-pen-to-square"></i> Edit This Workout
                </button>` : ''}
            ${isToday ? `
                <button onclick="showExercises()" class="mt-4 py-2 px-4 bg-white text-brand-dark rounded-md text-sm font-medium border-none cursor-pointer transition-all hover:-translate-y-px">
                    ${count > 0 ? 'Continue' : 'Start'} Today's Workout
                </button>` : ''}
        `;
    }

    const accountNote = isAccountCreationDay ? `<p class="text-base opacity-90 mb-2">This is the day you created your account.</p>` : '';

    container.innerHTML = `
        <p class="text-lg font-semibold mb-6">${headerLabel}</p>
        ${accountNote}
        ${bottomContent}
    `;
}

// Counts completed exercises for an arbitrary date
function _countCompletedExercisesForDate(iso) {
    const dayProgress = completionHistory?.[iso];
    if (!dayProgress) return 0;
    let count = 0;
    for (const playlistId of Object.keys(dayProgress)) {
        const pp = dayProgress[playlistId];
        for (const videoId of Object.keys(pp)) {
            const vp = pp[videoId];
            if (vp && typeof vp === 'object' && !Array.isArray(vp)) {
                if (Object.keys(vp).some(k => k.startsWith('set') && vp[k]?.completed)) count++;
            } else if (typeof vp === 'number' && vp > 0) {
                count++;
            }
        }
    }
    return count;
}

// ---------- Education home card ----------
function renderEducationHomeCard() {
    const container = document.getElementById('home-education-card');
    if (!container) return;

    const resumeLesson = hasEducationProgress() ? getEducationResumeLesson() : null;
    const stats = resumeLesson ? getEducationStats() : null;
    const allDone = stats && stats.completed === stats.total;

    let headingHTML;
    let buttonLabel;

    if (!resumeLesson) {
        // First-time user — no progress yet
        headingHTML = `
            <h3 class="text-xl font-semibold text-text-primary mb-4">Hands Up: Bone Health Program for Osteoporosis</h3>
            <p class="text-base text-text-tertiary mb-6 leading-relaxed">Learn how to maintain your bone health through safe movement, falls prevention, medication management, and lifestyle strategies.</p>
        `;
        buttonLabel = 'Start Program';
    } else if (allDone) {
        // All lessons complete — bookmark line would be misleading
        headingHTML = `
            <h3 class="text-xl font-semibold text-text-primary mb-2">Hands Up: Bone Health Program for Osteoporosis</h3>
            <p class="text-sm text-text-secondary mb-4">
                <i class="fa-solid fa-circle-check text-green-600 mr-1.5"></i>You've completed all ${stats.total} lessons. Feel free to revisit anytime.
            </p>
        `;
        buttonLabel = 'Revisit Program';
    } else {
        // In progress — show bookmark + stats
        headingHTML = `
            <h3 class="text-xl font-semibold text-text-primary mb-2">Hands Up: Bone Health Program for Osteoporosis</h3>
            <p class="text-sm text-text-secondary mb-1">
                <i class="fa-regular fa-bookmark mr-1.5"></i>Last time you left off on:
                <strong class="text-text-secondary text-blue-600">${resumeLesson.module} — ${resumeLesson.title}</strong>
            </p>
            <p class="text-sm text-text-secondary mb-4">
                <i class="fa-regular fa-circle-check mr-1.5"></i>${stats.completed} of ${stats.total} lessons completed
            </p>
        `;
        buttonLabel = 'Resume Program';
    }

    container.innerHTML = `
        <div class="bg-white rounded-xl p-8 flex items-center gap-8 max-md:flex-col max-md:p-6">
            <div class="flex-1">
                ${headingHTML}
                <button onclick="showEducation()" class="py-3 px-8 bg-blue-900 hover:bg-blue-950 text-white rounded-lg text-base font-semibold border-none cursor-pointer transition-colors">${buttonLabel}</button>
            </div>
            <div class="shrink-0">
                <img src="/assets/img/elearning-laptop.png" alt="E-learning module" class="w-[280px] max-md:w-full h-auto">
            </div>
        </div>
    `;
}

console.log('App module loaded');