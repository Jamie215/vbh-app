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

// Centralized color map for category-coded visualizations across the progress
// view. Single source of truth so chart segments, lines, bars, and detail
// panels stay consistent.
const CATEGORY_COLORS = {
    beginner: '#10b981',  // green
    advanced: '#8b5cf6',  // purple
    external: '#f59e0b',  // amber
    program:  '#475569'   // slate gray — combined program-sets line
};

// Total program sets completed across all time. Walks completionHistory and
// counts every set with completed:true across both beginner and advanced
// playlists. External activities are excluded.
function _getTotalProgramSetsCompleted() {
    if (!completionHistory) return 0;
    let total = 0;
    for (const dateStr of Object.keys(completionHistory)) {
        const dayProgress = completionHistory[dateStr];
        for (const playlistId of Object.keys(dayProgress)) {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist || playlist.type !== 'video') continue;
            const playlistProgress = dayProgress[playlistId];
            for (const videoId of Object.keys(playlistProgress)) {
                const videoProgress = playlistProgress[videoId];
                if (!videoProgress || typeof videoProgress !== 'object') continue;
                for (const setKey of Object.keys(videoProgress)) {
                    if (setKey.startsWith('set') && videoProgress[setKey]?.completed) {
                        total++;
                    }
                }
            }
        }
    }
    return total;
}

// Total minutes from external activities marked completed across all time.
function _getTotalExternalMinutes() {
    if (!completionHistory) return 0;
    let total = 0;
    for (const dateStr of Object.keys(completionHistory)) {
        const dayProgress = completionHistory[dateStr];
        for (const playlistId of Object.keys(dayProgress)) {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist || playlist.type !== 'external') continue;
            const playlistProgress = dayProgress[playlistId];
            for (const activityId of Object.keys(playlistProgress)) {
                const activity = playlistProgress[activityId];
                if (activity?.completed === true) {
                    total += activity.minutes || 0;
                }
            }
        }
    }
    return total;
}

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

    const footer = document.getElementById('site-footer');
    if (footer) footer.classList.toggle('hidden', false);
}

// ==================== Summary Stats ====================
function loadProgressStats() {
    // Total program sets completed
    const totalSets = _getTotalProgramSetsCompleted();
    const totalSetsEl = document.getElementById('total-program-sets');
    if (totalSetsEl) totalSetsEl.textContent = totalSets;

    // Total external activity minutes
    const totalMinutes = _getTotalExternalMinutes();
    const totalMinutesEl = document.getElementById('total-external-minutes');
    if (totalMinutesEl) totalMinutesEl.textContent = totalMinutes;

    // Program progress bar
    const currentWeek = calculateUserWeek();
    const completed = isProgramCompleted();
    const progressFill = document.getElementById('program-progress-fill');
    const progressText = document.getElementById('program-progress-text');
    const progressLabel = document.getElementById('program-progress-label');

    if (progressFill && progressText && progressLabel) {
        if (completed) {
            progressFill.style.width = '100%';
            progressFill.classList.add('completed');
            progressText.textContent = 'Complete!';
            progressLabel.textContent = 'Program Completed 🎉';
        } else {
            const percentage = Math.round((currentWeek / 6) * 100);
            progressFill.style.width = `${percentage}%`;
            progressFill.classList.remove('completed');
            progressText.textContent = `Week ${currentWeek} of 6`;
            progressLabel.textContent = 'Program Progress';
        }
    }
}

