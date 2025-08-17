# Track My - Habit Tracker PWA

A beautiful, privacy-focused habit tracking Progressive Web App with AI-powered suggestions. Track your daily habits, build streaks, and get personalized recommendations to improve your routines.

## Features

- **Dark Theme Design**: Beautiful dark aesthetic optimized for daily use
- **Category Organization**: Organize habits by Health, Fitness, Learning, Family, Work, and Mindfulness
- **Streak Tracking**: Visual streak indicators and achievement tracking
- **AI-Powered Suggestions**: Get personalized habit recommendations using OpenAI or Anthropic
- **Offline First**: Works completely offline with local data storage
- **Privacy Focused**: All data stored locally on your device
- **Touch Gestures**: Swipe to complete or delete habits
- **PWA Installable**: Install as a native app on any device

## Demo

Visit [https://vwilson05.github.io/track-my/](https://vwilson05.github.io/track-my/) to try the app.

## Installation

### Install as PWA (Recommended)

1. Visit the app URL on your device
2. For iOS: Tap the share button and select "Add to Home Screen"
3. For Android: Tap the menu and select "Install App"
4. For Desktop: Look for the install icon in the address bar

### Local Development

```bash
# Clone the repository
git clone https://github.com/vwilson05/track-my.git
cd track-my

# Serve locally (requires any static server)
npx serve .
# or
python -m http.server 8000
```

## Usage

### Getting Started

1. Click the "+" button to add your first habit
2. Choose a category and set the frequency
3. Tap checkboxes to mark habits complete
4. Build streaks by completing habits daily

### AI Suggestions (Optional)

1. Open Settings from the bottom navigation
2. Select your AI provider (OpenAI or Anthropic)
3. Enter your API key (stored locally)
4. Click "Suggest" on any category to get AI recommendations

### Touch Gestures

- **Swipe Right**: Mark habit as complete/incomplete
- **Swipe Left**: Delete habit (with confirmation)
- **Tap Habit**: View detailed statistics
- **Long Press**: Edit habit details

## Data Management

### Export Your Data
1. Go to Settings
2. Click "Export Data"
3. Save the JSON file for backup

### Import Data
1. Go to Settings
2. Click "Import Data"
3. Select your backup JSON file

### Privacy
- All data is stored locally using IndexedDB
- No servers or external databases
- API keys are encrypted in localStorage
- No telemetry or tracking

## Technology Stack

- **Frontend**: Vanilla JavaScript with Web Components
- **Styling**: CSS3 with CSS Variables
- **Storage**: IndexedDB for data, localStorage for settings
- **PWA**: Service Worker for offline functionality
- **AI**: OpenAI GPT-3.5 or Anthropic Claude integration
- **Deployment**: GitHub Pages with GitHub Actions

## Browser Support

- Chrome/Edge 90+
- Safari 14+ (iOS 14+)
- Firefox 88+
- Samsung Internet 14+

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Roadmap

- [ ] Add data sync across devices
- [ ] Calendar heat map visualization
- [ ] Habit templates library
- [ ] Social accountability features
- [ ] Widget support for mobile
- [ ] Advanced analytics with Chart.js
- [ ] Voice input for habits
- [ ] Gamification elements

## License

This project is open source and available under the MIT License.

## Acknowledgments

- Icons generated using Canvas API
- Dark theme inspired by modern design systems
- PWA patterns from web.dev best practices

## Support

For issues, questions, or suggestions, please open an issue on GitHub.

---

Built with passion for better habits and routines.