// packages/plugin-tee/src/services/cloud/cloudTEEService.ts
import { BaseTEEService } from '../base/baseTEEService';
import {
    TEEError,
    TEEErrorCode,
    TEEServiceConfig,
    TEEResponse,
    KeyDerivationResponse,
    AttestationResponse
} from '../../types';
import { DeriveKeyResponse } from "@phala/dstack-sdk";

// Define types for AWS SDK v2 to maintain type safety
type KMSInstance = any; // We'll type this properly when the instance is created
type GenerateDataKeyResponse = {
    Plaintext?: Buffer;
    KeyId: string;
};

export class CloudTEEService extends BaseTEEService {
    private kms: KMSInstance;
    private initialized: boolean = false;

    constructor(config: TEEServiceConfig) {
        super(config);
        if (!config.awsRegion || !config.awsKmsKeyId) {
            throw new TEEError(
                TEEErrorCode.INVALID_INPUT,
                'AWS region and KMS key ID are required for cloud TEE service'
            );
        }

        this.initializeKMS(config.awsRegion);
    }

    private async initializeKMS(region: string) {
        try {
            // Dynamic import of aws-sdk
            const AWS = await import('aws-sdk').then(m => m.default);
            this.kms = new AWS.KMS({ region });
            this.initialized = true;
        } catch (error) {
            throw new TEEError(
                TEEErrorCode.UNKNOWN_ERROR,
                'Failed to initialize AWS KMS',
                error
            );
        }
    }

    private async ensureInitialized(): Promise<void> {
        if (!this.initialized || !this.kms) {
            throw new TEEError(
                TEEErrorCode.UNKNOWN_ERROR,
                'KMS service not properly initialized'
            );
        }
    }

    async deriveKey(path: string, subject: string): Promise<TEEResponse<KeyDerivationResponse>> {
        try {
            await this.ensureInitialized();
            this.validateInput(path, subject);

            const params = {
                KeyId: this.config.awsKmsKeyId,
                KeySpec: 'AES_256',
                EncryptionContext: {
                    path,
                    subject
                }
            };

            const response = await this.kms.generateDataKey(params).promise();
            const { Plaintext } = response as GenerateDataKeyResponse;

            if (!Plaintext) {
                throw new TEEError(
                    TEEErrorCode.KEY_DERIVATION_FAILED,
                    'No key material returned from KMS'
                );
            }

            // Create a DeriveKeyResponse that matches the expected interface
            const derivedKey: DeriveKeyResponse = {
                asUint8Array: () => new Uint8Array(Plaintext),
                key: Plaintext.toString('base64'),
                certificate_chain: []
            };

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
                'Failed to derive key in cloud TEE',
                error
            );
        }
    }

    async generateAttestation(): Promise<TEEResponse<AttestationResponse>> {
        try {
            await this.ensureInitialized();

            const timestamp = new Date().toISOString();
            const messageString = `attestation-${timestamp}`;

            const params = {
                KeyId: this.config.awsKmsKeyId,
                Message: Buffer.from(messageString),
                SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
                MessageType: 'RAW'
            };

            const signResponse = await this.kms.sign(params).promise();

            if (!signResponse.Signature) {
                throw new TEEError(
                    TEEErrorCode.ATTESTATION_FAILED,
                    'No signature returned from KMS'
                );
            }

            const publicKeyResponse = await this.kms.getPublicKey({
                KeyId: this.config.awsKmsKeyId
            }).promise();

            return {
                data: {
                    attestation: signResponse.Signature.toString('base64'),
                    certificateChain: [
                        publicKeyResponse.PublicKey ?
                            Buffer.from(publicKeyResponse.PublicKey).toString('base64') : '',
                        signResponse.SigningAlgorithm || 'RSASSA_PKCS1_V1_5_SHA_256'
                    ]
                }
            };
        } catch (error) {
            if (error instanceof TEEError) {
                throw error;
            }
            throw new TEEError(
                TEEErrorCode.ATTESTATION_FAILED,
                'Failed to generate attestation in cloud TEE',
                error
            );
        }
    }
}
