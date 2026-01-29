// Progress module - handles My Progress view functionality

// Chart instance for cleanup
let workoutHistoryChart = null;

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
    renderWorkoutHistoryChart();
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

// ==================== Weekly Streak Calculation ====================
function loadStreakData() {
    const streaks = calculateWeeklyStreaks();
    
    const currentStreakEl = document.getElementById('current-streak');
    const longestStreakEl = document.getElementById('longest-streak');
    
    if (currentStreakEl) currentStreakEl.textContent = streaks.current;
    if (longestStreakEl) longestStreakEl.textContent = streaks.longest;
}

function getWeekNumber(date) {
    // Get the week number (ISO week) for a given date
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

function calculateWeeklyStreaks() {
    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        return { current: 0, longest: 0 };
    }

    // Get all workout dates and convert to week identifiers
    const dates = Object.keys(completionHistory).sort();
    const weeksWithWorkouts = new Set();
    
    dates.forEach(dateStr => {
        const weekId = getWeekNumber(new Date(dateStr + 'T00:00:00'));
        weeksWithWorkouts.add(weekId);
    });

    // Convert to sorted array of weeks
    const sortedWeeks = Array.from(weeksWithWorkouts).sort();
    
    if (sortedWeeks.length === 0) {
        return { current: 0, longest: 0 };
    }

    // Calculate longest streak
    let longestStreak = 1;
    let tempStreak = 1;

    for (let i = 1; i < sortedWeeks.length; i++) {
        if (areConsecutiveWeeks(sortedWeeks[i - 1], sortedWeeks[i])) {
            tempStreak++;
        } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    // Calculate current streak (from current week going backwards)
    const currentWeekId = getWeekNumber(new Date());
    const lastWeekId = getWeekNumber(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    
    let currentStreak = 0;
    
    // Check if current week or last week has a workout (to start the streak)
    const hasCurrentWeek = weeksWithWorkouts.has(currentWeekId);
    const hasLastWeek = weeksWithWorkouts.has(lastWeekId);
    
    if (!hasCurrentWeek && !hasLastWeek) {
        // No workout this week or last week - streak is broken
        currentStreak = 0;
    } else {
        // Count backwards from the most recent active week
        const startWeek = hasCurrentWeek ? currentWeekId : lastWeekId;
        let checkWeek = startWeek;
        
        while (weeksWithWorkouts.has(checkWeek)) {
            currentStreak++;
            checkWeek = getPreviousWeek(checkWeek);
        }
    }

    return { current: currentStreak, longest: longestStreak };
}

function areConsecutiveWeeks(week1, week2) {
    // Parse week strings like "2025-W03"
    const [year1, w1] = week1.split('-W').map((v, i) => i === 0 ? parseInt(v) : parseInt(v));
    const [year2, w2] = week2.split('-W').map((v, i) => i === 0 ? parseInt(v) : parseInt(v));
    
    // Same year, consecutive weeks
    if (year1 === year2 && w2 === w1 + 1) return true;
    
    // Year transition: last week of year1 to first week of year2
    if (year2 === year1 + 1 && w1 >= 52 && w2 === 1) return true;
    
    return false;
}

function getPreviousWeek(weekId) {
    const [year, week] = weekId.split('-W').map((v, i) => i === 0 ? parseInt(v) : parseInt(v));
    
    if (week === 1) {
        // Go to last week of previous year (52 or 53)
        return `${year - 1}-W52`;
    }
    return `${year}-W${(week - 1).toString().padStart(2, '0')}`;
}

// ==================== Workout History Stacked Bar Chart ====================
function renderWorkoutHistoryChart() {
    const canvas = document.getElementById('workout-history-chart');
    if (!canvas) return;

    // Destroy existing chart
    if (workoutHistoryChart) {
        workoutHistoryChart.destroy();
        workoutHistoryChart = null;
    }

    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        // Show empty state
        const container = canvas.parentElement;
        container.innerHTML = `
            <div class="chart-empty">
                <i class="fa-solid fa-chart-bar"></i>
                <p>No workout data yet. Complete some exercises to see your progress chart!</p>
            </div>
        `;
        return;
    }

    // Get sorted dates (last 14 sessions max for readability)
    const sortedDates = Object.keys(completionHistory).sort().slice(-14);
    
    // Build a map of all unique videos across all sessions
    const allVideos = new Map(); // videoId -> { title, playlistId }
    
    sortedDates.forEach(dateStr => {
        const dayProgress = completionHistory[dateStr];
        Object.keys(dayProgress).forEach(playlistId => {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist) return;
            
            Object.keys(dayProgress[playlistId]).forEach(videoId => {
                if (!allVideos.has(videoId)) {
                    const video = playlist.videos.find(v => v.id === videoId);
                    if (video) {
                        allVideos.set(videoId, { 
                            title: video.title, 
                            playlistId: playlistId 
                        });
                    }
                }
            });
        });
    });

    // Generate colors for each video
    const colorPalette = [
        '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444',
        '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'
    ];

    // Build datasets for each video
    const datasets = [];
    let colorIndex = 0;
    
    // Store detailed data for tooltips
    const detailedData = {};
    sortedDates.forEach(dateStr => {
        detailedData[dateStr] = {};
    });

    allVideos.forEach((videoInfo, videoId) => {
        const data = sortedDates.map(dateStr => {
            const dayProgress = completionHistory[dateStr];
            let completedSets = 0;
            let repsData = [];
            
            // Check each playlist for this video
            Object.keys(dayProgress).forEach(playlistId => {
                const videoProgress = dayProgress[playlistId]?.[videoId];
                if (videoProgress && typeof videoProgress === 'object') {
                    Object.keys(videoProgress).forEach(setKey => {
                        if (setKey.startsWith('set') && videoProgress[setKey]?.completed) {
                            completedSets++;
                            repsData.push({
                                set: setKey.replace('set', 'Set '),
                                reps: videoProgress[setKey].reps || 0
                            });
                        }
                    });
                }
            });
            
            // Store detailed info for tooltip
            if (completedSets > 0) {
                detailedData[dateStr][videoId] = {
                    title: videoInfo.title,
                    sets: completedSets,
                    repsData: repsData
                };
            }
            
            return completedSets;
        });

        const color = colorPalette[colorIndex % colorPalette.length];
        colorIndex++;

        datasets.push({
            label: videoInfo.title,
            data: data,
            backgroundColor: color,
            borderColor: color,
            borderWidth: 1,
            videoId: videoId
        });
    });

    // Format date labels
    const labels = sortedDates.map(dateStr => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Create the chart
    const ctx = canvas.getContext('2d');
    workoutHistoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        display: false
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Sets Completed',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    },
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 11
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        boxWidth: 12,
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        title: function(context) {
                            const index = context[0].dataIndex;
                            return sortedDates[index];
                        },
                        label: function(context) {
                            const dateStr = sortedDates[context.dataIndex];
                            const videoId = context.dataset.videoId;
                            const detail = detailedData[dateStr]?.[videoId];
                            
                            if (!detail || detail.sets === 0) {
                                return null; // Hide if no sets
                            }
                            
                            // Build detailed label
                            const repsBreakdown = detail.repsData
                                .map(r => `${r.set}: ${r.reps} reps`)
                                .join(', ');
                            
                            return `${detail.title}: ${detail.sets} sets (${repsBreakdown})`;
                        },
                        filter: function(tooltipItem) {
                            return tooltipItem.raw > 0;
                        }
                    },
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    titleFont: {
                        size: 13,
                        weight: '600'
                    },
                    bodyFont: {
                        size: 12
                    },
                    padding: 12,
                    cornerRadius: 8
                }
            },
            interaction: {
                mode: 'index',
                intersect: false
            }
        }
    });
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

        const isAdvanced = playlistId.includes('advanced');
        stats.push({
            playlistName: isAdvanced ? 'Advanced 4-6' : 'Beginner 0-3',
            exercisesCompleted: exercisesCompleted,
            totalExercises: playlist.videos.length
        });
    });

    return stats;
}

console.log('Progress module loaded');
