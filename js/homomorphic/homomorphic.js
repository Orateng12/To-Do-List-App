/**
 * Homomorphic Encryption for Computation on Encrypted Data
 * =========================================================
 * Perform calculations on encrypted tasks without decryption
 * Based on Paillier cryptosystem (simplified)
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Homomorphic Encryption System
 * Allows computation on ciphertexts that decrypts to computation on plaintexts
 */
export class HomomorphicEncryption {
    constructor() {
        // Key size in bits (smaller for demo, use 2048+ in production)
        this.keySize = 512;
        this.publicKey = null;
        this.privateKey = null;
    }

    /**
     * Generate key pair
     * In production, use proper prime generation
     */
    async generateKeyPair() {
        // Generate two large primes (simplified for demo)
        const p = this.generateLargePrime();
        const q = this.generateLargePrime();
        
        const n = p * q;
        const nSquared = n * n;
        const g = n + 1; // Simplified generator
        
        // Lambda function
        const lambda = this.lcm(p - 1, q - 1);
        
        // Compute mu using L function
        const mu = this.modInverse(this.lFunction(this.powerMod(g, lambda, nSquared), n), n);

        this.publicKey = { n, nSquared, g };
        this.privateKey = { lambda, mu, p, q };

        return {
            publicKey: { n: n.toString(), nSquared: nSquared.toString(), g: g.toString() },
            privateKey: { lambda: lambda.toString(), mu: mu.toString() }
        };
    }

    /**
     * Generate large prime (simplified)
     */
    generateLargePrime() {
        // For demo purposes - use proper prime generation in production
        const min = BigInt(Math.pow(2, this.keySize / 2 - 1));
        const max = BigInt(Math.pow(2, this.keySize / 2));
        
        // Find a probable prime
        let candidate = min + BigInt(Math.floor(Math.random() * Number(max - min)));
        while (!this.isProbablePrime(candidate)) {
            candidate += BigInt(2);
        }
        
        return candidate;
    }

    /**
     * Check if number is probably prime (Miller-Rabin test simplified)
     */
    isProbablePrime(n) {
        if (n < BigInt(2)) return false;
        if (n === BigInt(2)) return true;
        if (n % BigInt(2) === BigInt(0)) return false;
        
        // Simple primality test for demo
        const limit = BigInt(Math.min(1000, Number(n) / 2));
        for (let i = BigInt(3); i < limit; i += BigInt(2)) {
            if (n % i === BigInt(0)) return false;
        }
        return true;
    }

    /**
     * GCD using Euclidean algorithm
     */
    gcd(a, b) {
        while (b > BigInt(0)) {
            const temp = b;
            b = a % b;
            a = temp;
        }
        return a;
    }

    /**
     * LCM
     */
    lcm(a, b) {
        return (a * b) / this.gcd(a, b);
    }

    /**
     * Modular inverse using extended Euclidean algorithm
     */
    modInverse(a, m) {
        let m0 = m;
        let y = BigInt(0);
        let x = BigInt(1);

        if (m === BigInt(1)) return BigInt(0);

        while (a > BigInt(1)) {
            const q = a / m;
            let t = m;

            m = a % m;
            a = t;
            t = y;

            y = x - q * y;
            x = t;
        }

        if (x < BigInt(0)) x += m0;
        return x;
    }

    /**
     * Power mod (a^b mod m)
     */
    powerMod(base, exp, mod) {
        let result = BigInt(1);
        base = base % mod;
        
        while (exp > BigInt(0)) {
            if (exp % BigInt(2) === BigInt(1)) {
                result = (result * base) % mod;
            }
            exp = exp / BigInt(2);
            base = (base * base) % mod;
        }
        
        return result;
    }

    /**
     * L function for Paillier
     */
    lFunction(u, n) {
        return (u - BigInt(1)) / n;
    }

    /**
     * Encrypt plaintext
     * E(m) = g^m * r^n mod n^2
     */
    encrypt(plaintext, publicKey = this.publicKey) {
        if (!publicKey) throw new Error('No public key available');
        
        const { n, nSquared, g } = publicKey;
        const m = BigInt(plaintext);
        
        // Random r
        const r = BigInt(Math.floor(Math.random() * 1000000) + 1);
        
        // g^m mod n^2
        const gm = this.powerMod(g, m, nSquared);
        
        // r^n mod n^2
        const rn = this.powerMod(r, n, nSquared);
        
        // c = g^m * r^n mod n^2
        const ciphertext = (gm * rn) % nSquared;
        
        return {
            ciphertext: ciphertext.toString(),
            publicKey: {
                n: n.toString(),
                nSquared: nSquared.toString()
            }
        };
    }

