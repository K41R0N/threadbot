/**
 * SafeLogger - Prevents sensitive data from being logged
 *
 * Automatically redacts sensitive fields like tokens, passwords, and keys
 * from log output to prevent credential leakage in Vercel logs or monitoring tools.
 */

export class SafeLogger {
  private static SENSITIVE_KEYS = [
    'notion_token',
    'telegram_bot_token',
    'token',
    'password',
    'secret',
    'key',
    'auth',
    'api_key',
    'apikey',
    'bearer',
    'credential',
  ];

  /**
   * Recursively sanitize an object by redacting sensitive fields
   */
  private static sanitize(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    // Handle primitive types
    if (typeof obj !== 'object') {
      return obj;
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitize(item));
    }

    // Handle Error objects specially
    if (obj instanceof Error) {
      return {
        name: obj.name,
        message: obj.message,
        stack: obj.stack,
        ...this.sanitize({ ...obj }), // Spread any additional properties
      };
    }

    // Handle regular objects
    const sanitized: any = {};

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;

      // Check if this key should be redacted
      const keyLower = key.toLowerCase();
      const shouldRedact = this.SENSITIVE_KEYS.some(sensitiveKey =>
        keyLower.includes(sensitiveKey.toLowerCase())
      );

      if (shouldRedact) {
        // Show partial info for debugging while hiding the actual value
        const value = obj[key];
        if (typeof value === 'string' && value.length > 0) {
          sanitized[key] = `[REDACTED:${value.length} chars]`;
        } else {
          sanitized[key] = '[REDACTED]';
        }
      } else if (typeof obj[key] === 'object') {
        // Recursively sanitize nested objects
        sanitized[key] = this.sanitize(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }

    return sanitized;
  }

  /**
   * Log info message with sanitized data
   */
  static log(message: string, data?: any) {
    if (data !== undefined) {
      console.log(message, this.sanitize(data));
    } else {
      console.log(message);
    }
  }

  /**
   * Log error with sanitized error details
   */
  static error(message: string, error?: any) {
    if (error !== undefined) {
      console.error(message, this.sanitize(error));
    } else {
      console.error(message);
    }
  }

  /**
   * Log warning with sanitized data
   */
  static warn(message: string, data?: any) {
    if (data !== undefined) {
      console.warn(message, this.sanitize(data));
    } else {
      console.warn(message);
    }
  }

  /**
   * Log info with sanitized data
   */
  static info(message: string, data?: any) {
    if (data !== undefined) {
      console.info(message, this.sanitize(data));
    } else {
      console.info(message);
    }
  }
}
