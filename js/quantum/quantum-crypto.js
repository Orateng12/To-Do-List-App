/**
 * Quantum-Resistant Cryptography
 * ===============================
 * Post-quantum cryptographic algorithms for future-proof security
 */

/**
 * Lattice-Based Cryptography (Simplified Kyber-inspired)
 * Based on Module-LWE (Learning With Errors)
 */
export class LatticeCrypto {
    constructor(n = 16, q = 3329) {
        this.n = n;  // Polynomial degree
        this.q = q;  // Modulus
    }

    /**
     * Generate polynomial with small coefficients
     */
    generateSmallPoly() {
        const poly = [];
        for (let i = 0; i < this.n; i++) {
            // Coefficients in range [-2, 2]
            poly.push(Math.floor(Math.random() * 5) - 2);
        }
        return poly;
    }

    /**
     * Generate random polynomial mod q
     */
    generateRandomPoly() {
        const poly = [];
        for (let i = 0; i < this.n; i++) {
            poly.push(Math.floor(Math.random() * this.q));
        }
        return poly;
    }

    /**
     * Add two polynomials mod q
     */
    polyAdd(a, b) {
        return a.map((val, i) => ((val + b[i]) % this.q + this.q) % this.q);
    }

    /**
     * Multiply polynomials (simplified - coefficient-wise)
     */
    polyMul(a, b) {
        const result = new Array(this.n).fill(0);
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                const idx = (i + j) % this.n;
                result[idx] = (result[idx] + a[i] * b[j]) % this.q;
            }
        }
        return result;
    }

    /**
     * Generate key pair
     */
    generateKeyPair() {
        // Secret key (small polynomial)
        const sk = this.generateSmallPoly();
        
        // Public matrix A
        const A = [];
        for (let i = 0; i < this.n; i++) {
            A.push(this.generateRandomPoly());
        }
        
        // Public key b = A*s + e (where e is small error)
        const e = this.generateSmallPoly();
        const b = this.polyAdd(
            this.matrixVectorMul(A, sk),
            e
        );

        return {
            publicKey: { A, b },
            secretKey: sk,
            algorithm: 'lattice-based'
        };
    }

    /**
     * Matrix-vector multiplication
     */
    matrixVectorMul(A, v) {
        const result = new Array(this.n).fill(0);
        for (let i = 0; i < this.n; i++) {
            for (let j = 0; j < this.n; j++) {
                result[i] = (result[i] + A[i][j] * v[j]) % this.q;
            }
        }
        return result;
    }

    /**
     * Encrypt message (simplified)
     */
    encrypt(message, publicKey) {
        const { A, b } = publicKey;
        
        // Random polynomial for encryption
        const r = this.generateSmallPoly();
        
        // Ciphertext u = A^T * r
        const u = this.matrixVectorMul(A, r);
        
        // Ciphertext v = b^T * r + encode(m)
        const vDotR = this.dotProduct(b, r);
        const encoded = this.encodeMessage(message);
        const v = (vDotR + encoded) % this.q;

        return { u, v };
    }

    /**
     * Decrypt ciphertext
     */
    decrypt(ciphertext, secretKey) {
        const { u, v } = ciphertext;
        
        // m = v - s^T * u
        const sDotU = this.dotProduct(secretKey, u);
        const decoded = ((v - sDotU) % this.q + this.q) % this.q;
        
        return this.decodeMessage(decoded);
    }

    /**
     * Dot product
     */
    dotProduct(a, b) {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
            sum = (sum + a[i] * b[i]) % this.q;
        }
        return sum;
    }

    /**
     * Encode message to polynomial coefficient
     */
    encodeMessage(message) {
        // Simple encoding: map to coefficient space
        const charCode = message.charCodeAt(0) || 0;
        return Math.floor(charCode * this.q / 256);
    }

    /**
     * Decode message from polynomial coefficient
     */
    decodeMessage(value) {
        // Reverse encoding
        const charCode = Math.round(value * 256 / this.q);
        return String.fromCharCode(charCode % 256);
    }
}

