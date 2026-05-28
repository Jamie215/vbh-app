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
// Builds a wrap-flowed HTML legend below a chart's canvas. Each pill toggles
// the corresponding segment's visibility via Chart.js's data visibility API.
//
// Visual state is controlled by a single `is-hidden` class on the pill,
// rather than inline styles — inline styles on inner spans were getting
// overridden by Tailwind utilities and were hard to reason about.
function _renderCustomLegend(containerId, chart, labels, colors) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.className = 'grid grid-cols-2 gap-x-3 gap-y-2 mt-3 px-1';

    labels.forEach((label, index) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'legend-pill';

        const swatch = document.createElement('span');
        swatch.className = 'legend-swatch';
        swatch.style.setProperty('--swatch-color', colors[index]);

        const text = document.createElement('span');
        text.className = 'legend-label';
        text.textContent = label;

        pill.appendChild(swatch);
        pill.appendChild(text);

        // Reflect chart's current visibility on this pill.
        const sync = () => {
            const visible = chart.getDataVisibility(index);
            pill.classList.toggle('is-hidden', !visible);
        };
        sync();

        pill.addEventListener('click', () => {
            chart.toggleDataVisibility(index);
            chart.update();
            sync();
        });

        container.appendChild(pill);
    });
}

// Polar area chart for one program. Always shows every exercise in the
// playlist (in playlist order). Custom HTML legend is rendered below the
// canvas — click any item to toggle that segment's visibility. State resets
// on every render so context switches (Day → All Time, different day, etc.)
// start fresh.
function _createProgramPolar(canvasId, playlistId, programData, isAllTime) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const playlist = PLAYLISTS.find(p => p.id === playlistId);
    if (!playlist) return;

    const isAdvanced = playlistId.includes('advanced');
    const color = isAdvanced ? CATEGORY_COLORS.advanced : CATEGORY_COLORS.beginner;

    // Iterate the full playlist in canonical order. Each video either has
    // aggregated data or gets a synthetic zero entry.
    const entries = playlist.videos.map(video => {
        const logged = programData[video.id];
        if (logged) return logged;
        return {
            title: video.title,
            completedSets: 0,
            sessionCount: 0,
            recommendedSets: video.sets
        };
    });

    const labels = entries.map(e => e.title);
    const actualData = entries.map(e => e.completedSets);

    // Floor zero-radius slices at ~8% of the largest value so untouched
    // exercises remain visible.
    const maxValue = Math.max(...actualData, 1);
    const floorValue = maxValue * 0.08;
    const displayData = actualData.map(v => v > 0 ? v : floorValue);

    // Faded fill for floored slices signals "not attempted" before hover.
    const backgroundColor = entries.map(e => e.completedSets > 0 ? color + 'B3' : color + '33');
    const borderColor      = entries.map(e => e.completedSets > 0 ? color : color + '66');

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'polarArea',
        data: { labels, datasets: [{ data: displayData, backgroundColor, borderColor, borderWidth: 1 }] },
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
                legend: { display: false },  // replaced by custom HTML legend below
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const entry = entries[ctx.dataIndex];
                            if (isAllTime) {
                                if (entry.sessionCount === 0) {
                                    return `${entry.title}: Not yet attempted`;
                                }
                                return `${entry.title}: ${entry.completedSets} sets across ${entry.sessionCount} ${entry.sessionCount === 1 ? 'session' : 'sessions'}`;
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
    _renderCustomLegend(`${canvasId}-accordion-legend`, chart, labels, entries.map(e => color));
}

// Donut chart for external activities with a custom toggleable legend below.
function _createExternalDonut(canvasId, externalData, isAllTime) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const entries = Object.values(externalData);
    const labels = entries.map(e => e.title);
    const data = entries.map(e => e.totalMinutes);
    const segmentColors = entries.map((_, i) => EXTERNAL_PALETTE[i % EXTERNAL_PALETTE.length]);

    // Recompute the center total from currently-visible segments only, so
    // toggling a segment off updates the donut's center text in real time.
    const computeVisibleTotal = (chart) => {
        let total = 0;
        chart.data.datasets[0].data.forEach((value, i) => {
            if (!chart.getDataVisibility(i)) return;
            total += value;
        });
        return total;
    };

    const ctx = canvas.getContext('2d');
    const chart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: segmentColors, borderColor: '#fff', borderWidth: 2 }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { display: false },  // replaced by custom HTML legend below
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
            afterDraw: (chart) => {
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                const cx = (chartArea.left + chartArea.right) / 2;
                const cy = (chartArea.top + chartArea.bottom) / 2;
                const visibleTotal = computeVisibleTotal(chart);

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.fillStyle = '#1a1a2e';
                ctx.fillText(String(visibleTotal), cx, cy - 10);

                ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText('Total Min', cx, cy + 14);

                ctx.restore();
            }
        }]
    });
    detailPanelCharts.push(chart);
    _renderCustomLegend(`${canvasId}-accordion-legend`, chart, labels, segmentColors);
}

