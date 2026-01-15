// Progress module - handles My Progress view functionality

// Calendar state
let currentCalendarDate = new Date();

// ==================== Show My Progress View ====================
function showMyProgress() {
    if (!currentUser) {
        showAuthPage();
        return;
    }

    // Hide other views
    const homeView = document.getElementById('home-view');
    const playlistView = document.getElementById('playlist-view');
    const authView = document.getElementById('auth-view');
    const progressView = document.getElementById('progress-view');
    
    if (homeView) homeView.classList.add('hidden');
    if (playlistView) playlistView.classList.add('hidden');
    if (authView) authView.classList.add('hidden');
    if (progressView) progressView.classList.remove('hidden');

    // Update nav link active states
    updateNavActiveState('progress');

    // Show navbar
    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.remove('hidden');

    // Load all progress data
    loadProgressStats();
    loadStreakData();
    renderCalendar();
    loadRecentActivity();
}

// ==================== Summary Stats ====================
function loadProgressStats() {
    // Total workout days
    const totalDays = completionHistory ? Object.keys(completionHistory).length : 0;
    const totalDaysEl = document.getElementById('total-workout-days');
    if (totalDaysEl) totalDaysEl.textContent = totalDays;

    // Current week
    const currentWeek = calculateUserWeek();
    const currentWeekEl = document.getElementById('current-week-stat');
    if (currentWeekEl) currentWeekEl.textContent = currentWeek;
}

// ==================== Streak Calculation ====================
function loadStreakData() {
    const streaks = calculateStreaks();
    
    const currentStreakEl = document.getElementById('current-streak');
    const longestStreakEl = document.getElementById('longest-streak');
    
    if (currentStreakEl) currentStreakEl.textContent = streaks.current;
    if (longestStreakEl) longestStreakEl.textContent = streaks.longest;
}

function calculateStreaks() {
    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        return { current: 0, longest: 0 };
    }

    // Get sorted dates
    const dates = Object.keys(completionHistory).sort();
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;

    // Calculate longest streak
    for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1] + 'T00:00:00');
        const currDate = new Date(dates[i] + 'T00:00:00');
        const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            tempStreak++;
        } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Calculate current streak (counting back from today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const sortedDatesDesc = [...dates].sort().reverse();
    
    for (let i = 0; i < sortedDatesDesc.length; i++) {
        const workoutDate = new Date(sortedDatesDesc[i] + 'T00:00:00');
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - i);
        expectedDate.setHours(0, 0, 0, 0);

        // Allow for today or yesterday to start the streak
        if (i === 0) {
            const diffFromToday = Math.round((today - workoutDate) / (1000 * 60 * 60 * 24));
            if (diffFromToday > 1) {
                // Last workout was more than 1 day ago, no current streak
                currentStreak = 0;
                break;
            }
        }

        if (workoutDate.getTime() === expectedDate.getTime()) {
            currentStreak++;
        } else if (i === 0 && Math.round((today - workoutDate) / (1000 * 60 * 60 * 24)) === 1) {
            // Yesterday counts as starting point
            currentStreak++;
        } else {
            break;
        }
    }

    return { current: currentStreak, longest: longestStreak };
}

// ==================== Activity Calendar ====================
function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const monthYearEl = document.getElementById('calendar-month-year');
    
    if (!calendarDays || !monthYearEl) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // Update month/year display
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    monthYearEl.textContent = `${monthNames[month]} ${year}`;

    // Get first day of month and total days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Get today's date for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get workout dates for this month
    const workoutDates = getWorkoutDatesForMonth(year, month);

    // Build calendar HTML
    let calendarHTML = '';

    // Empty cells for days before first of month
    for (let i = 0; i < firstDay; i++) {
        calendarHTML += '<div class="calendar-day empty"></div>';
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const currentDate = new Date(year, month, day);
        currentDate.setHours(0, 0, 0, 0);

        let classes = 'calendar-day';
        
        // Check if this day has a workout
        if (workoutDates.includes(dateStr)) {
            classes += ' has-workout';
        }

        // Check if this is today
        if (currentDate.getTime() === today.getTime()) {
            classes += ' today';
        }

        // Check if this is in the future
        if (currentDate > today) {
            classes += ' future';
        }

        calendarHTML += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
    }

    calendarDays.innerHTML = calendarHTML;
}

function getWorkoutDatesForMonth(year, month) {
    if (!completionHistory) return [];

    const dates = [];
    const monthStr = String(month + 1).padStart(2, '0');
    const yearStr = String(year);

    Object.keys(completionHistory).forEach(dateStr => {
        if (dateStr.startsWith(`${yearStr}-${monthStr}`)) {
            dates.push(dateStr);
        }
    });

    return dates;
}

function previousMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar();
}

function nextMonth() {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar();
}

// ==================== Recent Activity Feed ====================
function loadRecentActivity() {
    const activityFeed = document.getElementById('activity-feed');
    if (!activityFeed) return;

    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        activityFeed.innerHTML = `
            <div class="activity-empty">
                <i class="fa-solid fa-dumbbell"></i>
                <p>No workout activity yet. Start your first workout to see your progress here!</p>
            </div>
        `;
        return;
    }

    // Get last 7 sessions, sorted by date descending
    const sortedDates = Object.keys(completionHistory).sort().reverse().slice(0, 7);

    let activityHTML = '';

    sortedDates.forEach(dateStr => {
        const progress = completionHistory[dateStr];
        const formattedDate = formatActivityDate(dateStr);
        
        // Calculate stats for this session
        const sessionStats = calculateSessionStats(progress);

        activityHTML += `
            <div class="activity-item">
                <div class="activity-date">
                    <i class="fa-solid fa-calendar-day"></i>
                    <span>${formattedDate}</span>
                </div>
                <div class="activity-details">
                    ${sessionStats.map(stat => `
                        <div class="activity-stat">
                            <span class="activity-playlist">${stat.playlistName}</span>
                            <span class="activity-count">${stat.exercisesCompleted}/${stat.totalExercises} exercises</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    activityFeed.innerHTML = activityHTML;
}

function formatActivityDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(date);
    dateOnly.setHours(0, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) {
        return 'Today';
    } else if (dateOnly.getTime() === yesterday.getTime()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { 
            weekday: 'short',
            month: 'short', 
            day: 'numeric' 
        });
    }
}

function calculateSessionStats(progress) {
    const stats = [];

    Object.keys(progress).forEach(playlistId => {
        const playlist = PLAYLISTS.find(p => p.id === playlistId);
        if (!playlist) return;

        const playlistProgress = progress[playlistId];
        let exercisesCompleted = 0;

        playlist.videos.forEach(video => {
            const videoProgress = playlistProgress[video.id];
            
            if (videoProgress) {
                if (typeof videoProgress === 'object' && !Array.isArray(videoProgress)) {
                    const hasCompletedSet = Object.keys(videoProgress).some(key => {
                        return key.startsWith('set') && videoProgress[key]?.completed === true;
                    });
                    if (hasCompletedSet) exercisesCompleted++;
                } else if (typeof videoProgress === 'number' && videoProgress > 0) {
                    exercisesCompleted++;
                }
            }
        });

        if (exercisesCompleted > 0) {
            const isAdvanced = playlistId.includes('advanced');
            stats.push({
                playlistName: isAdvanced ? 'Advanced 4-6' : 'Beginner 0-3',
                exercisesCompleted: exercisesCompleted,
                totalExercises: playlist.videos.length
            });
        }
    });

    return stats;
}

console.log('Progress module loaded');