// ==================== Workout History Chart ====================
// Combo chart over every date with logged activity:
//   - Slate line: total program sets completed that day (beginner + advanced)
//   - Amber bars: count of external activities logged that day
// Clicking a bar or line point selects that date in the detail panel.
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
                    <i class="fa-solid fa-chart-line text-5xl text-border-medium mb-4"></i>
                    <p class="text-base max-w-[300px]">No workout data yet. Complete some exercises to see your progress chart!</p>
                </div>
            `;
        }
        return;
    }

    // All recorded dates, oldest → newest
    const sortedDates = Object.keys(completionHistory).sort();
    chartData.sortedDates = sortedDates;

    const programSetsPerDay = [];
    const externalCountPerDay = [];

    sortedDates.forEach(dateStr => {
        const dayProgress = completionHistory[dateStr];
        let programSets = 0;
        let externalCount = 0;

        Object.keys(dayProgress).forEach(playlistId => {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist) return;

            if (playlist.type === 'external') {
                Object.keys(dayProgress[playlistId]).forEach(activityId => {
                    if (dayProgress[playlistId][activityId]?.completed === true) {
                        externalCount++;
                    }
                });
                return;
            }

            // Video playlist — sum completed sets across all exercises
            Object.keys(dayProgress[playlistId]).forEach(videoId => {
                const videoProgress = dayProgress[playlistId][videoId];
                if (!videoProgress || typeof videoProgress !== 'object') return;
                Object.keys(videoProgress).forEach(setKey => {
                    if (setKey.startsWith('set') && videoProgress[setKey]?.completed) {
                        programSets++;
                    }
                });
            });
        });

        programSetsPerDay.push(programSets);
        externalCountPerDay.push(externalCount);
    });

    chartData.dateLabels = sortedDates.map(dateStr => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });

    // Both axes start at 0; their max scales to the larger of the two so that
    // sets and activity-counts share visual space even though they're
    // categorically different units.
    const maxVal = Math.max(
        ...programSetsPerDay,
        ...externalCountPerDay,
        1  // floor so a quiet day doesn't collapse the y-axis
    );

    const ctx = canvas.getContext('2d');
    workoutHistoryChart = new Chart(ctx, {
        // Base type 'bar' lets us mix in a line dataset; Chart.js handles the rest.
        type: 'bar',
        data: {
            labels: chartData.dateLabels,
            datasets: [
                {
                    type: 'line',
                    label: 'Program sets completed',
                    data: programSetsPerDay,
                    borderColor: CATEGORY_COLORS.program,
                    backgroundColor: CATEGORY_COLORS.program,
                    borderWidth: 2,
                    tension: 0.25,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    yAxisID: 'y',
                    order: 0  // draw on top of bars
                },
                {
                    type: 'bar',
                    label: 'External activities logged',
                    data: externalCountPerDay,
                    backgroundColor: CATEGORY_COLORS.external,
                    borderColor: CATEGORY_COLORS.external,
                    borderWidth: 1,
                    yAxisID: 'y',
                    order: 1  // draw behind line
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            onClick: (event, elements) => {
                // Either dataset can drive selection — they share the same index space.
                if (elements.length > 0) {
                    const clickedDate = chartData.sortedDates[elements[0].index];
                    handleBarClick(clickedDate);
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    suggestedMax: maxVal,
                    ticks: {
                        precision: 0,  // integer ticks only — both metrics are counts
                        font: { size: 11 }
                    },
                    title: {
                        display: true,
                        text: 'Sets / Activities',
                        font: { size: 12, weight: '500' }
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
                        font: { size: 11 },
                        usePointStyle: true
                    }
                },
                tooltip: {
                    enabled: true,
                    callbacks: {
                        title: (context) => chartData.dateLabels[context[0].dataIndex],
                        label: (context) => {
                            const value = context.raw;
                            if (context.dataset.type === 'line') {
                                return `${value} program ${value === 1 ? 'set' : 'sets'}`;
                            }
                            return `${value} external ${value === 1 ? 'activity' : 'activities'}`;
                        },
                        footer: () => 'Click for breakdown'
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

    // Combine all entries from beginner, advanced, and external
    const allEntries = [
        ...data.beginner.exercises.map(e => ({ ...e, playlist: 'Beginner 0-3', color: '#10b981' })),
        ...data.advanced.exercises.map(e => ({ ...e, playlist: 'Advanced 4-6', color: '#8b5cf6' })),
        ...data.external.activities.map(a => ({
            title: a.title,
            sets: 1,                // each activity = 1 unit on the bar
            minutes: a.minutes,
            isExternal: true,
            playlist: 'External Activity',
            color: '#f59e0b'
        }))
    ];

    const programSets = data.beginner.totalSets + data.advanced.totalSets;
    const externalCount = data.external.totalCount;

    // Header summary — show each unit with its real label
    let summaryText;
    if (programSets > 0 && externalCount > 0) {
        summaryText = `${programSets} ${programSets === 1 ? 'set' : 'sets'} · ${externalCount} ${externalCount === 1 ? 'activity' : 'activities'}`;
    } else if (programSets > 0) {
        summaryText = `${programSets} ${programSets === 1 ? 'set' : 'sets'}`;
    } else if (externalCount > 0) {
        summaryText = `${externalCount} ${externalCount === 1 ? 'activity' : 'activities'}`;
    } else {
        summaryText = 'No exercises recorded';
    }

    if (allEntries.length === 0) {
        container.innerHTML = `
            <div class="flex justify-between items-center mb-4 pb-3 border-b border-border-subtle">
                <h4 class="text-base font-semibold text-text-primary m-0">${formattedDate}</h4>
                <span class="text-base text-text-secondary font-medium">${summaryText}</span>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-4 pb-3 border-b border-border-subtle">
            <h4 class="text-base font-semibold text-text-primary m-0">${formattedDate}</h4>
            <span class="text-base text-text-secondary font-medium">${summaryText}</span>
        </div>
        <div class="flex-1 min-h-0">
            <canvas id="detail-breakdown-chart"></canvas>
        </div>
    `;

    // Create horizontal bar chart for the breakdown
    const canvas = document.getElementById('detail-breakdown-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    detailBreakdownChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: allEntries.map(e => e.title),
            datasets: [{
                data: allEntries.map(e => e.sets),
                backgroundColor: allEntries.map(e => e.color),
                borderColor: allEntries.map(e => e.color),
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
                        text: 'Sets / Activities',
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
                    ticks: { font: { size: 11 } },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const entry = allEntries[context.dataIndex];
                            if (entry.isExternal) {
                                return `${entry.minutes} ${entry.minutes === 1 ? 'minute' : 'minutes'}`;
                            }
                            const repsStr = entry.repsData
                                .map(r => {
                                    // Time-based sets store reps=0 and seconds>0
                                    if (r.seconds > 0 && r.reps === 0) return `${r.set}: ${r.seconds}s`;
                                    return `${r.set}: ${r.reps} reps`;
                                })
                                .join(', ');
                            return `${entry.sets} sets (${repsStr})`;
                        },
                        afterLabel: function(context) {
                            const entry = allEntries[context.dataIndex];
                            return `Category: ${entry.playlist}`;
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

    // Aggregate every item across all dates. Video exercises tally completed sets;
    // external activities tally occurrences and accumulate minutes.
    const itemTotals = new Map();

    Object.keys(completionHistory).forEach(dateStr => {
        const dayProgress = completionHistory[dateStr];

        Object.keys(dayProgress).forEach(playlistId => {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist) return;

            // External: namespace the key so it can't collide with a video ID
            if (playlist.type === 'external') {
                Object.keys(dayProgress[playlistId]).forEach(activityId => {
                    const activity = playlist.others.find(a => a.id === activityId);
                    if (!activity) return;

                    const progress = dayProgress[playlistId][activityId];
                    if (progress?.completed !== true) return;

                    const key = `external:${activityId}`;
                    if (itemTotals.has(key)) {
                        const existing = itemTotals.get(key);
                        existing.sets += 1;
                        existing.totalMinutes += (progress.minutes || 0);
                    } else {
                        itemTotals.set(key, {
                            title: activity.title,
                            sets: 1,
                            totalMinutes: progress.minutes || 0,
                            isExternal: true,
                            playlist: 'External Activity',
                            color: '#f59e0b'
                        });
                    }
                });
                return;
            }

            // Video playlist
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
                    if (itemTotals.has(videoId)) {
                        itemTotals.get(videoId).sets += completedSets;
                    } else {
                        itemTotals.set(videoId, {
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

    const allEntries = Array.from(itemTotals.values())
        .sort((a, b) => b.sets - a.sets);

    if (allEntries.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-text-secondary text-center p-4">
                <i class="fa-solid fa-chart-pie text-4xl text-border-medium mb-4"></i>
                <p class="text-base max-w-[200px] leading-relaxed">No completed exercises yet</p>
            </div>
        `;
        return;
    }

    const programTotal = allEntries.filter(e => !e.isExternal).reduce((sum, e) => sum + e.sets, 0);
    const externalTotal = allEntries.filter(e => e.isExternal).reduce((sum, e) => sum + e.sets, 0);

    let summaryText;
    if (programTotal > 0 && externalTotal > 0) {
        summaryText = `${programTotal} sets · ${externalTotal} ${externalTotal === 1 ? 'activity' : 'activities'}`;
    } else if (programTotal > 0) {
        summaryText = `${programTotal} total sets`;
    } else {
        summaryText = `${externalTotal} ${externalTotal === 1 ? 'activity' : 'activities'}`;
    }

    container.innerHTML = `
        <div class="flex justify-between items-center mb-4 pb-3 border-b border-border-subtle">
            <h4 class="text-base font-semibold text-text-primary m-0">All Time Totals</h4>
            <span class="text-base text-text-secondary font-medium">${summaryText}</span>
        </div>
        <div class="flex-1 min-h-0">
            <canvas id="detail-breakdown-chart"></canvas>
        </div>
    `;

    const canvas = document.getElementById('detail-breakdown-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    detailBreakdownChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: allEntries.map(e => e.title),
            datasets: [{
                data: allEntries.map(e => e.sets),
                backgroundColor: allEntries.map(e => e.color),
                borderColor: allEntries.map(e => e.color),
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
                        text: 'Total Sets / Occurrences',
                        font: { size: 11 }
                    },
                    ticks: { font: { size: 10 } },
                    grid: {
                        display: true,
                        color: 'rgba(0,0,0,0.05)'
                    }
                },
                y: {
                    ticks: { font: { size: 11 } },
                    grid: { display: false }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const entry = allEntries[context.dataIndex];
                            if (entry.isExternal) {
                                const timesLabel = entry.sets === 1 ? 'time' : 'times';
                                return `Logged ${entry.sets} ${timesLabel} (${entry.totalMinutes} total minutes)`;
                            }
                            return `${entry.sets} total sets`;
                        },
                        afterLabel: function(context) {
                            const entry = allEntries[context.dataIndex];
                            return `Category: ${entry.playlist}`;
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

console.log('Progress module loaded');