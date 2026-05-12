// Progress module - handles My Progress view functionality

// Chart instances for cleanup
let workoutHistoryChart = null;

// State for detail panel
let selectedDate = null;
let currentDetailView = 'day'; // 'day' or 'alltime'

// Store processed data for click handlers
let chartData = {
    sortedDates: [],
    dateLabels: []
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

// All chart instances rendered inside the detail panel — destroyed on every
// re-render so we don't leak Chart.js instances or stack canvases.
let detailPanelCharts = [];

function _destroyDetailPanelCharts() {
    detailPanelCharts.forEach(c => { try { c.destroy(); } catch {} });
    detailPanelCharts = [];
}

// Amber palette for donut segments — keeps the "external" identity (amber)
// while making individual segments distinguishable. Cycled if there are more
// external activities than colors.
const EXTERNAL_PALETTE = [
    '#f59e0b',  // base amber
    '#d97706',  // darker amber
    '#fbbf24',  // lighter amber
    '#b45309',  // deep amber
    '#fcd34d',  // pale amber
    '#92400e',  // very deep amber
    '#fde68a'   // very pale amber
];

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

    _destroyDetailPanelCharts();

    if (currentDetailView === 'alltime') {
        renderAllTimeView(detailContent);
    } else if (selectedDate && completionHistory?.[selectedDate]) {
        renderDayView(detailContent, selectedDate);
    } else {
        renderInstructionalState(detailContent);
    }
}

function renderInstructionalState(container) {
    container.innerHTML = `
        <div class="flex flex-col items-center justify-center h-full text-text-secondary text-center p-4">
            <i class="fa-solid fa-hand-pointer text-4xl text-border-medium mb-4"></i>
            <p class="text-base max-w-[200px] leading-relaxed">Click a bar or point on the chart to see the breakdown for that day</p>
        </div>
    `;
}

// ---------- Aggregation helpers ----------

// Scope = a list of date strings to aggregate over.
// Returns: { [playlistId]: { [videoId]: { title, completedSets, sessionCount, recommendedSets } } }
function _aggregateProgramByPlaylist(dateStrs) {
    const result = {};

    dateStrs.forEach(dateStr => {
        const dayProgress = completionHistory?.[dateStr];
        if (!dayProgress) return;

        Object.keys(dayProgress).forEach(playlistId => {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist || playlist.type !== 'video') return;

            if (!result[playlistId]) result[playlistId] = {};

            Object.keys(dayProgress[playlistId]).forEach(videoId => {
                const video = playlist.videos.find(v => v.id === videoId);
                if (!video) return;

                const videoProgress = dayProgress[playlistId][videoId];
                if (!videoProgress || typeof videoProgress !== 'object') return;

                let completedThisDay = 0;
                Object.keys(videoProgress).forEach(setKey => {
                    if (setKey.startsWith('set') && videoProgress[setKey]?.completed) {
                        completedThisDay++;
                    }
                });

                if (completedThisDay === 0) return;

                if (!result[playlistId][videoId]) {
                    result[playlistId][videoId] = {
                        title: video.title,
                        completedSets: 0,
                        sessionCount: 0,
                        recommendedSets: video.sets
                    };
                }
                result[playlistId][videoId].completedSets += completedThisDay;
                result[playlistId][videoId].sessionCount += 1;
            });
        });
    });

    return result;
}

// Returns: { [activityId]: { title, totalMinutes, sessionCount } }
function _aggregateExternal(dateStrs) {
    const result = {};

    dateStrs.forEach(dateStr => {
        const dayProgress = completionHistory?.[dateStr];
        if (!dayProgress) return;

        Object.keys(dayProgress).forEach(playlistId => {
            const playlist = PLAYLISTS.find(p => p.id === playlistId);
            if (!playlist || playlist.type !== 'external') return;

            Object.keys(dayProgress[playlistId]).forEach(activityId => {
                const activity = playlist.others.find(a => a.id === activityId);
                if (!activity) return;

                const progress = dayProgress[playlistId][activityId];
                if (progress?.completed !== true) return;

                if (!result[activityId]) {
                    result[activityId] = {
                        title: activity.title,
                        totalMinutes: 0,
                        sessionCount: 0
                    };
                }
                result[activityId].totalMinutes += (progress.minutes || 0);
                result[activityId].sessionCount += 1;
            });
        });
    });

    return result;
}

// ---------- Chart factories ----------

