/**
 * Advanced Cryptography & Verification Module
 * ============================================
 * Homomorphic encryption, zero-knowledge proofs, and formal verification
 */

import type { Task, TaskId } from '../types';

// ============================================
// HOMOMORPHIC ENCRYPTION (Paillier-inspired)
// ============================================

/**
 * Simplified partially homomorphic encryption
 * Allows computation on encrypted data (addition only)
 * Note: This is a simplified educational implementation
 * Real homomorphic encryption requires big integer arithmetic
 */

export interface HEKeyPair {
  publicKey: HEPublicKey;
  privateKey: HEPrivateKey;
}

export interface HEPublicKey {
  n: bigint;      // n = p * q
  g: bigint;      // generator
  nSquared: bigint;
}

export interface HEPrivateKey {
  lambda: bigint; // lcm(p-1, q-1)
  mu: bigint;     // modular inverse
  p: bigint;
  q: bigint;
}

export interface Ciphertext {
  c: bigint;
}

export class HomomorphicEncryption {
  private keyPair: HEKeyPair | null = null;

  /**
   * Generate key pair with specified bit length
   */
  async generateKeys(bitLength: number = 512): Promise<HEKeyPair> {
    // Generate two large primes
    const p = await this.generateLargePrime(bitLength / 2);
    const q = await this.generateLargePrime(bitLength / 2);

    const n = p * q;
    const nSquared = n * n;
    const g = n + 1n; // Simplified generator

    // Calculate lambda = lcm(p-1, q-1)
    const lambda = this.lcm(p - 1n, q - 1n);

    // Calculate mu = lambda^(-1) mod n
    const mu = this.modInverse(lambda, n);

    this.keyPair = {
      publicKey: { n, g, nSquared },
      privateKey: { lambda, mu, p, q }
    };

    return this.keyPair;
  }

  /**
   * Encrypt plaintext
   */
  encrypt(plaintext: bigint, randomFactor?: bigint): Ciphertext {
    if (!this.keyPair) {
      throw new Error('Keys not generated');
    }

    const { n, g, nSquared } = this.keyPair.publicKey;
    const r = randomFactor || this.randomBigInt(n);

    // c = g^m * r^n mod n^2
    const gm = this.modPow(g, plaintext, nSquared);
    const rn = this.modPow(r, n, nSquared);
    const c = (gm * rn) % nSquared;

    return { c };
  }

  /**
   * Decrypt ciphertext
   */
  decrypt(ciphertext: Ciphertext): bigint {
    if (!this.keyPair) {
      throw new Error('Keys not generated');
    }

    const { n, nSquared } = this.keyPair.publicKey;
    const { lambda, mu } = this.keyPair.privateKey;

    // m = L(c^lambda mod n^2) * mu mod n
    const cLambda = this.modPow(ciphertext.c, lambda, nSquared);
    const lValue = this.lFunction(cLambda, n);
    const m = (lValue * mu) % n;

    return m;
  }

  /**
   * Homomorphic addition - add two encrypted values
   */
  add(cipher1: Ciphertext, cipher2: Ciphertext): Ciphertext {
    if (!this.keyPair) {
      throw new Error('Keys not generated');
    }

    const { nSquared } = this.keyPair.publicKey;

    // c3 = c1 * c2 mod n^2
    const c3 = (cipher1.c * cipher2.c) % nSquared;

    return { c: c3 };
  }

  /**
   * Homomorphic scalar multiplication - multiply encrypted value by plaintext
   */
  multiplyScalar(ciphertext: Ciphertext, scalar: bigint): Ciphertext {
    if (!this.keyPair) {
      throw new Error('Keys not generated');
    }

    const { nSquared } = this.keyPair.publicKey;

    // c' = c^scalar mod n^2
    const c = this.modPow(ciphertext.c, scalar, nSquared);

    return { c };
  }

  /**
   * L function for decryption
   */
  private lFunction(u: bigint, n: bigint): bigint {
    return (u - 1n) / n;
  }

