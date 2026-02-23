/**
 * AI Task Assistant - Chatbot Interface
 * =======================================
 * Conversational AI for task management assistance
 */

import { eventBus, EVENTS } from '../core/event-bus.js';
import { createTaskNLP } from '../nlp/nlp-parser.js';

/**
 * AI Assistant Engine
 */
export class TaskAssistant {
    constructor() {
        this.nlp = createTaskNLP();
        this.conversationHistory = [];
        this.context = {};
        this.intents = this.setupIntents();
    }

    /**
     * Setup intent handlers
     */
    setupIntents() {
        return {
            // Task creation intent
            create_task: {
                patterns: [
                    /add.*task/i,
                    /create.*task/i,
                    /i need to/i,
                    /i want to/i,
                    /remind me to/i,
                    /don't forget to/i
                ],
                handler: (message) => this.handleCreateTask(message)
            },
            
            // Task listing intent
            list_tasks: {
                patterns: [
                    /show.*task/i,
                    /list.*task/i,
                    /what.*do/i,
                    /what's.*left/i,
                    /my.*task/i,
                    /pending.*task/i
                ],
                handler: (message) => this.handleListTasks(message)
            },
            
            // Task completion intent
            complete_task: {
                patterns: [
                    /done.*task/i,
                    /finish.*task/i,
                    /complete.*task/i,
                    /marked.*done/i
                ],
                handler: (message) => this.handleCompleteTask(message)
            },
            
            // Task search intent
            search_task: {
                patterns: [
                    /find.*task/i,
                    /search.*task/i,
                    /where.*task/i,
                    /task.*about/i
                ],
                handler: (message) => this.handleSearchTask(message)
            },
            
            // Statistics intent
            show_stats: {
                patterns: [
                    /how.*doing/i,
                    /my.*progress/i,
                    /statistics/i,
                    /productivity/i,
                    /summary/i
                ],
                handler: (message) => this.handleShowStats(message)
            },
            
            // Help intent
            help: {
                patterns: [
                    /help/i,
                    /what can you do/i,
                    /how.*use/i,
                    /command/i
                ],
                handler: (message) => this.handleHelp(message)
            },
            
            // Greeting intent
            greeting: {
                patterns: [
                    /hello/i,
                    /hi/i,
                    /hey/i,
                    /good morning/i,
                    /good afternoon/i,
                    /good evening/i
                ],
                handler: (message) => this.handleGreeting(message)
            }
        };
    }

    /**
     * Process user message
     */
    async processMessage(message) {
        // Add to conversation history
        this.addToHistory('user', message);

        // Detect intent
        const intent = this.detectIntent(message);
        
        // Process with intent handler
        let response;
        if (intent) {
            response = await intent.handler(message);
        } else {
            response = this.handleUnknown(message);
        }

        // Add response to history
        this.addToHistory('assistant', response.text);

        return response;
    }

    /**
     * Detect intent from message
     */
    detectIntent(message) {
        for (const [intentName, intentConfig] of Object.entries(this.intents)) {
            for (const pattern of intentConfig.patterns) {
                if (pattern.test(message)) {
                    return { name: intentName, ...intentConfig };
                }
            }
        }
        return null;
    }

    /**
     * Handle create task intent
     */
    async handleCreateTask(message) {
        // Extract task from message
        const parsed = this.nlp.parse(message);
        
        // Ask clarifying questions if needed
        if (!parsed.dueDate) {
            return {
                text: `I'll add "${parsed.text}" to your tasks. When is it due?`,
                action: 'awaiting_due_date',
                pendingTask: parsed
            };
        }

        // Create the task
        eventBus.emit(EVENTS.TASK_ADDED, {
            task: parsed,
            source: 'assistant'
        });

        return {
            text: `✓ Task added: "${parsed.text}"${parsed.dueDate ? ` (Due: ${parsed.dueDate})` : ''}`,
            action: 'task_created',
            task: parsed
        };
    }