/**
 * Hash-Based Signatures (Merkle Signature Scheme)
 */
export class MerkleSignature {
    constructor(hashFunction = 'SHA-256') {
        this.hashFunction = hashFunction;
        this.leafCount = 0;
        this.leaves = [];
        this.tree = [];
    }

    /**
     * Hash data
     */
    async hash(data) {
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest(
            this.hashFunction,
            encoder.encode(data)
        );
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Generate leaf nodes
     */
    async generateLeaves(count) {
        this.leaves = [];
        for (let i = 0; i < count; i++) {
            // Generate random key pair for each leaf
            const privateKey = crypto.getRandomValues(new Uint8Array(32));
            const publicKey = await this.hash(
                Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join('')
            );
            
            this.leaves.push({
                privateKey: Array.from(privateKey),
                publicKey,
                used: false
            });
        }
        this.leafCount = count;
        
        // Build Merkle tree
        await this.buildTree();
        
        return {
            publicKey: this.tree[0][0], // Root
            leafCount: count
        };
    }

    /**
     * Build Merkle tree
     */
    async buildTree() {
        this.tree = [];
        
        // Level 0: leaves
        this.tree[0] = this.leaves.map(leaf => leaf.publicKey);
        
        // Build tree bottom-up
        let level = 0;
        while (this.tree[level].length > 1) {
            const nextLevel = [];
            const currentLevel = this.tree[level];
            
            for (let i = 0; i < currentLevel.length; i += 2) {
                const left = currentLevel[i];
                const right = currentLevel[i + 1] || left; // Duplicate if odd
                const parent = await this.hash(left + right);
                nextLevel.push(parent);
            }
            
            this.tree[level + 1] = nextLevel;
            level++;
        }
    }

    /**
     * Sign message with one-time key
     */
    async sign(message, leafIndex) {
        if (leafIndex >= this.leafCount || this.leaves[leafIndex].used) {
            throw new Error('Leaf already used or invalid');
        }

        const leaf = this.leaves[leafIndex];
        leaf.used = true;

        // Sign message with private key
        const messageHash = await this.hash(message);
        const signatureInput = messageHash + Array.from(leaf.privateKey).join('');
        const signature = await this.hash(signatureInput);

        // Generate authentication path
        const authPath = this.getAuthPath(leafIndex);

        return {
            signature,
            leafIndex,
            publicKey: leaf.publicKey,
            authPath,
            message: message
        };
    }

    /**
     * Get authentication path for leaf
     */
    getAuthPath(leafIndex) {
        const path = [];
        let index = leafIndex;
        
        for (let level = 0; level < this.tree.length - 1; level++) {
            const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
            const sibling = this.tree[level][siblingIndex] || null;
            
            path.push({
                hash: sibling,
                position: index % 2 === 0 ? 'right' : 'left'
            });
            
            index = Math.floor(index / 2);
        }
        
        return path;
    }

    /**
     * Verify signature
     */
    async verify(signature, rootPublicKey) {
        const { signature: sig, leafIndex, publicKey, authPath, message } = signature;

        // Verify signature with public key
        const messageHash = await this.hash(message);
        const verifyInput = messageHash + publicKey;
        const expectedSig = await this.hash(verifyInput);

        if (sig !== expectedSig) {
            return { valid: false, reason: 'Signature mismatch' };
        }

        // Verify authentication path
        let currentHash = publicKey;
        for (const node of authPath) {
            if (node.position === 'right') {
                currentHash = await this.hash(currentHash + node.hash);
            } else {
                currentHash = await this.hash(node.hash + currentHash);
            }
        }

        if (currentHash !== rootPublicKey) {
            return { valid: false, reason: 'Merkle path invalid' };
        }

        return { valid: true };
    }
}

/**
 * Code-Based Cryptography (McEliece-inspired)
 */
export class CodeBasedCrypto {
    constructor(n = 7, k = 4) {
        this.n = n; // Code length
        this.k = k; // Message length
        this.generatorMatrix = this.generateGeneratorMatrix();
    }

