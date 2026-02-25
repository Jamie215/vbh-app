// ============================================================
// HandsUP — Console Test Scripts for Modals & Alerts
// Paste any of these blocks into your browser console to test.
// ============================================================


// ===== 1. FINAL SESSION MODAL (Week 6, 1 session done) =====
// "You're Almost at the Finish Line!" — star icon, green button
sessionStorage.removeItem('dismissedFinalSessionModal');
showFinalSessionModal();


// ===== 2. PROGRAM COMPLETION MODAL (Week 6, all exercises done) =====
// "Congratulations!" — trophy icon, purple button
sessionStorage.removeItem('dismissedCompletionModal');
showProgramCompletionModal();


// ===== 3. FINAL SESSION MODAL (with full condition check) =====
// Mocks getProgramWeekState and getAdvancedSessionDates to simulate
// week 6 with 1 session done and no activity today.
sessionStorage.removeItem('dismissedFinalSessionModal');
const _gps1 = getProgramWeekState;
const _gas1 = getAdvancedSessionDates;
getProgramWeekState = () => ({ programWeek: 6, calendarWeek: 6, sessionsInCurrentWeek: 1, windowAnchor: new Date() });
getAdvancedSessionDates = () => [];  // no advanced activity today
checkAndShowFinalSessionModal();
getProgramWeekState = _gps1;
getAdvancedSessionDates = _gas1;


// ===== 4. COMPLETION MODAL (with full condition check) =====
// Mocks state to simulate week 6, today is an advanced session day,
// and all exercises are 100% complete.
sessionStorage.removeItem('dismissedCompletionModal');
const _gps2 = getProgramWeekState;
const _gas2 = getAdvancedSessionDates;
const _cpp2 = calculatePlaylistProgress;
const today2 = new Date().toISOString().split('T')[0];
getProgramWeekState = () => ({ programWeek: 6, calendarWeek: 6, sessionsInCurrentWeek: 2, windowAnchor: new Date() });
getAdvancedSessionDates = () => [today2];  // today has advanced activity
calculatePlaylistProgress = (id, todayOnly) => (id === 'advanced-4-6' && todayOnly) ? { completed: 8, total: 8, percentage: 100 } : _cpp2(id, todayOnly);
checkAndShowProgramCompletionModal();
getProgramWeekState = _gps2;
getAdvancedSessionDates = _gas2;
calculatePlaylistProgress = _cpp2;


// ===== 5. ALERTS — Pace Discrepancy ("Stay on Track!") =====
// Calendar week 5, but program week 4 with 1 session done.
const _gps3 = getProgramWeekState;
const _dr3 = detectProgressReset;
getProgramWeekState = () => ({ programWeek: 4, calendarWeek: 5, sessionsInCurrentWeek: 1, windowAnchor: new Date() });
detectProgressReset = () => ({ wasReset: false });
renderProgressAlert();
getProgramWeekState = _gps3;
detectProgressReset = _dr3;


// ===== 6. ALERTS — Week 5 ("Almost There!") =====
const _gps4 = getProgramWeekState;
const _dr4 = detectProgressReset;
getProgramWeekState = () => ({ programWeek: 5, calendarWeek: 5, sessionsInCurrentWeek: 0, windowAnchor: new Date() });
detectProgressReset = () => ({ wasReset: false });
renderProgressAlert();
getProgramWeekState = _gps4;
detectProgressReset = _dr4;


// ===== 7. ALERTS — Week 6 Info ("Final Week!") =====
const _gps5 = getProgramWeekState;
const _dr5 = detectProgressReset;
const _cw6a = checkWeek6Activity;
getProgramWeekState = () => ({ programWeek: 6, calendarWeek: 6, sessionsInCurrentWeek: 0, windowAnchor: new Date() });
detectProgressReset = () => ({ wasReset: false });
checkWeek6Activity = () => false;
renderProgressAlert();
getProgramWeekState = _gps5;
detectProgressReset = _dr5;
checkWeek6Activity = _cw6a;


// ===== 8. ALERTS — Success ("Congratulations!") =====
const _gps6 = getProgramWeekState;
const _dr6 = detectProgressReset;
const _cw6b = checkWeek6Activity;
getProgramWeekState = () => ({ programWeek: 6, calendarWeek: 6, sessionsInCurrentWeek: 2, windowAnchor: new Date() });
detectProgressReset = () => ({ wasReset: false });
checkWeek6Activity = () => true;
renderProgressAlert();
getProgramWeekState = _gps6;
detectProgressReset = _dr6;
checkWeek6Activity = _cw6b;


// ===== 9. ALERTS — Warning / Reset ("Welcome Back!") =====
const _dr7 = detectProgressReset;
detectProgressReset = () => ({ wasReset: true, naturalWeek: 5, daysSinceActivity: 20 });
renderProgressAlert();
detectProgressReset = _dr7;


// ===== 10. GREETING — Post-Completion =====
// Mocks isProgramCompleted to show the completion greeting message.
const _ipc = isProgramCompleted;
isProgramCompleted = () => true;
loadPlaylists();
isProgramCompleted = _ipc;


// ===== CLEANUP — Dismiss & Remove All =====
// Run this to clear all modals and reset sessionStorage flags.
closeFinalSessionModal();
closeProgramCompletionModal();
sessionStorage.removeItem('dismissedFinalSessionModal');
sessionStorage.removeItem('dismissedCompletionModal');
sessionStorage.removeItem('dismissedAlerts');
renderProgressAlert();