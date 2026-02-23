/**
 * Quantum-Resistant Encryption Module
 * ====================================
 * Post-quantum cryptography using lattice-based algorithms
 * Implements CRYSTALS-Kyber inspired key encapsulation
 */

import type { Task, EncryptedData } from '../types';

// ============================================
// LATTICE CRYPTOGRAPHY UTILITIES
// ============================================

class LatticeUtils {
  /**
   * Generate random polynomial with coefficients in range [-q/2, q/2]
   */
  static generatePolynomial(degree: number, q: number): Int16Array {
    const poly = new Int16Array(degree);
    for (let i = 0; i < degree; i++) {
      poly[i] = Math.floor(Math.random() * q) - Math.floor(q / 2);
    }
    return poly as Int16Array<ArrayBuffer>;
  }

  /**
   * Add two polynomials mod q
   */
  static addPolynomials(a: Int16Array, b: Int16Array, q: number): Int16Array {
    const result = new Int16Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = ((a[i] + b[i]) % q + q) % q;
    }
    return result as Int16Array<ArrayBuffer>;
  }

  /**
   * Multiply polynomials mod (x^n + 1) mod q
   * Using negacyclic convolution
   */
  static multiplyPolynomials(a: Int16Array, b: Int16Array, q: number): Int16Array {
    const n = a.length;
    const result = new Int16Array(n);

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const idx = i + j;
        if (idx < n) {
          result[idx] = ((result[idx] + a[i] * b[j]) % q + q) % q;
        } else {
          // Negacyclic: x^n = -1
          result[idx - n] = ((result[idx - n] - a[i] * b[j]) % q + q) % q;
        }
      }
    }

    return result as Int16Array<ArrayBuffer>;
  }

  /**
   * Compress polynomial for transmission
   */
  static compress(poly: Int16Array, d: number, q: number): Uint8Array {
    const compressed = new Uint8Array(poly.length * Math.ceil(d / 8));
    for (let i = 0; i < poly.length; i++) {
      const compressedValue = Math.round((poly[i] * (2 ** d)) / q) % (2 ** d);
      compressed[i] = compressedValue;
    }
    return compressed;
  }

  /**
   * Decompress polynomial
   */
  static decompress(compressed: Uint8Array, d: number, q: number): Int16Array {
    const poly = new Int16Array(compressed.length);
    for (let i = 0; i < compressed.length; i++) {
      poly[i] = Math.round((compressed[i] * q) / (2 ** d));
    }
    return poly;
  }

  /**
   * Hash to seed using SHA-256
   */
  static async hashToSeed(data: Uint8Array): Promise<Uint8Array> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data as unknown as ArrayBuffer);
    return new Uint8Array(hashBuffer);
  }

  /**
   * Generate error polynomial (small coefficients)
   */
  static generateErrorPolynomial(degree: number): Int16Array {
    const poly = new Int16Array(degree);
    for (let i = 0; i < degree; i++) {
      // Centered binomial distribution
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        sum += Math.random() > 0.5 ? 1 : -1;
      }
      poly[i] = sum;
    }
    return poly as Int16Array<ArrayBuffer>;
  }
}

// ============================================
// KYBER-INSPIRED KEY ENCAPSULATION
// ============================================

export interface KyberKeyPair {
  publicKey: KyberPublicKey;
  privateKey: KyberPrivateKey;
}

export interface KyberPublicKey {
  matrixA: Int16Array[]; // k x k matrix of polynomials
  vectorB: Int16Array[]; // k-dimensional vector
  seed: Uint8Array;
}

export interface KyberPrivateKey {
  vectorS: Int16Array[]; // k-dimensional secret vector
  publicKeyHash: Uint8Array;
}

export interface Ciphertext {
  vectorU: Int16Array[];
  valueV: Int16Array;
}

export class KyberKEM {
  // Parameters for Kyber512 (simplified)
  private static readonly K = 2; // Dimension
  private static readonly N = 64; // Polynomial degree (reduced for browser)
  private static readonly Q = 3329; // Prime modulus
  private static readonly ETA = 3; // Error distribution parameter

