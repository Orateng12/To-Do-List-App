/**
 * Blockchain for Immutable Task History
 * ======================================
 * Private blockchain with Proof-of-Work for tamper-proof audit trails
 */

import { eventBus, EVENTS } from '../core/event-bus.js';

/**
 * Block in the blockchain
 */
export class Block {
    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
        this.nonce = 0;
    }

    /**
     * Calculate block hash
     */
    calculateHash() {
        const content = JSON.stringify({
            index: this.index,
            timestamp: this.timestamp,
            data: this.data,
            previousHash: this.previousHash,
            nonce: this.nonce
        });
        return this.sha256(content);
    }

    /**
     * SHA-256 hash function
     */
    async sha256(content) {
        const encoder = new TextEncoder();
        const data = encoder.encode(content);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Mine block with Proof-of-Work
     */
    async mineBlock(difficulty) {
        const target = Array(difficulty).fill('0').join('');
        
        while (true) {
            this.hash = await this.calculateHash();
            if (this.hash.substring(0, difficulty) === target) {
                break;
            }
            this.nonce++;
            
            // Yield to prevent blocking
            if (this.nonce % 10000 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        return {
            hash: this.hash,
            nonce: this.nonce,
            difficulty
        };
    }

    /**
     * Verify block integrity
     */
    async verify() {
        const calculatedHash = await this.calculateHash();
        return this.hash === calculatedHash;
    }

    /**
     * Serialize block
     */
    toJSON() {
        return {
            index: this.index,
            timestamp: this.timestamp,
            data: this.data,
            previousHash: this.previousHash,
            hash: this.hash,
            nonce: this.nonce
        };
    }

    /**
     * Deserialize block
     */
    static fromJSON(json) {
        const block = new Block(json.index, json.timestamp, json.data, json.previousHash);
        block.hash = json.hash;
        block.nonce = json.nonce;
        return block;
    }
}

/**
 * Blockchain - Immutable ledger
 */
export class TaskBlockchain {
    constructor(difficulty = 3) {
        this.chain = [];
        this.difficulty = difficulty;
        this.pendingTransactions = [];
        this.mining = false;
        this.miningProgress = 0;
    }

    /**
     * Initialize blockchain with genesis block
     */
    async init() {
        if (this.chain.length === 0) {
            await this.addGenesisBlock();
        }
        return this;
    }

    /**
     * Create genesis block
     */
    async addGenesisBlock() {
        const genesisBlock = new Block(
            0,
            Date.now(),
            {
                type: 'genesis',
                message: 'TaskMaster Blockchain initialized',
                version: '1.0.0'
            },
            '0'
        );
        
        await genesisBlock.mineBlock(this.difficulty);
        this.chain.push(genesisBlock);
        
        eventBus.emit(EVENTS.BLOCKCHAIN_INIT, {
            blockIndex: 0,
            hash: genesisBlock.hash
        });

        return genesisBlock;
    }

    /**
     * Get latest block
     */
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    /**
     * Add task transaction
     */
    addTaskTransaction(taskId, action, data) {
        const transaction = {
            id: this.generateTransactionId(),
            timestamp: Date.now(),
            taskId,
            action,
            data,
            type: 'task'
        };

        this.pendingTransactions.push(transaction);
        
        eventBus.emit(EVENTS.TRANSACTION_PENDING, {
            transactionId: transaction.id,
            taskId
        });

        return transaction.id;
    }

    /**
     * Mine pending transactions into a block
     */
    async minePendingTransactions(minerId = 'system') {
        if (this.pendingTransactions.length === 0) {
            return null;
        }

        this.mining = true;
        this.miningProgress = 0;

        const latestBlock = this.getLatestBlock();
        const block = new Block(
            this.chain.length,
            Date.now(),
            {
                transactions: [...this.pendingTransactions],
                miner: minerId,
                transactionCount: this.pendingTransactions.length
            },
            latestBlock.hash
        );

        // Mine the block
        const miningResult = await block.mineBlock(this.difficulty);
        
        this.chain.push(block);
        this.pendingTransactions = [];
        this.mining = false;
        this.miningProgress = 100;

        eventBus.emit(EVENTS.BLOCK_MINED, {
            blockIndex: block.index,
            hash: block.hash,
            transactionCount: block.data.transactionCount,
            miningResult
        });

        return block;
    }

    /**
     * Verify blockchain integrity
     */
    async verifyChain() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];

            // Verify current block hash
            const isValid = await currentBlock.verify();
            if (!isValid) {
                return { valid: false, error: `Block ${i} hash invalid` };
            }

            // Verify previous hash linkage
            if (currentBlock.previousHash !== previousBlock.hash) {
                return { 
                    valid: false, 
                    error: `Block ${i} previous hash mismatch` 
                };
            }

            // Verify difficulty
            if (!currentBlock.hash.startsWith('0'.repeat(this.difficulty))) {
                return { 
                    valid: false, 
                    error: `Block ${i} difficulty not met` 
                };
            }
        }

        return { valid: true, blockCount: this.chain.length };
    }

    /**
     * Get all transactions for a task
     */
    getTaskHistory(taskId) {
        const transactions = [];

        for (const block of this.chain) {
            if (block.data.transactions) {
                for (const tx of block.data.transactions) {
                    if (tx.taskId === taskId) {
                        transactions.push({
                            ...tx,
                            blockIndex: block.index,
                            blockHash: block.hash,
                            timestamp: block.timestamp
                        });
                    }
                }
            }
        }

        return transactions.sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * Detect tampering
     */
    async detectTampering() {
        const issues = [];

        for (let i = 1; i < this.chain.length; i++) {
            const block = this.chain[i];
            const isValid = await block.verify();
            
            if (!isValid) {
                issues.push({
                    blockIndex: i,
                    type: 'hash_mismatch',
                    severity: 'critical'
                });
            }

            if (block.previousHash !== this.chain[i - 1].hash) {
                issues.push({
                    blockIndex: i,
                    type: 'chain_break',
                    severity: 'critical'
                });
            }
        }

        return issues;
    }

    /**
     * Get blockchain statistics
     */
    getStats() {
        const totalTransactions = this.chain.reduce(
            (sum, block) => sum + (block.data.transactionCount || 0),
            0
        );

        return {
            blockCount: this.chain.length,
            pendingTransactions: this.pendingTransactions.length,
            totalTransactions,
            difficulty: this.difficulty,
            isMining: this.mining,
            miningProgress: this.miningProgress,
            latestBlock: this.getLatestBlock()?.toJSON()
        };
    }

    /**
     * Export blockchain
     */
    export() {
        return {
            version: '1.0.0',
            difficulty: this.difficulty,
            chain: this.chain.map(b => b.toJSON()),
            exportedAt: new Date().toISOString()
        };
    }

    /**
     * Import blockchain
     */
    async import(data) {
        this.difficulty = data.difficulty;
        this.chain = data.chain.map(b => Block.fromJSON(b));
        
        // Verify imported chain
        const verification = await this.verifyChain();
        if (!verification.valid) {
            throw new Error('Imported chain is invalid: ' + verification.error);
        }

        return this;
    }

    /**
     * Generate transaction ID
     */
    generateTransactionId() {
        return `tx_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get Merkle root of transactions
     */
    async getMerkleRoot(transactions) {
        if (transactions.length === 0) return '0';

        let hashes = await Promise.all(
            transactions.map(tx => this.sha256(JSON.stringify(tx)))
        );

        while (hashes.length > 1) {
            const newHashes = [];
            for (let i = 0; i < hashes.length; i += 2) {
                const combined = hashes[i] + (hashes[i + 1] || hashes[i]);
                newHashes.push(await this.sha256(combined));
            }
            hashes = newHashes;
        }

        return hashes[0];
    }
}

/**
 * Task Audit Trail - High-level interface
 */
export class TaskAuditTrail {
    constructor(blockchain) {
        this.blockchain = blockchain;
        this.autoMineInterval = null;
    }

    /**
     * Start audit trail
     */
    start(autoMineSeconds = 30) {
        // Auto-mine pending transactions periodically
        if (autoMineSeconds > 0) {
            this.autoMineInterval = setInterval(() => {
                this.blockchain.minePendingTransactions();
            }, autoMineSeconds * 1000);
        }

        // Subscribe to task events
        this.setupEventListeners();
    }

    /**
     * Stop audit trail
     */
    stop() {
        if (this.autoMineInterval) {
            clearInterval(this.autoMineInterval);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Task created
        eventBus.on(EVENTS.TASK_ADDED, (data) => {
            this.blockchain.addTaskTransaction(
                data.task.id,
                'CREATE',
                {
                    text: data.task.text,
                    priority: data.task.priority,
                    dueDate: data.task.dueDate
                }
            );
        });

        // Task updated
        eventBus.on(EVENTS.TASK_UPDATED, (data) => {
            this.blockchain.addTaskTransaction(
                data.task.id,
                'UPDATE',
                { updates: data.updates }
            );
        });

        // Task completed
        eventBus.on(EVENTS.TASK_TOGGLED, (data) => {
            this.blockchain.addTaskTransaction(
                data.task.id,
                data.task.completed ? 'COMPLETE' : 'UNCOMPLETE',
                {}
            );
        });

        // Task deleted
        eventBus.on(EVENTS.TASK_DELETED, (data) => {
            this.blockchain.addTaskTransaction(
                data.id,
                'DELETE',
                {}
            );
        });
    }

    /**
     * Get complete history for a task
     */
    getTaskHistory(taskId) {
        return this.blockchain.getTaskHistory(taskId);
    }

    /**
     * Verify task integrity
     */
    async verifyTask(taskId) {
        const history = this.getTaskHistory(taskId);
        
        if (history.length === 0) {
            return { valid: false, reason: 'No history found' };
        }

        // Verify first transaction is CREATE
        if (history[0].action !== 'CREATE') {
            return { valid: false, reason: 'Missing CREATE transaction' };
        }

        // Check for tampering
        const tampering = await this.blockchain.detectTampering();
        if (tampering.length > 0) {
            return { valid: false, reason: 'Blockchain tampering detected', issues: tampering };
        }

        return { valid: true, transactionCount: history.length };
    }

    /**
     * Get audit report
     */
    async getAuditReport() {
        const verification = await this.blockchain.verifyChain();
        const stats = this.blockchain.getStats();

        return {
            integrity: verification,
            statistics: stats,
            generatedAt: new Date().toISOString()
        };
    }
}

/**
 * Create blockchain-based audit trail
 */
export function createTaskAuditTrail(difficulty = 3) {
    const blockchain = new TaskBlockchain(difficulty);
    const auditTrail = new TaskAuditTrail(blockchain);
    
    return { blockchain, auditTrail };
}
