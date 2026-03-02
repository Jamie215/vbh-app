// ==================== Alert System ====================
// Handles contextual alerts for progress milestones, resets, and pacing
// Depends on: utility.js (completionHistory), app.js (calculateUserWeek, getProgramWeekState, calculateCalendarWeek)

// Track if progress was reset (detected via inactivity)
let wasProgressReset = false;
let previousWeekBeforeReset = null;

/**
 * Detects if user's progress was reset due to inactivity (14+ days).
 * Uses getProgramWeekState() which already computes the reset internally.
 */
function detectProgressReset() {
    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        return { wasReset: false };
    }

    const dates = Object.keys(completionHistory).sort();
    if (dates.length === 0) return { wasReset: false };

    const calendarWeek = calculateCalendarWeek();

    // Only relevant if calendar week would place user in 4-6 territory
    if (calendarWeek < 4) return { wasReset: false };

    const mostRecentDate = new Date(dates[dates.length - 1] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysSinceLastActivity = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24));

    // Check if inactivity triggered a reset
    if (daysSinceLastActivity >= 14) {
        return {
            wasReset: true,
            naturalWeek: calendarWeek,
            daysSinceActivity: daysSinceLastActivity
        };
    }

    return { wasReset: false };
}

/**
 * Determines which alert to show based on user's progress state.
 * Priority order:
 *   1. Progress reset (14+ days inactivity)
 *   2. Program completed (week 6 with activity)
 *   3. Pace discrepancy (calendar week ahead of program week)
 *   4. Approaching end (week 5 / week 6 milestones)
 */
function getAlertState() {
    const state = getProgramWeekState();
    const userWeek = state.programWeek;
    const resetInfo = detectProgressReset();

    // Priority 1: Progress was reset due to inactivity (weeks 4-6)
    if (resetInfo.wasReset) {
        return {
            type: 'warning',
            icon: 'fa-circle-exclamation',
            title: 'Welcome Back!',
            message: `It's been a while since your last workout. We've set you back to <strong>Week 4</strong> to help you ease back in. Pick up where you feel comfortable and keep going!`
        };
    }

    // Priority 2: Completed program (week 6 with activity)
    if (userWeek >= 6) {
        const hasWeek6Activity = checkWeek6Activity();
        if (hasWeek6Activity) {
            return {
                type: 'success',
                icon: 'fa-trophy',
                title: 'Congratulations!',
                message: `You've completed the 6-week program! 🎉 You're welcome to continue repeating the <strong>Advanced Weeks 4-6</strong> exercises at your own pace, for as long as they feel helpful and supportive of your goals.`
            };
        }
    }

    // Priority 3: Pace discrepancy — calendar week is ahead of program week
    const calendarWeek = state.calendarWeek;
    if (calendarWeek > userWeek && userWeek >= 4 && userWeek < 6) {
        const sessionsNeeded = 2 - state.sessionsInCurrentWeek;
        let actionText;

        if (sessionsNeeded === 2) {
            actionText = `Log 2 workout sessions this week to progress to <strong>Week ${userWeek + 1}</strong>.`;
        } else if (sessionsNeeded === 1) {
            actionText = `You're 1 session away from unlocking <strong>Week ${userWeek + 1}</strong> — keep it up!`;
        } else {
            actionText = `You've met the requirement — <strong>Week ${userWeek + 1}</strong> will unlock soon!`;
        }

        return {
            type: 'info',
            icon: 'fa-person-running',
            title: 'One More Session Remaining!',
            message: `${actionText} Aim for 2 sessions per week to keep pace. 💪`
        };
    }

    // Priority 4: Approaching end (weeks 5-6)
    if (userWeek === 5) {
        return {
            type: 'info',
            icon: 'fa-flag-checkered',
            title: 'Almost There!',
            message: `You're on <strong>Week 5</strong> — just one more week until you complete the program! Keep up the great work.`
        };
    }

    if (userWeek === 6) {
        return {
            type: 'info',
            icon: 'fa-flag-checkered',
            title: 'Final Week!',
            message: `You're on <strong>Week 6</strong> — the final week of the program! Finish strong and celebrate your progress.`
        };
    }

    // No alert needed
    return null;
}

/**
 * Checks if user has logged any advanced activity while in program week 6.
 * Uses getProgramWeekState() to determine when week 6 started (the window anchor).
 */
function checkWeek6Activity() {
    const state = getProgramWeekState();

    // Must be in program week 6 to have week 6 activity
    if (state.programWeek < 6) return false;

    return state.sessionsInCurrentWeek > 0;
}

/**
 * Renders the alert element in the DOM
 */
function renderProgressAlert() {
    const alertContainer = document.getElementById('progress-alert-container');
    if (!alertContainer) return;

    const alertState = getAlertState();

    if (!alertState) {
        alertContainer.innerHTML = '';
        alertContainer.classList.add('hidden');
        return;
    }

    // Check if user dismissed this alert type in this session
    const dismissedAlerts = sessionStorage.getItem('dismissedAlerts');
    if (dismissedAlerts) {
        const dismissed = JSON.parse(dismissedAlerts);
        if (dismissed.includes(alertState.type + '-' + alertState.title)) {
            alertContainer.innerHTML = '';
            alertContainer.classList.add('hidden');
            return;
        }
    }

    alertContainer.classList.remove('hidden');
    alertContainer.innerHTML = `
        <div class="progress-alert alert-${alertState.type}">
            <div class="alert-icon">
                <i class="fa-solid ${alertState.icon}"></i>
            </div>
            <div class="alert-content">
                <h4 class="alert-title">${alertState.title}</h4>
                <p class="alert-message">${alertState.message}</p>
            </div>
            <button class="alert-dismiss" onclick="dismissAlert('${alertState.type}', '${alertState.title}')" aria-label="Dismiss alert">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>
    `;
}

/**
 * Dismisses an alert for the current session
 */
function dismissAlert(type, title) {
    const key = type + '-' + title;
    let dismissed = [];
    
    const stored = sessionStorage.getItem('dismissedAlerts');
    if (stored) {
        dismissed = JSON.parse(stored);
    }
    
    if (!dismissed.includes(key)) {
        dismissed.push(key);
    }
    
    sessionStorage.setItem('dismissedAlerts', JSON.stringify(dismissed));
    
    // Animate out and remove
    const alertContainer = document.getElementById('progress-alert-container');
    if (alertContainer) {
        const alert = alertContainer.querySelector('.progress-alert');
        if (alert) {
            alert.classList.add('dismissing');
            setTimeout(() => {
                alertContainer.innerHTML = '';
                alertContainer.classList.add('hidden');
            }, 300);
        }
    }
}

console.log('Alerts module loaded');