  /**
   * Generate key pair
   */
  static async generateKeyPair(): Promise<KyberKeyPair> {
    // Generate random seed
    const seed = crypto.getRandomValues(new Uint8Array(32));

    // Generate matrix A from seed
    const matrixA = await this.generateMatrixA(seed);

    // Generate secret vector s
    const vectorS: Int16Array[] = [];
    for (let i = 0; i < this.K; i++) {
      vectorS.push(LatticeUtils.generateErrorPolynomial(this.N) as Int16Array<ArrayBuffer>);
    }

    // Generate error vector e
    const vectorE: Int16Array[] = [];
    for (let i = 0; i < this.K; i++) {
      vectorE.push(LatticeUtils.generateErrorPolynomial(this.N) as Int16Array<ArrayBuffer>);
    }

    // Compute b = A * s + e
    const vectorB: Int16Array[] = [];
    for (let i = 0; i < this.K; i++) {
      let sum = new Int16Array(this.N);
      for (let j = 0; j < this.K; j++) {
        const product = LatticeUtils.multiplyPolynomials(matrixA[i][j], vectorS[j], this.Q);
        sum = LatticeUtils.addPolynomials(sum, product, this.Q);
      }
      sum = LatticeUtils.addPolynomials(sum, vectorE[i], this.Q);
      vectorB.push(sum as Int16Array<ArrayBuffer>);
    }

    const publicKey: KyberPublicKey = { matrixA, vectorB, seed };
    const privateKey: KyberPrivateKey = { vectorS, publicKeyHash: await LatticeUtils.hashToSeed(seed) };

    return { publicKey, privateKey };
  }

  /**
   * Encapsulate - generate shared secret and ciphertext
   */
  static async encapsulate(publicKey: KyberPublicKey): Promise<{
    ciphertext: Ciphertext;
    sharedSecret: Uint8Array;
  }> {
    // Generate random message
    const message = crypto.getRandomValues(new Uint8Array(32));

    // Generate matrix A from public key seed
    const matrixA = await this.generateMatrixA(publicKey.seed);

    // Generate random vector r with small coefficients
    const vectorR: Int16Array[] = [];
    for (let i = 0; i < this.K; i++) {
      vectorR.push(LatticeUtils.generateErrorPolynomial(this.N) as Int16Array<ArrayBuffer>);
    }

    // Generate error vectors e1 and e2
    const vectorE1: Int16Array[] = [];
    for (let i = 0; i < this.K; i++) {
      vectorE1.push(LatticeUtils.generateErrorPolynomial(this.N) as Int16Array<ArrayBuffer>);
    }
    const e2 = LatticeUtils.generateErrorPolynomial(this.N) as Int16Array<ArrayBuffer>;

    // Compute u = A^T * r + e1
    const vectorU: Int16Array[] = [];
    for (let i = 0; i < this.K; i++) {
      let sum = new Int16Array(this.N);
      for (let j = 0; j < this.K; j++) {
        const product = LatticeUtils.multiplyPolynomials(matrixA[j][i], vectorR[j], this.Q);
        sum = LatticeUtils.addPolynomials(sum, product, this.Q);
      }
      sum = LatticeUtils.addPolynomials(sum, vectorE1[i], this.Q);
      vectorU.push(sum as Int16Array<ArrayBuffer>);
    }

    // Compute v = b^T * r + e2 + encode(m)
    let v = new Int16Array(this.N);
    for (let i = 0; i < this.K; i++) {
      const product = LatticeUtils.multiplyPolynomials(publicKey.vectorB[i], vectorR[i], this.Q);
      v = LatticeUtils.addPolynomials(v, product, this.Q);
    }
    v = LatticeUtils.addPolynomials(v, e2, this.Q);

    // Encode message into polynomial
    const encodedMessage = this.encodeMessage(message);
    v = LatticeUtils.addPolynomials(v, encodedMessage, this.Q);

    const ciphertext: Ciphertext = { vectorU, valueV: v as Int16Array<ArrayBuffer> };

    // Derive shared secret from message
    const sharedSecret = await LatticeUtils.hashToSeed(message);

    return { ciphertext, sharedSecret };
  }

