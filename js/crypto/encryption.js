/**
 * Encryption Module for Sensitive Tasks
 * ======================================
 * AES-GCM encryption with PBKDF2 key derivation
 */

/**
 * Crypto Utils - Web Crypto API wrapper
 */
export class CryptoUtils {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
        this.ivLength = 12;
        this.saltLength = 16;
        this.iterations = 100000;
    }

    /**
     * Generate encryption key from password
     */
    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: this.iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: this.algorithm, length: this.keyLength },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Generate random salt
     */
    generateSalt() {
        return crypto.getRandomValues(new Uint8Array(this.saltLength));
    }

    /**
     * Generate random IV
     */
    generateIV() {
        return crypto.getRandomValues(new Uint8Array(this.ivLength));
    }

    /**
     * Encrypt data
     */
    async encrypt(plainText, password) {
        const salt = this.generateSalt();
        const iv = this.generateIV();
        const key = await this.deriveKey(password, salt);

        const encoder = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            encoder.encode(plainText)
        );

        // Combine salt, iv, and ciphertext
        const combined = new Uint8Array(
            salt.length + iv.length + encrypted.byteLength
        );
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(encrypted), salt.length + iv.length);

        return this.arrayBufferToBase64(combined.buffer);
    }

    /**
     * Decrypt data
     */
    async decrypt(encryptedData, password) {
        const combined = this.base64ToArrayBuffer(encryptedData);
        
        // Extract salt, iv, and ciphertext
        const salt = combined.slice(0, this.saltLength);
        const iv = combined.slice(this.saltLength, this.saltLength + this.ivLength);
        const ciphertext = combined.slice(this.saltLength + this.ivLength);

        const key = await this.deriveKey(password, salt);

        const decrypted = await crypto.subtle.decrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            ciphertext
        );

        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    }

    /**
     * Generate hash for integrity
     */
    async hash(data) {
        const encoder = new TextEncoder();
        const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data));
        return this.arrayBufferToBase64(hash);
    }

    /**
     * Verify integrity
     */
    async verify(data, expectedHash) {
        const hash = await this.hash(data);
        return hash === expectedHash;
    }

    /**
     * ArrayBuffer to Base64
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Generate secure random string
     */
    generateRandomString(length = 32) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const random = new Uint32Array(length);
        crypto.getRandomValues(random);
        
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[random[i] % chars.length];
        }
        return result;
    }
}

/**
 * Encrypted Task Store
 */
export class EncryptedTaskStore {
    constructor(cryptoUtils) {
        this.crypto = cryptoUtils;
        this.encryptedTasks = new Map(); // taskId -> encrypted data
        this.unlockedTasks = new Map(); // taskId -> decrypted task
        this.masterPassword = null;
        this.dbName = 'TaskMasterEncrypted';
    }

    /**
     * Initialize encrypted store
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            
            request.onsuccess = () => {
                this.db = request.result;
                this.loadEncryptedTasks();
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('encrypted')) {
                    db.createObjectStore('encrypted', { keyPath: 'id' });
                }
            };
        });
    }

    /**
     * Unlock store with password
     */
    async unlock(password) {
        this.masterPassword = password;
        await this.loadEncryptedTasks();
        
        // Decrypt all tasks
        for (const [id, encrypted] of this.encryptedTasks) {
            try {
                const decrypted = await this.crypto.decrypt(encrypted.data, password);
                this.unlockedTasks.set(id, JSON.parse(decrypted));
            } catch (e) {
                console.warn(`Failed to decrypt task ${id}`);
            }
        }

        return this.unlockedTasks.size;
    }

    /**
     * Lock store (clear decrypted tasks)
     */
    lock() {
        this.masterPassword = null;
        this.unlockedTasks.clear();
    }

    /**
     * Add encrypted task
     */
    async addTask(task, password) {
        const encryptedData = await this.crypto.encrypt(
            JSON.stringify(task),
            password
        );

        const record = {
            id: task.id,
            data: encryptedData,
            hash: await this.crypto.hash(encryptedData),
            createdAt: new Date().toISOString()
        };

        this.encryptedTasks.set(task.id, record);
        await this.saveToDB(record);

        // Also add to unlocked if we have the password
        if (this.masterPassword === password) {
            this.unlockedTasks.set(task.id, task);
        }

        return task.id;
    }

