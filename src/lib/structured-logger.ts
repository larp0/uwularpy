import { logger as triggerLogger } from "@trigger.dev/sdk/v3";

/**
 * Structured logging utility for better traceability and consistency.
 * Provides standardized logging formats with context and events.
 */

export interface LogContext {
  component: string;
  operation?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  [key: string]: any;
}

export interface LogEvent {
  event: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: LogContext;
  data?: Record<string, any>;
  timestamp?: Date;
  duration?: number;
}

export class StructuredLogger {
  private baseContext: LogContext;

  constructor(baseContext: LogContext) {
    this.baseContext = baseContext;
  }

  private formatEvent(event: LogEvent): void {
    const logData = {
      event: event.event,
      component: this.baseContext.component,
      operation: this.baseContext.operation || event.context?.operation,
      message: event.message,
      timestamp: event.timestamp || new Date(),
      duration: event.duration,
      context: { ...this.baseContext, ...event.context },
      data: event.data
    };

    switch (event.level) {
      case 'debug':
        triggerLogger.debug(event.message, logData);
        break;
      case 'info':
        triggerLogger.info(event.message, logData);
        break;
      case 'warn':
        triggerLogger.warn(event.message, logData);
        break;
      case 'error':
        triggerLogger.error(event.message, logData);
        break;
      default:
        triggerLogger.log(event.message, logData);
    }
  }

  debug(event: string, message: string, data?: Record<string, any>, context?: Partial<LogContext>): void {
    this.formatEvent({
      event,
      level: 'debug',
      message,
      data,
      context: context ? { ...this.baseContext, ...context } : this.baseContext
    });
  }

  info(event: string, message: string, data?: Record<string, any>, context?: Partial<LogContext>): void {
    this.formatEvent({
      event,
      level: 'info',
      message,
      data,
      context: context ? { ...this.baseContext, ...context } : this.baseContext
    });
  }

  warn(event: string, message: string, data?: Record<string, any>, context?: Partial<LogContext>): void {
    this.formatEvent({
      event,
      level: 'warn',
      message,
      data,
      context: context ? { ...this.baseContext, ...context } : this.baseContext
    });
  }

  error(event: string, message: string, data?: Record<string, any>, context?: Partial<LogContext>): void {
    this.formatEvent({
      event,
      level: 'error',
      message,
      data,
      context: context ? { ...this.baseContext, ...context } : this.baseContext
    });
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(operation: string): () => void {
    const startTime = Date.now();
    return () => {
      const duration = Date.now() - startTime;
      this.info('operation_completed', `${operation} completed`, { duration }, { operation });
    };
  }

  /**
   * Log the start of an operation
   */
  startOperation(operation: string, data?: Record<string, any>): void {
    this.info('operation_started', `Starting ${operation}`, data, { operation });
  }

  /**
   * Log the successful completion of an operation
   */
  completeOperation(operation: string, data?: Record<string, any>): void {
    this.info('operation_completed', `Completed ${operation}`, data, { operation });
  }

  /**
   * Log the failure of an operation
   */
  failOperation(operation: string, error: Error | string, data?: Record<string, any>): void {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const errorData = {
      ...data,
      error: errorMessage,
      stack: typeof error === 'object' ? error.stack : undefined
    };
    this.error('operation_failed', `Failed ${operation}: ${errorMessage}`, errorData, { operation });
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: Partial<LogContext>): StructuredLogger {
    return new StructuredLogger({
      ...this.baseContext,
      ...additionalContext
    });
  }
}

/**
 * Create structured loggers for different components
 */
export function createLogger(component: string, baseContext?: Partial<LogContext>): StructuredLogger {
  return new StructuredLogger({
    component,
    ...baseContext
  });
}

/**
 * Pre-configured loggers for common components
 */
export const loggers = {
  git: createLogger('git-operations'),
  codex: createLogger('codex-repository'),
  openai: createLogger('openai-operations'),
  fileOps: createLogger('file-operations'),
  security: createLogger('security-utils')
};
