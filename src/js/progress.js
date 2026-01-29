// Progress module - handles My Progress view functionality

// Chart instances for cleanup
let workoutHistoryChart = null;
let detailBreakdownChart = null;

// State for detail panel
let selectedDate = null;
let currentDetailView = 'day'; // 'day' or 'alltime'

// Store processed data for click handlers
let chartData = {
    sortedDates: [],
    dateLabels: [],
    detailedData: {}
};

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

    // Reset detail panel state
    selectedDate = null;
    currentDetailView = 'day';

    // Load all progress data
    loadProgressStats();
    loadStreakData();
    renderWorkoutHistoryChart();
    renderDetailPanel();
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

    const dates = Object.keys(completionHistory).sort();
    const weeksWithWorkouts = new Set();
    
    dates.forEach(dateStr => {
        const weekId = getWeekNumber(new Date(dateStr + 'T00:00:00'));
        weeksWithWorkouts.add(weekId);
    });

    const sortedWeeks = Array.from(weeksWithWorkouts).sort();
    
    if (sortedWeeks.length === 0) {
        return { current: 0, longest: 0 };
    }

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

    const currentWeekId = getWeekNumber(new Date());
    const lastWeekId = getWeekNumber(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    
    let currentStreak = 0;
    
    const hasCurrentWeek = weeksWithWorkouts.has(currentWeekId);
    const hasLastWeek = weeksWithWorkouts.has(lastWeekId);
    
    if (!hasCurrentWeek && !hasLastWeek) {
        currentStreak = 0;
    } else {
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
    const [year1, w1] = week1.split('-W').map((v, i) => i === 0 ? parseInt(v) : parseInt(v));
    const [year2, w2] = week2.split('-W').map((v, i) => i === 0 ? parseInt(v) : parseInt(v));
    
    if (year1 === year2 && w2 === w1 + 1) return true;
    if (year2 === year1 + 1 && w1 >= 52 && w2 === 1) return true;
    
    return false;
}

function getPreviousWeek(weekId) {
    const [year, week] = weekId.split('-W').map((v, i) => i === 0 ? parseInt(v) : parseInt(v));
    
    if (week === 1) {
        return `${year - 1}-W52`;
    }
    return `${year}-W${(week - 1).toString().padStart(2, '0')}`;
}

// ==================== Workout History Chart (Aggregated by Playlist) ====================
function renderWorkoutHistoryChart() {
    const canvas = document.getElementById('workout-history-chart');
    if (!canvas) return;

    // Destroy existing chart
    if (workoutHistoryChart) {
        workoutHistoryChart.destroy();
        workoutHistoryChart = null;
    }

    const chartContainer = document.getElementById('history-chart-container');
    
    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        if (chartContainer) {
            chartContainer.innerHTML = `
                <canvas id="workout-history-chart"></canvas>
                <div class="chart-empty">
                    <i class="fa-solid fa-chart-bar"></i>
                    <p>No workout data yet. Complete some exercises to see your progress chart!</p>
                </div>
            `;
        }
        return;
    }

    // Get sorted dates (last 14 sessions max for readability)
    const sortedDates = Object.keys(completionHistory).sort().slice(-14);
    chartData.sortedDates = sortedDates;
    
    // Process data - aggregate by playlist
    const beginnerData = [];
    const advancedData = [];
    chartData.detailedData = {};

    sortedDates.forEach(dateStr => {
        const dayProgress = completionHistory[dateStr];
        let beginnerSets = 0;
        let advancedSets = 0;
        
        // Store detailed breakdown for this date
        chartData.detailedData[dateStr] = {
            beginner: { exercises: [], totalSets: 0 },
            advanced: { exercises: [], totalSets: 0 }
        };

        Object.keys(dayProgress).forEach(playlistId => {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist) return;
            
            const isAdvanced = playlistId.includes('advanced');
            const targetData = isAdvanced ? chartData.detailedData[dateStr].advanced : chartData.detailedData[dateStr].beginner;

            Object.keys(dayProgress[playlistId]).forEach(videoId => {
                const video = playlist.videos.find(v => v.id === videoId);
                if (!video) return;

                const videoProgress = dayProgress[playlistId][videoId];
                let completedSets = 0;
                let repsData = [];

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

                if (completedSets > 0) {
                    if (isAdvanced) {
                        advancedSets += completedSets;
                    } else {
                        beginnerSets += completedSets;
                    }

                    targetData.exercises.push({
                        title: video.title,
                        sets: completedSets,
                        repsData: repsData
                    });
                    targetData.totalSets += completedSets;
                }
            });
        });

        beginnerData.push(beginnerSets);
        advancedData.push(advancedSets);
    });

    // Format date labels
    chartData.dateLabels = sortedDates.map(dateStr => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Create the chart
    const ctx = canvas.getContext('2d');
    workoutHistoryChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.dateLabels,
            datasets: [
                {
                    label: 'Beginner 0-3',
                    data: beginnerData,
                    backgroundColor: '#10b981',
                    borderColor: '#10b981',
                    borderWidth: 1
                },
                {
                    label: 'Advanced 4-6',
                    data: advancedData,
                    backgroundColor: '#8b5cf6',
                    borderColor: '#8b5cf6',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const clickedDate = chartData.sortedDates[index];
                    handleBarClick(clickedDate);
                }
            },
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
                    enabled: true,
                    callbacks: {
                        title: function(context) {
                            return chartData.dateLabels[context[0].dataIndex];
                        },
                        footer: function() {
                            return 'Click to see breakdown';
                        }
                    },
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    titleFont: { size: 13, weight: '600' },
                    bodyFont: { size: 12 },
                    footerFont: { size: 10, style: 'italic' },
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

// ==================== Detail Panel ====================
function handleBarClick(dateStr) {
    selectedDate = dateStr;
    currentDetailView = 'day';
    updateDetailTabs();
    renderDetailPanel();
}

function switchDetailView(view) {
    currentDetailView = view;
    updateDetailTabs();
    renderDetailPanel();
}

function updateDetailTabs() {
    const dayTab = document.getElementById('tab-day-view');
    const allTimeTab = document.getElementById('tab-all-time');
    
    if (dayTab && allTimeTab) {
        dayTab.classList.toggle('active', currentDetailView === 'day');
        allTimeTab.classList.toggle('active', currentDetailView === 'alltime');
    }
}

function renderDetailPanel() {
    const detailContent = document.getElementById('detail-panel-content');
    if (!detailContent) return;

    // Destroy existing detail chart
    if (detailBreakdownChart) {
        detailBreakdownChart.destroy();
        detailBreakdownChart = null;
    }

    if (currentDetailView === 'alltime') {
        renderAllTimeView(detailContent);
    } else if (selectedDate && chartData.detailedData[selectedDate]) {
        renderDayView(detailContent, selectedDate);
    } else {
        renderInstructionalState(detailContent);
    }
}

function renderInstructionalState(container) {
    container.innerHTML = `
        <div class="detail-empty">
            <i class="fa-solid fa-hand-pointer"></i>
            <p>Click a bar in the chart to see the exercise breakdown for that day</p>
        </div>
    `;
}

function renderDayView(container, dateStr) {
    const data = chartData.detailedData[dateStr];
    if (!data) {
        renderInstructionalState(container);
        return;
    }

    const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });

    // Combine all exercises from both playlists
    const allExercises = [
        ...data.beginner.exercises.map(e => ({ ...e, playlist: 'Beginner 0-3', color: '#10b981' })),
        ...data.advanced.exercises.map(e => ({ ...e, playlist: 'Advanced 4-6', color: '#8b5cf6' }))
    ];

    const totalSets = data.beginner.totalSets + data.advanced.totalSets;

    if (allExercises.length === 0) {
        container.innerHTML = `
            <div class="detail-header">
                <h4>${formattedDate}</h4>
                <span class="detail-total">No exercises recorded</span>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="detail-header">
            <h4>${formattedDate}</h4>
            <span class="detail-total">${totalSets} total sets</span>
        </div>
        <div class="detail-chart-container">
            <canvas id="detail-breakdown-chart"></canvas>
        </div>
    `;

    // Create horizontal bar chart for exercise breakdown
    const canvas = document.getElementById('detail-breakdown-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    detailBreakdownChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: allExercises.map(e => e.title),
            datasets: [{
                data: allExercises.map(e => e.sets),
                backgroundColor: allExercises.map(e => e.color),
                borderColor: allExercises.map(e => e.color),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Sets',
                        font: { size: 11 }
                    },
                    ticks: {
                        stepSize: 1,
                        font: { size: 10 }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                y: {
                    ticks: {
                        font: { size: 11 }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const exercise = allExercises[context.dataIndex];
                            const repsStr = exercise.repsData
                                .map(r => `${r.set}: ${r.reps} reps`)
                                .join(', ');
                            return `${exercise.sets} sets (${repsStr})`;
                        },
                        afterLabel: function(context) {
                            const exercise = allExercises[context.dataIndex];
                            return `Playlist: ${exercise.playlist}`;
                        }
                    },
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 6
                }
            }
        }
    });
}

