/**
 * Voice Input Manager
 * ====================
 * Speech recognition for hands-free task management
 * 
 * Features:
 * - Voice-to-text task creation
 * - Voice commands (complete, delete, search)
 * - Natural language parsing integration
 * - Multi-language support
 * - Offline speech recognition
 */

import { eventBus, AppEvents } from '../core/event-bus.js';
import { NaturalLanguageParser } from './natural-language-parser.js';

class VoiceInputManager {
    constructor(taskRepository, uiController) {
        this.taskRepository = taskRepository;
        this.uiController = uiController;
        this.nlpParser = new NaturalLanguageParser();
        
        // Speech recognition setup
        this.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = null;
        this.isListening = false;
        this.transcript = '';
        
        // Voice commands
        this.commands = {
            complete: [/complete task/i, /mark done/i, /finish/i, /check/i],
            delete: [/delete task/i, /remove task/i, /trash/i],
            search: [/search for/i, /find/i, /look for/i],
            show: [/show tasks/i, /list tasks/i, /what's on my plate/i],
            help: [/help/i, /what can i say/i, /commands/i],
            add: [/add task/i, /create task/i, /new task/i, /remind me to/i]
        };
        
        // Supported languages
        this.languages = {
            'en-US': 'English (US)',
            'en-GB': 'English (UK)',
            'es-ES': 'Spanish',
            'fr-FR': 'French',
            'de-DE': 'German',
            'it-IT': 'Italian',
            'pt-BR': 'Portuguese (Brazil)',
            'ja-JP': 'Japanese',
            'zh-CN': 'Chinese (Simplified)',
            'ko-KR': 'Korean'
        };
        
        this.currentLanguage = 'en-US';
        
        if (this.SpeechRecognition) {
            this._initializeRecognition();
        }
    }

    /**
     * Initialize speech recognition
     * @private
     */
    _initializeRecognition() {
        this.recognition = new this.SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = this.currentLanguage;
        
        this.recognition.onstart = () => {
            this.isListening = true;
            eventBus.emit(AppEvents.VOICE_LISTENING_START);
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            eventBus.emit(AppEvents.VOICE_LISTENING_END);
        };
        
        this.recognition.onresult = (event) => {
            this.transcript = '';
            
            for (let i = 0; i < event.results.length; i++) {
                this.transcript += event.results[i][0].transcript;
            }
            
            // Show interim results
            if (event.results[0].isFinal) {
                this._processVoiceInput(this.transcript);
            }
            
            eventBus.emit(AppEvents.VOICE_TRANSCRIPT, { 
                transcript: this.transcript,
                isFinal: event.results[0]?.isFinal || false
            });
        };
        
        this.recognition.onerror = (event) => {
            console.error('[VoiceInput] Error:', event.error);
            this.isListening = false;
            
            let errorMessage = 'Voice recognition error';
            switch (event.error) {
                case 'no-speech':
                    errorMessage = 'No speech detected. Please try again.';
                    break;
                case 'audio-capture':
                    errorMessage = 'No microphone found. Please check permissions.';
                    break;
                case 'not-allowed':
                    errorMessage = 'Microphone permission denied.';
                    break;
            }
            
            this.uiController.showToast(errorMessage, 'error');
            eventBus.emit(AppEvents.VOICE_ERROR, { error: event.error });
        };
    }

    /**
     * Start listening for voice input
     * @returns {Promise<boolean>} Success
     */
    async startListening() {
        if (!this.SpeechRecognition) {
            this.uiController.showToast(
                'Voice recognition is not supported in this browser',
                'error'
            );
            return false;
        }
        
        // Request microphone permission
        try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (err) {
            this.uiController.showToast(
                'Microphone permission required for voice input',
                'error'
            );
            return false;
        }
        
        try {
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('[VoiceInput] Start error:', error);
            return false;
        }
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    /**
     * Toggle listening
     * @returns {Promise<boolean>} Is listening
     */
    async toggleListening() {
        if (this.isListening) {
            this.stopListening();
            return false;
        } else {
            return await this.startListening();
        }
    }

    /**
     * Process voice input
     * @private
     */
    async _processVoiceInput(transcript) {
        const trimmedTranscript = transcript.trim();
        
        // Check for commands first
        const command = this._detectCommand(trimmedTranscript);
        
        if (command) {
            await this._executeCommand(command, trimmedTranscript);
        } else {
            // Treat as new task
            await this._createTaskFromVoice(trimmedTranscript);
        }
    }

    /**
     * Detect voice command
     * @private
     */
    _detectCommand(transcript) {
        for (const [command, patterns] of Object.entries(this.commands)) {
            for (const pattern of patterns) {
                if (pattern.test(transcript)) {
                    return command;
                }
            }
        }
        return null;
    }

    /**
     * Execute voice command
     * @private
     */
    async _executeCommand(command, transcript) {
        switch (command) {
            case 'complete':
                await this._completeTaskByVoice(transcript);
                break;
            case 'delete':
                await this._deleteTaskByVoice(transcript);
                break;
            case 'search':
                await this._searchByVoice(transcript);
                break;
            case 'show':
                await this._showTasks();
                break;
            case 'help':
                this._showVoiceHelp();
                break;
            case 'add':
                // Extract task from "add task [task text]"
                const taskText = transcript.replace(/add task|create task|new task|remind me to/gi, '').trim();
                if (taskText) {
                    await this._createTaskFromVoice(taskText);
                }
                break;
        }
    }

    /**
     * Complete task by voice
     * @private
     */
    async _completeTaskByVoice(transcript) {
        const tasks = await this.taskRepository.getAll();
        const activeTasks = tasks.filter(t => !t.completed);
        
        // Try to match task text
        const spokenText = transcript.replace(/complete task|mark done|finish|check/gi, '').trim().toLowerCase();
        
        let matchedTask = null;
        for (const task of activeTasks) {
            if (task.text.toLowerCase().includes(spokenText) || spokenText.includes(task.text.toLowerCase())) {
                matchedTask = task;
                break;
            }
        }
        
        // If no match, ask for clarification
        if (!matchedTask) {
            this.uiController.showToast(
                `Could not find task matching "${spokenText}"`,
                'warning'
            );
            return;
        }
        
        // Complete the task
        matchedTask.completed = true;
        matchedTask.completedAt = new Date().toISOString();
        await this.taskRepository.save(matchedTask);
        
        this.uiController.showToast(`Completed: ${matchedTask.text}`, 'success');
        eventBus.emit(AppEvents.TASK_TOGGLED, { task: matchedTask });
    }

    /**
     * Delete task by voice
     * @private
     */
    async _deleteTaskByVoice(transcript) {
        const tasks = await this.taskRepository.getAll();
        const spokenText = transcript.replace(/delete task|remove task|trash/gi, '').trim().toLowerCase();
        
        let matchedTask = null;
        for (const task of tasks) {
            if (task.text.toLowerCase().includes(spokenText)) {
                matchedTask = task;
                break;
            }
        }
        
        if (!matchedTask) {
            this.uiController.showToast(
                `Could not find task matching "${spokenText}"`,
                'warning'
            );
            return;
        }
        
        await this.taskRepository.delete(matchedTask.id);
        this.uiController.showToast(`Deleted: ${matchedTask.text}`, 'info');
        eventBus.emit(AppEvents.TASK_DELETED, { task: matchedTask, id: matchedTask.id });
    }

    /**
     * Search by voice
     * @private
     */
    async _searchByVoice(transcript) {
        const spokenText = transcript.replace(/search for|find|look for/gi, '').trim();
        
        // Emit search event
        eventBus.emit(AppEvents.VOICE_SEARCH, { query: spokenText });
        
        this.uiController.showToast(`Searching for: ${spokenText}`, 'info');
    }

    /**
     * Show tasks
     * @private
     */
    async _showTasks() {
        const tasks = await this.taskRepository.getAll();
        const activeTasks = tasks.filter(t => !t.completed).slice(0, 5);
        
        if (activeTasks.length === 0) {
            this.uiController.showToast('No active tasks! 🎉', 'success');
            return;
        }
        
        const taskList = activeTasks.map((t, i) => `${i + 1}. ${t.text}`).join('\n');
        this.uiController.showToast(`Your tasks:\n${taskList}`, 'info', { duration: 8000 });
    }

    /**
     * Show voice help
     * @private
     */
    _showVoiceHelp() {
        const helpText = `
Voice Commands:
• "Add task [task]" - Create new task
• "Complete task [name]" - Mark task done
• "Delete task [name]" - Remove task
• "Search for [query]" - Find tasks
• "Show tasks" - List your tasks
• "Help" - Show this help

Just speak naturally!
        `.trim();
        
        this.uiController.showToast(helpText, 'info', { duration: 10000 });
    }

    /**
     * Create task from voice input
     * @private
     */
    async _createTaskFromVoice(transcript) {
        // Parse with NLP
        const parsed = this.nlpParser.parse(transcript);
        
        const newTask = {
            id: this._generateId(),
            text: parsed.cleanedText || transcript,
            completed: false,
            priority: parsed.priority?.value || 'medium',
            dueDate: parsed.dueDate ? parsed.dueDate.toISOString() : null,
            createdAt: new Date().toISOString(),
            updatedAt: null,
            voiceCreated: true
        };
        
        await this.taskRepository.save(newTask);
        
        this.uiController.showToast(
            `Created: ${newTask.text}`,
            'success'
        );
        
        eventBus.emit(AppEvents.TASK_CREATED, { task: newTask });
    }

    /**
     * Set language
     * @param {string} language - Language code
     */
    setLanguage(language) {
        if (this.languages[language]) {
            this.currentLanguage = language;
            if (this.recognition) {
                this.recognition.lang = language;
            }
            this.uiController.showToast(`Language set to ${this.languages[language]}`, 'success');
        }
    }

    /**
     * Get supported languages
     * @returns {Object} Languages
     */
    getSupportedLanguages() {
        return this.languages;
    }

    /**
     * Check if voice input is supported
     * @returns {boolean} Supported
     */
    isSupported() {
        return !!this.SpeechRecognition;
    }

    /**
     * Get listening status
     * @returns {boolean} Is listening
     */
    getIsListening() {
        return this.isListening;
    }

    _generateId() {
        return 'voice_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    }
}

export { VoiceInputManager };
