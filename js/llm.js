class LLMService {
    constructor() {
        this.providers = {
            openai: {
                url: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-3.5-turbo',
                headers: (apiKey) => ({
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                }),
                formatRequest: (prompt, model) => ({
                    model: model || 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful habit tracking assistant. Suggest specific, actionable habits based on the user\'s history and category.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 100,
                    temperature: 0.7
                }),
                parseResponse: (data) => data.choices[0].message.content.trim()
            },
            anthropic: {
                url: 'https://api.anthropic.com/v1/messages',
                model: 'claude-3-haiku-20240307',
                headers: (apiKey) => ({
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                }),
                formatRequest: (prompt, model) => ({
                    model: model || 'claude-3-haiku-20240307',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: 100,
                    system: 'You are a helpful habit tracking assistant. Suggest specific, actionable habits based on the user\'s history and category.'
                }),
                parseResponse: (data) => data.content[0].text.trim()
            }
        };
    }

    async getSuggestion(category, recentHabits = []) {
        const provider = localStorage.getItem('aiProvider');
        const apiKey = localStorage.getItem('apiKey');
        
        if (!provider || !apiKey) {
            throw new Error('AI provider not configured');
        }
        
        const providerConfig = this.providers[provider];
        if (!providerConfig) {
            throw new Error('Invalid AI provider');
        }
        
        const prompt = this.buildPrompt(category, recentHabits);
        
        try {
            const response = await fetch(providerConfig.url, {
                method: 'POST',
                headers: providerConfig.headers(apiKey),
                body: JSON.stringify(providerConfig.formatRequest(prompt))
            });
            
            if (!response.ok) {
                const error = await response.text();
                console.error('AI API error:', error);
                throw new Error('Failed to get AI suggestion');
            }
            
            const data = await response.json();
            const suggestion = providerConfig.parseResponse(data);
            
            return this.cleanSuggestion(suggestion);
        } catch (error) {
            console.error('Error getting AI suggestion:', error);
            throw error;
        }
    }

    buildPrompt(category, recentHabits) {
        let prompt = `Suggest a new ${category} habit for someone to track.`;
        
        if (recentHabits.length > 0) {
            prompt += ` They have recently completed these ${category} habits: ${recentHabits.join(', ')}.`;
            prompt += ` Suggest something different but complementary to what they're already doing.`;
        } else {
            prompt += ` This is their first ${category} habit, so suggest something beginner-friendly.`;
        }
        
        prompt += ` The suggestion should be:`;
        prompt += ` 1. Specific and measurable`;
        prompt += ` 2. Achievable daily`;
        prompt += ` 3. Related to ${category}`;
        prompt += ` 4. Under 10 words`;
        prompt += ` Return only the habit name, no explanation.`;
        
        return prompt;
    }

    cleanSuggestion(suggestion) {
        suggestion = suggestion.replace(/^["']|["']$/g, '');
        suggestion = suggestion.replace(/^\d+\.\s*/, '');
        suggestion = suggestion.replace(/^-\s*/, '');
        suggestion = suggestion.replace(/^\*\s*/, '');
        
        if (suggestion.length > 50) {
            suggestion = suggestion.substring(0, 50).trim() + '...';
        }
        
        return suggestion;
    }

    async testConnection() {
        const provider = localStorage.getItem('aiProvider');
        const apiKey = localStorage.getItem('apiKey');
        
        if (!provider || !apiKey) {
            return { success: false, error: 'AI provider not configured' };
        }
        
        try {
            const suggestion = await this.getSuggestion('health', []);
            return { success: true, message: 'Connection successful' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    getCategoryPrompts() {
        return {
            health: {
                examples: ['Drink 8 glasses of water', 'Take vitamins', 'Sleep 8 hours'],
                focus: 'physical and mental well-being'
            },
            fitness: {
                examples: ['30 minute walk', '10 pushups', 'Stretch for 5 minutes'],
                focus: 'physical activity and exercise'
            },
            learning: {
                examples: ['Read 10 pages', 'Practice new skill', 'Watch educational video'],
                focus: 'knowledge and skill development'
            },
            family: {
                examples: ['Call a family member', 'Family dinner', 'Play with kids'],
                focus: 'family connections and quality time'
            },
            work: {
                examples: ['Review daily goals', 'Clean workspace', 'Update task list'],
                focus: 'productivity and professional growth'
            },
            mindfulness: {
                examples: ['Meditate 10 minutes', 'Journal thoughts', 'Practice gratitude'],
                focus: 'mental clarity and emotional balance'
            }
        };
    }

    async getMultipleSuggestions(category, count = 3) {
        const suggestions = [];
        const recentHabits = [];
        
        for (let i = 0; i < count; i++) {
            try {
                const suggestion = await this.getSuggestion(category, recentHabits);
                if (suggestion && !suggestions.includes(suggestion)) {
                    suggestions.push(suggestion);
                    recentHabits.push(suggestion);
                }
            } catch (error) {
                console.error('Error getting suggestion:', error);
            }
        }
        
        return suggestions;
    }
}

window.LLMService = new LLMService();