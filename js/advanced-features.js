/**
 * TaskMaster - Advanced Features Integration
 * ===========================================
 * 
 * This module integrates all advanced features into a cohesive system:
 * - Task Dependencies & Blocking
 * - Time Blocking & Auto-Scheduling
 * - Energy/Mood Tracking
 * - Bulk Operations
 * - Smart Templates
 * - Archive System
 * - Dependency Graph Visualization
 */

import { eventBus, AppEvents } from './core/event-bus.js';
import { container } from './core/di-container.js';
import { db } from './core/storage.js';
import { DependencyManager } from './dependencies/dependency-manager.js';
import { TimeBlockingScheduler } from './time-blocking/time-blocking.js';
import { EnergyMoodTracker } from './energy/energy-tracker.js';
import { BulkOperationsManager } from './bulk-ops/bulk-operations.js';
import { TemplatesManager } from './templates/templates-manager.js';
import { ArchiveManager } from './archive/archive-manager.js';
import { DependencyGraphVisualizer } from './dependencies/graph-visualizer.js';

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    AUTO_ARCHIVE_ENABLED: true,
    AUTO_ARCHIVE_INTERVAL: 24 * 60 * 60 * 1000, // 24 hours
    ENERGY_REMINDER_INTERVAL: 4 * 60 * 60 * 1000, // 4 hours
    TEMPLATE_SUGGESTIONS_ENABLED: true
};

// ============================================
// ADVANCED FEATURES MANAGER
// ============================================
class AdvancedFeaturesManager {
    constructor(taskRepository, ui) {
        this.taskRepository = taskRepository;
        this.ui = ui;
        
        // Initialize all managers
        this.dependencyManager = new DependencyManager(taskRepository);
        this.timeBlockingScheduler = new TimeBlockingScheduler(taskRepository, this.dependencyManager);
        this.energyTracker = new EnergyMoodTracker(taskRepository, db);
        this.bulkOps = new BulkOperationsManager(taskRepository, ui);
        this.templates = new TemplatesManager(taskRepository, db);
        this.archive = new ArchiveManager(taskRepository, db);
        
        // Graph visualizer (initialized on demand)
        this.graphVisualizer = null;
        
        // State
        this.initialized = false;
        this.autoArchiveTimer = null;
        this.energyReminderTimer = null;
    }

    /**
     * Initialize all advanced features
     */
    async initialize() {
        if (this.initialized) return;

        console.log('🚀 Initializing Advanced Features...');

        // Initialize UI components
        this._initUIComponents();
        
        // Initialize event listeners
        this._initEventListeners();
        
        // Start background tasks
        this._startBackgroundTasks();
        
        // Load saved settings
        await this._loadSettings();
        
        this.initialized = true;
        
        eventBus.emit(AppEvents.ADVANCED_FEATURES_READY, {
            features: [
                'dependencies',
                'time-blocking',
                'energy-tracking',
                'bulk-operations',
                'templates',
                'archive'
            ]
        });
        
        console.log('✅ Advanced Features initialized');
    }

    /**
     * Initialize UI components
     */
    _initUIComponents() {
        // Add selection toolbar
        this._createSelectionToolbar();
        
        // Add energy tracker widget
        this._createEnergyTrackerWidget();
        
        // Add templates panel
        this._createTemplatesPanel();
        
        // Add archive view
        this._createArchiveView();
        
        // Add dependency graph modal
        this._createGraphModal();
    }

    /**
     * Create selection toolbar for bulk operations
     */
    _createSelectionToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'selection-toolbar';
        toolbar.id = 'selectionToolbar';
        toolbar.innerHTML = `
            <span class="selection-count">0 selected</span>
            <div class="selection-actions">
                <button class="selection-btn" data-action="complete" title="Complete Selected">
                    <span>✓</span> Complete
                </button>
                <button class="selection-btn" data-action="priority" title="Set Priority">
                    <span>🚩</span> Priority
                </button>
                <button class="selection-btn" data-action="export" title="Export Selected">
                    <span>📄</span> Export
                </button>
                <button class="selection-btn danger" data-action="delete" title="Delete Selected">
                    <span>🗑</span> Delete
                </button>
                <button class="selection-btn" data-action="clear" title="Clear Selection">
                    <span>✕</span>
                </button>
            </div>
        `;
        
