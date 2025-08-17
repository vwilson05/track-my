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

let chartOffset = 0; // Track current chart time offset
let selectedHabitId = 'all'; // Track selected habit filter

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
    
    // Populate habit filter dropdown
    const habitFilter = document.getElementById('habitFilter');
    if (habitFilter && habitFilter.children.length === 1) { // Only populate once
        habits.forEach(habit => {
            const option = document.createElement('option');
            option.value = habit.id;
            option.textContent = habit.name;
            habitFilter.appendChild(option);
        });
        
        habitFilter.addEventListener('change', (e) => {
            selectedHabitId = e.target.value;
            renderChart(habits, completions);
        });
    }
    
    // Setup chart navigation
    const chartPrev = document.getElementById('chartPrev');
    const chartNext = document.getElementById('chartNext');
    
    if (chartPrev && !chartPrev.hasAttribute('data-initialized')) {
        chartPrev.setAttribute('data-initialized', 'true');
        chartPrev.addEventListener('click', () => {
            chartOffset += 14; // Go back 14 days
            renderChart(habits, completions);
        });
    }
    
    if (chartNext && !chartNext.hasAttribute('data-initialized')) {
        chartNext.setAttribute('data-initialized', 'true');
        chartNext.addEventListener('click', () => {
            if (chartOffset > 0) {
                chartOffset = Math.max(0, chartOffset - 14); // Go forward 14 days
                renderChart(habits, completions);
            }
        });
    }
    
    renderChart(habits, completions);
    renderHeatmap(completions);
}

function renderChart(habits, completions) {
    const canvas = document.getElementById('progressChart');
    const ctx = canvas.getContext('2d');
    
    // Get container actual width to prevent overflow
    const container = canvas.parentElement;
    const containerWidth = Math.min(container.clientWidth, window.innerWidth - 48); // Ensure it fits in viewport
    
    // Fixed dimensions for consistency
    const devicePixelRatio = window.devicePixelRatio || 1;
    const canvasWidth = Math.min(containerWidth, 500); // Smaller max width
    const canvasHeight = 200; // Fixed height
    
    // Set canvas size for high DPI displays
    canvas.width = canvasWidth * devicePixelRatio;
    canvas.height = canvasHeight * devicePixelRatio;
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';
    
    // Scale context for high DPI
    ctx.scale(devicePixelRatio, devicePixelRatio);
    
    const width = canvasWidth;
    const height = canvasHeight;
    const padding = { 
        top: 30, 
        right: 10, 
        bottom: 30, 
        left: 35
    };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Always show 14 days for consistency
    const days = 14;
    const today = new Date();
    today.setDate(today.getDate() - chartOffset); // Apply offset
    const data = [];
    const labels = [];
    
    // Filter habits if needed
    const filteredHabits = selectedHabitId === 'all' ? habits : 
        habits.filter(h => h.id === selectedHabitId);
    const habitCount = filteredHabits.length || 1;
    
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateKey = Utils.getDayKey(date);
        const dayCompletions = completions[dateKey] || [];
        
        let completionRate;
        if (selectedHabitId === 'all') {
            completionRate = habitCount > 0 ? (dayCompletions.length / habitCount) * 100 : 0;
        } else {
            // Check if specific habit was completed
            completionRate = dayCompletions.includes(selectedHabitId) ? 100 : 0;
        }
        
        data.push(completionRate);
        labels.push(date.getDate()); // Just the day number
    }
    
    // Update range display
    const chartRange = document.getElementById('chartRange');
    if (chartRange) {
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setDate(startDate.getDate() - (days - 1));
        
        if (chartOffset === 0) {
            chartRange.textContent = 'Last 14 days';
        } else {
            chartRange.textContent = `${startDate.getMonth() + 1}/${startDate.getDate()} - ${endDate.getMonth() + 1}/${endDate.getDate()}`;
        }
    }
    
    // Update navigation buttons
    const chartNext = document.getElementById('chartNext');
    if (chartNext) {
        chartNext.disabled = chartOffset === 0;
    }
    
    // Find max value for scaling
    const maxValue = Math.max(...data, 100);
    const minValue = 0;
    
    // Draw grid lines and y-axis labels
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillStyle = '#999'; // Secondary text color
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    
    const gridLines = 4; // Consistent grid lines
    for (let i = 0; i <= gridLines; i++) {
        const y = padding.top + (chartHeight / gridLines) * i;
        const value = Math.round(maxValue - (maxValue / gridLines) * i);
        
        // Draw grid line
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        
        // Draw y-axis label
        ctx.fillText(value + '%', padding.left - 5, y + 3);
    }
    
    // Draw x-axis labels (show first, middle, and last)
    ctx.textAlign = 'center';
    ctx.font = '8px sans-serif';
    const showLabels = [0, Math.floor(labels.length / 2), labels.length - 1];
    showLabels.forEach(i => {
        const x = padding.left + (chartWidth / (data.length - 1)) * i;
        ctx.fillText(labels[i], x, height - padding.bottom + 12);
    });
    
    // Draw the line chart
    if (data.length > 0) {
        // Create gradient for the line
        const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
        gradient.addColorStop(0, 'rgb(16, 185, 129)');
        gradient.addColorStop(1, 'rgb(59, 130, 246)');
        
        // Draw the line
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        data.forEach((value, i) => {
            const x = padding.left + (chartWidth / (data.length - 1)) * i;
            const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
        
        // Draw area under the line
        ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
        ctx.beginPath();
        data.forEach((value, i) => {
            const x = padding.left + (chartWidth / (data.length - 1)) * i;
            const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
            
            if (i === 0) {
                ctx.moveTo(x, height - padding.bottom);
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.lineTo(width - padding.right, height - padding.bottom);
        ctx.closePath();
        ctx.fill();
        
        // Draw dots on data points
        ctx.fillStyle = 'rgb(16, 185, 129)';
        data.forEach((value, i) => {
            const x = padding.left + (chartWidth / (data.length - 1)) * i;
            const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
            
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Add hover area (for future interactivity)
            if (i === data.length - 1) {
                // Highlight today's point
                ctx.strokeStyle = 'rgb(16, 185, 129)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.stroke();
            }
        });
    }
    
    // Add chart title
    ctx.fillStyle = '#e5e5e5'; // Primary text color
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    
    let titleText;
    if (selectedHabitId === 'all') {
        titleText = 'All Habits Completion';
    } else {
        const habit = habits.find(h => h.id === selectedHabitId);
        titleText = habit ? habit.name : 'Completion Rate';
    }
    ctx.fillText(titleText, width / 2, 20);
    
    // No axis labels or legend needed - keep it clean
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