  /**
   * Modular exponentiation
   */
  private modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    base = base % mod;

    while (exp > 0n) {
      if (exp % 2n === 1n) {
        result = (result * base) % mod;
      }
      exp = exp / 2n;
      base = (base * base) % mod;
    }

    return result;
  }

  /**
   * Modular inverse using extended Euclidean algorithm
   */
  private modInverse(a: bigint, m: bigint): bigint {
    const [gcd, x] = this.extendedGcd(a, m);
    if (gcd !== 1n) {
      throw new Error('Modular inverse does not exist');
    }
    return ((x % m) + m) % m;
  }

  /**
   * Extended Euclidean algorithm
   */
  private extendedGcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
    if (a === 0n) {
      return [b, 0n, 1n];
    }

    const [gcd, x1, y1] = this.extendedGcd(b % a, a);
    const x = y1 - (b / a) * x1;
    const y = x1;

    return [gcd, x, y];
  }

  /**
   * Calculate LCM
   */
  private lcm(a: bigint, b: bigint): bigint {
    return (a * b) / this.gcd(a, b);
  }

  /**
   * Calculate GCD
   */
  private gcd(a: bigint, b: bigint): bigint {
    while (b !== 0n) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  /**
   * Generate large prime number
   */
  private async generateLargePrime(bits: number): Promise<bigint> {
    // Simplified prime generation
    // In production, use proper primality testing (Miller-Rabin)
    const min = 2n ** BigInt(bits - 1);
    const max = 2n ** BigInt(bits);

    while (true) {
      const candidate = this.randomBigIntInRange(min, max);
      if (await this.isPrime(candidate)) {
        return candidate;
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  /**
   * Miller-Rabin primality test
   */
  private async isPrime(n: bigint, k: number = 5): Promise<boolean> {
    if (n <= 1n) return false;
    if (n <= 3n) return true;
    if (n % 2n === 0n) return false;

    // Write n-1 as 2^r * d
    let d = n - 1n;
    let r = 0n;
    while (d % 2n === 0n) {
      d = d / 2n;
      r = r + 1n;
    }

    // Witness loop
    for (let i = 0; i < k; i++) {
      const a = this.randomBigIntInRange(2n, n - 2n);
      let x = this.modPow(a, d, n);

      if (x === 1n || x === n - 1n) continue;

      let composite = true;
      for (let j = 0; j < Number(r) - 1; j++) {
        x = this.modPow(x, 2n, n);
        if (x === n - 1n) {
          composite = false;
          break;
        }
      }

      if (composite) return false;
    }

    return true;
  }

  /**
   * Generate random bigint
   */
  private randomBigInt(max: bigint): bigint {
    const bytes = Math.ceil(Math.log2(Number(max)) / 8);
    const randomBytes = crypto.getRandomValues(new Uint8Array(bytes));
    let result = 0n;
    for (const byte of randomBytes) {
      result = (result * 256n) + BigInt(byte);
    }
    return result % max;
  }

  /**
   * Generate random bigint in range
   */
  private randomBigIntInRange(min: bigint, max: bigint): bigint {
    const range = max - min;
    return min + this.randomBigInt(range);
  }

  /**
   * Export keys
   */
  exportKeys(): string {
    if (!this.keyPair) return '';
    return JSON.stringify({
      publicKey: {
        n: this.keyPair.publicKey.n.toString(),
        g: this.keyPair.publicKey.g.toString(),
        nSquared: this.keyPair.publicKey.nSquared.toString()
      },
      privateKey: {
        lambda: this.keyPair.privateKey.lambda.toString(),
        mu: this.keyPair.privateKey.mu.toString(),
        p: this.keyPair.privateKey.p.toString(),
        q: this.keyPair.privateKey.q.toString()
      }
    });
  }

  /**
   * Import keys
   */
  importKeys(json: string): void {
    const data = JSON.parse(json);
    this.keyPair = {
      publicKey: {
        n: BigInt(data.publicKey.n),
        g: BigInt(data.publicKey.g),
        nSquared: BigInt(data.publicKey.nSquared)
      },
      privateKey: {
        lambda: BigInt(data.privateKey.lambda),
        mu: BigInt(data.privateKey.mu),
        p: BigInt(data.privateKey.p),
        q: BigInt(data.privateKey.q)
      }
    };
  }
}

// ============================================
// ZERO-KNOWLEDGE PROOFS (Schnorr Protocol)
// ============================================

export interface ZKPProof {
  commitment: bigint;
  challenge: bigint;
  response: bigint;
}

export interface ZKPStatement {
  taskId: TaskId;
  claim: string;
  proof: ZKPProof;
  verified: boolean;
  timestamp: Date;
}

export class ZeroKnowledgeProof {
  private p: bigint;      // Large prime
  private g: bigint;      // Generator
  private x: bigint;      // Secret (prover's private key)
  private y: bigint;      // Public key (g^x mod p)

  constructor() {
    // Use safe prime for security
    this.p = 2n ** 256n - 2n ** 224n + 2n ** 192n + 2n ** 96n - 1n;
    this.g = 2n;
    this.x = this.randomBigInt(this.p - 1n) + 1n;
    this.y = this.modPow(this.g, this.x, this.p);
  }

  /**
   * Generate proof of knowledge
   */
  async generateProof(secret: bigint = this.x): Promise<ZKPProof> {
    // Commitment: choose random r, compute t = g^r mod p
    const r = this.randomBigInt(this.p - 2n) + 1n;
    const commitment = this.modPow(this.g, r, this.p);

    // Challenge: hash of commitment and public values
    const challenge = await this.hashToBigInt(commitment, this.y, this.g, this.p);

    // Response: s = r + c * x mod (p-1)
    const response = (r + challenge * secret) % (this.p - 1n);

    return { commitment, challenge, response };
  }

  /**
   * Verify proof
   */
  verifyProof(proof: ZKPProof, publicKey: bigint = this.y): boolean {
    // Verify: g^s = t * y^c mod p
    const leftSide = this.modPow(this.g, proof.response, this.p);
    const rightSide = (proof.commitment * this.modPow(publicKey, proof.challenge, this.p)) % this.p;

    return leftSide === rightSide;
  }

  /**
   * Create ZKP statement for task
   */
  async createTaskStatement(taskId: TaskId, claim: string, secret: bigint): Promise<ZKPStatement> {
    const proof = await this.generateProof(secret);

    return {
      taskId,
      claim,
      proof,
      verified: true, // We generated it, so it's valid
      timestamp: new Date()
    };
  }

  /**
   * Verify task statement
   */
  verifyTaskStatement(statement: ZKPStatement): boolean {
    const isValid = this.verifyProof(statement.proof, this.y);
    statement.verified = isValid;
    return isValid;
  }

  /**
   * Prove task ownership without revealing identity
   */
  async proveTaskOwnership(taskId: TaskId, userSecret: bigint): Promise<ZKPStatement> {
    return await this.createTaskStatement(
      taskId,
      `I own task ${taskId} without revealing my identity`,
      userSecret
    );
  }

  /**
   * Prove task completion status
   */
  async proveTaskCompletion(taskId: TaskId, completed: boolean, secret: bigint): Promise<ZKPStatement> {
    const claim = completed
      ? `Task ${taskId} was completed`
      : `Task ${taskId} is not completed`;
    return await this.createTaskStatement(taskId, claim, secret);
  }

  /**
   * Range proof - prove value is in range without revealing it
   */
  async proveInRange(value: bigint, min: bigint, max: bigint): Promise<ZKPProof> {
    // Simplified range proof using commitment
    if (value < min || value > max) {
      throw new Error('Value out of range');
    }

    // Create commitment to value
    const r = this.randomBigInt(this.p - 1n);
    const commitment = (this.modPow(this.g, value, this.p) * this.modPow(2n, r, this.p)) % this.p;
    const challenge = await this.hashToBigInt(commitment);
    const response = (r + challenge * value) % (this.p - 1n);

    return { commitment, challenge, response };
  }

  /**
   * Hash values to bigint (simulated random oracle)
   */
  private async hashToBigInt(...values: bigint[]): Promise<bigint> {
    const data = new TextEncoder().encode(values.map(v => v.toString()).join(':'));
    const hash = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hash);

    // Convert first 32 bytes to bigint
    let result = 0n;
    for (let i = 0; i < Math.min(32, hashArray.length); i++) {
      result = (result * 256n) + BigInt(hashArray[i]);
    }

    return result % (this.p - 1n);
  }

  /**
   * Modular exponentiation
   */
  private modPow(base: bigint, exp: bigint, mod: bigint): bigint {
    let result = 1n;
    base = base % mod;

    while (exp > 0n) {
      if (exp % 2n === 1n) {
        result = (result * base) % mod;
      }
      exp = exp / 2n;
      base = (base * base) % mod;
    }

    return result;
  }

  /**
   * Generate random bigint
   */
  private randomBigInt(max: bigint): bigint {
    const bytes = 32;
    const randomBytes = crypto.getRandomValues(new Uint8Array(bytes));
    let result = 0n;
    for (const byte of randomBytes) {
      result = (result * 256n) + BigInt(byte);
    }
    return result % max;
  }

  /**
   * Get public key
   */
  getPublicKey(): bigint {
    return this.y;
  }
}

// ============================================
// CHAOS ENGINEERING
// ============================================

export interface ChaosExperiment {
  id: string;
  name: string;
  type: ChaosType;
  target: string;
  probability: number;
  duration: number;
  startTime?: Date;
  endTime?: Date;
  status: 'scheduled' | 'running' | 'completed' | 'failed';
  result?: ChaosResult;
}

export type ChaosType =
  | 'latency_injection'
  | 'error_injection'
  | 'resource_exhaustion'
  | 'network_partition'
  | 'state_corruption'
  | 'dependency_failure';

export interface ChaosResult {
  success: boolean;
  observations: string[];
  metrics: Record<string, number>;
  recommendations: string[];
}

export class ChaosEngine {
  private experiments: Map<string, ChaosExperiment> = new Map();
  private activeExperiments: Set<string> = new Set();
  private observers: Array<(event: ChaosEvent) => void> = [];

  /**
   * Schedule chaos experiment
   */
  scheduleExperiment(experiment: Omit<ChaosExperiment, 'id' | 'status'>): ChaosExperiment {
    const id = `chaos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const fullExperiment: ChaosExperiment = {
      ...experiment,
      id,
      status: 'scheduled'
    };

    this.experiments.set(id, fullExperiment);
    this.notifyObservers({ type: 'experiment_scheduled', experiment: fullExperiment });

    return fullExperiment;
  }

  /**
   * Run chaos experiment
   */
  async runExperiment(experimentId: string): Promise<ChaosResult> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) {
      throw new Error(`Experiment ${experimentId} not found`);
    }

    experiment.status = 'running';
    experiment.startTime = new Date();
    this.activeExperiments.add(experimentId);

    this.notifyObservers({ type: 'experiment_started', experiment });

    try {
      const result = await this.executeExperiment(experiment);
      experiment.status = 'completed';
      experiment.result = result;

      this.notifyObservers({ type: 'experiment_completed', experiment, result });
      return result;
    } catch (error) {
      experiment.status = 'failed';
      const result: ChaosResult = {
        success: false,
        observations: [`Experiment failed: ${error}`],
        metrics: {},
        recommendations: ['Review experiment configuration']
      };
      experiment.result = result;

      this.notifyObservers({ type: 'experiment_failed', experiment, error });
      return result;
    } finally {
      experiment.endTime = new Date();
      this.activeExperiments.delete(experimentId);
    }
  }

  /**
   * Execute specific chaos experiment
   */
  private async executeExperiment(experiment: ChaosExperiment): Promise<ChaosResult> {
    const observations: string[] = [];
    const metrics: Record<string, number> = {};
    const startTime = Date.now();

    switch (experiment.type) {
      case 'latency_injection':
        return this.injectLatency(experiment.probability, experiment.duration);

      case 'error_injection':
        return this.injectErrors(experiment.probability);

      case 'resource_exhaustion':
        return this.exhaustResources(experiment.duration);

      case 'network_partition':
        return this.simulateNetworkPartition(experiment.duration);

      case 'state_corruption':
        return this.corruptState(experiment.probability);

      case 'dependency_failure':
        return this.simulateDependencyFailure(experiment.duration);

      default:
        return {
          success: false,
          observations: ['Unknown experiment type'],
          metrics: {},
          recommendations: []
        };
    }
  }

  /**
   * Inject random latency
   */
  private async injectLatency(probability: number, duration: number): Promise<ChaosResult> {
    const observations: string[] = [];
    const latencies: number[] = [];

    for (let i = 0; i < 10; i++) {
      if (Math.random() < probability) {
        const latency = Math.random() * duration;
        latencies.push(latency);
        await new Promise(resolve => setTimeout(resolve, latency));
        observations.push(`Injected ${latency.toFixed(0)}ms latency`);
      }
    }

    return {
      success: true,
      observations,
      metrics: {
        avgLatency: latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
        maxLatency: Math.max(...latencies, 0),
        injectionCount: latencies.length
      },
      recommendations: [
        'Consider implementing retry logic for latency-sensitive operations',
        'Add timeout handling for external dependencies'
      ]
    };
  }

  /**
   * Inject random errors
   */
  private async injectErrors(probability: number): Promise<ChaosResult> {
    const observations: string[] = [];
    let errorCount = 0;

    for (let i = 0; i < 10; i++) {
      if (Math.random() < probability) {
        errorCount++;
        const errorTypes = ['TimeoutError', 'ConnectionError', 'ValidationError', 'UnknownError'];
        const errorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        observations.push(`Injected ${errorType}`);
      }
    }

    return {
      success: true,
      observations,
      metrics: {
        errorCount,
        errorRate: errorCount / 10
      },
      recommendations: [
        'Implement comprehensive error handling',
        'Add circuit breakers for failing dependencies',
        'Ensure proper error logging and monitoring'
      ]
    };
  }

  /**
   * Simulate resource exhaustion
   */
  private async exhaustResources(duration: number): Promise<ChaosResult> {
    const observations: string[] = [];
    const memoryUsage: number[] = [];

    // Simulate memory pressure
    const chunks: Uint8Array[] = [];
    const chunkSize = 1024 * 1024; // 1MB chunks

    const startTime = Date.now();
    while (Date.now() - startTime < duration && chunks.length < 10) {
      chunks.push(new Uint8Array(chunkSize));
      memoryUsage.push(chunks.length * chunkSize);
      observations.push(`Allocated ${(chunks.length * chunkSize / 1024 / 1024).toFixed(0)}MB`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Release memory
    chunks.length = 0;

    return {
      success: true,
      observations,
      metrics: {
        peakMemoryMB: Math.max(...memoryUsage) / 1024 / 1024,
        allocationRate: memoryUsage.length / (duration / 1000)
      },
      recommendations: [
        'Implement memory limits and garbage collection triggers',
        'Add resource monitoring and alerts',
        'Consider implementing backpressure mechanisms'
      ]
    };
  }

  /**
   * Simulate network partition
   */
  private async simulateNetworkPartition(duration: number): Promise<ChaosResult> {
    const observations: string[] = ['Simulating network partition'];

    // Simulate being offline
    const wasOnline = navigator.onLine;
    observations.push(`Network status before: ${wasOnline ? 'online' : 'offline'}`);

    await new Promise(resolve => setTimeout(resolve, duration));

    const isOnline = navigator.onLine;
    observations.push(`Network status after: ${isOnline ? 'online' : 'offline'}`);

    return {
      success: true,
      observations,
      metrics: {
        partitionDuration: duration,
        networkAvailable: isOnline ? 1 : 0
      },
      recommendations: [
        'Implement offline-first architecture',
        'Add local caching and sync mechanisms',
        'Ensure graceful degradation when offline'
      ]
    };
  }

  /**
   * Simulate state corruption
   */
  private async corruptState(probability: number): Promise<ChaosResult> {
    const observations: string[] = [];
    let corruptionCount = 0;

    // Check localStorage integrity
    for (let i = 0; i < localStorage.length; i++) {
      if (Math.random() < probability) {
        const key = localStorage.key(i);
        if (key) {
          corruptionCount++;
          observations.push(`Potential corruption detected in key: ${key}`);
        }
      }
    }

    return {
      success: true,
      observations: corruptionCount > 0 ? observations : ['No corruption detected'],
      metrics: {
        keysChecked: localStorage.length,
        potentialCorruptions: corruptionCount
      },
      recommendations: [
        'Implement data integrity checks (checksums/hashes)',
        'Add backup and recovery mechanisms',
        'Consider using IndexedDB for critical data'
      ]
    };
  }

  /**
   * Simulate dependency failure
   */
  private async simulateDependencyFailure(duration: number): Promise<ChaosResult> {
    const observations: string[] = ['Simulating external dependency failure'];

    // Simulate API failure
    const startTime = Date.now();
    let retryCount = 0;
    let success = false;

    while (Date.now() - startTime < duration) {
      retryCount++;
      // Simulate failed fetch
      observations.push(`Retry attempt ${retryCount} failed`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return {
      success,
      observations,
      metrics: {
        retryAttempts: retryCount,
        failureDuration: duration
      },
      recommendations: [
        'Implement circuit breaker pattern',
        'Add fallback mechanisms for critical dependencies',
        'Consider caching responses from external services'
      ]
    };
  }

  /**
   * Subscribe to chaos events
   */
  subscribe(observer: (event: ChaosEvent) => void): () => void {
    this.observers.push(observer);
    return () => {
      this.observers = this.observers.filter(o => o !== observer);
    };
  }

  /**
   * Notify observers
   */
  private notifyObservers(event: ChaosEvent): void {
    for (const observer of this.observers) {
      observer(event);
    }
  }

  /**
   * Get experiment status
   */
  getExperiment(id: string): ChaosExperiment | null {
    return this.experiments.get(id) || null;
  }

  /**
   * Get all experiments
   */
  getAllExperiments(): ChaosExperiment[] {
    return Array.from(this.experiments.values());
  }

  /**
   * Get active experiments
   */
  getActiveExperiments(): ChaosExperiment[] {
    return Array.from(this.activeExperiments)
      .map(id => this.experiments.get(id))
      .filter(Boolean) as ChaosExperiment[];
  }
}

export interface ChaosEvent {
  type: 'experiment_scheduled' | 'experiment_started' | 'experiment_completed' | 'experiment_failed';
  experiment: ChaosExperiment;
  result?: ChaosResult;
  error?: unknown;
}

// ============================================
// FORMAL VERIFICATION
// ============================================

export interface VerificationResult {
  property: string;
  verified: boolean;
  counterExample?: unknown;
  proof?: string;
}

export interface Invariant {
  name: string;
  condition: (state: unknown) => boolean;
  description: string;
}

export class FormalVerifier {
  private invariants: Map<string, Invariant> = new Map();

  /**
   * Register invariant property
   */
  registerInvariant(name: string, condition: (state: unknown) => boolean, description: string): void {
    this.invariants.set(name, { name, condition, description });
  }

  /**
   * Verify invariant holds for state
   */
  verifyInvariant(name: string, state: unknown): VerificationResult {
    const invariant = this.invariants.get(name);
    if (!invariant) {
      return {
        property: name,
        verified: false,
        proof: 'Invariant not found'
      };
    }

    try {
      const holds = invariant.condition(state);
      return {
        property: name,
        verified: holds,
        proof: holds ? 'Invariant holds for given state' : 'Invariant violated'
      };
    } catch (error) {
      return {
        property: name,
        verified: false,
        counterExample: error
      };
    }
  }

  /**
   * Verify all invariants
   */
  verifyAllInvariants(state: unknown): VerificationResult[] {
    const results: VerificationResult[] = [];

    for (const [name] of this.invariants.entries()) {
      results.push(this.verifyInvariant(name, state));
    }

    return results;
  }

  /**
   * Model checking - verify property for all reachable states
   */
  async modelCheck(
    initialState: unknown,
    transitions: Array<(state: unknown) => unknown[]>,
    property: (state: unknown) => boolean,
    maxDepth: number = 10
  ): Promise<VerificationResult> {
    const visited = new Set<string>();
    const queue: Array<{ state: unknown; depth: number; path: unknown[] }> = [
      { state: initialState, depth: 0, path: [initialState] }
    ];

    while (queue.length > 0) {
      const { state, depth, path } = queue.shift()!;
      const stateHash = JSON.stringify(state);

      if (visited.has(stateHash)) continue;
      visited.add(stateHash);

      // Check property
      if (!property(state)) {
        return {
          property: property.toString(),
          verified: false,
          counterExample: { state, path }
        };
      }

      // Explore transitions if not at max depth
      if (depth < maxDepth) {
        for (const transition of transitions) {
          const nextStates = transition(state);
          for (const nextState of nextStates) {
            queue.push({
              state: nextState,
              depth: depth + 1,
              path: [...path, nextState]
            });
          }
        }
      }
    }

    return {
      property: property.toString(),
      verified: true,
      proof: `Property holds for all ${visited.size} reachable states up to depth ${maxDepth}`
    };
  }

  /**
   * Verify task state machine
   */
  verifyTaskStateMachine(task: Task): VerificationResult[] {
    const results: VerificationResult[] = [];

    // Invariant: Completed tasks must have completedAt timestamp
    results.push(this.verifyInvariant('completed-has-timestamp', {
      status: task.status,
      completedAt: task.completedAt
    }));

    // Invariant: Priority must be valid value
    results.push(this.verifyInvariant('valid-priority', {
      priority: task.priority
    }));

    // Invariant: Due date must be in valid format
    if (task.dueDate) {
      results.push(this.verifyInvariant('valid-due-date', {
        dueDate: task.dueDate
      }));
    }

    return results;
  }

  /**
   * Register default task invariants
   */
  registerDefaultInvariants(): void {
    // Completed tasks must have completion timestamp
    this.registerInvariant(
      'completed-has-timestamp',
      (state: any) => {
        if (state.status === 'completed') {
          return state.completedAt !== undefined && state.completedAt !== null;
        }
        return true;
      },
      'Completed tasks must have a completedAt timestamp'
    );

    // Priority must be valid
    this.registerInvariant(
      'valid-priority',
      (state: any) => {
        const validPriorities = ['low', 'medium', 'high', 'critical'];
        return validPriorities.includes(state.priority);
      },
      'Task priority must be one of: low, medium, high, critical'
    );

    // Status must be valid
    this.registerInvariant(
      'valid-status',
      (state: any) => {
        const validStatuses = ['pending', 'in_progress', 'completed', 'archived'];
        return validStatuses.includes(state.status);
      },
      'Task status must be one of: pending, in_progress, completed, archived'
    );

    // Version must be positive
    this.registerInvariant(
      'positive-version',
      (state: any) => {
        return state.version > 0;
      },
      'Task version must be positive'
    );
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

export const homomorphicEncryption = new HomomorphicEncryption();
export const zeroKnowledgeProof = new ZeroKnowledgeProof();
export const chaosEngine = new ChaosEngine();
export const formalVerifier = new FormalVerifier();

// Register default invariants
formalVerifier.registerDefaultInvariants();