// ---------- View renderers ----------

// Stacks program polars and the external donut inside the details panel.
// Each block has a fixed-height chart and an accordion below it that
// reveals the toggleable legend. Accordions are closed by default — the
// panel stays compact until the user opts into the detail.
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

    let blocksHTML = headerHTML;

    const orderedPlaylistIds = ['beginner-1-3', 'advanced-4-6'];
    orderedPlaylistIds.forEach(pid => {
        const programEntries = programByPlaylist[pid];
        if (!programEntries || Object.keys(programEntries).length === 0) return;

        const isAdvanced = pid === 'advanced-4-6';
        const label = isAdvanced ? 'Advanced 4-6' : 'Beginner 1-3';
        const dotColor = isAdvanced ? CATEGORY_COLORS.advanced : CATEGORY_COLORS.beginner;

        // Count = every exercise in the playlist (the polar always shows all
        // of them, including zero-radius slivers for untouched ones).
        const playlist = PLAYLISTS.find(p => p.id === pid);
        const itemCount = playlist ? playlist.videos.length : 0;

        blocksHTML += `
            <div class="shrink-0">
                <div class="flex items-center gap-2 mb-2">
                    <span class="w-3 h-3 rounded-full" style="background:${dotColor}"></span>
                    <h5 class="text-base font-semibold text-text-primary m-0">${label}</h5>
                </div>
                <div class="h-[280px] relative shrink-0">
                    <canvas id="detail-polar-${pid}"></canvas>
                </div>
                ${_buildAccordionHTML(`detail-polar-${pid}-accordion`, 'Exercise Types', itemCount)}
            </div>
        `;
    });

    if (hasExternal) {
        const itemCount = Object.keys(externalData).length;
        blocksHTML += `
            <div class="shrink-0">
                <div class="flex items-center gap-2 mb-2">
                    <span class="w-3 h-3 rounded-full" style="background:${CATEGORY_COLORS.external}"></span>
                    <h5 class="text-base font-semibold text-text-primary m-0">External Activities</h5>
                </div>
                <div class="h-[240px] relative shrink-0">
                    <canvas id="detail-donut-external"></canvas>
                </div>
                ${_buildAccordionHTML('detail-donut-external-accordion', 'Activity Types', itemCount)}
            </div>
        `;
    }

    container.innerHTML = blocksHTML;

    // Defer chart mounting one frame so flex layout settles before Chart.js
    // reads container dimensions.
    requestAnimationFrame(() => {
        orderedPlaylistIds.forEach(pid => {
            if (!programByPlaylist[pid] || Object.keys(programByPlaylist[pid]).length === 0) return;
            _createProgramPolar(`detail-polar-${pid}`, pid, programByPlaylist[pid], isAllTime);
        });
        if (hasExternal) {
            _createExternalDonut('detail-donut-external', externalData, isAllTime);
        }
    });
}

// Markup for one collapsible accordion. The chart-factory functions populate
// the inner legend container after the chart mounts. Toggle behavior is
// wired up by the click handler we attach inline.
function _buildAccordionHTML(idPrefix, label, count) {
    return `
        <div class="mt-3 border-t border-border-subtle pt-2">
            <button type="button"
                    id="${idPrefix}-toggle"
                    class="flex items-center gap-2 w-full text-left bg-transparent border-none p-1 cursor-pointer hover:bg-subtle rounded transition-colors"
                    aria-expanded="false"
                    aria-controls="${idPrefix}-body"
                    onclick="_toggleAccordion('${idPrefix}')">
                <i class="fa-solid fa-chevron-right text-xs text-text-secondary transition-transform" id="${idPrefix}-chevron"></i>
                <span class="text-sm font-medium text-text-primary">${label}</span>
                <span class="text-sm text-text-secondary">(${count})</span>
            </button>
            <div id="${idPrefix}-body" class="hidden pt-2 pb-1">
                <div id="${idPrefix}-legend"></div>
            </div>
        </div>
    `;
}

// Toggles an accordion open/closed by id prefix. Pure DOM toggling, no state
// to track — open state is read directly from the DOM if anyone needs it.
function _toggleAccordion(idPrefix) {
    const body = document.getElementById(`${idPrefix}-body`);
    const chevron = document.getElementById(`${idPrefix}-chevron`);
    const toggle = document.getElementById(`${idPrefix}-toggle`);
    if (!body) return;

    const wasHidden = body.classList.contains('hidden');
    body.classList.toggle('hidden');
    if (chevron) chevron.style.transform = wasHidden ? 'rotate(90deg)' : 'rotate(0deg)';
    if (toggle)  toggle.setAttribute('aria-expanded', wasHidden ? 'true' : 'false');
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