// packages/plugin-tee/src/types/config.ts
/**
 * Configuration options for TEE services
 */
export interface TEEServiceConfig {
    /** Endpoint URL for remote TEE service */
    endpoint?: string;
    /** AWS region for cloud TEE service */
    awsRegion?: string;
    /** AWS KMS key ID for cloud TEE service */
    awsKmsKeyId?: string;
    /** Maximum retry attempts for failed operations */
    maxRetries?: number;
    /** Delay between retry attempts in milliseconds */
    retryDelay?: number;
}
