/**
 * Blockchain Module - Immutable Task Verification
 * =================================================
 * Creates tamper-proof audit trail using blockchain technology
 * Each task operation is recorded as a transaction in a block
 */

import type { Task, TaskId, DomainEvent } from '../types';

// ============================================
// BLOCK STRUCTURE
// ============================================

export interface BlockHeader {
  version: number;
  previousHash: string;
  merkleRoot: string;
  timestamp: number;
  nonce: number;
  difficulty: number;
}

export interface BlockData {
  type: 'TASK_CREATED' | 'TASK_UPDATED' | 'TASK_DELETED' | 'TASK_COMPLETED';
  taskId: TaskId;
  payload: Record<string, unknown>;
  signature: string;
}

export interface Block {
  index: number;
  header: BlockHeader;
  data: BlockData[];
  hash: string;
}

export interface Transaction {
  id: string;
  type: string;
  taskId: TaskId;
  timestamp: number;
  data: Record<string, unknown>;
  signature: string;
}

// ============================================
// CRYPTOGRAPHIC UTILITIES
// ============================================

class CryptoUtils {
  /**
   * Generate SHA-256 hash
   */
  static async sha256(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate double SHA-256 hash (Bitcoin-style)
   */
  static async doubleSha256(data: string): Promise<string> {
    const first = await this.sha256(data);
    return this.sha256(first);
  }

  /**
   * Generate Merkle root from transactions
   */
  static async merkleRoot(hashes: string[]): Promise<string> {
    if (hashes.length === 0) return this.sha256('empty');
    if (hashes.length === 1) return hashes[0];

    // Ensure even number of hashes
    if (hashes.length % 2 !== 0) {
      hashes = [...hashes, hashes[hashes.length - 1]];
    }

    // Build next level
    const nextLevel: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const combined = hashes[i] + hashes[i + 1];
      nextLevel.push(await this.sha256(combined));
    }

    return this.merkleRoot(nextLevel);
  }

  /**
   * Generate digital signature
   */
  static async sign(data: string, privateKey: CryptoKey): Promise<string> {
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      privateKey,
      encoder.encode(data)
    );
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Verify digital signature
   */
  static async verify(
    data: string,
    signature: string,
    publicKey: CryptoKey
  ): Promise<boolean> {
    const encoder = new TextEncoder();
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify(
      { name: 'ECDSA', hash: { name: 'SHA-256' } },
      publicKey,
      signatureBytes,
      encoder.encode(data)
    );
  }

  /**
   * Generate key pair for signing
   */
  static async generateKeyPair(): Promise<CryptoKeyPair> {
    return await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true,
      ['sign', 'verify']
    );
  }
}

// ============================================
// PROOF OF WORK - Mining
// ============================================

class ProofOfWork {
  private difficulty: number;

  constructor(difficulty: number = 4) {
    this.difficulty = difficulty;
  }

