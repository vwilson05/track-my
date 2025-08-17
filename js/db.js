class Database {
    constructor() {
        this.dbName = 'TrackMyDB';
        this.version = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('habits')) {
                    const habitsStore = db.createObjectStore('habits', { keyPath: 'id' });
                    habitsStore.createIndex('category', 'category', { unique: false });
                    habitsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                if (!db.objectStoreNames.contains('completions')) {
                    const completionsStore = db.createObjectStore('completions', { keyPath: 'date' });
                }

                if (!db.objectStoreNames.contains('categories')) {
                    const categoriesStore = db.createObjectStore('categories', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }
            };
        });
    }

    async addHabit(habit) {
        const transaction = this.db.transaction(['habits'], 'readwrite');
        const store = transaction.objectStore('habits');
        
        const habitData = {
            ...habit,
            id: habit.id || Utils.generateId(),
            createdAt: habit.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            streak: 0,
            bestStreak: 0,
            totalCompletions: 0
        };
        
        return new Promise((resolve, reject) => {
            const request = store.add(habitData);
            request.onsuccess = () => resolve(habitData);
            request.onerror = () => reject(request.error);
        });
    }

    async updateHabit(id, updates) {
        const transaction = this.db.transaction(['habits'], 'readwrite');
        const store = transaction.objectStore('habits');
        
        return new Promise(async (resolve, reject) => {
            const getRequest = store.get(id);
            
            getRequest.onsuccess = () => {
                const habit = getRequest.result;
                if (!habit) {
                    reject(new Error('Habit not found'));
                    return;
                }
                
                const updated = {
                    ...habit,
                    ...updates,
                    updatedAt: new Date().toISOString()
                };
                
                const putRequest = store.put(updated);
                putRequest.onsuccess = () => resolve(updated);
                putRequest.onerror = () => reject(putRequest.error);
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async deleteHabit(id) {
        const transaction = this.db.transaction(['habits'], 'readwrite');
        const store = transaction.objectStore('habits');
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getHabits(category = null) {
        const transaction = this.db.transaction(['habits'], 'readonly');
        const store = transaction.objectStore('habits');
        
        return new Promise((resolve, reject) => {
            let request;
            
            if (category) {
                const index = store.index('category');
                request = index.getAll(category);
            } else {
                request = store.getAll();
            }
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getHabit(id) {
        const transaction = this.db.transaction(['habits'], 'readonly');
        const store = transaction.objectStore('habits');
        
        return new Promise((resolve, reject) => {
            const request = store.get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async markComplete(habitId, date = new Date()) {
        const dateKey = Utils.getDayKey(date);
        const transaction = this.db.transaction(['completions', 'habits'], 'readwrite');
        const completionsStore = transaction.objectStore('completions');
        const habitsStore = transaction.objectStore('habits');
        
        return new Promise(async (resolve, reject) => {
            const getRequest = completionsStore.get(dateKey);
            
            getRequest.onsuccess = async () => {
                let completion = getRequest.result || { date: dateKey, habits: [] };
                
                if (!completion.habits.includes(habitId)) {
                    completion.habits.push(habitId);
                    
                    const putRequest = completionsStore.put(completion);
                    
                    putRequest.onsuccess = async () => {
                        const habit = await this.getHabit(habitId);
                        if (habit) {
                            const completions = await this.getCompletions();
                            const streak = Utils.calculateStreak(completions, habitId);
                            
                            await this.updateHabit(habitId, {
                                streak,
                                bestStreak: Math.max(streak, habit.bestStreak || 0),
                                totalCompletions: (habit.totalCompletions || 0) + 1,
                                lastCompleted: dateKey
                            });
                        }
                        resolve(completion);
                    };
                    
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    resolve(completion);
                }
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async markIncomplete(habitId, date = new Date()) {
        const dateKey = Utils.getDayKey(date);
        const transaction = this.db.transaction(['completions', 'habits'], 'readwrite');
        const completionsStore = transaction.objectStore('completions');
        
        return new Promise(async (resolve, reject) => {
            const getRequest = completionsStore.get(dateKey);
            
            getRequest.onsuccess = async () => {
                const completion = getRequest.result;
                
                if (completion && completion.habits.includes(habitId)) {
                    completion.habits = completion.habits.filter(id => id !== habitId);
                    
                    let request;
                    if (completion.habits.length === 0) {
                        request = completionsStore.delete(dateKey);
                    } else {
                        request = completionsStore.put(completion);
                    }
                    
                    request.onsuccess = async () => {
                        const habit = await this.getHabit(habitId);
                        if (habit) {
                            const completions = await this.getCompletions();
                            const streak = Utils.calculateStreak(completions, habitId);
                            
                            await this.updateHabit(habitId, {
                                streak,
                                totalCompletions: Math.max(0, (habit.totalCompletions || 0) - 1)
                            });
                        }
                        resolve(completion);
                    };
                    
                    request.onerror = () => reject(request.error);
                } else {
                    resolve(null);
                }
            };
            
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    async getCompletions(startDate = null, endDate = null) {
        const transaction = this.db.transaction(['completions'], 'readonly');
        const store = transaction.objectStore('completions');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            
            request.onsuccess = () => {
                let completions = request.result;
                
                if (startDate || endDate) {
                    completions = completions.filter(c => {
                        // c.date is stored as "YYYY-MM-DD" string
                        const date = new Date(c.date + 'T00:00:00');
                        const startDateKey = startDate ? Utils.getDayKey(startDate) : null;
                        const endDateKey = endDate ? Utils.getDayKey(endDate) : null;
                        
                        if (startDateKey && c.date < startDateKey) return false;
                        if (endDateKey && c.date > endDateKey) return false;
                        return true;
                    });
                }
                
                const completionMap = {};
                completions.forEach(c => {
                    completionMap[c.date] = c.habits;
                });
                
                resolve(completionMap);
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    async getCompletionsForDate(date = new Date()) {
        const dateKey = Utils.getDayKey(date);
        const transaction = this.db.transaction(['completions'], 'readonly');
        const store = transaction.objectStore('completions');
        
        return new Promise((resolve, reject) => {
            const request = store.get(dateKey);
            request.onsuccess = () => resolve(request.result?.habits || []);
            request.onerror = () => reject(request.error);
        });
    }

    async saveSetting(key, value) {
        const transaction = this.db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.put({ key, value, updatedAt: new Date().toISOString() });
            request.onsuccess = () => resolve({ key, value });
            request.onerror = () => reject(request.error);
        });
    }

    async getSetting(key) {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result?.value);
            request.onerror = () => reject(request.error);
        });
    }

    async getAllSettings() {
        const transaction = this.db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const settings = {};
                request.result.forEach(s => {
                    settings[s.key] = s.value;
                });
                resolve(settings);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async exportAllData() {
        const habits = await this.getHabits();
        const completions = await this.getCompletions();
        const settings = await this.getAllSettings();
        
        return {
            version: this.version,
            exportDate: new Date().toISOString(),
            data: {
                habits,
                completions,
                settings
            }
        };
    }

    async importData(importedData) {
        if (!importedData.data) {
            throw new Error('Invalid import data format');
        }
        
        const { habits, completions, settings } = importedData.data;
        
        const transaction = this.db.transaction(['habits', 'completions', 'settings'], 'readwrite');
        
        if (habits) {
            const habitsStore = transaction.objectStore('habits');
            for (const habit of habits) {
                await new Promise((resolve, reject) => {
                    const request = habitsStore.put(habit);
                    request.onsuccess = resolve;
                    request.onerror = reject;
                });
            }
        }
        
        if (completions) {
            const completionsStore = transaction.objectStore('completions');
            for (const [date, habitIds] of Object.entries(completions)) {
                await new Promise((resolve, reject) => {
                    const request = completionsStore.put({ date, habits: habitIds });
                    request.onsuccess = resolve;
                    request.onerror = reject;
                });
            }
        }
        
        if (settings) {
            const settingsStore = transaction.objectStore('settings');
            for (const [key, value] of Object.entries(settings)) {
                await new Promise((resolve, reject) => {
                    const request = settingsStore.put({ key, value });
                    request.onsuccess = resolve;
                    request.onerror = reject;
                });
            }
        }
        
        return true;
    }

    async clearAllData() {
        const transaction = this.db.transaction(['habits', 'completions', 'settings'], 'readwrite');
        
        const stores = ['habits', 'completions', 'settings'];
        const promises = stores.map(storeName => {
            return new Promise((resolve, reject) => {
                const store = transaction.objectStore(storeName);
                const request = store.clear();
                request.onsuccess = resolve;
                request.onerror = reject;
            });
        });
        
        await Promise.all(promises);
        return true;
    }
}

window.DB = new Database();