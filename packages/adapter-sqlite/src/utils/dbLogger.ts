// packages/adapter-sqlite/src/utils/dbLogger.ts
import { UUID } from "@ai16z/eliza";

interface SQLiteErrorDetails {
    operation: string;
    sql?: string;
    params?: unknown[];
    error: any;
    context?: Record<string, unknown>;
}

export class DatabaseLogger {
    private static formatError(details: SQLiteErrorDetails): string {
        return `
Database Operation Error:
Operation: ${details.operation}
SQL: ${details.sql || 'Not provided'}
Parameters: ${JSON.stringify(details.params || [], null, 2)}
Error Code: ${details.error?.code || 'Unknown'}
Error Message: ${details.error?.message || 'No message'}
Stack: ${details.error?.stack || 'No stack trace'}
Context: ${JSON.stringify(details.context || {}, null, 2)}
Timestamp: ${new Date().toISOString()}
        `.trim();
    }

    static logError(details: SQLiteErrorDetails): void {
        const formattedError = this.formatError(details);
        console.error('\n=== DATABASE ERROR START ===');
        console.error(formattedError);
        console.error('=== DATABASE ERROR END ===\n');
    }
}