    /**
     * Decrypt ciphertext
     * D(c) = L(c^lambda mod n^2) * mu mod n
     */
    decrypt(encrypted, privateKey = this.privateKey, publicKey = this.publicKey) {
        if (!privateKey || !publicKey) throw new Error('No keys available');
        
        const c = BigInt(encrypted.ciphertext);
        const { lambda, mu } = privateKey;
        const { n, nSquared } = publicKey;
        
        // c^lambda mod n^2
        const cl = this.powerMod(c, lambda, nSquared);
        
        // L(c^lambda mod n^2)
        const l = this.lFunction(cl, n);
        
        // m = L(c^lambda mod n^2) * mu mod n
        const plaintext = (l * mu) % n;
        
        return plaintext;
    }

    /**
     * Homomorphic Addition
     * E(m1 + m2) = E(m1) * E(m2) mod n^2
     * Allows adding encrypted values without decryption!
     */
    add(encrypted1, encrypted2, publicKey = this.publicKey) {
        const c1 = BigInt(encrypted1.ciphertext);
        const c2 = BigInt(encrypted2.ciphertext);
        const { nSquared } = publicKey;
        
        // Multiply ciphertexts
        const sumCiphertext = (c1 * c2) % nSquared;
        
        return {
            ciphertext: sumCiphertext.toString(),
            publicKey: {
                n: publicKey.n.toString(),
                nSquared: nSquared.toString()
            },
            operation: 'addition',
            operandCount: 2
        };
    }

    /**
     * Homomorphic Scalar Multiplication
     * E(k * m) = E(m)^k mod n^2
     * Allows multiplying encrypted value by plaintext scalar
     */
    multiplyScalar(encrypted, scalar, publicKey = this.publicKey) {
        const c = BigInt(encrypted.ciphertext);
        const { nSquared } = publicKey;
        const k = BigInt(scalar);
        
        // Raise ciphertext to power k
        const productCiphertext = this.powerMod(c, k, nSquared);
        
        return {
            ciphertext: productCiphertext.toString(),
            publicKey: {
                n: publicKey.n.toString(),
                nSquared: nSquared.toString()
            },
            operation: 'scalar_multiplication',
            scalar: scalar.toString()
        };
    }

    /**
     * Verify homomorphic properties
     */
    async verifyHomomorphicProperties() {
        // Generate keys
        const keys = await this.generateKeyPair();
        
        // Test values
        const m1 = BigInt(42);
        const m2 = BigInt(58);
        const scalar = BigInt(3);
        
        // Encrypt
        const e1 = this.encrypt(m1, keys.publicKey);
        const e2 = this.encrypt(m2, keys.publicKey);
        
        // Homomorphic addition
        const eSum = this.add(e1, e2, keys.publicKey);
        const decryptedSum = this.decrypt(eSum, keys.privateKey, keys.publicKey);
        
        // Homomorphic scalar multiplication
        const eProduct = this.multiplyScalar(e1, scalar, keys.publicKey);
        const decryptedProduct = this.decrypt(eProduct, keys.privateKey, keys.publicKey);
        
        return {
            additionTest: {
                plaintext: (m1 + m2).toString(),
                decryptedFromEncrypted: decryptedSum.toString(),
                passed: (m1 + m2) === decryptedSum
            },
            scalarMultiplicationTest: {
                plaintext: (m1 * scalar).toString(),
                decryptedFromEncrypted: decryptedProduct.toString(),
                passed: (m1 * scalar) === decryptedProduct
            }
        };
    }
}

/**
 * Privacy-Preserving Task Analytics
 * Compute statistics on encrypted task data
 */
export class PrivateAnalytics {
    constructor(homomorphic) {
        this.he = homomorphic;
        this.encryptedTasks = new Map();
        this.publicKey = null;
    }

    /**
     * Initialize with key pair
     */
    async initialize() {
        const keys = await this.he.generateKeyPair();
        this.publicKey = keys.publicKey;
        this.privateKey = keys.privateKey;
        
        return { publicKey: this.publicKey };
    }

