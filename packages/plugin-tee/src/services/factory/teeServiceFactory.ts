// packages/plugin-tee/src/services/factory/teeServiceFactory.ts
import { TEEServiceConfig, TEEError, TEEErrorCode } from '../../types';
import { LocalTEEService } from '../local/localTEEService';
import { CloudTEEService } from '../cloud/cloudTEEService';
import { ITEEService } from '../../types';

export class TEEServiceFactory {
    private static instance: ITEEService;

    /**
     * Creates a TEE service instance based on configuration and environment
     * @param config Configuration options for the TEE service
     * @returns An instance of ITEEService
     * @throws TEEError if service creation fails
     */
    public static create(config: TEEServiceConfig = {}): ITEEService {
        try {
            // Return existing instance if already created (singleton pattern)
            if (this.instance) {
                return this.instance;
            }

            // Determine service type based on environment
            if (process.env.AWS_EXECUTION_ENV || config.awsKmsKeyId) {
                if (!config.awsKmsKeyId) {
                    throw new TEEError(
                        TEEErrorCode.INVALID_INPUT,
                        'AWS KMS Key ID is required for cloud TEE service'
                    );
                }
                this.instance = new CloudTEEService(config);
            } else {
                this.instance = new LocalTEEService(config);
            }

            return this.instance;
        } catch (error) {
            if (error instanceof TEEError) {
                throw error;
            }
            throw new TEEError(
                TEEErrorCode.UNKNOWN_ERROR,
                'Failed to create TEE service instance',
                error
            );
        }
    }

    /**
     * Gets the current TEE service instance
     * @returns The current ITEEService instance
     * @throws TEEError if no instance exists
     */
    public static getInstance(): ITEEService {
        if (!this.instance) {
            throw new TEEError(
                TEEErrorCode.UNKNOWN_ERROR,
                'TEE service instance has not been created. Call create() first.'
            );
        }
        return this.instance;
    }

    /**
     * Resets the TEE service instance
     * Primarily useful for testing and initialization
     */
    public static reset(): void {
        this.instance = undefined;
    }
}