// Polar area chart for one program. Day View tooltip = "X/N sets",
// All Time tooltip = "X sets across Y sessions".
function _createProgramPolar(canvasId, playlistId, programData, isAllTime) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const isAdvanced = playlistId.includes('advanced');
    const color = isAdvanced ? CATEGORY_COLORS.advanced : CATEGORY_COLORS.beginner;

    const entries = Object.values(programData);
    const labels = entries.map(e => e.title);
    const data = entries.map(e => e.completedSets);

    // All segments share the program's color; transparency lets adjacent
    // segments separate visually without needing distinct hues per exercise.
    const backgroundColor = entries.map(() => color + 'B3');  // ~70% opacity
    const borderColor = entries.map(() => color);

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'polarArea',
        data: { labels, datasets: [{ data, backgroundColor, borderColor, borderWidth: 1 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: { display: false, precision: 0 },
                    grid: { color: 'rgba(0,0,0,0.06)' }
                }
            },
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { size: 10 }, boxWidth: 10, padding: 6 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const entry = entries[ctx.dataIndex];
                            if (isAllTime) {
                                const sessions = entry.sessionCount;
                                return `${entry.title}: ${entry.completedSets} sets across ${sessions} ${sessions === 1 ? 'session' : 'sessions'}`;
                            }
                            return `${entry.title}: ${entry.completedSets}/${entry.recommendedSets} sets`;
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
    detailPanelCharts.push(chart);
}

// Donut chart for external activities. Center text drawn by an inline plugin
// since we don't want to pull in chartjs-plugin-datalabels.
function _createExternalDonut(canvasId, externalData, isAllTime) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const entries = Object.values(externalData);
    const labels = entries.map(e => e.title);
    const data = entries.map(e => e.totalMinutes);
    const totalMinutes = data.reduce((a, b) => a + b, 0);

    const backgroundColor = entries.map((_, i) => EXTERNAL_PALETTE[i % EXTERNAL_PALETTE.length]);

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor, borderColor: '#fff', borderWidth: 2 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: { font: { size: 10 }, boxWidth: 10, padding: 6 }
                },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const entry = entries[ctx.dataIndex];
                            if (isAllTime) {
                                const sessions = entry.sessionCount;
                                return `${entry.title}: ${entry.totalMinutes} min across ${sessions} ${sessions === 1 ? 'session' : 'sessions'}`;
                            }
                            return `${entry.title}: ${entry.totalMinutes} min`;
                        }
                    },
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    titleFont: { size: 12, weight: '600' },
                    bodyFont: { size: 11 },
                    padding: 10,
                    cornerRadius: 6
                }
            }
        },
        plugins: [{
            id: 'donutCenterText',
            // Drawing in afterDraw (not beforeDraw) so the center text stays
            // on top of the doughnut arcs in every Chart.js version.
            afterDraw: (chart) => {
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                const cx = (chartArea.left + chartArea.right) / 2;
                const cy = (chartArea.top + chartArea.bottom) / 2;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                // Big number
                ctx.font = 'bold 22px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.fillStyle = '#1a1a2e';
                ctx.fillText(String(totalMinutes), cx, cy - 8);

                // Small label
                ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText('total minutes', cx, cy + 12);

                ctx.restore();
            }
        }]
    });
    detailPanelCharts.push(chart);
}

// ---------- View renderers ----------