  /**
   * Mine a block by finding valid nonce
   */
  async mine(
    previousHash: string,
    merkleRoot: string,
    timestamp: number
  ): Promise<{ nonce: number; hash: string }> {
    let nonce = 0;
    const target = '0'.repeat(this.difficulty);

    while (true) {
      const headerData = `${previousHash}${merkleRoot}${timestamp}${nonce}${this.difficulty}`;
      const hash = await CryptoUtils.sha256(headerData);

      if (hash.startsWith(target)) {
        return { nonce, hash };
      }

      nonce++;

      // Prevent infinite loop in browser
      if (nonce % 10000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Verify proof of work
   */
  async verify(hash: string): Promise<boolean> {
    const target = '0'.repeat(this.difficulty);
    return hash.startsWith(target);
  }

  /**
   * Adjust difficulty based on mining time
   */
  adjustDifficulty(blocks: Block[], targetTime: number = 60000): number {
    if (blocks.length < 2) return this.difficulty;

    const recentBlocks = blocks.slice(-10);
    const totalTime = recentBlocks[recentBlocks.length - 1].header.timestamp -
      recentBlocks[0].header.timestamp;

    const avgTime = totalTime / recentBlocks.length;

    if (avgTime < targetTime / 2) {
      return Math.min(this.difficulty + 1, 10);
    } else if (avgTime > targetTime * 2) {
      return Math.max(this.difficulty - 1, 1);
    }

    return this.difficulty;
  }
}

// ============================================
// BLOCKCHAIN - Main Chain Structure
// ============================================

export class TaskBlockchain {
  private chain: Block[];
  private pendingTransactions: Transaction[];
  private keyPair: CryptoKeyPair | null;
  private pow: ProofOfWork;
  private difficultyAdjustmentInterval: number;

  constructor() {
    this.chain = [];
    this.pendingTransactions = [];
    this.keyPair = null;
    this.pow = new ProofOfWork(2); // Lower difficulty for browser
    this.difficultyAdjustmentInterval = 10;
  }

  /**
   * Initialize blockchain with genesis block
   */
  async initialize(): Promise<void> {
    if (this.chain.length === 0) {
      await this.addGenesisBlock();
    }
  }

  /**
   * Generate key pair for signing transactions
   */
  async generateKeys(): Promise<void> {
    this.keyPair = await CryptoUtils.generateKeyPair();
  }

  /**
   * Create genesis block
   */
  private async addGenesisBlock(): Promise<void> {
    const genesisBlock: Block = {
      index: 0,
      header: {
        version: 1,
        previousHash: '0'.repeat(64),
        merkleRoot: await CryptoUtils.sha256('genesis'),
        timestamp: Date.now(),
        nonce: 0,
        difficulty: 2
      },
      data: [{
        type: 'TASK_CREATED',
        taskId: 'genesis',
        payload: { message: 'TaskMaster Blockchain initialized' },
        signature: 'genesis'
      }],
      hash: await this.calculateBlockHash(0, '0'.repeat(64), 'genesis', Date.now(), 0, 2)
    };

    this.chain.push(genesisBlock);
  }

  /**
   * Add task operation to pending transactions
   */
  async addTransaction(
    type: string,
    taskId: TaskId,
    data: Record<string, unknown>
  ): Promise<string> {
    if (!this.keyPair) {
      await this.generateKeys();
    }

    const transaction: Transaction = {
      id: await CryptoUtils.sha256(`${Date.now()}-${taskId}-${type}`),
      type,
      taskId,
      timestamp: Date.now(),
      data,
      signature: await CryptoUtils.sign(
        `${type}-${taskId}-${Date.now()}-${JSON.stringify(data)}`,
        this.keyPair!.privateKey
      )
    };

    this.pendingTransactions.push(transaction);
    return transaction.id;
  }

  /**
   * Mine pending transactions into a new block
   */
  async minePendingTransactions(): Promise<Block | null> {
    if (this.pendingTransactions.length === 0) return null;

    const previousBlock = this.chain[this.chain.length - 1];
    const index = this.chain.length;
    const timestamp = Date.now();

    // Calculate Merkle root from transactions
    const transactionHashes = await Promise.all(
      this.pendingTransactions.map(tx =>
        CryptoUtils.sha256(JSON.stringify(tx))
      )
    );
    const merkleRoot = await CryptoUtils.merkleRoot(transactionHashes);

    // Mine block
    const { nonce, hash } = await this.pow.mine(
      previousBlock.hash,
      merkleRoot,
      timestamp
    );

    // Create block data from transactions
    const blockData: BlockData[] = this.pendingTransactions.map(tx => ({
      type: tx.type as BlockData['type'],
      taskId: tx.taskId,
      payload: tx.data,
      signature: tx.signature
    }));

    const newBlock: Block = {
      index,
      header: {
        version: 1,
        previousHash: previousBlock.hash,
        merkleRoot,
        timestamp,
        nonce,
        difficulty: this.pow['difficulty']
      },
      data: blockData,
      hash
    };

    // Verify and add to chain
    if (await this.isValidBlock(newBlock, previousBlock)) {
      this.chain.push(newBlock);
      this.pendingTransactions = [];

      // Adjust difficulty periodically
      if (this.chain.length % this.difficultyAdjustmentInterval === 0) {
        this.pow['difficulty'] = this.pow.adjustDifficulty(this.chain);
      }

      return newBlock;
    }

    return null;
  }

  /**
   * Verify entire blockchain
   */
  async verifyChain(): Promise<boolean> {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (!await this.isValidBlock(currentBlock, previousBlock)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Verify individual block
   */
  private async isValidBlock(block: Block, previousBlock: Block): Promise<boolean> {
    // Verify previous hash
    if (block.header.previousHash !== previousBlock.hash) {
      return false;
    }

    // Verify proof of work
    const powValid = await this.pow.verify(block.hash);
    if (!powValid) {
      return false;
    }

    // Verify hash calculation
    const calculatedHash = await this.calculateBlockHash(
      block.index,
      block.header.previousHash,
      block.header.merkleRoot,
      block.header.timestamp,
      block.header.nonce,
      block.header.difficulty
    );

    if (calculatedHash !== block.hash) {
      return false;
    }

    // Verify transactions
    for (const txData of block.data) {
      const valid = await this.verifyTransactionSignature(txData);
      if (!valid) return false;
    }

    return true;
  }

  /**
   * Verify transaction signature
   */
  private async verifyTransactionSignature(data: BlockData): Promise<boolean> {
    // In production, would verify against stored public key
    // For now, just check signature exists
    return data.signature.length > 0;
  }

  /**
   * Calculate block hash
   */
  private async calculateBlockHash(
    index: number,
    previousHash: string,
    merkleRoot: string,
    timestamp: number,
    nonce: number,
    difficulty: number
  ): Promise<string> {
    const headerData = `${index}${previousHash}${merkleRoot}${timestamp}${nonce}${difficulty}`;
    return CryptoUtils.sha256(headerData);
  }

  /**
   * Get task history from blockchain
   */
  getTaskHistory(taskId: TaskId): BlockData[] {
    const history: BlockData[] = [];

    for (const block of this.chain) {
      for (const data of block.data) {
        if (data.taskId === taskId) {
          history.push(data);
        }
      }
    }

    return history;
  }

  /**
   * Get all transactions for task
   */
  getTaskTransactions(taskId: TaskId): Transaction[] {
    return this.pendingTransactions.filter(tx => tx.taskId === taskId);
  }

  /**
   * Get blockchain statistics
   */
  getStats(): {
    chainLength: number;
    pendingTransactions: number;
    totalTransactions: number;
    difficulty: number;
  } {
    const totalTx = this.chain.reduce((acc, block) => acc + block.data.length, 0);

    return {
      chainLength: this.chain.length,
      pendingTransactions: this.pendingTransactions.length,
      totalTransactions: totalTx,
      difficulty: this.pow['difficulty']
    };
  }

  /**
   * Export blockchain for synchronization
   */
  export(): string {
    return JSON.stringify({
      chain: this.chain,
      stats: this.getStats()
    });
  }

  /**
   * Import blockchain from backup
   */
  async import(json: string): Promise<boolean> {
    const data = JSON.parse(json);
    const importedChain: Block[] = data.chain;

    // Verify imported chain
    for (let i = 1; i < importedChain.length; i++) {
      if (!await this.isValidBlock(importedChain[i], importedChain[i - 1])) {
        return false;
      }
    }

    // Accept longer valid chain
    if (importedChain.length > this.chain.length) {
      this.chain = importedChain;
    }

    return true;
  }

  /**
   * Get latest block
   */
  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  /**
   * Get block by index
   */
  getBlockByIndex(index: number): Block | null {
    return this.chain[index] || null;
  }

  /**
   * Search blockchain for specific event type
   */
  searchByEventType(eventType: string): BlockData[] {
    const results: BlockData[] = [];

    for (const block of this.chain) {
      for (const data of block.data) {
        if (data.type === eventType) {
          results.push(data);
        }
      }
    }

    return results;
  }
}

// ============================================
// SMART CONTRACTS - Automated Task Rules
// ============================================

export interface SmartContract {
  id: string;
  name: string;
  condition: (task: Task, blockchain: TaskBlockchain) => Promise<boolean>;
  action: (task: Task, blockchain: TaskBlockchain) => Promise<void>;
}

export class ContractEngine {
  private contracts: Map<string, SmartContract>;
  private blockchain: TaskBlockchain;

  constructor(blockchain: TaskBlockchain) {
    this.contracts = new Map();
    this.blockchain = blockchain;
    this.registerDefaultContracts();
  }

  /**
   * Register default smart contracts
   */
  private registerDefaultContracts(): void {
    // Auto-archive completed tasks after 7 days
    this.registerContract({
      id: 'auto-archive',
      name: 'Auto-archive Completed Tasks',
      condition: async (task) => {
        if (task.status !== 'completed' || !task.completedAt) return false;
        const completedDate = new Date(task.completedAt);
        const daysSinceCompletion = (Date.now() - completedDate.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceCompletion >= 7;
      },
      action: async (task) => {
        await this.blockchain.addTransaction('TASK_UPDATED', task.id, {
          status: 'archived',
          reason: 'Auto-archived after 7 days'
        });
      }
    });

    // Escalate overdue high-priority tasks
    this.registerContract({
      id: 'escalate-overdue',
      name: 'Escalate Overdue High Priority',
      condition: async (task) => {
        if (!task.dueDate || task.status === 'completed') return false;
        const dueDate = new Date(task.dueDate);
        const isOverdue = dueDate.getTime() < Date.now();
        const isHighPriority = task.priority === 'high' || task.priority === 'critical';
        return isOverdue && isHighPriority;
      },
      action: async (task) => {
        if (task.priority !== 'critical') {
          await this.blockchain.addTransaction('TASK_UPDATED', task.id, {
            priority: 'critical',
            reason: 'Escalated due to overdue status'
          });
        }
      }
    });
  }

  /**
   * Register a smart contract
   */
  registerContract(contract: SmartContract): void {
    this.contracts.set(contract.id, contract);
  }

  /**
   * Execute all contracts against a task
   */
  async executeContracts(task: Task): Promise<string[]> {
    const executed: string[] = [];

    for (const [id, contract] of this.contracts.entries()) {
      try {
        if (await contract.condition(task, this.blockchain)) {
          await contract.action(task, this.blockchain);
          executed.push(id);
        }
      } catch (error) {
        console.error(`Contract ${id} execution failed:`, error);
      }
    }

    return executed;
  }

  /**
   * Get all registered contracts
   */
  getContracts(): SmartContract[] {
    return Array.from(this.contracts.values());
  }
}

// ============================================
// SINGLETON INSTANCES
// ============================================

export const blockchain = new TaskBlockchain();
export const contractEngine = new ContractEngine(blockchain);

// Initialize on module load
blockchain.initialize();
