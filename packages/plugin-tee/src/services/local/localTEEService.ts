// packages/plugin-tee/src/services/local/localTEEService.ts
import { TappdClient } from "@phala/dstack-sdk";
import { BaseTEEService } from '../base/baseTEEService';
import {
    TEEError,
    TEEErrorCode,
    TEEServiceConfig,
    TEEResponse,
    KeyDerivationResponse,
    AttestationResponse
} from '../../types';

export class LocalTEEService extends BaseTEEService {
    private client: TappdClient;
    private initialized: boolean = false;

    constructor(config: TEEServiceConfig) {
        super(config);
        try {
            this.client = config.endpoint ?
                new TappdClient(config.endpoint) :
                new TappdClient();
            this.initialized = true;
        } catch (error) {
            throw new TEEError(
                TEEErrorCode.UNKNOWN_ERROR,
                'Failed to initialize local TEE service',
                error
            );
        }
    }

    async deriveKey(path: string, subject: string): Promise<TEEResponse<KeyDerivationResponse>> {
        try {
            this.validateServiceState();
            this.validateInput(path, subject);

            const derivedKey = await this.client.deriveKey(path, subject);

            if (!derivedKey) {
                throw new TEEError(
                    TEEErrorCode.KEY_DERIVATION_FAILED,
                    'No key material returned from TEE'
                );
            }

            return {
                data: {
                    derivedKey
                }
            };
        } catch (error) {
            if (error instanceof TEEError) {
                throw error;
            }
            throw new TEEError(
                TEEErrorCode.KEY_DERIVATION_FAILED,
                'Failed to derive key in local TEE',
                error
            );
        }
    }

    async generateAttestation(): Promise<TEEResponse<AttestationResponse>> {
        try {
            this.validateServiceState();

            const reportData = new Date().toISOString(); // Using timestamp as report data
            const tdxQuote = await this.client.tdxQuote(reportData);

            if (!tdxQuote) {
                throw new TEEError(
                    TEEErrorCode.ATTESTATION_FAILED,
                    'No TDX quote returned from TEE'
                );
            }

            return {
                data: {
                    attestation: JSON.stringify(tdxQuote),
                    certificateChain: []  // Local TEE doesn't provide a certificate chain
                }
            };
        } catch (error) {
            if (error instanceof TEEError) {
                throw error;
            }
            throw new TEEError(
                TEEErrorCode.ATTESTATION_FAILED,
                'Failed to generate TDX attestation in local TEE',
                error
            );
        }
    }

    private validateServiceState(): void {
        if (!this.initialized || !this.client) {
            throw new TEEError(
                TEEErrorCode.UNKNOWN_ERROR,
                'Local TEE service is not properly initialized'
            );
        }
    }
}