// Shared block-renderer used by both Day View and All Time. Stacks program
// polars (one per playlist with records) followed by an external donut.
function _renderBreakdownBlocks(container, headerHTML, programByPlaylist, externalData, isAllTime) {
    const hasProgram = Object.keys(programByPlaylist).some(pid => Object.keys(programByPlaylist[pid]).length > 0);
    const hasExternal = Object.keys(externalData).length > 0;

    if (!hasProgram && !hasExternal) {
        container.innerHTML = `
            ${headerHTML}
            <div class="flex flex-col items-center justify-center flex-1 text-text-secondary text-center p-4">
                <i class="fa-solid fa-circle-info text-3xl text-border-medium mb-3"></i>
                <p class="text-base">No activity recorded.</p>
            </div>
        `;
        return;
    }

    // Build all blocks first, then mount; this guarantees the canvas DOM
    // exists before we ask Chart.js to find it by ID.
    let blocksHTML = headerHTML;

    const orderedPlaylistIds = ['beginner-0-3', 'advanced-4-6'];  // stable order regardless of insertion
    orderedPlaylistIds.forEach(pid => {
        if (!programByPlaylist[pid] || Object.keys(programByPlaylist[pid]).length === 0) return;
        const isAdvanced = pid === 'advanced-4-6';
        const label = isAdvanced ? 'Advanced 4-6' : 'Beginner 0-3';
        const dotColor = isAdvanced ? CATEGORY_COLORS.advanced : CATEGORY_COLORS.beginner;
        blocksHTML += `
            <div class="shrink-0">
                <div class="flex items-center gap-2 mb-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background:${dotColor}"></span>
                    <h5 class="text-sm font-semibold text-text-primary m-0">${label}</h5>
                </div>
                <div class="h-[200px] relative">
                    <canvas id="detail-polar-${pid}"></canvas>
                </div>
            </div>
        `;
    });

    if (hasExternal) {
        blocksHTML += `
            <div class="shrink-0">
                <div class="flex items-center gap-2 mb-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background:${CATEGORY_COLORS.external}"></span>
                    <h5 class="text-sm font-semibold text-text-primary m-0">External Activities</h5>
                </div>
                <div class="h-[200px] relative">
                    <canvas id="detail-donut-external"></canvas>
                </div>
            </div>
        `;
    }

    container.innerHTML = blocksHTML;

    // Mount charts now that canvases exist in the DOM
    orderedPlaylistIds.forEach(pid => {
        if (!programByPlaylist[pid] || Object.keys(programByPlaylist[pid]).length === 0) return;
        _createProgramPolar(`detail-polar-${pid}`, pid, programByPlaylist[pid], isAllTime);
    });
    if (hasExternal) {
        _createExternalDonut('detail-donut-external', externalData, isAllTime);
    }
}

function renderDayView(container, dateStr) {
    const formattedDate = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric'
    });

    const programByPlaylist = _aggregateProgramByPlaylist([dateStr]);
    const externalData = _aggregateExternal([dateStr]);

    const programSets = Object.values(programByPlaylist).reduce((sum, playlist) => {
        return sum + Object.values(playlist).reduce((s, ex) => s + ex.completedSets, 0);
    }, 0);
    const externalCount = Object.keys(externalData).length;

    let summaryText;
    if (programSets > 0 && externalCount > 0) {
        summaryText = `${programSets} ${programSets === 1 ? 'set' : 'sets'} · ${externalCount} ${externalCount === 1 ? 'activity' : 'activities'}`;
    } else if (programSets > 0) {
        summaryText = `${programSets} ${programSets === 1 ? 'set' : 'sets'}`;
    } else if (externalCount > 0) {
        summaryText = `${externalCount} ${externalCount === 1 ? 'activity' : 'activities'}`;
    } else {
        summaryText = 'No activity';
    }

    const headerHTML = `
        <div class="flex justify-between items-center pb-3 border-b border-border-subtle shrink-0">
            <h4 class="text-base font-semibold text-text-primary m-0">${formattedDate}</h4>
            <span class="text-base text-text-secondary font-medium">${summaryText}</span>
        </div>
    `;

    _renderBreakdownBlocks(container, headerHTML, programByPlaylist, externalData, false);
}

function renderAllTimeView(container) {
    const allDates = completionHistory ? Object.keys(completionHistory) : [];

    if (allDates.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-text-secondary text-center p-4">
                <i class="fa-solid fa-chart-pie text-4xl text-border-medium mb-4"></i>
                <p class="text-base max-w-[200px] leading-relaxed">No workout data yet</p>
            </div>
        `;
        return;
    }

    const programByPlaylist = _aggregateProgramByPlaylist(allDates);
    const externalData = _aggregateExternal(allDates);

    const programSets = Object.values(programByPlaylist).reduce((sum, playlist) => {
        return sum + Object.values(playlist).reduce((s, ex) => s + ex.completedSets, 0);
    }, 0);
    const externalMinutes = Object.values(externalData).reduce((s, a) => s + a.totalMinutes, 0);

    let summaryText;
    if (programSets > 0 && externalMinutes > 0) {
        summaryText = `${programSets} sets · ${externalMinutes} min`;
    } else if (programSets > 0) {
        summaryText = `${programSets} total sets`;
    } else if (externalMinutes > 0) {
        summaryText = `${externalMinutes} total minutes`;
    } else {
        summaryText = '';
    }

    const headerHTML = `
        <div class="flex justify-between items-center pb-3 border-b border-border-subtle shrink-0">
            <h4 class="text-base font-semibold text-text-primary m-0">All Time Totals</h4>
            <span class="text-base text-text-secondary font-medium">${summaryText}</span>
        </div>
    `;

    _renderBreakdownBlocks(container, headerHTML, programByPlaylist, externalData, true);
}

console.log('Progress module loaded');