    /**
     * Handle list tasks intent
     */
    async handleListTasks(message) {
        // Request tasks from system
        return new Promise((resolve) => {
            const handler = (data) => {
                const tasks = data.tasks || [];
                
                if (tasks.length === 0) {
                    resolve({
                        text: "You're all caught up! No pending tasks.",
                        action: 'list_empty'
                    });
                } else {
                    const taskList = tasks.slice(0, 5).map((t, i) => 
                        `${i + 1}. ${t.text}${t.dueDate ? ` (Due: ${t.dueDate})` : ''}`
                    ).join('\n');
                    
                    const moreText = tasks.length > 5 ? `\n...and ${tasks.length - 5} more tasks` : '';
                    
                    resolve({
                        text: `You have ${tasks.length} pending tasks:\n\n${taskList}${moreText}`,
                        action: 'list_tasks',
                        tasks
                    });
                }
            };
            
            eventBus.once(EVENTS.ASSISTANT_TASKS_LIST, handler);
            eventBus.emit(EVENTS.ASSISTANT_REQUEST_TASKS);
        });
    }

    /**
     * Handle complete task intent
     */
    async handleCompleteTask(message) {
        // Extract task name
        const taskName = message
            .replace(/done.*task/i, '')
            .replace(/finish.*task/i, '')
            .replace(/complete.*task/i, '')
            .trim();

        return {
            text: `Looking for task "${taskName}" to mark as complete...`,
            action: 'complete_task_search',
            taskName
        };
    }

    /**
     * Handle search task intent
     */
    async handleSearchTask(message) {
        const searchTerm = message
            .replace(/find.*task/i, '')
            .replace(/search.*task/i, '')
            .trim();

        return {
            text: `Searching for tasks about "${searchTerm}"...`,
            action: 'search_tasks',
            searchTerm
        };
    }

    /**
     * Handle show stats intent
     */
    async handleShowStats(message) {
        return new Promise((resolve) => {
            const handler = (data) => {
                const stats = data.stats || {};
                
                const response = `
📊 Your Productivity Summary:

✓ Tasks Completed: ${stats.completed || 0}
⏳ Tasks Pending: ${stats.active || 0}
🔥 Current Streak: ${stats.streak || 0} days
📈 Completion Rate: ${stats.completionRate || 0}%
                `.trim();

                resolve({
                    text: response,
                    action: 'show_stats',
                    stats
                });
            };
            
            eventBus.once(EVENTS.ASSISTANT_STATS, handler);
            eventBus.emit(EVENTS.ASSISTANT_REQUEST_STATS);
        });
    }

    /**
     * Handle help intent
     */
    async handleHelp(message) {
        const helpText = `
🤖 I'm your TaskMaster Assistant!

I can help you with:

📝 **Task Management**
• "Add task Buy groceries tomorrow"
• "Show my tasks"
• "Mark task as done"

🔍 **Search & Filter**
• "Find tasks about meeting"
• "Show high priority tasks"

📊 **Productivity**
• "How am I doing?"
• "Show my statistics"

💡 **Tips**
• Be specific with due dates
• Include priority keywords (urgent, important)
• Use categories for organization

What would you like to do?
        `.trim();

        return {
            text: helpText,
            action: 'show_help'
        };
    }

    /**
     * Handle greeting intent
     */
    async handleGreeting(message) {
        const hour = new Date().getHours();
        let greeting = 'Hello';
        
        if (hour < 12) greeting = 'Good morning';
        else if (hour < 18) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        // Get quick stats
        return new Promise((resolve) => {
            const handler = (data) => {
                const pendingCount = data.stats?.active || 0;
                const completedToday = data.stats?.completedToday || 0;

                resolve({
                    text: `${greeting}! 👋 You have ${pendingCount} pending tasks${completedToday > 0 ? ` and ${completedToday} completed today` : ''}. How can I help?`,
                    action: 'greeting',
                    stats: data.stats
                });
            };
            
            eventBus.once(EVENTS.ASSISTANT_STATS, handler);
            eventBus.emit(EVENTS.ASSISTANT_REQUEST_STATS);
        });
    }

    /**
     * Handle unknown intent
     */
    handleUnknown(message) {
        const suggestions = [
            'Try "Add task [your task]" to create a new task',
            'Try "Show my tasks" to see what\'s pending',
            'Try "How am I doing?" to see your productivity',
            'Try "Help" to see all available commands'
        ];

        return {
            text: `I'm not sure I understand. ${suggestions[Math.floor(Math.random() * suggestions.length)]}`,
            action: 'unknown'
        };
    }

