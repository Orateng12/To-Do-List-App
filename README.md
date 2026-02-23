<<<<<<< HEAD
# TaskMaster v2.0 - Enhanced To-Do List Application

A **powerful, feature-rich** to-do list application with a modern modular architecture, offline support, and advanced productivity features.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 🚀 What's New in v2.0

### Architecture Improvements
- **ES6 Modules** - Clean, maintainable code structure
- **Pub/Sub Event System** - Decoupled components for better scalability
- **IndexedDB Storage** - Robust data persistence with localStorage fallback
- **State Management** - Centralized state with undo/redo history

### New Features
| Feature | Description |
|---------|-------------|
| 🔍 **Search** | Real-time search through tasks, categories, and notes |
| 📊 **Sorting** | Sort by date, priority, or creation time (asc/desc) |
| 🏷️ **Categories** | Organize tasks with customizable tags |
| ⌨️ **Keyboard Shortcuts** | 15+ shortcuts for power users |
| 🌓 **Themes** | Light/Dark mode with system preference detection |
| ↶ **Undo/Redo** | Full history management (up to 50 actions) |
| 💾 **Export/Import** | JSON backup and restore functionality |
| 📱 **PWA Support** | Install as app, works offline |
| 🍞 **Toast Notifications** | Non-blocking feedback for all actions |
| 📝 **Task Notes** | Add detailed notes to tasks |

---

## 📁 Project Structure

```
To-Do list app/
├── index.html          # Main HTML file
├── manifest.json       # PWA manifest
├── offline.html        # Offline fallback page
├── sw.js               # Service Worker
├── css/
│   └── styles.css      # All styles with theme support
└── js/
    ├── app.js          # Main entry point
    ├── event-bus.js    # Pub/Sub event system
    ├── state.js        # State management with undo/redo
    ├── storage.js      # IndexedDB + localStorage
    ├── ui.js           # UI rendering
    ├── utils.js        # Utility functions
    └── keyboard.js     # Keyboard shortcuts
```

---

## 🎹 Keyboard Shortcuts

Press `Ctrl+/` (or `Cmd+/` on Mac) to view all shortcuts.

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | New task |
| `Ctrl+K` | Focus search |
| `Ctrl+Enter` | Add task |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `J` / `↓` | Select next task |
| `K` / `↑` | Select previous task |
| `Enter` | Toggle selected task |
| `C` | Complete selected task |
| `E` | Edit selected task |
| `Delete` | Delete selected task |
| `T` | Toggle theme |
| `Escape` | Close modal/sidebar |

---

## 🛠️ Technical Deep Dive

### 1. Event Bus (Pub/Sub Pattern)

```javascript
// Subscribe to events
eventBus.on(EVENTS.TASK_ADDED, (data) => {
    console.log('Task added:', data.task);
});

// Emit events
eventBus.emit(EVENTS.TASK_ADDED, { task: newTask });

// One-time subscription
eventBus.once(EVENTS.STORAGE_LOADED, (data) => {
    console.log('Loaded', data.count, 'tasks');
});
```

**Benefits:**
- Loose coupling between components
- Easy to add new features without modifying existing code
- Better testability

### 2. State Management with Undo/Redo

```javascript
class StateManager {
    constructor() {
        this.history = [];
        this.historyIndex = -1;
        this.MAX_HISTORY = 50;
    }

    saveToHistory() {
        this.history.push(JSON.stringify(this.tasks));
        this.historyIndex++;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.tasks = JSON.parse(this.history[this.historyIndex]);
        }
    }
}
```

### 3. Hybrid Storage (IndexedDB + localStorage)

```javascript
async init() {
    try {
        await this.initIndexedDB();
        this.useIndexedDB = true;
    } catch (error) {
        this.useIndexedDB = false; // Fallback to localStorage
    }
}
```

**Why IndexedDB?**
- Much larger storage quota (typically 50MB+)
- Better for structured data
- Async operations don't block UI
- Native JSON support

### 4. Service Worker Caching Strategy

```javascript
// Cache-first strategy for assets
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});
```

---

## 🎨 Theming System

CSS Custom Properties enable seamless theme switching:

```css
:root {
    --bg-primary: #0f0f0f;
    --text-primary: #ffffff;
    --accent-primary: #6366f1;
}

[data-theme="light"] {
    --bg-primary: #f5f5f5;
    --text-primary: #1a1a1a;
}
```

**Features:**
- System preference detection (`prefers-color-scheme`)
- Persistent user preference
- Smooth transitions
- Print-optimized styles

---

## 📦 Installation & Usage

### Option 1: Local Server (Recommended)

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .

# Using PHP
php -S localhost:8000
```

Then open `http://localhost:8000`

### Option 2: Direct File Access

Simply open `index.html` in your browser.

**Note:** Service Worker requires HTTPS or localhost to function.

---

## 🔧 Customization

### Add Custom Categories

```javascript
stateManager.addCategory('work');
stateManager.addCategory('personal');
```

### Modify Keyboard Shortcuts

Edit `js/keyboard.js`:

```javascript
this.register('ctrl+shift+a', 'Custom action', (e) => {
    e.preventDefault();
    // Your custom logic
});
```

### Change Theme Colors

Edit CSS custom properties in `css/styles.css`:

```css
:root {
    --accent-primary: #your-color;
    --accent-hover: #your-hover-color;
}
```

---

## 🐛 Troubleshooting

### Service Worker Not Registering
- Ensure you're on `localhost` or `HTTPS`
- Clear browser cache
- Check browser console for errors

### Data Not Persisting
- Check browser storage permissions
- IndexedDB may be disabled in private browsing
- Try clearing storage and reloading

### Keyboard Shortcuts Not Working
- Ensure no other extension is intercepting keys
- Focus must not be in an input field (except for specific shortcuts)

---

## 📈 Performance Considerations

| Optimization | Implementation |
|--------------|----------------|
| DOM Caching | All elements cached in `uiRenderer.elements` |
| Event Delegation | Single listener for dynamic task cards |
| Debounced Search | 300ms delay to reduce renders |
| CSS Transitions | GPU-accelerated `transform` properties |
| Lazy Loading | Service Worker caches on-demand |

---

## 🧪 Testing Checklist

- [ ] Add task with priority and due date
- [ ] Edit task and add notes
- [ ] Delete task and use undo
- [ ] Filter by active/completed
- [ ] Search for task text
- [ ] Sort by different criteria
- [ ] Add and remove categories
- [ ] Toggle theme
- [ ] Use keyboard shortcuts
- [ ] Export and import tasks
- [ ] Test offline mode
- [ ] Test on mobile devices

---

## 🚀 Future Enhancements

Potential features for v3.0:

1. **Subtasks** - Nested checklists within tasks
2. **Recurring Tasks** - Daily, weekly, monthly repeats
3. **Drag & Drop** - Reorder tasks manually
4. **Cloud Sync** - Firebase/Supabase backend
5. **Collaboration** - Share lists with others
6. **Analytics** - Productivity statistics
7. **Voice Input** - Add tasks via voice
8. **AI Suggestions** - Smart task categorization

---

## 📄 License

MIT License - Feel free to use this project for learning or production.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

**Built with ❤️ using vanilla JavaScript**

No frameworks, no dependencies, just pure web standards.
