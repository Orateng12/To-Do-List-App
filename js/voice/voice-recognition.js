/**
 * Voice Recognition for Hands-Free Task Management
 * =================================================
 * Speech-to-text task creation and control
 */

import { eventBus, EVENTS } from '../core/event-bus.js';
import { createTaskNLP } from '../nlp/nlp-parser.js';

/**
 * Voice Command Recognition
 */
export class VoiceCommands {
    constructor() {
        this.nlp = createTaskNLP();
        this.commands = new Map();
        this.isListening = false;
        this.recognition = null;
        this.setupCommands();
        this.setupSpeechRecognition();
    }

    /**
     * Setup voice commands
     */
    setupCommands() {
        // Task creation commands
        this.commands.set('add task', (transcript) => this.handleAddTask(transcript));
        this.commands.set('create task', (transcript) => this.handleAddTask(transcript));
        this.commands.set('new task', (transcript) => this.handleAddTask(transcript));

        // Task completion commands
        this.commands.set('complete task', (transcript) => this.handleCompleteTask(transcript));
        this.commands.set('finish task', (transcript) => this.handleCompleteTask(transcript));
        this.commands.set('done', (transcript) => this.handleCompleteTask(transcript));

        // List commands
        this.commands.set('show tasks', () => this.handleListTasks());
        this.commands.set('list tasks', () => this.handleListTasks());
        this.commands.set('my tasks', () => this.handleListTasks());

        // Filter commands
        this.commands.set('show active tasks', () => this.handleFilterTasks('active'));
        this.commands.set('show completed tasks', () => this.handleFilterTasks('completed'));

        // Control commands
        this.commands.set('start listening', () => this.startListening());
        this.commands.set('stop listening', () => this.stopListening());
        this.commands.set('help', () => this.showHelp());
    }