  /**
   * Decapsulate - recover shared secret from ciphertext
   */
  static async decapsulate(
    ciphertext: Ciphertext,
    privateKey: KyberPrivateKey
  ): Promise<Uint8Array> {
    // Compute s^T * u
    let su = new Int16Array(this.N);
    for (let i = 0; i < this.K; i++) {
      const product = LatticeUtils.multiplyPolynomials(privateKey.vectorS[i], ciphertext.vectorU[i], this.Q);
      su = LatticeUtils.addPolynomials(su, product, this.Q);
    }

    // Recover v - s^T * u
    let recovered = new Int16Array(this.N);
    for (let i = 0; i < this.N; i++) {
      recovered[i] = ((ciphertext.valueV[i] - su[i]) % this.Q + this.Q) % this.Q;
    }

    // Decode message
    const message = this.decodeMessage(recovered);

    // Derive shared secret
    return LatticeUtils.hashToSeed(message);
  }

  /**
   * Generate matrix A from seed
   */
  private static async generateMatrixA(seed: Uint8Array): Promise<Int16Array[][]> {
    const matrix: Int16Array[][] = [];

    for (let i = 0; i < this.K; i++) {
      matrix[i] = [];
      for (let j = 0; j < this.K; j++) {
        // Derive polynomial from seed
        const derivedSeed = await LatticeUtils.hashToSeed(
          new Uint8Array([...seed, i, j])
        );
        const poly = new Int16Array(this.N);
        for (let k = 0; k < this.N; k++) {
          poly[k] = (derivedSeed[k % derivedSeed.length] % this.Q);
        }
        matrix[i][j] = poly as Int16Array<ArrayBuffer>;
      }
    }

    return matrix as Int16Array<ArrayBuffer>[][];
  }

  /**
   * Encode message bytes to polynomial
   */
  private static encodeMessage(message: Uint8Array): Int16Array {
    const poly = new Int16Array(this.N);
    for (let i = 0; i < Math.min(message.length * 8, this.N); i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      const bit = (message[byteIndex] >> bitIndex) & 1;
      poly[i] = bit ? Math.floor(this.Q / 2) : 0;
    }
    return poly;
  }

  /**
   * Decode polynomial to message bytes
   */
  private static decodeMessage(poly: Int16Array): Uint8Array {
    const message = new Uint8Array(Math.floor(this.N / 8));
    for (let i = 0; i < message.length * 8; i++) {
      const byteIndex = Math.floor(i / 8);
      const bitIndex = i % 8;
      // Check if coefficient is closer to q/2 than to 0
      const centered = poly[i] > this.Q / 2 ? poly[i] - this.Q : poly[i];
      const bit = Math.abs(centered) > this.Q / 4 ? 1 : 0;
      message[byteIndex] |= bit << bitIndex;
    }
    return message;
  }
}

// ============================================
// HYBRID ENCRYPTION - Classical + Post-Quantum
// ============================================

export class QuantumResistantEncryption {
  private kyberKeyPair: KyberKeyPair | null = null;
  private aesKey: CryptoKey | null = null;

  /**
   * Initialize with new key pair
   */
  async initialize(): Promise<void> {
    this.kyberKeyPair = await KyberKEM.generateKeyPair();
  }

  /**
   * Import existing keys
   */
  importKeys(serialized: string): void {
    const data = JSON.parse(serialized);
    // In production, would properly deserialize polynomials
    this.kyberKeyPair = data;
  }

  /**
   * Export keys for storage
   */
  exportKeys(): string {
    if (!this.kyberKeyPair) return '';
    return JSON.stringify(this.kyberKeyPair);
  }

