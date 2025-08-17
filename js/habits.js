class HabitManager {
    constructor() {
        this.habits = [];
        this.completions = {};
        this.currentView = 'today';
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchedElement = null;
    }

    async init() {
        await this.loadHabits();
        await this.loadCompletions();
        this.setupEventListeners();
        this.render();
    }

    setupEventListeners() {
        document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
        
        document.getElementById('habitForm').addEventListener('submit', this.handleHabitFormSubmit.bind(this));
    }

    handleTouchStart(e) {
        const habitItem = e.target.closest('.habit-item');
        if (habitItem) {
            this.touchStartX = e.touches[0].clientX;
            this.touchStartY = e.touches[0].clientY;
            this.touchedElement = habitItem;
        }
    }

    handleTouchMove(e) {
        if (!this.touchedElement) return;
        
        const touchX = e.touches[0].clientX;
        const touchY = e.touches[0].clientY;
        const deltaX = touchX - this.touchStartX;
        const deltaY = touchY - this.touchStartY;
        
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
            e.preventDefault();
            this.touchedElement.style.transform = `translateX(${deltaX}px)`;
        }
    }

    async handleTouchEnd(e) {
        if (!this.touchedElement) return;
        
        const touchX = e.changedTouches[0].clientX;
        const deltaX = touchX - this.touchStartX;
        
        if (Math.abs(deltaX) > 100) {
            const habitId = this.touchedElement.dataset.habitId;
            
            if (deltaX > 0) {
                await this.toggleHabit(habitId);
            } else {
                const shouldDelete = confirm('Delete this habit?');
                if (shouldDelete) {
                    await this.deleteHabit(habitId);
                }
            }
        }
        
        this.touchedElement.style.transform = '';
        this.touchedElement = null;
    }

    async handleHabitFormSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const habit = {
            name: formData.get('name'),
            category: formData.get('category'),
            frequency: formData.get('frequency'),
            time: formData.get('time'),
            description: formData.get('description')
        };
        
        await this.addHabit(habit);
        window.closeModal('habitModal');
        e.target.reset();
    }

    async loadHabits() {
        this.habits = await DB.getHabits();
    }

    async loadCompletions() {
        this.completions = await DB.getCompletions();
    }

    async addHabit(habitData) {
        const habit = await DB.addHabit(habitData);
        this.habits.push(habit);
        this.render();
        Utils.showNotification('Habit added successfully', 'success');
    }

    async updateHabit(id, updates) {
        const habit = await DB.updateHabit(id, updates);
        const index = this.habits.findIndex(h => h.id === id);
        if (index !== -1) {
            this.habits[index] = habit;
        }
        this.render();
    }

    async deleteHabit(id) {
        await DB.deleteHabit(id);
        this.habits = this.habits.filter(h => h.id !== id);
        this.render();
        Utils.showNotification('Habit deleted', 'info');
    }

    async toggleHabit(habitId) {
        const today = new Date();
        const completedToday = await this.isCompletedToday(habitId);
        
        if (completedToday) {
            await DB.markIncomplete(habitId, today);
        } else {
            await DB.markComplete(habitId, today);
            this.checkForReminders(habitId);
        }
        
        await this.loadCompletions();
        await this.loadHabits();
        this.render();
    }

    async isCompletedToday(habitId) {
        const todayCompletions = await DB.getCompletionsForDate(new Date());
        return todayCompletions.includes(habitId);
    }

    groupHabitsByCategory() {
        const grouped = {};
        
        this.habits.forEach(habit => {
            if (!grouped[habit.category]) {
                grouped[habit.category] = [];
            }
            grouped[habit.category].push(habit);
        });
        
        return grouped;
    }

    async render() {
        const container = document.getElementById('categoriesContainer');
        const emptyState = document.getElementById('emptyState');
        
        if (this.habits.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }
        
        container.style.display = 'flex';
        emptyState.style.display = 'none';
        
        const grouped = this.groupHabitsByCategory();
        const todayCompletions = await DB.getCompletionsForDate(new Date());
        
        container.innerHTML = '';
        
        for (const [category, habits] of Object.entries(grouped)) {
            const categoryCard = document.createElement('div');
            categoryCard.className = 'category-card';
            categoryCard.style.setProperty('--category-color', Utils.getCategoryColor(category));
            
            const categoryHeader = document.createElement('div');
            categoryHeader.className = 'category-header';
            
            const categoryTitle = document.createElement('div');
            categoryTitle.className = 'category-title';
            
            const categoryIcon = document.createElement('span');
            categoryIcon.className = 'category-icon';
            categoryIcon.textContent = Utils.getCategoryIcon(category);
            categoryIcon.style.background = Utils.getCategoryColor(category);
            
            const categoryName = document.createElement('span');
            categoryName.textContent = category.charAt(0).toUpperCase() + category.slice(1);
            
            categoryTitle.appendChild(categoryIcon);
            categoryTitle.appendChild(categoryName);
            
            const aiButton = document.createElement('button');
            aiButton.className = 'ai-suggest-btn';
            aiButton.innerHTML = '> Suggest';
            aiButton.onclick = () => this.getAISuggestion(category);
            
            categoryHeader.appendChild(categoryTitle);
            
            const apiKey = localStorage.getItem('apiKey');
            if (apiKey) {
                categoryHeader.appendChild(aiButton);
            }
            
            const habitsList = document.createElement('div');
            habitsList.className = 'habits-list';
            
            habits.forEach(habit => {
                const isCompleted = todayCompletions.includes(habit.id);
                
                const habitItem = document.createElement('div');
                habitItem.className = `habit-item ${isCompleted ? 'completed' : ''}`;
                habitItem.dataset.habitId = habit.id;
                
                const checkbox = document.createElement('div');
                checkbox.className = `habit-checkbox ${isCompleted ? 'checked' : ''}`;
                checkbox.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleHabit(habit.id);
                };
                
                const habitText = document.createElement('div');
                habitText.className = 'habit-text';
                habitText.textContent = habit.name;
                
                const habitMeta = document.createElement('div');
                habitMeta.className = 'habit-meta';
                
                if (habit.streak > 0) {
                    const streakSpan = document.createElement('span');
                    streakSpan.textContent = `=% ${habit.streak}`;
                    habitMeta.appendChild(streakSpan);
                }
                
                if (habit.time) {
                    const timeSpan = document.createElement('span');
                    timeSpan.textContent = `� ${habit.time}`;
                    habitMeta.appendChild(timeSpan);
                }
                
                habitItem.appendChild(checkbox);
                habitItem.appendChild(habitText);
                if (habitMeta.children.length > 0) {
                    habitItem.appendChild(habitMeta);
                }
                
                habitItem.addEventListener('click', (e) => {
                    if (e.target === checkbox) return;
                    this.showHabitDetails(habit);
                });
                
                habitsList.appendChild(habitItem);
            });
            
            categoryCard.appendChild(categoryHeader);
            categoryCard.appendChild(habitsList);
            container.appendChild(categoryCard);
        }
        
        this.updateDateDisplay();
        this.updateStreakDisplay();
    }

    updateDateDisplay() {
        const dateElement = document.getElementById('currentDate');
        dateElement.textContent = Utils.formatDate(new Date());
    }

    async updateStreakDisplay() {
        const streakElement = document.querySelector('.streak-count');
        let maxStreak = 0;
        
        for (const habit of this.habits) {
            if (habit.streak > maxStreak) {
                maxStreak = habit.streak;
            }
        }
        
        streakElement.textContent = maxStreak;
    }

    showHabitDetails(habit) {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${habit.name}</h2>
                    <button class="close-btn" onclick="this.parentElement.parentElement.parentElement.remove()">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <div class="habit-details">
                    <div class="detail-row">
                        <span class="detail-label">Category:</span>
                        <span class="detail-value">${habit.category}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Frequency:</span>
                        <span class="detail-value">${habit.frequency}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Current Streak:</span>
                        <span class="detail-value">=% ${habit.streak || 0} days</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Best Streak:</span>
                        <span class="detail-value"><� ${habit.bestStreak || 0} days</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Completions:</span>
                        <span class="detail-value">${habit.totalCompletions || 0}</span>
                    </div>
                    ${habit.description ? `
                    <div class="detail-row">
                        <span class="detail-label">Description:</span>
                        <span class="detail-value">${habit.description}</span>
                    </div>
                    ` : ''}
                    <div class="form-actions">
                        <button class="btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
                        <button class="btn-danger" onclick="if(confirm('Delete this habit?')) { habitManager.deleteHabit('${habit.id}'); this.closest('.modal').remove(); }">Delete</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async getAISuggestion(category) {
        const apiKey = localStorage.getItem('apiKey');
        const provider = localStorage.getItem('aiProvider');
        
        if (!apiKey || !provider) {
            Utils.showNotification('Please configure AI settings first', 'warning');
            return;
        }
        
        const categoryHabits = this.habits.filter(h => h.category === category);
        const recentCompletions = [];
        
        for (const habit of categoryHabits.slice(0, 10)) {
            if (habit.lastCompleted) {
                recentCompletions.push(`${habit.name} (${habit.lastCompleted})`);
            }
        }
        
        try {
            const suggestion = await LLMService.getSuggestion(category, recentCompletions);
            
            if (suggestion) {
                const shouldAdd = confirm(`AI Suggestion: ${suggestion}\n\nWould you like to add this habit?`);
                if (shouldAdd) {
                    await this.addHabit({
                        name: suggestion,
                        category: category,
                        frequency: 'daily'
                    });
                }
            }
        } catch (error) {
            Utils.showNotification('Failed to get AI suggestion', 'error');
        }
    }

    async checkForReminders(habitId) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit || !habit.time) return;
        
        const now = new Date();
        const [hours, minutes] = habit.time.split(':').map(Number);
        const reminderTime = new Date();
        reminderTime.setHours(hours, minutes, 0, 0);
        
        if (now.getHours() === hours && Math.abs(now.getMinutes() - minutes) < 5) {
            const notificationsEnabled = await DB.getSetting('enableNotifications');
            if (notificationsEnabled) {
                Utils.sendNotification(`Time for: ${habit.name}`, {
                    body: `Don't forget to complete your ${habit.category} habit!`,
                    tag: habitId,
                    requireInteraction: true
                });
            }
        }
    }
}

window.habitManager = new HabitManager();