    /**
     * Setup Web Speech API
     */
    setupSpeechRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => this.handleSpeechResult(event);
        this.recognition.onerror = (event) => this.handleSpeechError(event);
        this.recognition.onend = () => this.handleSpeechEnd();
    }

    /**
     * Start listening
     */
    startListening() {
        if (!this.recognition) {
            eventBus.emit(EVENTS.TOAST_SHOW, {
                message: 'Speech recognition not supported in this browser',
                type: 'error'
            });
            return;
        }

        try {
            this.recognition.start();
            this.isListening = true;
            eventBus.emit(EVENTS.VOICE_LISTENING_STARTED);
            eventBus.emit(EVENTS.TOAST_SHOW, {
                message: 'Listening... Speak your command',
                type: 'info'
            });
        } catch (error) {
            console.error('Failed to start listening:', error);
        }
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
            this.isListening = false;
            eventBus.emit(EVENTS.VOICE_LISTENING_STOPPED);
        }
    }

    /**
     * Toggle listening
     */
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }

    /**
     * Handle speech result
     */
    handleSpeechResult(event) {
        const results = event.results;
        const transcript = results[results.length - 1][0].transcript.trim();
        const isFinal = results[results.length - 1].isFinal;

        // Show interim results
        eventBus.emit(EVENTS.VOICE_INTERIM_RESULT, { transcript, isFinal });

        if (isFinal) {
            this.processCommand(transcript);
        }
    }

    /**
     * Process voice command
     */
    processCommand(transcript) {
        const lower = transcript.toLowerCase();
        
        // Find matching command
        for (const [keyword, handler] of this.commands.entries()) {
            if (lower.includes(keyword)) {
                handler(transcript);
                return;
            }
        }

        // Default: treat as task creation
        this.handleAddTask(transcript);
    }

    /**
     * Handle add task command
     */
    handleAddTask(transcript) {
        // Remove command keywords
        const taskText = transcript
            .replace(/add task/i, '')
            .replace(/create task/i, '')
            .replace(/new task/i, '')
            .trim();

        if (!taskText) {
            eventBus.emit(EVENTS.TOAST_SHOW, {
                message: 'Please specify the task',
                type: 'warning'
            });
            return;
        }

        // Parse with NLP
        const parsed = this.nlp.parse(taskText);
        
        eventBus.emit(EVENTS.TASK_ADDED, {
            task: parsed,
            source: 'voice'
        });

        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: `Task added: "${parsed.text}"`,
            type: 'success'
        });
    }

    /**
     * Handle complete task command
     */
    handleCompleteTask(transcript) {
        // Extract task name from transcript
        const taskName = transcript
            .replace(/complete task/i, '')
            .replace(/finish task/i, '')
            .replace(/done/i, '')
            .trim();

        eventBus.emit(EVENTS.VOICE_COMPLETE_REQUEST, { taskName });
        
        eventBus.emit(EVENTS.TOAST_SHOW, {
            message: `Looking for task: "${taskName}"`,
            type: 'info'
        });
    }

    /**
     * Handle list tasks command
     */
    handleListTasks() {
        eventBus.emit(EVENTS.VOICE_LIST_REQUEST);
    }

    /**
     * Handle filter tasks command
     */
    handleFilterTasks(filter) {
        eventBus.emit(EVENTS.VOICE_FILTER_REQUEST, { filter });
    }

    /**
     * Show help
     */
    showHelp() {
        const helpText = `
Voice Commands Available:
• "Add task [task name]" - Create a new task
• "Complete task [name]" - Mark task as done
• "Show tasks" - List all tasks
• "Show active tasks" - List incomplete tasks
• "Start listening" - Enable voice commands
• "Stop listening" - Disable voice commands
• "Help" - Show this help

Examples:
• "Add task Buy groceries tomorrow at 5pm"
• "Complete task Write report"
• "Add task Urgent meeting with client today"
        `.trim();

        eventBus.emit(EVENTS.VOICE_HELP, { helpText });
    }

    /**
     * Handle speech error
     */
    handleSpeechError(event) {
        console.error('Speech recognition error:', event.error);
        
        const errorMessages = {
            'no-speech': 'No speech detected. Please try again.',
            'audio-capture': 'No microphone found.',
            'not-allowed': 'Microphone permission denied.',
            'network': 'Network error. Please check connection.'
        };

        const message = errorMessages[event.error] || 'Speech recognition error';
        
        eventBus.emit(EVENTS.TOAST_SHOW, {
            message,
            type: 'error'
        });

        this.isListening = false;
    }

    /**
     * Handle speech end
     */
    handleSpeechEnd() {
        this.isListening = false;
        eventBus.emit(EVENTS.VOICE_LISTENING_STOPPED);
    }

    /**
     * Get listening state
     */
    isListeningState() {
        return this.isListening;
    }
}

/**
 * Text-to-Speech for Task Feedback
 */
export class TaskSpeech {
    constructor() {
        this.synthesis = window.speechSynthesis;
        this.enabled = false;
        this.voice = null;
        this.loadVoices();
    }

    /**
     * Load available voices
     */
    loadVoices() {
        if (!this.synthesis) return;

        const loadVoices = () => {
            const voices = this.synthesis.getVoices();
            // Prefer English voice
            this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        };

        loadVoices();
        
        // Chrome loads voices asynchronously
        if (this.synthesis.onvoiceschanged !== undefined) {
            this.synthesis.onvoiceschanged = loadVoices;
        }
    }

    /**
     * Enable speech feedback
     */
    enable() {
        this.enabled = true;
    }

    /**
     * Disable speech feedback
     */
    disable() {
        this.enabled = false;
        this.synthesis.cancel();
    }

    /**
     * Toggle speech
     */
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    /**
     * Speak text
     */
    speak(text, options = {}) {
        if (!this.enabled || !this.synthesis) return;

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        if (this.voice) {
            utterance.voice = this.voice;
        }

        utterance.rate = options.rate || 1.0;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;

        this.synthesis.speak(utterance);
    }