    /**
     * Get decrypted task
     */
    async getTask(taskId, password) {
        const record = this.encryptedTasks.get(taskId);
        if (!record) return null;

        try {
            const decrypted = await this.crypto.decrypt(record.data, password);
            const task = JSON.parse(decrypted);

            // Verify integrity
            const valid = await this.crypto.verify(record.data, record.hash);
            if (!valid) {
                throw new Error('Data integrity check failed');
            }

            return task;
        } catch (e) {
            console.error('Failed to decrypt task:', e);
            return null;
        }
    }

    /**
     * Get all decrypted tasks
     */
    getAllTasks() {
        return Array.from(this.unlockedTasks.values());
    }

    /**
     * Update encrypted task
     */
    async updateTask(taskId, updates, password) {
        const existing = await this.getTask(taskId, password);
        if (!existing) {
            throw new Error('Task not found');
        }

        const updatedTask = { ...existing, ...updates };
        await this.addTask(updatedTask, password);
        
        return updatedTask;
    }

    /**
     * Delete encrypted task
     */
    async deleteTask(taskId) {
        this.encryptedTasks.delete(taskId);
        this.unlockedTasks.delete(taskId);
        await this.deleteFromDB(taskId);
    }

    /**
     * Save to IndexedDB
     */
    saveToDB(record) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['encrypted'], 'readwrite');
            const store = transaction.objectStore('encrypted');
            const request = store.put(record);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete from IndexedDB
     */
    deleteFromDB(taskId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['encrypted'], 'readwrite');
            const store = transaction.objectStore('encrypted');
            const request = store.delete(taskId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Load encrypted tasks from IndexedDB
     */
    loadEncryptedTasks() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['encrypted'], 'readonly');
            const store = transaction.objectStore('encrypted');
            const request = store.getAll();

            request.onsuccess = () => {
                this.encryptedTasks.clear();
                request.result.forEach(record => {
                    this.encryptedTasks.set(record.id, record);
                });
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Check if store is unlocked
     */
    isUnlocked() {
        return this.masterPassword !== null;
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            encryptedCount: this.encryptedTasks.size,
            unlockedCount: this.unlockedTasks.size,
            isUnlocked: this.isUnlocked()
        };
    }

    /**
     * Export encrypted data
     */
    exportEncrypted() {
        return Array.from(this.encryptedTasks.values());
    }

    /**
     * Import encrypted data
     */
    importEncrypted(records) {
        records.forEach(record => {
            this.encryptedTasks.set(record.id, record);
            this.saveToDB(record);
        });
    }
}

/**
 * Password Manager for secure storage
 */
export class PasswordManager {
    constructor(cryptoUtils) {
        this.crypto = cryptoUtils;
        this.storageKey = 'taskmaster_password_hint';
    }

    /**
     * Store password hint (not the password itself!)
     */
    setHint(hint) {
        localStorage.setItem(this.storageKey, hint);
    }

    /**
     * Get password hint
     */
    getHint() {
        return localStorage.getItem(this.storageKey);
    }

    /**
     * Clear hint
     */
    clearHint() {
        localStorage.removeItem(this.storageKey);
    }

    /**
     * Check password strength
     */
    checkStrength(password) {
        let score = 0;
        
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        return {
            score,
            level: score <= 2 ? 'weak' : score <= 4 ? 'medium' : 'strong',
            suggestions: this.getPasswordSuggestions(password)
        };
    }

    /**
     * Get password improvement suggestions
     */
    getPasswordSuggestions(password) {
        const suggestions = [];
        
        if (password.length < 12) {
            suggestions.push('Use at least 12 characters');
        }
        if (!/[A-Z]/.test(password)) {
            suggestions.push('Add uppercase letters');
        }
        if (!/[a-z]/.test(password)) {
            suggestions.push('Add lowercase letters');
        }
        if (!/\d/.test(password)) {
            suggestions.push('Add numbers');
        }
        if (!/[^a-zA-Z0-9]/.test(password)) {
            suggestions.push('Add special characters');
        }

        return suggestions;
    }

    /**
     * Generate secure password
     */
    generatePassword(length = 16) {
        return this.crypto.generateRandomString(length);
    }
}

/**
 * Create encrypted store instance
 */
export function createEncryptedStore() {
    const crypto = new CryptoUtils();
    const store = new EncryptedTaskStore(crypto);
    const passwordManager = new PasswordManager(crypto);
    
    return { crypto, store, passwordManager };
}