    /**
     * Generate random generator matrix
     */
    generateGeneratorMatrix() {
        const matrix = [];
        for (let i = 0; i < this.k; i++) {
            const row = [];
            for (let j = 0; j < this.n; j++) {
                row.push(j === i ? 1 : Math.floor(Math.random() * 2));
            }
            matrix.push(row);
        }
        return matrix;
    }

    /**
     * Generate key pair
     */
    generateKeyPair() {
        // Scrambling matrix S
        const S = this.generateRandomInvertibleMatrix(this.k);
        
        // Permutation matrix P
        const P = this.generatePermutationMatrix(this.n);
        
        // Public key G' = S * G * P
        const GPrime = this.matrixMul(
            this.matrixMul(S, this.generatorMatrix),
            P
        );

        return {
            publicKey: GPrime,
            secretKey: { S, P, G: this.generatorMatrix },
            algorithm: 'code-based'
        };
    }

    /**
     * Generate random invertible matrix
     */
    generateRandomInvertibleMatrix(size) {
        // Identity matrix for simplicity
        const matrix = [];
        for (let i = 0; i < size; i++) {
            const row = [];
            for (let j = 0; j < size; j++) {
                row.push(i === j ? 1 : 0);
            }
            matrix.push(row);
        }
        return matrix;
    }

    /**
     * Generate permutation matrix
     */
    generatePermutationMatrix(size) {
        const matrix = [];
        const permutation = Array.from({ length: size }, (_, i) => i);
        
        // Shuffle
        for (let i = size - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
        }

        for (let i = 0; i < size; i++) {
            const row = [];
            for (let j = 0; j < size; j++) {
                row.push(permutation[i] === j ? 1 : 0);
            }
            matrix.push(row);
        }

        return matrix;
    }

    /**
     * Matrix multiplication mod 2
     */
    matrixMul(a, b) {
        const result = [];
        for (let i = 0; i < a.length; i++) {
            const row = [];
            for (let j = 0; j < b[0].length; j++) {
                let sum = 0;
                for (let k = 0; k < a[0].length; k++) {
                    sum += a[i][k] * b[k][j];
                }
                row.push(sum % 2);
            }
            result.push(row);
        }
        return result;
    }

    /**
     * Encrypt message
     */
    encrypt(messageBits, publicKey) {
        // c = m * G' + e (where e is random error)
        const encoded = this.matrixVectorMul(messageBits, publicKey);
        const error = this.generateErrorVector(this.n);
        
        return encoded.map((bit, i) => (bit + error[i]) % 2);
    }

    /**
     * Generate error vector
     */
    generateErrorVector(length) {
        const error = [];
        for (let i = 0; i < length; i++) {
            error.push(Math.random() < 0.1 ? 1 : 0); // 10% error rate
        }
        return error;
    }

    /**
     * Matrix-vector multiplication mod 2
     */
    matrixVectorMul(matrix, vector) {
        const result = [];
        for (let i = 0; i < matrix.length; i++) {
            let sum = 0;
            for (let j = 0; j < matrix[0].length; j++) {
                sum += matrix[i][j] * vector[j];
            }
            result.push(sum % 2);
        }
        return result;
    }
}

/**
 * Quantum Key Distribution Simulator (BB84 Protocol)
 */
export class QKDSimulator {
    constructor() {
        this.bases = ['+', '×']; // Rectilinear and Diagonal
    }

    /**
     * Generate random bit
     */
    randomBit() {
        return Math.random() < 0.5 ? 0 : 1;
    }

    /**
     * Generate random basis
     */
    randomBasis() {
        return this.bases[Math.floor(Math.random() * 2)];
    }

