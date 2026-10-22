// Data layer: every sign-in, read and write the app makes goes through here.
//
// This is the DEMO version. It has one built-in account (demo-data.js) and
// keeps that account's data in memory: saving workouts, logging past days
// and eLearning progress all work, but a page reload starts again from the
// sample data. Nothing leaves the browser.
//
// To connect a real backend (e.g. an API on the study server that talks to
// REDCap), replace the bodies of these functions and keep their names and
// results. Every function resolves to { data, error }: `error` is null on
// success, or an Error whose message can be shown to the participant.

const _DEMO_SIGNED_IN_KEY = 'handsupDemoSignedIn';

let _demoStore = null;

// Builds the in-memory copy of the sample data, turning "days ago" into dates
function _getDemoStore() {
    if (_demoStore) return _demoStore;

    const dateDaysAgo = (n) => {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d;
    };

    // Noon local time, so the creation date is the same day in any time zone conversion
    const created = dateDaysAgo(DEMO_DATA.account.createdDaysAgo);
    created.setHours(12, 0, 0, 0);

    const workoutSessions = {};
    DEMO_DATA.workoutSessions.forEach(s => {
        workoutSessions[_dateToISO(dateDaysAgo(s.daysAgo))] = _copy(s.progress);
    });

    _demoStore = {
        user: {
            id: 'demo-participant',
            email: DEMO_DATA.account.email,
            created_at: created.toISOString(),
            user_metadata: { full_name: DEMO_DATA.account.fullName }
        },
        workoutSessions,
        programState: _copy(DEMO_DATA.programState),
        educationProgress: _copy(DEMO_DATA.educationProgress)
    };
    return _demoStore;
}

// Results are copies, so changes on screen never alter the store until saved
function _copy(value) {
    return value == null ? null : JSON.parse(JSON.stringify(value));
}

function _ok(data = null) {
    return Promise.resolve({ data, error: null });
}

function _fail(message) {
    return Promise.resolve({ data: null, error: new Error(message) });
}

// The sign-in flag lives in sessionStorage so a reload keeps the demo signed
// in (while the data resets). Storage can be unavailable, e.g. in some
// private windows; the demo then simply asks to sign in again.
function _setDemoSignedIn(signedIn) {
    try {
        if (signedIn) sessionStorage.setItem(_DEMO_SIGNED_IN_KEY, '1');
        else sessionStorage.removeItem(_DEMO_SIGNED_IN_KEY);
    } catch { /* storage unavailable */ }
}

function _isDemoSignedIn() {
    try {
        return sessionStorage.getItem(_DEMO_SIGNED_IN_KEY) === '1';
    } catch {
        return false;
    }
}

const DEMO_NOT_AVAILABLE = 'This isn\'t available in the demo. Sign in with the demo account shown on the Log In page.';

const Data = {
    isDemo: true,
    demoAccount: { email: DEMO_DATA.account.email, password: DEMO_DATA.account.password },

    // ---------- Accounts ----------

    // The signed-in user, or null
    getSession() {
        return _ok(_isDemoSignedIn() ? _copy(_getDemoStore().user) : null);
    },

    signIn(email, password) {
        const account = DEMO_DATA.account;
        if (email.toLowerCase() !== account.email || password !== account.password) {
            return _fail('Invalid email or password');
        }
        _setDemoSignedIn(true);
        return _ok(_copy(_getDemoStore().user));
    },

    signOut() {
        _setDemoSignedIn(false);
        return _ok();
    },

    signUp() {
        return _fail(DEMO_NOT_AVAILABLE);
    },

    requestPasswordReset() {
        return _fail(DEMO_NOT_AVAILABLE);
    },

    updatePassword() {
        return _fail(DEMO_NOT_AVAILABLE);
    },

    // { full_name }
    getProfile() {
        return _ok({ full_name: _getDemoStore().user.user_metadata.full_name });
    },

    // ---------- Workouts (one record per date) ----------

    // [{ session_date, progress }], oldest first
    loadWorkoutSessions() {
        const sessions = _getDemoStore().workoutSessions;
        return _ok(Object.keys(sessions).sort().map(date => ({
            session_date: date,
            progress: _copy(sessions[date])
        })));
    },

    // { session_date, progress } for one date, or null
    loadWorkoutSession(date) {
        const progress = _getDemoStore().workoutSessions[date];
        return _ok(progress ? { session_date: date, progress: _copy(progress) } : null);
    },

    // Creates or replaces the record for that date
    saveWorkoutSession(date, progress) {
        _getDemoStore().workoutSessions[date] = _copy(progress);
        return _ok();
    },

    deleteWorkoutSession(date) {
        delete _getDemoStore().workoutSessions[date];
        return _ok();
    },

    // ---------- Program completion ----------

    // { completed_at, completion_method }, or null if not completed
    loadProgramState() {
        return _ok(_copy(_getDemoStore().programState));
    },

    saveProgramState(completedAt, completionMethod) {
        _getDemoStore().programState = { completed_at: completedAt, completion_method: completionMethod };
        return _ok();
    },

    clearProgramState() {
        _getDemoStore().programState = null;
        return _ok();
    },

    // ---------- eLearning progress ----------

    // { progress, bookmark }, or null if the course hasn't been opened
    loadEducationProgress() {
        return _ok(_copy(_getDemoStore().educationProgress));
    },

    saveEducationProgress(progress, bookmark) {
        _getDemoStore().educationProgress = { progress: _copy(progress), bookmark };
        return _ok();
    }
};
