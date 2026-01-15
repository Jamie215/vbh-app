// ==================== Alert System ====================
// Handles contextual alerts for progress milestones and resets
// Depends on: shared.js (completionHistory, calculateUserWeek)

// Track if progress was reset (detected via inactivity)
let wasProgressReset = false;
let previousWeekBeforeReset = null;

/**
 * Detects if user's progress was reset due to inactivity (14+ days)
 * Returns true if user was in weeks 4-6 and got reset back to week 4
 */
function detectProgressReset() {
    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        return { wasReset: false };
    }

    const dates = Object.keys(completionHistory).sort();
    if (dates.length === 0) return { wasReset: false };

    const firstDate = new Date(dates[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = today - firstDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const naturalWeek = Math.floor(diffDays / 7);

    // Only relevant if natural week would be 4-6
    if (naturalWeek < 4) return { wasReset: false };

    const mostRecentDate = new Date(dates[dates.length - 1] + 'T00:00:00');
    const daysSinceLastActivity = Math.floor((today - mostRecentDate) / (1000 * 60 * 60 * 24));

    // Check if inactivity triggered a reset
    if (daysSinceLastActivity >= 14 && naturalWeek >= 4) {
        return {
            wasReset: true,
            naturalWeek: Math.min(naturalWeek, 6),
            daysSinceActivity: daysSinceLastActivity
        };
    }

    return { wasReset: false };
}

/**
 * Determines which alert to show based on user's progress state
 * Returns: { type: string, message: string, icon: string } or null
 */
function getAlertState() {
    const userWeek = calculateUserWeek();
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

    // Priority 2: Completed program (week 6+)
    if (userWeek >= 6) {
        // Check if they've actually been active in week 6
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

    // Priority 3: Approaching end (weeks 5-6)
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
 * Checks if user has logged any activity during week 6
 */
function checkWeek6Activity() {
    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        return false;
    }

    const dates = Object.keys(completionHistory).sort();
    if (dates.length === 0) return false;

    const firstDate = new Date(dates[0] + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Week 6 starts at day 42 (6 * 7)
    const week6Start = new Date(firstDate);
    week6Start.setDate(week6Start.getDate() + 42);

    // Check if any activity dates fall within week 6 or later
    for (const dateStr of dates) {
        const activityDate = new Date(dateStr + 'T00:00:00');
        if (activityDate >= week6Start) {
            return true;
        }
    }

    return false;
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
