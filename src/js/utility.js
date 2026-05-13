// Contains all shared state and functions used across multiple modules

// ==================== Global App State ====================
let currentUser = null;
let userProfile = null;
let currentPlaylist = null;
let currentVideo = null;
let todaySession = null;
let sessionProgress = {};
let completionHistory = {};
let programCompletedAt = null;

// ==================== Shared UI Functions ====================
// Show form message (used by auth.js)
function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.className = `form-message ${isError ? 'error' : 'success'}`;
    }
}

// Clear auth form messages
function clearAuthMessages() {
    const messageIds = ['signin-message', 'signup-message', 'forgot-message', 'reset-message'];
    messageIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = '';
            el.className = 'form-message';
        }
    });
}

// ==================== Error Logging ====================
// Forensic error logging to Supabase. Designed for an unmaintained
// research app — captures enough context for a future maintainer to
// investigate, with PII scrubbing and rate limits so it can't hurt
// the user even if something goes wrong with logging itself.
//
// To review errors: open the Supabase dashboard → Table Editor →
// error_log. The service role bypasses RLS so all rows are visible.
// Join to auth.users on user_id to correlate to participants.

const ERROR_LOG_SESSION_CAP = 20;  // max errors logged per page session
let _errorLogCount = 0;

// Maps the current URL path to a view identifier for error context.
// Mirrors the mapping in navigation.js routeFromURL().
function _getCurrentView() {
    const path = window.location.pathname;
    if (path === '/') return 'home';
    if (path === '/exercises') return 'exercises';
    if (path.startsWith('/exercises/')) {
        if (path === '/exercises/how-to-use') return 'how-to-use';
        if (path === '/exercises/progress') return 'progress';
        return 'playlist';
    }
    if (path === '/education') return 'education';
    if (path === '/login' || path === '/signup' ||
        path === '/forgot-password' || path === '/reset-password') return 'auth';
    return 'unknown';
}

// Strip likely-PII patterns from a string before logging.
// Order matters: do specific (dynamic) patterns before generic regex.
function _scrubPII(text) {
    if (!text || typeof text !== 'string') return text;
    let scrubbed = text;

    // Dynamic: strip the current user's actual name and email if they
    // appear verbatim. .split().join() avoids regex-escaping issues for
    // names containing apostrophes, hyphens, periods, etc.
    if (currentUser?.email) {
        scrubbed = scrubbed.split(currentUser.email).join('[user_email]');
    }
    if (userProfile?.full_name) {
        scrubbed = scrubbed.split(userProfile.full_name).join('[user_name]');
    }

    // Generic patterns
    return scrubbed
        // Email addresses
        .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[email]')
        // Supabase recovery / access tokens in URLs
        .replace(/access_token=[^&\s]+/g, 'access_token=[redacted]')
        .replace(/refresh_token=[^&\s]+/g, 'refresh_token=[redacted]')
        // JWT-shaped strings (three base64 chunks separated by dots)
        .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[jwt]');
}

// Computes a stable fingerprint for grouping similar errors.
// First line of message + first stack frame is usually enough to
// identify "the same bug" without splitting minor variations.
function _computeFingerprint(message, stack) {
    const firstMsgLine = (message || 'unknown').split('\n')[0].slice(0, 200);
    const firstStackLine = stack
        ? (stack.split('\n').find(l => l.trim().startsWith('at ')) || '').slice(0, 200)
        : '';
    return `${firstMsgLine}::${firstStackLine}`;
}

/**
 * Log an error to Supabase for forensic review.
 *
 * Always also logs to console.error so live debugging works.
 * Silently swallows logging failures — we never want to break the
 * app because we couldn't log a bug.
 *
 * @param {Error|string} error - the error caught
 * @param {object} [extraContext] - optional ad-hoc context to merge
 *   into app_context for this specific call site (e.g. operation
 *   name, IDs, parameters relevant to the failure)
 */
async function logError(error, extraContext) {
    // Always log to console first — independent of DB success
    console.error(error);

    // Rate limit per session to protect the DB and free-tier limits
    if (_errorLogCount >= ERROR_LOG_SESSION_CAP) return;
    _errorLogCount++;

    try {
        const message = _scrubPII(
            error instanceof Error ? error.message : String(error)
        );
        const stack = error instanceof Error ? _scrubPII(error.stack || '') : null;
        const fingerprint = _computeFingerprint(message, stack);

        const appContext = { view: _getCurrentView() };
        if (extraContext && typeof extraContext === 'object') {
            Object.assign(appContext, extraContext);
        }

        // Fire-and-forget: don't await, don't block the caller.
        // The .then catches insert errors silently.
        window.supabaseClient
            .from('error_log')
            .insert({
                user_id: currentUser?.id ?? null,
                message: message.slice(0, 2000),
                stack: stack ? stack.slice(0, 5000) : null,
                fingerprint: fingerprint.slice(0, 500),
                url_path: window.location.pathname,
                user_agent: navigator.userAgent?.slice(0, 500) ?? null,
                app_context: appContext
            })
            .then(({ error: insertError }) => {
                if (insertError) {
                    console.warn('logError: insert failed', insertError);
                }
            });
    } catch (e) {
        // Anything thrown synchronously (supabaseClient missing, etc.)
        // gets swallowed. console.error already ran above.
        console.warn('logError: exception during logging', e);
    }
}