function renderAllTimeView(container) {
    if (!completionHistory || Object.keys(completionHistory).length === 0) {
        container.innerHTML = `
            <div class="detail-empty">
                <i class="fa-solid fa-chart-pie"></i>
                <p>No workout data yet</p>
            </div>
        `;
        return;
    }

    // Aggregate all exercises across all sessions
    const exerciseTotals = new Map(); // videoId -> { title, sets, playlist, color }

    Object.keys(completionHistory).forEach(dateStr => {
        const dayProgress = completionHistory[dateStr];

        Object.keys(dayProgress).forEach(playlistId => {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist) return;

            const isAdvanced = playlistId.includes('advanced');

            Object.keys(dayProgress[playlistId]).forEach(videoId => {
                const video = playlist.videos.find(v => v.id === videoId);
                if (!video) return;

                const videoProgress = dayProgress[playlistId][videoId];
                let completedSets = 0;

                if (videoProgress && typeof videoProgress === 'object') {
                    Object.keys(videoProgress).forEach(setKey => {
                        if (setKey.startsWith('set') && videoProgress[setKey]?.completed) {
                            completedSets++;
                        }
                    });
                }

                if (completedSets > 0) {
                    if (exerciseTotals.has(videoId)) {
                        exerciseTotals.get(videoId).sets += completedSets;
                    } else {
                        exerciseTotals.set(videoId, {
                            title: video.title,
                            sets: completedSets,
                            playlist: isAdvanced ? 'Advanced 4-6' : 'Beginner 0-3',
                            color: isAdvanced ? '#8b5cf6' : '#10b981'
                        });
                    }
                }
            });
        });
    });

    const allExercises = Array.from(exerciseTotals.values())
        .sort((a, b) => b.sets - a.sets); // Sort by sets descending

    const totalSets = allExercises.reduce((sum, e) => sum + e.sets, 0);

    if (allExercises.length === 0) {
        container.innerHTML = `
            <div class="detail-empty">
                <i class="fa-solid fa-chart-pie"></i>
                <p>No completed exercises yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="detail-header">
            <h4>All Time Totals</h4>
            <span class="detail-total">${totalSets} total sets</span>
        </div>
        <div class="detail-chart-container">
            <canvas id="detail-breakdown-chart"></canvas>
        </div>
    `;

    // Create horizontal bar chart
    const canvas = document.getElementById('detail-breakdown-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    detailBreakdownChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: allExercises.map(e => e.title),
            datasets: [{
                data: allExercises.map(e => e.sets),
                backgroundColor: allExercises.map(e => e.color),
                borderColor: allExercises.map(e => e.color),
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Total Sets',
                        font: { size: 11 }
                    },
                    ticks: {
                        font: { size: 10 }
                    },
                    grid: {
                        display: true,
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                y: {
                    ticks: {
                        font: { size: 11 }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const exercise = allExercises[context.dataIndex];
                            return `${exercise.sets} total sets`;
                        },
                        afterLabel: function(context) {
                            const exercise = allExercises[context.dataIndex];
                            return `Playlist: ${exercise.playlist}`;
                        }
                    },
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 6
                }
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

    const sortedDates = Object.keys(completionHistory).sort().reverse().slice(0, 7);

    let activityHTML = '';

    sortedDates.forEach(dateStr => {
        const progress = completionHistory[dateStr];
        const formattedDate = formatActivityDate(dateStr);
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