    /**
     * Speak task confirmation
     */
    speakTaskAdded(task) {
        this.speak(`Task added: ${task.text}`);
    }

    /**
     * Speak task completed
     */
    speakTaskCompleted(task) {
        this.speak(`Task completed: ${task.text}`);
    }

    /**
     * Speak task list
     */
    speakTaskList(tasks) {
        if (tasks.length === 0) {
            this.speak('You have no tasks');
            return;
        }

        const summary = `You have ${tasks.length} tasks. `;
        const taskList = tasks.slice(0, 5).map((t, i) => 
            `${i + 1}. ${t.text}${t.dueDate ? ', due ' + t.dueDate : ''}`
        ).join('. ');

        const more = tasks.length > 5 ? `. And ${tasks.length - 5} more tasks.` : '';

        this.speak(summary + taskList + more);
    }

    /**
     * Speak reminder
     */
    speakReminder(task) {
        this.speak(`Reminder: ${task.text} is due ${task.dueDate || 'soon'}`, {
            rate: 0.9,
            pitch: 1.1
        });
    }

    /**
     * Speak time announcement
     */
    speakTimeAnnouncement() {
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        this.speak(`The time is ${time}`);
    }
}

/**
 * Voice UI Component
 */
export class VoiceUI {
    constructor(voiceCommands, taskSpeech) {
        this.voiceCommands = voiceCommands;
        this.taskSpeech = taskSpeech;
        this.buttonElement = null;
        this.statusElement = null;
    }

    /**
     * Initialize voice UI
     */
    init(buttonSelector, statusSelector) {
        this.buttonElement = document.querySelector(buttonSelector);
        this.statusElement = document.querySelector(statusSelector);

        if (this.buttonElement) {
            this.buttonElement.addEventListener('click', () => {
                this.voiceCommands.toggleListening();
                this.updateButtonState();
            });
        }

        // Subscribe to voice events
        this.subscribeToEvents();
    }

    /**
     * Subscribe to voice events
     */
    subscribeToEvents() {
        eventBus.on(EVENTS.VOICE_LISTENING_STARTED, () => this.updateButtonState());
        eventBus.on(EVENTS.VOICE_LISTENING_STOPPED, () => this.updateButtonState());
        eventBus.on(EVENTS.VOICE_INTERIM_RESULT, (data) => this.showTranscript(data.transcript));
    }

    /**
     * Update button state
     */
    updateButtonState() {
        if (!this.buttonElement) return;

        const isListening = this.voiceCommands.isListeningState();
        
        this.buttonElement.classList.toggle('listening', isListening);
        this.buttonElement.setAttribute('aria-pressed', isListening);
        this.buttonElement.innerHTML = isListening ? '🎤' : '🎙️';
        this.buttonElement.title = isListening ? 'Stop listening' : 'Start voice commands';
    }

    /**
     * Show transcript
     */
    showTranscript(transcript) {
        if (!this.statusElement) return;
        this.statusElement.textContent = transcript;
        this.statusElement.classList.add('visible');
        
        // Hide after delay
        setTimeout(() => {
            this.statusElement.classList.remove('visible');
        }, 3000);
    }
}

/**
 * Create voice command system
 */
export function createVoiceSystem() {
    const voiceCommands = new VoiceCommands();
    const taskSpeech = new TaskSpeech();
    const voiceUI = new VoiceUI(voiceCommands, taskSpeech);
    
    return {
        voiceCommands,
        taskSpeech,
        voiceUI,
        start: () => voiceCommands.startListening(),
        stop: () => voiceCommands.stopListening(),
        toggle: () => voiceCommands.toggleListening(),
        speak: (text) => taskSpeech.speak(text),
        enableSpeech: () => taskSpeech.enable(),
        disableSpeech: () => taskSpeech.disable()
    };
}
