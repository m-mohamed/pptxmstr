// packages/plugin-tee/src/services/cloud/cloudTEEService.ts
import { KMS } from 'aws-sdk';
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

export class CloudTEEService extends BaseTEEService {
    private kms: KMS;

    constructor(config: TEEServiceConfig) {
        super(config);
        if (!config.awsRegion || !config.awsKmsKeyId) {
            throw new TEEError(
                TEEErrorCode.INVALID_INPUT,
                'AWS region and KMS key ID are required for cloud TEE service'
            );
        }

        this.kms = new KMS({
            region: config.awsRegion
        });
    }

    async deriveKey(path: string, subject: string): Promise<TEEResponse<KeyDerivationResponse>> {
        try {
            this.validateInput(path, subject);

            const { Plaintext } = await this.kms.generateDataKey({
                KeyId: this.config.awsKmsKeyId,
                KeySpec: 'AES_256',
                EncryptionContext: {
                    path,
                    subject
                }
            }).promise();

            if (!Plaintext) {
                throw new TEEError(
                    TEEErrorCode.KEY_DERIVATION_FAILED,
                    'No key material returned from KMS'
                );
            }

            // Convert Plaintext to Uint8Array safely
            const uint8Array = new Uint8Array(Plaintext instanceof Buffer ? Plaintext : new Uint8Array());

            const derivedKey: DeriveKeyResponse = {
                asUint8Array: () => uint8Array,
                key: uint8Array.toString(),
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
            const timestamp = new Date().toISOString();
            const messageString = `attestation-${timestamp}`;

            const { Signature, SigningAlgorithm } = await this.kms.sign({
                KeyId: this.config.awsKmsKeyId,
                Message: messageString,
                SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256',
                MessageType: 'RAW'
            }).promise();

            if (!Signature) {
                throw new TEEError(
                    TEEErrorCode.ATTESTATION_FAILED,
                    'No signature returned from KMS'
                );
            }

            // Convert Signature to Uint8Array safely
            const signatureArray = new Uint8Array(Signature instanceof Buffer ? Signature : new Uint8Array());

            const { PublicKey } = await this.kms.getPublicKey({
                KeyId: this.config.awsKmsKeyId
            }).promise();

            return {
                data: {
                    attestation: signatureArray.toString(),
                    certificateChain: [
                        PublicKey ? new Uint8Array(PublicKey instanceof Buffer ? PublicKey : new Uint8Array()).toString() : '',
                        SigningAlgorithm || 'RSASSA_PKCS1_V1_5_SHA_256'
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
