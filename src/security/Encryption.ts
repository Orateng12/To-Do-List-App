/**
 * End-to-End Encryption Module
 * =============================
 * AES-GCM encryption for sensitive task data with PBKDF2 key derivation
 */

import type { EncryptedData, Task, EncryptedTask } from '../types';

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const HASH_ALGORITHM = 'SHA-256';
const ITERATIONS = 100000;
const KEY_LENGTH = 256;

export class EncryptionService {
  private encryptionKey: CryptoKey | null = null;
  private keySalt: string | null = null;

  /**
   * Generate a new encryption key from password
   */
  async generateKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);
    
    // Generate random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));
    this.keySalt = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive encryption key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer,
        iterations: ITERATIONS,
        hash: HASH_ALGORITHM
      },
      keyMaterial,
      { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    this.encryptionKey = key;
    return key;
  }

  /**
   * Import existing key from storage
   */
  async importKey(encryptedKey: EncryptedData, password: string): Promise<CryptoKey> {
    if (!encryptedKey.salt) {
      throw new Error('Invalid encrypted key: missing salt');
    }
    
    const salt = new Uint8Array(encryptedKey.salt.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const encoder = new TextEncoder();
    const passwordData = encoder.encode(password);

    // Import password as key material
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      passwordData,
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );

    // Derive key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt.buffer,
        iterations: ITERATIONS,
        hash: HASH_ALGORITHM
      },
      keyMaterial,
      { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
      false,
      ['encrypt', 'decrypt']
    );

    this.encryptionKey = key;
    this.keySalt = encryptedKey.salt;

    // Verify key by attempting to decrypt
    try {
      await this.decrypt(encryptedKey);
      return key;
    } catch {
      throw new Error('Invalid password');
    }
  }

  /**
   * Encrypt task data
   */
  async encryptTask(task: Task): Promise<EncryptedTask> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const data = JSON.stringify({
      text: task.text,
      description: task.description,
      notes: task.notes,
      tags: task.tags
    });

    const encrypted = await this.encrypt(data);

    return {
      id: task.id,
      encrypted,
      version: task.version,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    };
  }

  /**
   * Decrypt task data
   */
  async decryptTask(encryptedTask: EncryptedTask): Promise<Task> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const decryptedData = await this.decrypt(encryptedTask.encrypted);
    const data = JSON.parse(decryptedData);

    // Return partial task with decrypted fields
    return {
      id: encryptedTask.id,
      text: data.text,
      description: data.description,
      notes: data.notes,
      tags: data.tags,
      // These fields remain unencrypted for indexing
      status: 'pending',
      priority: 'medium',
      recurrence: 'none',
      categories: [],
      subtasks: [],
      createdAt: encryptedTask.createdAt,
      updatedAt: encryptedTask.updatedAt,
      version: encryptedTask.version
    } as Task;
  }

  /**
   * Generic encrypt method
   */
  async encrypt(plaintext: string): Promise<EncryptedData> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: iv.buffer
      },
      this.encryptionKey,
      data.buffer
    ) as ArrayBuffer;

    return {
      iv: this.arrayBufferToHex(iv),
      data: this.arrayBufferToHex(encrypted)
    };
  }

  /**
   * Generic decrypt method
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    if (!encryptedData.iv || !encryptedData.data) {
      throw new Error('Invalid encrypted data');
    }

    const iv = new Uint8Array(encryptedData.iv.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);
    const data = new Uint8Array(encryptedData.data.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv: iv.buffer
      },
      this.encryptionKey,
      data.buffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }

  /**
   * Export encrypted key for storage
   */
  exportKey(): EncryptedData | null {
    if (!this.keySalt) return null;

    return {
      salt: this.keySalt,
      iv: '',
      data: ''
    };
  }

  /**
   * Check if encryption is enabled
   */
  isEnabled(): boolean {
    return this.encryptionKey !== null;
  }

  /**
   * Clear encryption key from memory
   */
  clearKey(): void {
    this.encryptionKey = null;
    this.keySalt = null;
  }

  /**
   * Generate a secure random password
   */
  generatePassword(length = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const values = crypto.getRandomValues(new Uint8Array(length));
    
    return Array.from(values)
      .map(v => charset[v % charset.length])
      .join('');
  }

  /**
   * Calculate hash of data (for integrity verification)
   */
  async hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return this.arrayBufferToHex(hashBuffer);
  }

  /**
   * Verify data integrity
   */
  async verify(data: string, expectedHash: string): Promise<boolean> {
    const hash = await this.hash(data);
    return hash === expectedHash;
  }

  /**
   * Convert ArrayBuffer to hex string
   */
  private arrayBufferToHex(buffer: ArrayBuffer | Uint8Array): string {
    const arr = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return Array.from(arr)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// ============================================
// ENCRYPTION UTILITIES
// ============================================

/**
 * Check if browser supports required crypto APIs
 */
export function isEncryptionSupported(): boolean {
  return !!(
    typeof crypto !== 'undefined' &&
    crypto.subtle &&
    typeof crypto.subtle.generateKey === 'function' &&
    typeof crypto.subtle.encrypt === 'function' &&
    typeof crypto.subtle.decrypt === 'function' &&
    typeof crypto.subtle.deriveKey === 'function' &&
    typeof crypto.subtle.importKey === 'function'
  );
}

/**
 * Get encryption status message
 */
export function getEncryptionStatus(): { supported: boolean; message: string } {
  if (!isEncryptionSupported()) {
    return {
      supported: false,
      message: 'Your browser does not support the required encryption APIs. Please use a modern browser (Chrome, Firefox, Edge, Safari).'
    };
  }

  if (!window.isSecureContext) {
    return {
      supported: false,
      message: 'Encryption requires a secure context (HTTPS or localhost). Please serve your app over HTTPS.'
    };
  }

  return {
    supported: true,
    message: 'Encryption is available and ready to use.'
  };
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const encryptionService = new EncryptionService();