        document.body.appendChild(toolbar);
        
        // Bind toolbar actions
        toolbar.addEventListener('click', (e) => {
            const btn = e.target.closest('.selection-btn');
            if (!btn) return;
            
            const action = btn.dataset.action;
            this._handleToolbarAction(action);
        });
        
        // Update toolbar on selection change
        eventBus.on(AppEvents.SELECTION_CHANGED, (data) => {
            const count = data.count;
            toolbar.classList.toggle('visible', count > 0);
            toolbar.querySelector('.selection-count').textContent = `${count} selected`;
        });
    }

    /**
     * Create energy tracker widget
     */
    _createEnergyTrackerWidget() {
        const widget = document.createElement('div');
        widget.className = 'energy-tracker-widget';
        widget.id = 'energyTrackerWidget';
        widget.style.display = 'none';
        widget.innerHTML = `
            <div class="energy-tracker-header">
                <span class="energy-tracker-title">⚡ Energy & Mood Check-in</span>
                <button class="btn-close" id="closeEnergyWidget" title="Close">&times;</button>
            </div>
            <div class="energy-input-container">
                <input type="range" class="energy-slider" id="energySlider" 
                       min="1" max="10" value="5">
                <span class="energy-level-display" id="energyLevelDisplay">5</span>
            </div>
            <div class="mood-selector" id="moodSelector">
                <button class="mood-btn" data-mood="focused">🎯 Focused</button>
                <button class="mood-btn" data-mood="creative">💡 Creative</button>
                <button class="mood-btn" data-mood="energetic">⚡ Energetic</button>
                <button class="mood-btn" data-mood="calm">😌 Calm</button>
                <button class="mood-btn" data-mood="stressed">😰 Stressed</button>
                <button class="mood-btn" data-mood="tired">😴 Tired</button>
                <button class="mood-btn" data-mood="motivated">🔥 Motivated</button>
                <button class="mood-btn" data-mood="neutral">😐 Neutral</button>
            </div>
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                <button class="btn-save" id="saveEnergyLog" style="flex: 1;">Log Check-in</button>
                <button class="btn-secondary" id="getRecommendations" style="flex: 1;">Get Recommendations</button>
            </div>
        `;
        
        // Insert after task input section
        const inputSection = document.querySelector('.input-section');
        if (inputSection) {
            inputSection.parentNode.insertBefore(widget, inputSection.nextSibling);
        }
        
        // Bind events
        this._bindEnergyWidgetEvents();
    }

    /**
     * Bind energy widget events
     */
    _bindEnergyWidgetEvents() {
        const slider = document.getElementById('energySlider');
        const display = document.getElementById('energyLevelDisplay');
        const closeBtn = document.getElementById('closeEnergyWidget');
        const saveBtn = document.getElementById('saveEnergyLog');
        const recommendBtn = document.getElementById('getRecommendations');
        const moodBtns = document.querySelectorAll('.mood-btn');
        
        let selectedMood = null;
        
        // Slider value display
        slider?.addEventListener('input', (e) => {
            display.textContent = e.target.value;
        });
        
        // Mood selection
        moodBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                moodBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedMood = btn.dataset.mood;
            });
        });
        
        // Close
        closeBtn?.addEventListener('click', () => {
            widget.style.display = 'none';
        });
        
        // Save log
        saveBtn?.addEventListener('click', async () => {
            const energy = parseInt(slider.value);
            if (selectedMood) {
                await this.energyTracker.logCombined(energy, selectedMood, 3);
                this.ui.showToast('Energy & mood logged!', 'success');
            } else {
                await this.energyTracker.logEnergy(energy);
                this.ui.showToast('Energy level logged!', 'success');
            }
            widget.style.display = 'none';
        });
        
        // Get recommendations
        recommendBtn?.addEventListener('click', async () => {
            const energy = parseInt(slider.value);
            const state = { energy, mood: selectedMood || 'neutral', moodIntensity: 3 };
            const recommendations = await this.energyTracker.getRecommendations(state);
            
            this._showRecommendations(recommendations);
        });
    }

    /**
     * Create templates panel
     */
    _createTemplatesPanel() {
        const panel = document.createElement('div');
        panel.className = 'templates-panel';
        panel.id = 'templatesPanel';
        panel.style.display = 'none';
        panel.innerHTML = `
            <div class="modal-header" style="padding: 1rem; border-bottom: 1px solid var(--border-color);">
                <h3>📋 Task Templates</h3>
                <button class="modal-close" id="closeTemplatesPanel">&times;</button>
            </div>
            <div class="templates-grid" id="templatesGrid"></div>
        `;
        
        document.body.appendChild(panel);
        
        // Bind close button
        document.getElementById('closeTemplatesPanel')?.addEventListener('click', () => {
            panel.style.display = 'none';
        });
        
        // Load templates
        this._loadTemplatesGrid();
    }

    /**
     * Load templates into grid
     */
    async _loadTemplatesGrid() {
        const grid = document.getElementById('templatesGrid');
        if (!grid) return;
        
        const templates = await this.templates.getAllTemplates();
        
        grid.innerHTML = templates.map(t => `
            <div class="template-card" data-template-id="${t.id}">
                <div class="template-card-header">
                    <span class="template-icon">${t.icon}</span>
                    <div>
                        <div class="template-name">${t.name}</div>
                        <span class="template-category-badge">${t.category}</span>
                    </div>
                </div>
                <div class="template-description">${t.description}</div>
                <div class="template-task-count">
                    <span>📝</span> ${t.tasks.length} tasks
                </div>
            </div>
        `).join('');
        
        // Bind template clicks
        grid.addEventListener('click', async (e) => {
            const card = e.target.closest('.template-card');
            if (!card) return;
            
            const templateId = card.dataset.templateId;
            const confirmed = confirm('Apply this template? This will create multiple tasks.');
            
            if (confirmed) {
                await this.templates.applyTemplate(templateId);
                this.ui.showToast('Template applied!', 'success');
                // Refresh task list
                const tasks = await this.taskRepository.getAll();
                this.ui.render(tasks);
            }
        });
    }

    /**
     * Create archive view
     */
    _createArchiveView() {
        const view = document.createElement('div');
        view.className = 'archive-view';
        view.id = 'archiveView';
        view.style.display = 'none';
        view.innerHTML = `
            <div class="archive-header">
                <h3>🗄️ Archived Tasks</h3>
                <div class="archive-stats" id="archiveStats"></div>
            </div>
            <div class="archive-filters" style="margin-bottom: 1rem;">
                <input type="text" id="archiveSearch" placeholder="Search archived tasks..." 
                       style="padding: 0.5rem; border-radius: 6px; border: 1px solid var(--border-color); background: var(--bg-tertiary); color: var(--text-primary); width: 300px;">
            </div>
            <div id="archivedTasksList"></div>
        `;
        
        // Insert in main content
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.appendChild(view);
        }
        
        // Bind search
        document.getElementById('archiveSearch')?.addEventListener('input', async (e) => {
            await this._loadArchivedTasks(e.target.value);
        });
    }

    /**
     * Load archived tasks
     */
    async _loadArchivedTasks(search = '') {
        const list = document.getElementById('archivedTasksList');
        const stats = document.getElementById('archiveStats');
        if (!list) return;
        
        const archived = await this.archive.getArchivedTasks({ search });
        const statsData = await this.archive.getStats();
        
        // Update stats
        stats.innerHTML = `
            <div class="archive-stat">
                <div class="archive-stat-value">${statsData.totalArchived}</div>
                <div class="archive-stat-label">Total</div>
            </div>
            <div class="archive-stat">
                <div class="archive-stat-value">${statsData.storageSizeKB} KB</div>
                <div class="archive-stat-label">Storage</div>
            </div>
        `;
        
        // Update list
        if (archived.length === 0) {
            list.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-muted);">No archived tasks</div>';
        } else {
            list.innerHTML = archived.map(task => `
                <div class="archived-task-item">
                    <div class="archived-task-info">
                        <div class="archived-task-text">${task.text}</div>
                        <div class="archived-task-meta">
                            Archived: ${new Date(task.archivedAt).toLocaleDateString()} | 
                            Priority: ${task.priority}
                        </div>
                    </div>
                    <div class="archived-task-actions">
                        <button class="btn-restore" data-action="restore" data-task-id="${task.id}">Restore</button>
                        <button class="btn-delete-permanent" data-action="delete" data-task-id="${task.id}">Delete</button>
                    </div>
                </div>
            `).join('');
            
            // Bind actions
            list.querySelectorAll('[data-action="restore"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    await this.archive.restoreTask(btn.dataset.taskId);
                    this.ui.showToast('Task restored', 'success');
                    await this._loadArchivedTasks(search);
                    // Refresh main task list
                    const tasks = await this.taskRepository.getAll();
                    this.ui.render(tasks);
                });
            });
            
            list.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const confirmed = confirm('Permanently delete this task? This cannot be undone.');
                    if (confirmed) {
                        await this.archive.permanentlyDelete(btn.dataset.taskId);
                        this.ui.showToast('Task permanently deleted', 'info');
                        await this._loadArchivedTasks(search);
                    }
                });
            });
        }
    }

    /**
     * Create dependency graph modal
     */
    _createGraphModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'dependencyGraphModal';
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content large">
                <div class="modal-header">
                    <h3>🕸️ Dependency Graph</h3>
                    <button class="modal-close" id="closeGraphModal">&times;</button>
                </div>
                <div class="dependency-graph-container" id="dependencyGraphContainer"></div>
                <div style="padding: 1rem; display: flex; gap: 0.5rem; flex-wrap: wrap;">
                    <button class="btn-secondary" id="refreshGraph">🔄 Refresh</button>
                    <button class="btn-secondary" id="toggleCriticalPath">⚡ Toggle Critical Path</button>
                    <button class="btn-secondary" id="addDependency">🔗 Add Dependency</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Bind close
        document.getElementById('closeGraphModal')?.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.querySelector('.modal-overlay')?.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        // Bind refresh
        document.getElementById('refreshGraph')?.addEventListener('click', async () => {
            await this.showDependencyGraph();
        });
        
        // Bind critical path toggle
        document.getElementById('toggleCriticalPath')?.addEventListener('click', () => {
            if (this.graphVisualizer) {
                this.graphVisualizer.showCriticalPath = !this.graphVisualizer.showCriticalPath;
            }
        });
        
        // Bind add dependency
        document.getElementById('addDependency')?.addEventListener('click', () => {
            this._showAddDependencyDialog();
        });
        
        // Listen for graph events
        eventBus.on(AppEvents.GRAPH_NODE_DOUBLE_CLICK, async (data) => {
            const task = await this.taskRepository.getById(data.node.id);
            if (task) {
                this.ui.showToast(`Task: ${task.text}`, 'info');
            }
        });
    }

    /**
     * Show dependency graph
     */
    async showDependencyGraph() {
        const modal = document.getElementById('dependencyGraphModal');
        const container = document.getElementById('dependencyGraphContainer');
        
        if (!modal || !container) return;
        
        modal.style.display = 'block';
        
        // Destroy existing visualizer
        if (this.graphVisualizer) {
            this.graphVisualizer.destroy();
        }
        
        // Create new visualizer
        const tasks = await this.taskRepository.getAll();
        this.graphVisualizer = new DependencyGraphVisualizer(container, this.dependencyManager);
        await this.graphVisualizer.init(tasks);
    }

    /**
     * Show add dependency dialog
     */
    _showAddDependencyDialog() {
        // Simple prompt-based for now (can be enhanced with a proper modal)
        const predecessorId = prompt('Enter predecessor task ID:');
        if (!predecessorId) return;
        
        const successorId = prompt('Enter successor task ID:');
        if (!successorId) return;
        
        this.dependencyManager.addDependency(predecessorId, successorId)
            .then(() => {
                this.ui.showToast('Dependency added!', 'success');
                this.showDependencyGraph();
            })
            .catch(err => {
                this.ui.showToast(err.message, 'error');
            });
    }

    /**
     * Show recommendations panel
     */
    _showRecommendations(recommendations) {
        // Create or update recommendations panel
        let panel = document.getElementById('recommendationsPanel');
        
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'recommendations-panel';
            panel.id = 'recommendationsPanel';
            
            const mainContent = document.querySelector('.main-content');
            mainContent?.insertBefore(panel, mainContent.firstChild);
        }
        
        const bestMatches = recommendations.bestMatch?.slice(0, 5) || [];
        
        panel.innerHTML = `
            <div class="recommendations-header">
                <h4>🎯 Recommended Tasks</h4>
                <button class="btn-close" onclick="document.getElementById('recommendationsPanel').remove()">&times;</button>
            </div>
            ${bestMatches.map(({ task, score }) => `
                <div class="recommendation-item">
                    <div>
                        <div style="font-weight: 600;">${task.text}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">
                            Priority: ${task.priority} | 
                            Est. Duration: ${task.estimatedDuration || 30} min
                        </div>
                    </div>
                    <div class="recommendation-score">
                        <div class="score-bar">
                            <div class="score-fill" style="width: ${score.total * 100}%"></div>
                        </div>
                        <span style="font-size: 0.75rem;">${Math.round(score.total * 100)}%</span>
                    </div>
                </div>
            `).join('')}
        `;
    }

    /**
     * Initialize event listeners
     */
    _initEventListeners() {
        // Listen for task deletion to handle dependencies
        eventBus.on(AppEvents.TASK_DELETED, async ({ task }) => {
            if (task.dependencies || task.dependents) {
                await this.dependencyManager.handleTaskDeletion(task.id);
            }
        });
        
        // Listen for task completion to update blocked tasks
        eventBus.on(AppEvents.TASK_COMPLETED, async () => {
            // Could trigger notifications for unblocked tasks
        });
    }

    /**
     * Start background tasks
     */
    _startBackgroundTasks() {
        // Auto-archive
        if (CONFIG.AUTO_ARCHIVE_ENABLED) {
            this.autoArchiveTimer = setInterval(async () => {
                const stats = await this.archive.autoArchive();
                if (stats.archivedCount > 0) {
                    console.log(`Auto-archived ${stats.archivedCount} tasks`);
                }
            }, CONFIG.AUTO_ARCHIVE_INTERVAL);
        }
        
        // Energy reminders
        this.energyReminderTimer = setInterval(() => {
            const hour = new Date().getHours();
            if (hour >= 9 && hour <= 17) { // Work hours
                this.ui.showToast('💡 How\'s your energy level?', 'info', {
                    actionText: 'Log',
                    onAction: () => {
                        document.getElementById('energyTrackerWidget').style.display = 'block';
                    }
                });
            }
        }, CONFIG.ENERGY_REMINDER_INTERVAL);
    }

    /**
     * Load saved settings
     */
    async _loadSettings() {
        // Load any saved preferences
    }

    /**
     * Handle toolbar action
     */
    _handleToolbarAction(action) {
        switch (action) {
            case 'complete':
                this.bulkOps.batchComplete();
                break;
            case 'delete':
                this.bulkOps.batchDelete();
                break;
            case 'priority':
                // Show priority submenu (simplified)
                const priority = prompt('Set priority (high/medium/low):');
                if (priority && ['high', 'medium', 'low'].includes(priority)) {
                    this.bulkOps.batchSetPriority(priority);
                }
                break;
            case 'export':
                this.bulkOps.batchExport('json');
                break;
            case 'clear':
                this.bulkOps.clearSelection();
                break;
        }
    }

    /**
     * Destroy and cleanup
     */
    destroy() {
        if (this.autoArchiveTimer) {
            clearInterval(this.autoArchiveTimer);
        }
        if (this.energyReminderTimer) {
            clearInterval(this.energyReminderTimer);
        }
        if (this.graphVisualizer) {
            this.graphVisualizer.destroy();
        }
    }
}

// Export singleton
export const advancedFeatures = null;

// Initialize on demand
export function initAdvancedFeatures(taskRepository, ui) {
    if (!advancedFeatures) {
        const manager = new AdvancedFeaturesManager(taskRepository, ui);
        manager.initialize();
        return manager;
    }
    return advancedFeatures;
}

export { AdvancedFeaturesManager };