    /**
     * Add to conversation history
     */
    addToHistory(role, message) {
        this.conversationHistory.push({
            role,
            message,
            timestamp: Date.now()
        });

        // Keep last 20 messages
        if (this.conversationHistory.length > 20) {
            this.conversationHistory.shift();
        }
    }

    /**
     * Get conversation history
     */
    getHistory() {
        return [...this.conversationHistory];
    }

    /**
     * Clear conversation history
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Set context
     */
    setContext(key, value) {
        this.context[key] = value;
    }

    /**
     * Get context
     */
    getContext(key) {
        return this.context[key];
    }
}

/**
 * Chat UI Component
 */
export class ChatUI {
    constructor(assistant) {
        this.assistant = assistant;
        this.container = null;
        this.messagesContainer = null;
        this.inputElement = null;
        this.sendButton = null;
    }

    /**
     * Initialize chat UI
     */
    init(containerSelector) {
        this.container = document.querySelector(containerSelector);
        if (!this.container) return;

        this.setupUI();
        this.bindEvents();
    }

    /**
     * Setup UI structure
     */
    setupUI() {
        this.container.innerHTML = `
            <div class="chat-container">
                <div class="chat-header">
                    <h3>🤖 Task Assistant</h3>
                    <button class="chat-toggle" aria-label="Toggle chat">▼</button>
                </div>
                <div class="chat-messages" id="chatMessages"></div>
                <div class="chat-input-container">
                    <input 
                        type="text" 
                        class="chat-input" 
                        placeholder="Ask me anything..."
                        id="chatInput"
                    >
                    <button class="chat-send" id="chatSend">➤</button>
                </div>
            </div>
        `;

        this.messagesContainer = this.container.querySelector('#chatMessages');
        this.inputElement = this.container.querySelector('#chatInput');
        this.sendButton = this.container.querySelector('#chatSend');

        // Add welcome message
        this.addMessage('assistant', 'Hi! I\'m your TaskMaster Assistant. Type "Help" to see what I can do! 👋');
    }

    /**
     * Bind events
     */
    bindEvents() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.inputElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
        this.container.querySelector('.chat-toggle').addEventListener('click', () => {
            this.container.classList.toggle('collapsed');
        });
    }

    /**
     * Send message
     */
    async sendMessage() {
        const message = this.inputElement.value.trim();
        if (!message) return;

        // Add user message
        this.addMessage('user', message);
        this.inputElement.value = '';

        // Show typing indicator
        this.showTypingIndicator();

        // Process with assistant
        const response = await this.assistant.processMessage(message);
        
        // Remove typing indicator
        this.removeTypingIndicator();

        // Add assistant response
        this.addMessage('assistant', response.text);

        // Handle actions
        this.handleAssistantAction(response.action, response);
    }

    /**
     * Add message to chat
     */
    addMessage(role, text) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${role}`;
        messageEl.innerHTML = `
            <div class="message-content">${this.formatMessage(text)}</div>
        `;
        
        this.messagesContainer.appendChild(messageEl);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    /**
     * Format message text
     */
    formatMessage(text) {
        return text
            .split('\n')
            .map(line => `<p>${line}</p>`)
            .join('');
    }

    /**
     * Show typing indicator
     */
    showTypingIndicator() {
        const typingEl = document.createElement('div');
        typingEl.className = 'chat-message assistant typing';
        typingEl.id = 'typingIndicator';
        typingEl.innerHTML = `
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        
        this.messagesContainer.appendChild(typingEl);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    /**
     * Remove typing indicator
     */
    removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    }

    /**
     * Handle assistant action
     */
    handleAssistantAction(action, response) {
        switch (action) {
            case 'task_created':
                eventBus.emit(EVENTS.TASK_ADDED, { task: response.task, source: 'assistant' });
                break;
            case 'complete_task_search':
                // Search for matching task and complete
                eventBus.emit(EVENTS.ASSISTANT_FIND_AND_COMPLETE, { taskName: response.taskName });
                break;
        }
    }
}

/**
 * Create AI assistant
 */
export function createTaskAssistant() {
    const assistant = new TaskAssistant();
    const chatUI = new ChatUI(assistant);
    return { assistant, chatUI };
}
