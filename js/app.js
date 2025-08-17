let currentView = 'today';
let weekOffset = 0;

async function initApp() {
    try {
        await DB.init();
        await habitManager.init();
        
        setupNavigation();
        setupModals();
        setupSettings();
        
        checkForUpdates();
        requestNotifications();
        
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        Utils.showNotification('Failed to initialize app', 'error');
    }
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            const view = item.dataset.view;
            switchView(view);
        });
    });
}

function switchView(view) {
    currentView = view;
    
    document.getElementById('mainContent').style.display = view === 'today' ? 'block' : 'none';
    document.getElementById('weekView').style.display = view === 'week' ? 'block' : 'none';
    document.getElementById('statsView').style.display = view === 'stats' ? 'block' : 'none';
    
    if (view === 'week') {
        renderWeekView();
    } else if (view === 'stats') {
        renderStatsView();
    } else if (view === 'settings') {
        window.openModal('settingsModal');
    }
}

function setupModals() {
    document.getElementById('addHabitBtn').addEventListener('click', () => {
        window.openModal('habitModal');
    });
    
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                window.closeModal(modal.id);
            }
        });
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');
    
    if (modalId === 'settingsModal') {
        const activeNav = document.querySelector('.nav-item.active');
        if (activeNav && activeNav.dataset.view === 'settings') {
            document.querySelector('.nav-item[data-view="today"]').click();
        }
    }
}

function setupSettings() {
    loadSettings();
    
    document.getElementById('aiProvider').addEventListener('change', saveSettings);
    document.getElementById('apiKey').addEventListener('change', saveSettings);
    document.getElementById('enableNotifications').addEventListener('change', saveSettings);
}

async function loadSettings() {
    const provider = await DB.getSetting('aiProvider') || localStorage.getItem('aiProvider');
    const apiKey = await DB.getSetting('apiKey') || localStorage.getItem('apiKey');
    const notifications = await DB.getSetting('enableNotifications');
    
    if (provider) {
        document.getElementById('aiProvider').value = provider;
        localStorage.setItem('aiProvider', provider);
    }
    
    if (apiKey) {
        document.getElementById('apiKey').value = apiKey;
        localStorage.setItem('apiKey', apiKey);
    }
    
    if (notifications !== undefined) {
        document.getElementById('enableNotifications').checked = notifications;
    }
}

async function saveSettings() {
    const provider = document.getElementById('aiProvider').value;
    const apiKey = document.getElementById('apiKey').value;
    const notifications = document.getElementById('enableNotifications').checked;
    
    if (provider) {
        await DB.saveSetting('aiProvider', provider);
        localStorage.setItem('aiProvider', provider);
    }
    
    if (apiKey) {
        await DB.saveSetting('apiKey', apiKey);
        localStorage.setItem('apiKey', apiKey);
    }
    
    await DB.saveSetting('enableNotifications', notifications);
    
    if (provider && apiKey) {
        const result = await LLMService.testConnection();
        if (result.success) {
            Utils.showNotification('AI connection successful', 'success');
        } else {
            Utils.showNotification(`AI connection failed: ${result.error}`, 'error');
        }
    }
    
    habitManager.render();
}

async function exportData() {
    try {
        const data = await DB.exportAllData();
        Utils.exportData(data);
        Utils.showNotification('Data exported successfully', 'success');
    } catch (error) {
        Utils.showNotification('Failed to export data', 'error');
    }
}

async function importData() {
    try {
        const data = await Utils.importData();
        await DB.importData(data);
        await habitManager.loadHabits();
        await habitManager.loadCompletions();
        habitManager.render();
        Utils.showNotification('Data imported successfully', 'success');
    } catch (error) {
        Utils.showNotification('Failed to import data', 'error');
    }
}

async function clearAllData() {
    if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
        try {
            await DB.clearAllData();
            await habitManager.loadHabits();
            await habitManager.loadCompletions();
            habitManager.render();
            Utils.showNotification('All data cleared', 'success');
        } catch (error) {
            Utils.showNotification('Failed to clear data', 'error');
        }
    }
}

