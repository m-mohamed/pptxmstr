// packages/plugin-tee/src/types/errors.ts
/**
 * Enumeration of possible TEE operation error codes
 */
export enum TEEErrorCode {
    INVALID_INPUT = 'INVALID_INPUT',
    KEY_DERIVATION_FAILED = 'KEY_DERIVATION_FAILED',
    ATTESTATION_FAILED = 'ATTESTATION_FAILED',
    KEYPAIR_GENERATION_FAILED = 'KEYPAIR_GENERATION_FAILED',
    NETWORK_ERROR = 'NETWORK_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * Structured error type for TEE operations
 */
export class TEEError extends Error {
    constructor(
        public code: TEEErrorCode,
        message: string,
        public details?: unknown
    ) {
        super(message);
        this.name = 'TEEError';
    }
}