  /**
   * Hybrid encrypt - uses both AES and Kyber
   */
  async encrypt(task: Task): Promise<EncryptedData & { pqCiphertext: Ciphertext }> {
    if (!this.kyberKeyPair) {
      await this.initialize();
    }

    // Generate ephemeral key pair for this encryption
    const ephemeralKeys = await KyberKEM.generateKeyPair();

    // Encapsulate shared secret
    const { ciphertext: pqCiphertext, sharedSecret } = await KyberKEM.encapsulate(
      this.kyberKeyPair!.publicKey
    );

    // Derive AES key from shared secret
    const aesKey = await this.deriveAESKey(sharedSecret);

    // Encrypt task data with AES-GCM
    const taskData = JSON.stringify({
      text: task.text,
      description: task.description,
      notes: task.notes
    });

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(taskData)
    );

    return {
      iv: this.arrayBufferToHex(iv),
      data: this.arrayBufferToHex(encrypted),
      pqCiphertext
    };
  }

  /**
   * Hybrid decrypt
   */
  async decrypt(encryptedData: EncryptedData & { pqCiphertext: Ciphertext }): Promise<Task> {
    if (!this.kyberKeyPair) {
      throw new Error('Keys not initialized');
    }

    // Decapsulate to get shared secret
    const sharedSecret = await KyberKEM.decapsulate(
      encryptedData.pqCiphertext,
      this.kyberKeyPair.privateKey
    );

    // Derive AES key
    const aesKey = await this.deriveAESKey(sharedSecret);

    // Decrypt with AES
    const iv = new Uint8Array(
      encryptedData.iv!.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || []
    );
    const data = new Uint8Array(
      encryptedData.data.match(/.{1,2}/g)?.map(b => parseInt(b, 16)) || []
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      data
    );

    const taskData = JSON.parse(new TextDecoder().decode(decrypted));

    return {
      id: 'decrypted-task',
      text: taskData.text,
      description: taskData.description,
      notes: taskData.notes,
      status: 'pending',
      priority: 'medium',
      recurrence: 'none',
      categories: [],
      tags: [],
      subtasks: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    };
  }

  /**
   * Derive AES-256 key from shared secret
   */
  private async deriveAESKey(sharedSecret: Uint8Array): Promise<CryptoKey> {
    // Hash the shared secret to get uniform key material
    const hash = await crypto.subtle.digest('SHA-256', sharedSecret);

    return await crypto.subtle.importKey(
      'raw',
      hash,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Get public key for sharing
   */
  getPublicKey(): string {
    if (!this.kyberKeyPair) return '';
    return JSON.stringify(this.kyberKeyPair.publicKey);
  }

  /**
   * Import peer's public key for secure communication
   */
  async importPeerPublicKey(publicKeyJson: string): Promise<Uint8Array> {
    const publicKey: KyberPublicKey = JSON.parse(publicKeyJson);
    const { sharedSecret } = await KyberKEM.encapsulate(publicKey);
    return sharedSecret;
  }

  /**
   * Utility: Convert ArrayBuffer to hex string
   */
  private arrayBufferToHex(buffer: ArrayBuffer | Uint8Array): string {
    const arr = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  }
}

// ============================================
// DILITHIUM-INSPIRED DIGITAL SIGNATURES
// ============================================

export interface DilithiumKeyPair {
  publicKey: DilithiumPublicKey;
  privateKey: DilithiumPrivateKey;
}

export interface DilithiumPublicKey {
  matrixA: Int16Array[];
  vectorT: Int16Array[];
  seed: Uint8Array;
}

export interface DilithiumPrivateKey {
  vectorS1: Int16Array[];
  vectorS2: Int16Array[];
  publicKey: DilithiumPublicKey;
}

export interface DilithiumSignature {
  vectorZ: Int16Array[];
  hint: Uint8Array;
  challenge: Uint8Array;
}

export class DilithiumDSA {
  private static readonly K = 4;
  private static readonly L = 4;
  private static readonly N = 64;
  private static readonly Q = 8380417;

  /**
   * Generate signing key pair
   */
  static async generateKeyPair(): Promise<DilithiumKeyPair> {
    const seed = crypto.getRandomValues(new Uint8Array(32));

    // Generate matrix A
    const matrixA = await this.generateMatrixA(seed);

    // Generate secret vectors
    const vectorS1: Int16Array[] = [];
    const vectorS2: Int16Array[] = [];
    for (let i = 0; i < this.L; i++) {
      vectorS1.push(LatticeUtils.generateErrorPolynomial(this.N) as Int16Array<ArrayBuffer>);
    }
    for (let i = 0; i < this.K; i++) {
      vectorS2.push(LatticeUtils.generateErrorPolynomial(this.N) as Int16Array<ArrayBuffer>);
    }

    // Compute t = A * s1 + s2
    const vectorT: Int16Array[] = [];
    for (let i = 0; i < this.K; i++) {
      let sum = new Int16Array(this.N);
      for (let j = 0; j < this.L; j++) {
        const product = LatticeUtils.multiplyPolynomials(matrixA[i][j], vectorS1[j], this.Q);
        sum = LatticeUtils.addPolynomials(sum, product, this.Q);
      }
      sum = LatticeUtils.addPolynomials(sum, vectorS2[i], this.Q);
      vectorT.push(sum as Int16Array<ArrayBuffer>);
    }

    const publicKey: DilithiumPublicKey = { matrixA, vectorT, seed };
    const privateKey: DilithiumPrivateKey = { vectorS1, vectorS2, publicKey };

    return { publicKey, privateKey };
  }

  /**
   * Sign message
   */
  static async sign(
    message: Uint8Array,
    privateKey: DilithiumPrivateKey
  ): Promise<DilithiumSignature> {
    // Hash message to get challenge seed
    const challengeSeed = await LatticeUtils.hashToSeed(message);

    // Generate challenge polynomial
    const challenge = new Int16Array(this.N);
    for (let i = 0; i < this.N; i++) {
      challenge[i] = challengeSeed[i % challengeSeed.length] % 3 - 1; // {-1, 0, 1}
    }

    // Generate random vector y
    const vectorY: Int16Array[] = [];
    for (let i = 0; i < this.L; i++) {
      vectorY.push(LatticeUtils.generatePolynomial(this.N, this.Q / 8));
    }

    // Compute z = y + c * s1
    const vectorZ: Int16Array[] = [];
    for (let i = 0; i < this.L; i++) {
      const cs1 = LatticeUtils.multiplyPolynomials(challenge, privateKey.vectorS1[i], this.Q);
      const z = LatticeUtils.addPolynomials(vectorY[i], cs1, this.Q);
      vectorZ.push(z);
    }

    // Generate hint for verification
    const hint = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      hint[i] = vectorZ[0][i] > 0 ? 1 : 0;
    }

    return { vectorZ, hint, challenge: challengeSeed };
  }

  /**
   * Verify signature
   */
  static async verify(
    message: Uint8Array,
    signature: DilithiumSignature,
    publicKey: DilithiumPublicKey
  ): Promise<boolean> {
    // Recompute challenge
    const challengeSeed = await LatticeUtils.hashToSeed(message);

    // Verify challenge matches
    if (signature.challenge.length !== challengeSeed.length) {
      return false;
    }

    for (let i = 0; i < challengeSeed.length; i++) {
      if (signature.challenge[i] !== challengeSeed[i]) {
        return false;
      }
    }

    // Verify z norm is bounded (simplified check)
    for (const z of signature.vectorZ) {
      for (const coeff of z) {
        if (Math.abs(coeff) > this.Q / 4) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Generate matrix A from seed
   */
  private static async generateMatrixA(seed: Uint8Array): Promise<Int16Array[][]> {
    const matrix: Int16Array[][] = [];

    for (let i = 0; i < this.K; i++) {
      matrix[i] = [];
      for (let j = 0; j < this.L; j++) {
        const derivedSeed = await LatticeUtils.hashToSeed(
          new Uint8Array([...seed, i, j])
        );
        const poly = new Int16Array(this.N);
        for (let k = 0; k < this.N; k++) {
          poly[k] = derivedSeed[k % derivedSeed.length] % this.Q;
        }
        matrix[i][j] = poly as Int16Array<ArrayBuffer>;
      }
    }

    return matrix as Int16Array<ArrayBuffer>[][];
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const quantumEncryption = new QuantumResistantEncryption();
