/**
 * CQRS Command Bus - Command Query Responsibility Segregation
 * ============================================================
 * Separates write operations (commands) from read operations (queries)
 */

import type { Command, Result } from '../types';

type CommandBusHandler = (command: Command) => Promise<Result<unknown>>;

export class CommandBus {
  private handlers: Map<string, CommandBusHandler> = new Map();
  private middleware: Array<(command: Command, next: () => Promise<Result<unknown>>) => Promise<Result<unknown>>> = [];
  private isProcessing = false;
  private commandQueue: Command[] = [];

  /**
   * Register a command handler
   */
  register(commandType: string, handler: (command: Command) => Promise<Result<unknown>>): void {
    if (this.handlers.has(commandType)) {
      throw new Error(`Handler already registered for command: ${commandType}`);
    }
    
    this.handlers.set(commandType, handler);
    console.log(`[CommandBus] Registered handler for: ${commandType}`);
  }

  /**
   * Add middleware to the pipeline
   */
  use(
    middleware: (command: Command, next: () => Promise<Result<unknown>>) => Promise<Result<unknown>>
  ): void {
    this.middleware.push(middleware);
  }

  /**
   * Execute a command
   */
  async execute<T extends Record<string, unknown>>(command: Command<T>): Promise<Result<T>> {
    return this.processCommand(command) as Promise<Result<T>>;
  }

  /**
   * Execute multiple commands in parallel
   */
  async executeBatch<T extends Record<string, unknown>>(commands: Command<T>[]): Promise<Result<T>[]> {
    return Promise.all(commands.map(cmd => this.execute(cmd))) as Promise<Result<T>[]>;
  }

  /**
   * Execute commands sequentially (for dependent operations)
   */
  async executeSequence<T extends Record<string, unknown>>(commands: Command<T>[]): Promise<Result<T>[]> {
    const results: Result<T>[] = [];
    
    for (const command of commands) {
      const result = await this.execute(command);
      results.push(result);
      
      // Stop on first failure
      if (!result.success) {
        break;
      }
    }
    
    return results;
  }

  /**
   * Process command through middleware pipeline
   */
  private async processCommand<T extends Record<string, unknown>>(command: Command<T>): Promise<Result<T>> {
    const handler = this.handlers.get(command.type);
    
    if (!handler) {
      return {
        success: false,
        error: new Error(`No handler registered for command: ${command.type}`)
      } as Result<T>;
    }

    try {
      // Execute middleware chain
      let result: Result<unknown> = { success: true, data: undefined };
      
      for (const middleware of this.middleware) {
        const nextCalled = false;
        const next = () => {
          if (nextCalled) throw new Error('next() called multiple times');
          return Promise.resolve(result);
        };
        result = await middleware(command, next);
        if (!result.success) {
          return result as Result<T>;
        }
      }
      
      // Execute handler
      const handlerResult = await handler(command) as Result<T>;
      
      // Log successful command
      if (handlerResult.success) {
        console.log(`[CommandBus] Executed: ${command.type}`, command.payload);
      } else {
        console.error(`[CommandBus] Failed: ${command.type}`, handlerResult.error);
      }
      
      return handlerResult;
    } catch (error) {
      console.error(`[CommandBus] Error executing ${command.type}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      } as Result<T>;
    }
  }

  /**
   * Queue command for later execution
   */
  queue(command: Command): void {
    this.commandQueue.push(command);
    console.log(`[CommandBus] Queued: ${command.type}`);
  }

  /**
   * Process queued commands
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    while (this.commandQueue.length > 0) {
      const command = this.commandQueue.shift()!;
      await this.execute(command);
    }

    this.isProcessing = false;
  }

  /**
   * Clear command queue
   */
  clearQueue(): void {
    this.commandQueue = [];
  }

  /**
   * Get registered command types
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Check if a command type is registered
   */
  isRegistered(commandType: string): boolean {
    return this.handlers.has(commandType);
  }
}

// ============================================
// COMMAND VALIDATION MIDDLEWARE
// ============================================

export function validationMiddleware() {
  return async (
    command: Command,
    next: () => Promise<Result<unknown>>
  ): Promise<Result<unknown>> => {
    // Validate command structure
    if (!command.type || !command.payload) {
      return {
        success: false,
        error: new Error('Command must have type and payload')
      };
    }

    // Validate timestamp
    if (!command.timestamp) {
      return {
        success: false,
        error: new Error('Command must have timestamp')
      };
    }

    return next();
  };
}

// ============================================
// LOGGING MIDDLEWARE
// ============================================

export function loggingMiddleware() {
  return async (
    command: Command,
    next: () => Promise<Result<unknown>>
  ): Promise<Result<unknown>> => {
    const startTime = performance.now();
    console.log(`[CommandBus] → ${command.type}`, command.payload);

    const result = await next();

    const duration = performance.now() - startTime;
    console.log(
      `[CommandBus] ← ${command.type} ${result.success ? '✓' : '✗'} (${duration.toFixed(2)}ms)`
    );

    return result;
  };
}

// ============================================
// RETRY MIDDLEWARE
// ============================================

export function retryMiddleware(maxRetries = 3, delayMs = 100) {
  return async (
    command: Command,
    next: () => Promise<Result<unknown>>
  ): Promise<Result<unknown>> => {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await next();
        
        if (result.success) {
          return result;
        }

        lastError = result.error as Error;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      if (attempt < maxRetries) {
        console.warn(
          `[CommandBus] Retry ${attempt}/${maxRetries} for ${command.type}`
        );
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
      }
    }

    return {
      success: false,
      error: lastError || new Error('Unknown error after retries')
    };
  };
}

// ============================================
// TRANSACTION MIDDLEWARE
// ============================================

export function transactionMiddleware() {
  return async (
    command: Command,
    next: () => Promise<Result<unknown>>
  ): Promise<Result<unknown>> => {
    // Start transaction marker in event store
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    command.metadata = { ...command.metadata, transactionId };

    try {
      const result = await next();

      if (!result.success) {
        // Could implement rollback logic here
        console.error(`[Transaction] Failed: ${transactionId}`);
      }

      return result;
    } catch (error) {
      console.error(`[Transaction] Error: ${transactionId}`, error);
      throw error;
    }
  };
}

// ============================================
// GLOBAL COMMAND BUS INSTANCE
// ============================================

export const commandBus = new CommandBus();

// Register global middleware
commandBus.use(validationMiddleware());
commandBus.use(loggingMiddleware());
commandBus.use(retryMiddleware());