async function renderWeekView() {
    const weekGrid = document.getElementById('weekGrid');
    const weekTitle = document.getElementById('weekTitle');
    
    console.log('weekGrid element:', weekGrid);
    console.log('weekTitle element:', weekTitle);
    
    if (!weekGrid) {
        console.error('weekGrid element not found!');
        return;
    }
    
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekOffset * 7));
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    weekTitle.textContent = weekOffset === 0 ? 'This Week' : 
        `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
    
    weekGrid.innerHTML = '';
    
    const habits = await DB.getHabits();
    const completions = await DB.getCompletions(weekStart, weekEnd);
    
    console.log('Week View Debug:', {
        habits: habits.length,
        completions,
        weekStart: weekStart.toISOString(),
        weekEnd: weekEnd.toISOString()
    });
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateKey = Utils.getDayKey(date);
        
        console.log(`Day ${i}: ${dateKey}, completions:`, completions[dateKey]);
        
        const dayCard = document.createElement('div');
        dayCard.className = 'day-card';
        
        const dayHeader = document.createElement('div');
        dayHeader.className = 'day-header';
        dayHeader.textContent = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        
        const dayHabits = document.createElement('div');
        dayHabits.className = 'day-habits';
        
        const dayCompletions = completions[dateKey] || [];
        const completionRate = habits.length > 0 ? 
            Math.round((dayCompletions.length / habits.length) * 100) : 0;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress-bar';
        progressBar.innerHTML = `
            <div class="progress-fill" style="width: ${completionRate}%"></div>
            <span class="progress-text">${completionRate}%</span>
        `;
        
        dayCard.appendChild(dayHeader);
        dayCard.appendChild(progressBar);
        weekGrid.appendChild(dayCard);
        console.log(`Added card for ${dateKey} to weekGrid`);
    }
}

function navigateWeek(direction) {
    weekOffset += direction;
    renderWeekView();
}

async function renderStatsView() {
    const habits = await DB.getHabits();
    const completions = await DB.getCompletions();
    
    console.log('Stats View Debug:', {
        habits: habits.length,
        completions,
        completionsKeys: Object.keys(completions)
    });
    
    const totalHabitsEl = document.getElementById('totalHabits');
    const completionRateEl = document.getElementById('completionRate');
    
    console.log('Updating totalHabits element:', totalHabitsEl, 'with value:', habits.length);
    if (totalHabitsEl) {
        totalHabitsEl.textContent = habits.length;
    } else {
        console.error('totalHabits element not found!');
    }
    
    const today = Utils.getDayKey(new Date());
    const todayCompletions = completions[today] || [];
    const completionRate = habits.length > 0 ? 
        Math.round((todayCompletions.length / habits.length) * 100) : 0;
    
    console.log('Updating completionRate element:', completionRateEl, 'with value:', `${completionRate}%`);
    if (completionRateEl) {
        completionRateEl.textContent = `${completionRate}%`;
    } else {
        console.error('completionRate element not found!');
    }
    
    let maxStreak = 0;
    let maxBestStreak = 0;
    
    habits.forEach(habit => {
        if (habit.streak > maxStreak) maxStreak = habit.streak;
        if (habit.bestStreak > maxBestStreak) maxBestStreak = habit.bestStreak;
    });
    
    document.getElementById('currentStreak').textContent = maxStreak;
    document.getElementById('bestStreak').textContent = maxBestStreak;
    
    renderChart();
    renderHeatmap(completions);
}

function renderChart() {
    const canvas = document.getElementById('progressChart');
    const ctx = canvas.getContext('2d');
    
    canvas.width = canvas.offsetWidth;
    canvas.height = 250;
    
    ctx.fillStyle = 'var(--secondary-text)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Chart visualization will be added with Chart.js', canvas.width / 2, canvas.height / 2);
}

function renderHeatmap(completions) {
    const container = document.getElementById('heatmapContainer');
    container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--secondary-text);">Activity heatmap coming soon</div>';
}

function checkForUpdates() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        Utils.showNotification('New version available! Refresh to update.', 'info');
                    }
                });
            });
        });
    }
}

async function requestNotifications() {
    const enabled = await DB.getSetting('enableNotifications');
    if (enabled) {
        await Utils.requestNotificationPermission();
    }
}

function openAddHabitModal() {
    window.openModal('habitModal');
}

window.openModal = openModal;
window.closeModal = closeModal;
window.exportData = exportData;
window.importData = importData;
window.clearAllData = clearAllData;
window.navigateWeek = navigateWeek;
window.openAddHabitModal = openAddHabitModal;
window.renderWeekView = renderWeekView;
window.renderStatsView = renderStatsView;

document.addEventListener('DOMContentLoaded', initApp);