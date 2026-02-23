# Quick Start Guide

## Running the App

### Method 1: Using a Local Server (Recommended)

**Using Python:**
```bash
cd "C:\Users\tatat\Projects\To-Do list app"
python -m http.server 8000
```
Then open: http://localhost:8000

**Using Node.js:**
```bash
npx serve .
```

**Using PHP:**
```bash
php -S localhost:8000
```

### Method 2: Direct File Access
Simply double-click `index.html` to open in your browser.

---

## First Steps

1. **Add Your First Task**
   - Type in the input field
   - Press `Enter` or click the `+` button
   - Press `Ctrl+N` to quickly focus the input

2. **Show Advanced Options**
   - Click "Show Options" or press the toggle button
   - Set priority (Low/Medium/High)
   - Set a due date
   - Add categories (comma-separated)

3. **Manage Tasks**
   - Click the checkbox to mark complete
   - Click ✏️ to edit
   - Click 🗑️ to delete
   - Use keyboard: `J/K` to navigate, `C` to complete, `E` to edit

4. **Search & Filter**
   - Use the search bar for real-time search
   - Click filter tabs (All/Active/Completed)
   - Sort by date, priority, or creation time

5. **Undo/Redo**
   - Made a mistake? Press `Ctrl+Z` to undo
   - Press `Ctrl+Y` to redo

6. **Export Backup**
   - Click the 📤 button to export all tasks
   - Keep your data safe!

---

## Keyboard Shortcuts Cheat Sheet

```
Ctrl+N      → New task
Ctrl+K      → Search
Ctrl+Enter  → Add task
Ctrl+Z      → Undo
Ctrl+Y      → Redo
J / ↓       → Next task
K / ↑       → Previous task
Enter       → Toggle complete
E           → Edit task
Delete      → Delete task
T           → Toggle theme
Ctrl+/      → Show all shortcuts
Escape      → Close modals
```

---

## Features Overview

### 🏷️ Categories
Organize tasks with tags like "work", "personal", "shopping"
- Add in the "Categories" field when creating/editing
- Separate multiple with commas
- Click the × to remove a category

### 📊 Sorting Options
- **Newest First** - Most recently created
- **Oldest First** - Chronological order
- **Due Date** - Urgent tasks first
- **Priority** - High priority tasks first

### 🌓 Themes
- Click the 🌙 button to toggle light/dark
- Automatically detects system preference
- Your choice is saved

### 📱 Mobile Use
- Sidebar slides in on mobile
- Touch-friendly interface
- Works offline after first load

---

## Tips for Productivity

1. **Morning Routine**
   - Review tasks sorted by priority
   - Set due dates for today's tasks
   - Use categories to context-switch

2. **Evening Review**
   - Filter by "Completed" to see progress
   - Clear completed tasks
   - Plan tomorrow's tasks

3. **Keyboard Power User**
   - Keep hands on keyboard
   - `J/K` to navigate, `Enter` to complete
   - `Ctrl+Z` if you make a mistake

4. **Weekly Backup**
   - Export your tasks regularly
   - Import when switching devices

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| App not loading | Use a local server instead of direct file |
| Data not saving | Check browser storage permissions |
| Shortcuts not working | Make sure you're not in an input field |
| Offline mode not working | Visit the app while online first |

---

## Need Help?

1. Press `Ctrl+/` in the app for keyboard shortcuts
2. Check the full README.md for detailed documentation
3. Open browser DevTools (F12) to see console logs

**Enjoy using TaskMaster! 🎉**