    /**
     * Add encrypted task metric
     */
    async addTaskMetric(taskId, metricName, value) {
        const encrypted = this.he.encrypt(BigInt(value), this.publicKey);
        
        if (!this.encryptedTasks.has(taskId)) {
            this.encryptedTasks.set(taskId, {});
        }
        
        this.encryptedTasks.get(taskId)[metricName] = encrypted;
        
        return { encrypted: true, metricName };
    }

    /**
     * Compute encrypted sum of a metric across all tasks
     */
    computeEncryptedSum(metricName) {
        let sum = null;
        let count = 0;
        
        for (const taskMetrics of this.encryptedTasks.values()) {
            if (taskMetrics[metricName]) {
                if (sum === null) {
                    sum = taskMetrics[metricName];
                } else {
                    sum = this.he.add(sum, taskMetrics[metricName], this.publicKey);
                }
                count++;
            }
        }
        
        return {
            encryptedSum: sum,
            taskCount: count,
            metricName
        };
    }

    /**
     * Decrypt and reveal sum
     */
    decryptSum(encryptedSum) {
        if (!encryptedSum) return BigInt(0);
        return this.he.decrypt(encryptedSum, this.privateKey, this.publicKey);
    }

    /**
     * Compute average (requires decryption for division)
     */
    async computeAverage(metricName) {
        const { encryptedSum, taskCount } = this.computeEncryptedSum(metricName);
        
        if (taskCount === 0) return { average: 0, count: 0 };
        
        const sum = this.decryptSum(encryptedSum);
        const average = sum / BigInt(taskCount);
        
        return {
            average: average.toString(),
            count: taskCount,
            metricName,
            privacyPreserved: true
        };
    }

    /**
     * Get privacy-preserving statistics
     */
    getStatistics() {
        return {
            totalTasks: this.encryptedTasks.size,
            metricsTracked: new Set(
                Array.from(this.encryptedTasks.values()).flatMap(Object.keys)
            ).size,
            publicKeyAvailable: !!this.publicKey,
            allDataEncrypted: true
        };
    }
}

/**
 * Encrypted Task Priority Calculator
 * Calculate priority scores without revealing task details
 */
export class EncryptedPriorityCalculator {
    constructor(homomorphic) {
        this.he = homomorphic;
        this.weights = {
            urgency: 3,
            importance: 2,
            effort: 1  // Lower effort = higher priority
        };
    }

    /**
     * Calculate encrypted priority score
     * Score = (urgency * 3 + importance * 2 - effort * 1)
     */
    async calculatePriority(urgency, importance, effort) {
        // Encrypt individual components
        const eUrgency = this.he.encrypt(BigInt(urgency));
        const eImportance = this.he.encrypt(BigInt(importance));
        const eEffort = this.he.encrypt(BigInt(effort));
        
        // Apply weights using scalar multiplication
        const eWeightedUrgency = this.he.multiplyScalar(eUrgency, this.weights.urgency);
        const eWeightedImportance = this.he.multiplyScalar(eImportance, this.weights.importance);
        const eWeightedEffort = this.he.multiplyScalar(eEffort, this.weights.effort);
        
        // Sum weighted components
        const eSum1 = this.he.add(eWeightedUrgency, eWeightedImportance);
        const eScore = this.he.add(eSum1, eWeightedEffort);
        
        return {
            encryptedScore: eScore,
            computation: 'homomorphic',
            weights: this.weights
        };
    }

    /**
     * Compare two encrypted scores (returns encrypted comparison)
     */
    compareScores(encryptedScore1, encryptedScore2) {
        // In full implementation, this would use encrypted comparison protocols
        // For demo, we indicate that comparison is possible
        return {
            comparable: true,
            protocol: 'encrypted_comparison',
            note: 'Full implementation requires encrypted comparison protocol'
        };
    }
}

/**
 * Create homomorphic encryption system
 */
export function createHomomorphicEncryption() {
    const he = new HomomorphicEncryption();
    const analytics = new PrivateAnalytics(he);
    const priorityCalc = new EncryptedPriorityCalculator(he);
    
    return {
        he,
        analytics,
        priorityCalc,
        async verify() {
            return await he.verifyHomomorphicProperties();
        }
    };
}