// ==================== Global Error Listeners ====================
// Catch errors that escape try/catch blocks so we get visibility
// into bugs we didn't anticipate. Wrapped in try/catch so the
// listener itself can never become a source of new errors.

window.addEventListener('error', (event) => {
    try {
        const err = event.error || new Error(event.message || 'Unknown error');
        logError(err, {
            source: 'window.error',
            filename: event.filename,
            lineno: event.lineno,
            colno: event.colno
        });
    } catch (e) {
        console.warn('window.error listener failed', e);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    try {
        const reason = event.reason;
        const err = reason instanceof Error
            ? reason
            : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason));
        logError(err, { source: 'unhandled_promise' });
    } catch (e) {
        console.warn('unhandledrejection listener failed', e);
    }
});

// ==================== Data Loading Functions ====================
async function loadCompletionHistory() {
    if (!currentUser) return;
    
    try {
        const { data, error } = await window.supabaseClient
            .from('workout_sessions')
            .select('session_date, progress')
            .eq('user_id', currentUser.id)
            .order('session_date', { ascending: true });

        if (error) {
            logError(error, { operation: 'load_completion_history' });
            return;
        }

        completionHistory = {};
        data?.forEach(session => {
            if (!completionHistory[session.session_date]) {
                completionHistory[session.session_date] = session.progress;
            }
        });
    } catch (error) {
        logError(error, { operation: 'load_completion_history' });
    }   
}

async function loadProgramState() {
    if (!currentUser) return;

    try {
        const { data, error } = await window.supabaseClient
            .from('user_program_state')
            .select('completed_at')
            .eq('user_id', currentUser.id)
            .maybeSingle();

        if (error) {
            logError(error, { operation: 'load_program_state' });
            return;
        }

        programCompletedAt = data?.completed_at ?? null;
    } catch (error) {
        logError(error, { operation: 'load_program_state' });
    }
}

async function loadTodaySession() {
    if (!currentUser) return;

    try {
        const today = new Date().toISOString().split('T')[0];
        const { data, error } = await window.supabaseClient
            .from('workout_sessions')
            .select('*')
            .eq('user_id', currentUser.id)
            .eq('session_date', today)
            .order('updated_at', { ascending: false })
            .maybeSingle();

        if (error) {
            logError(error, { operation: 'load_today_session' });
            return;
        }

        todaySession = data;

        if (data?.progress) {
            Object.keys(data.progress).forEach(playlistId => {
                if (!sessionProgress[playlistId]) {
                    sessionProgress[playlistId] = {};
                }
                Object.keys(data.progress[playlistId]).forEach(videoId => {
                    sessionProgress[playlistId][videoId] = data.progress[playlistId][videoId] || 0;
                });
            });
        }
    } catch (error) {
        logError(error, { operation: 'load_today_session' });
    }   
}

/**
 * True if a set has a "completion-related" change vs its original state.
 *   - Completion status flipped
 *   - OR set is currently completed AND reps/seconds differ
 *
 * Used by both the live-session save flow and the manual-entry flow to
 * decide whether the Save button should be enabled.
 */
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

/**
 * Parallel of _setHasMeaningfulChange for external activities.
 * True if completion flipped, OR currently completed and minutes differ.
 */
function _externalHasMeaningfulChange(originalActivity, currentActivity) {
    const orig = originalActivity || {};
    const curr = currentActivity || {};

    if ((orig.completed ?? false) !== (curr.completed ?? false)) return true;

    if (curr.completed) {
        if ((orig.minutes ?? 0) !== (curr.minutes ?? 0)) return true;
    }

    return false;
}

// ==================== UI Update Functions ====================
async function updateUIForAuthenticatedUser(user) {
    const signoutBtn = document.getElementById('signout-button');
    if (signoutBtn) signoutBtn.classList.remove('hidden');
    
    let profile = null;
    
    try {
        const { data, error } = await window.supabaseClient
            .rpc('get_my_profile');
        
        if (error) {
            logError(error, { operation: 'fetch_profile' });
        } else {
            profile = data?.[0] || null;
        }
    } catch (error) {
        logError(error, { operation: 'fetch_profile' });
    }

    userProfile = profile;

    const userInfo = document.getElementById('user-info');
    if (userInfo) {
        userInfo.classList.remove('hidden');
        
        // Use profile name, user metadata, or email as fallback
        const fullName = profile?.full_name || user.user_metadata?.full_name || user.email || 'User';
        const firstName = fullName.split(' ')[0];
        
        const nameDisplay = document.getElementById('user-name-display');
        const initialDisplay = document.getElementById('user-initial');
        
        if (nameDisplay) nameDisplay.textContent = firstName;
        if (initialDisplay) initialDisplay.textContent = firstName.charAt(0).toUpperCase();
    }
}

function updateUIForGuestUser() {
    const signoutBtn = document.getElementById('signout-button');
    if (signoutBtn) signoutBtn.classList.add('hidden');
    
    const userInfo = document.getElementById('user-info');
    if (userInfo) userInfo.classList.add('hidden');
}

// ==================== State Reset ====================
function resetAppState() {
    currentUser = null;
    userProfile = null;
    todaySession = null;
    sessionProgress = {};
    completionHistory = {};
    currentPlaylist = null;
    programCompletedAt = null;
}

console.log('Shared utilities loaded');