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
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(weekStart);
        date.setDate(date.getDate() + i);
        const dateKey = Utils.getDayKey(date);
        
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
    }
}

function navigateWeek(direction) {
    weekOffset += direction;
    renderWeekView();
}

async function renderStatsView() {
    const habits = await DB.getHabits();
    const completions = await DB.getCompletions();
    
    document.getElementById('totalHabits').textContent = habits.length;
    
    const today = Utils.getDayKey(new Date());
    const todayCompletions = completions[today] || [];
    const completionRate = habits.length > 0 ? 
        Math.round((todayCompletions.length / habits.length) * 100) : 0;
    document.getElementById('completionRate').textContent = `${completionRate}%`;
    
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
    container.innerHTML = '';
    
    // Create heatmap header
    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;';
    header.innerHTML = `
        <h3 style="margin: 0; color: var(--primary-text);">Activity Heatmap</h3>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: var(--secondary-text); font-size: 0.85rem;">Less</span>
            <div style="display: flex; gap: 2px;">
                <div style="width: 12px; height: 12px; background: var(--tertiary-bg); border-radius: 2px;"></div>
                <div style="width: 12px; height: 12px; background: rgba(16, 185, 129, 0.3); border-radius: 2px;"></div>
                <div style="width: 12px; height: 12px; background: rgba(16, 185, 129, 0.6); border-radius: 2px;"></div>
                <div style="width: 12px; height: 12px; background: rgba(16, 185, 129, 0.9); border-radius: 2px;"></div>
                <div style="width: 12px; height: 12px; background: rgb(16, 185, 129); border-radius: 2px;"></div>
            </div>
            <span style="color: var(--secondary-text); font-size: 0.85rem;">More</span>
        </div>
    `;
    container.appendChild(header);
    
    // Create heatmap grid
    const grid = document.createElement('div');
    grid.style.cssText = 'display: flex; gap: 4px; overflow-x: auto; padding: 1rem 0;';
    
    // Get the last 52 weeks of data
    const today = new Date();
    const weeks = 52;
    const daysPerWeek = 7;
    
    // Create day labels
    const dayLabels = document.createElement('div');
    dayLabels.style.cssText = 'display: flex; flex-direction: column; gap: 2px; margin-right: 8px;';
    const days = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
    days.forEach(day => {
        const label = document.createElement('div');
        label.style.cssText = 'height: 12px; font-size: 10px; color: var(--secondary-text); display: flex; align-items: center;';
        label.textContent = day;
        dayLabels.appendChild(label);
    });
    grid.appendChild(dayLabels);
    
    // Calculate total habits for percentage calculation
    const habitsCount = window.habitManager ? window.habitManager.habits.length : 1;
    
    // Generate heatmap cells
    for (let week = weeks - 1; week >= 0; week--) {
        const weekColumn = document.createElement('div');
        weekColumn.style.cssText = 'display: flex; flex-direction: column; gap: 2px;';
        
        for (let day = 0; day < daysPerWeek; day++) {
            const cellDate = new Date(today);
            cellDate.setDate(cellDate.getDate() - (week * 7) - (today.getDay() - day));
            const dateKey = Utils.getDayKey(cellDate);
            
            const cell = document.createElement('div');
            cell.style.cssText = 'width: 12px; height: 12px; border-radius: 2px; cursor: pointer; transition: all 0.2s;';
            
            // Calculate completion intensity
            const dayCompletions = completions[dateKey] || [];
            const completionRate = habitsCount > 0 ? dayCompletions.length / habitsCount : 0;
            
            // Set cell color based on completion rate
            if (completionRate === 0) {
                cell.style.background = 'var(--tertiary-bg)';
            } else if (completionRate <= 0.25) {
                cell.style.background = 'rgba(16, 185, 129, 0.3)';
            } else if (completionRate <= 0.5) {
                cell.style.background = 'rgba(16, 185, 129, 0.5)';
            } else if (completionRate <= 0.75) {
                cell.style.background = 'rgba(16, 185, 129, 0.7)';
            } else {
                cell.style.background = 'rgb(16, 185, 129)';
            }
            
            // Add hover effect and tooltip
            cell.title = `${cellDate.toLocaleDateString()}: ${dayCompletions.length} habit${dayCompletions.length !== 1 ? 's' : ''} completed`;
            cell.onmouseover = () => {
                cell.style.transform = 'scale(1.2)';
                cell.style.outline = '2px solid var(--primary-color)';
            };
            cell.onmouseout = () => {
                cell.style.transform = 'scale(1)';
                cell.style.outline = 'none';
            };
            
            // Don't render future dates
            if (cellDate > today) {
                cell.style.visibility = 'hidden';
            }
            
            weekColumn.appendChild(cell);
        }
        
        grid.appendChild(weekColumn);
    }
    
    // Add month labels
    const monthLabels = document.createElement('div');
    monthLabels.style.cssText = 'display: flex; gap: 4px; margin-left: 40px; margin-bottom: 0.5rem;';
    
    const months = [];
    for (let week = weeks - 1; week >= 0; week -= 4) {
        const cellDate = new Date(today);
        cellDate.setDate(cellDate.getDate() - (week * 7));
        const monthName = cellDate.toLocaleDateString('default', { month: 'short' });
        
        const label = document.createElement('div');
        label.style.cssText = 'font-size: 10px; color: var(--secondary-text); width: 48px;';
        label.textContent = monthName;
        monthLabels.appendChild(label);
    }
    
    container.appendChild(monthLabels);
    container.appendChild(grid);
    
    // Add summary stats
    const stats = document.createElement('div');
    stats.style.cssText = 'margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border-color); display: flex; justify-content: space-around;';
    
    // Calculate stats for the last 30 days
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let totalCompletions = 0;
    let activeDays = 0;
    
    Object.entries(completions).forEach(([date, habits]) => {
        const dateObj = new Date(date);
        if (dateObj >= thirtyDaysAgo && dateObj <= today) {
            totalCompletions += habits.length;
            if (habits.length > 0) activeDays++;
        }
    });
    
    stats.innerHTML = `
        <div style="text-align: center;">
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-text);">${totalCompletions}</div>
            <div style="font-size: 0.85rem; color: var(--secondary-text);">Total (30 days)</div>
        </div>
        <div style="text-align: center;">
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-text);">${activeDays}</div>
            <div style="font-size: 0.85rem; color: var(--secondary-text);">Active Days</div>
        </div>
        <div style="text-align: center;">
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary-text);">${activeDays > 0 ? Math.round(totalCompletions / activeDays) : 0}</div>
            <div style="font-size: 0.85rem; color: var(--secondary-text);">Daily Average</div>
        </div>
    `;
    
    container.appendChild(stats);
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