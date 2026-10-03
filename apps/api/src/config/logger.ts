export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  message: string;
  context?: Record<string, unknown>;
  error?: Error | unknown;
}

class Logger {
  private formatLog(level: LogLevel, payload: LogPayload) {
    const timestamp = new Date().toISOString();
    const entry: Record<string, unknown> = {
      timestamp,
      level: level.toUpperCase(),
      message: payload.message,
    };

    if (payload.context) {
      // Ensure no sensitive keys are printed
      const sanitizedContext = { ...payload.context };
      const sensitiveKeys = ["secret", "password", "signature", "key", "token", "authorization"];
      for (const k of Object.keys(sanitizedContext)) {
        if (sensitiveKeys.some((s) => k.toLowerCase().includes(s))) {
          sanitizedContext[k] = "[REDACTED]";
        }
      }
      entry.context = sanitizedContext;
    }

    if (payload.error instanceof Error) {
      entry.error = {
        name: payload.error.name,
        message: payload.error.message,
      };
    } else if (payload.error) {
      entry.error = payload.error;
    }

    return JSON.stringify(entry);
  }

  info(message: string, context?: Record<string, unknown>) {
    console.log(this.formatLog("info", { message, context }));
  }

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(this.formatLog("warn", { message, context }));
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    console.error(this.formatLog("error", { message, error, context }));
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.formatLog("debug", { message, context }));
    }
  }
}

export const logger = new Logger();
