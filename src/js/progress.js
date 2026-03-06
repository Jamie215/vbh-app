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

    pushRoute('/progress');
    hideAllViews();

    const progressView = document.getElementById('progress-view');
    if (progressView) progressView.classList.remove('hidden');

    const navbar = document.getElementById('navbar');
    if (navbar) navbar.classList.remove('hidden');

    // Update nav link active states
    updateNavActiveState('progress');

    // Reset detail panel state
    selectedDate = null;
    currentDetailView = 'day';

    // Load all progress data
    loadProgressStats();
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

    // Program program bar
    const currentWeek = calculateUserWeek();
    const completed = isProgramCompleted();
    const progressFill = document.getElementById('program-progress-fill');
    const progressText = document.getElementById('program-progress-text');
    const progressLabel = document.getElementById('program-progress-label');

    if (progressFill && progressText && progressLabel) {
        if(completed) {
            progressFill.style.width = '100%';
            progressFill.classList.add('completed');
            progressText.textContent = 'Complete!';
            if (progressLabel) progressLabel.textContent = 'Program Completed 🎉';
        } else {
            const percentage = Math.round((currentWeek / 6) * 100);
            progressFill.style.width = `${percentage}%`;
            progressFill.classList.remove('completed');
            progressText.textContent = `Week ${currentWeek} of 6`;
            if (progressLabel) progressLabel.textContent = 'Program Progress';
        }
    }
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
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
                <div class="absolute inset-0 flex flex-col items-center justify-center text-text-secondary text-center">
                    <i class="fa-solid fa-chart-bar text-5xl text-border-medium mb-4"></i>
                    <p class="text-base max-w-[300px]">No workout data yet. Complete some exercises to see your progress chart!</p>
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
        <div class="flex flex-col items-center justify-center h-full text-text-secondary text-center p-4">
            <i class="fa-solid fa-hand-pointer text-4xl text-border-medium mb-4"></i>
            <p class="text-base max-w-[200px] leading-relaxed">Click a bar in the chart to see the exercise breakdown for that day</p>
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
            <div class="flex justify-between items-center mb-4 pb-3 border-b border-border-subtle">
                <h4 class="text-base font-semibold text-text-primary m-0">${formattedDate}</h4>
                <span class="text-base text-text-secondary font-medium">No exercises recorded</span>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-4 pb-3 border-b border-border-subtle">
            <h4 class="text-base font-semibold text-text-primary m-0">${formattedDate}</h4>
            <span class="text-base text-text-secondary font-medium">${totalSets} total sets</span>
        </div>
        <div class="flex-1 min-h-0">
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
            <div class="flex flex-col items-center justify-center h-full text-text-secondary text-center p-4">
                <i class="fa-solid fa-chart-pie text-4xl text-border-medium mb-4"></i>
                <p class="text-base max-w-[200px] leading-relaxed">No workout data yet</p>
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
            <div class="flex flex-col items-center justify-center h-full text-text-secondary text-center p-4">
                <i class="fa-solid fa-chart-pie text-4xl text-border-medium mb-4"></i>
                <p class="text-base max-w-[200px] leading-relaxed">No completed exercises yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-4 pb-3 border-b border-border-subtle">
            <h4 class="text-base font-semibold text-text-primary m-0">All Time Totals</h4>
            <span class="text-base text-text-secondary font-medium">${totalSets} total sets</span>
        </div>
        <div class="flex-1 min-h-0">
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
            <div class="py-12 text-center text-text-secondary">
                <i class="fa-solid fa-dumbbell text-4xl text-border-medium mb-4 block"></i>
                <p class="text-base max-w-[300px] mx-auto">No workout activity yet. Start your first workout to see your progress here!</p>
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
            <div class="px-6 py-4 border-b border-border-subtle last:border-b-0 flex items-start gap-4 hover:bg-[#fafbfc] max-md:flex-col max-md:gap-2">
                <div class="flex items-center gap-2 min-w-[120px] shrink-0 max-md:min-w-0">
                    <i class="fa-solid fa-calendar-day text-brand text-base"></i>
                    <span class="font-semibold text-text-primary text-base">${formattedDate}</span>
                </div>
                <div class="flex flex-col gap-1">
                    ${sessionStats.map(stat => `
                        <div class="flex items-center gap-3">
                            <span class="font-medium text-text-tertiary text-base">${stat.playlistName}</span>
                            <span class="text-success text-base font-medium">${stat.exercisesCompleted}/${stat.totalExercises} exercises</span>
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