    /**
     * Encode bit in quantum state
     */
    encodeBit(bit, basis) {
        // Simulate quantum state encoding
        return {
            bit,
            basis,
            state: `${bit}:${basis}`
        };
    }

    /**
     * Measure quantum state
     */
    measure(state, basis) {
        if (state.basis === basis) {
            // Correct basis - get correct bit
            return state.bit;
        } else {
            // Wrong basis - random result
            return this.randomBit();
        }
    }

    /**
     * Run BB84 protocol
     */
    run(length = 64) {
        // Alice generates random bits and bases
        const aliceBits = [];
        const aliceBases = [];
        for (let i = 0; i < length; i++) {
            aliceBits.push(this.randomBit());
            aliceBases.push(this.randomBasis());
        }

        // Alice encodes and sends to Bob
        const quantumStates = aliceBits.map((bit, i) => 
            this.encodeBit(bit, aliceBases[i])
        );

        // Bob measures with random bases
        const bobBits = [];
        const bobBases = [];
        for (let i = 0; i < length; i++) {
            const basis = this.randomBasis();
            bobBases.push(basis);
            bobBits.push(this.measure(quantumStates[i], basis));
        }

        // Sifting - keep only matching bases
        const siftedAlice = [];
        const siftedBob = [];
        for (let i = 0; i < length; i++) {
            if (aliceBases[i] === bobBases[i]) {
                siftedAlice.push(aliceBits[i]);
                siftedBob.push(bobBits[i]);
            }
        }

        // Error estimation (simulate eavesdropping check)
        const sampleSize = Math.min(16, siftedAlice.length / 4);
        let errors = 0;
        for (let i = 0; i < sampleSize; i++) {
            if (siftedAlice[i] !== siftedBob[i]) {
                errors++;
            }
        }

        const errorRate = errors / sampleSize;
        const secure = errorRate < 0.1; // Less than 10% error is acceptable

        return {
            siftedKey: siftedAlice.slice(sampleSize),
            errorRate,
            secure,
            keyLength: siftedAlice.length - sampleSize
        };
    }
}

/**
 * Post-Quantum Crypto Manager
 */
export class PostQuantumCrypto {
    constructor() {
        this.lattice = new LatticeCrypto();
        this.merkle = new MerkleSignature();
        this.codeBased = new CodeBasedCrypto();
        this.qkd = new QKDSimulator();
    }

    /**
     * Generate hybrid key pair (classical + post-quantum)
     */
    async generateHybridKeyPair() {
        // Classical (ECDSA)
        const classicalKey = await crypto.subtle.generateKey(
            { name: 'ECDSA', namedCurve: 'P-384' },
            true,
            ['sign', 'verify']
        );

        // Post-quantum (Lattice-based)
        const pqKey = this.lattice.generateKeyPair();

        // Merkle signature scheme
        const merkleKeys = await this.merkle.generateLeaves(16);

        return {
            classical: classicalKey,
            postQuantum: pqKey,
            merkle: merkleKeys,
            algorithm: 'hybrid-pq'
        };
    }

    /**
     * Encrypt with hybrid scheme
     */
    async hybridEncrypt(message, publicKey) {
        // Classical encryption
        const encoder = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const classicalEncrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            publicKey.classical,
            encoder.encode(message)
        );

        // Post-quantum encryption
        const pqEncrypted = this.lattice.encrypt(
            message.charAt(0),
            publicKey.postQuantum.publicKey
        );

        return {
            classical: {
                iv: Array.from(iv),
                data: Array.from(new Uint8Array(classicalEncrypted))
            },
            postQuantum: pqEncrypted
        };
    }

    /**
     * Generate quantum-secure key via QKD
     */
    generateQKDKey(length = 64) {
        return this.qkd.run(length);
    }
}

/**
 * Create post-quantum crypto instance
 */
export function createPostQuantumCrypto() {
    return new PostQuantumCrypto();
}
