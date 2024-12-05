// packages/plugin-tee/src/providers/remoteAttestationProvider.ts
import { IAgentRuntime, Memory, Provider, State } from "@ai16z/eliza";
import { TEEServiceFactory } from '../services';
import { TEEError, TEEErrorCode } from '../types';

export const remoteAttestationProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message?: Memory, _state?: State): Promise<string> => {
        try {
            // Initialize TEE service with runtime configuration
            const teeService = TEEServiceFactory.create({
                endpoint: runtime.getSetting("TEE_SERVICE_ENDPOINT"),
                awsRegion: runtime.getSetting("AWS_REGION"),
                awsKmsKeyId: runtime.getSetting("AWS_KMS_KEY_ID")
            });

            // Generate attestation
            const result = await teeService.generateAttestation();

            // Handle potential errors in the response
            if (result.error) {
                throw new TEEError(
                    TEEErrorCode.ATTESTATION_FAILED,
                    `Attestation generation failed: ${result.error}`
                );
            }

            // Validate attestation data
            if (!result.data?.attestation) {
                throw new TEEError(
                    TEEErrorCode.ATTESTATION_FAILED,
                    "No attestation data received from TEE service"
                );
            }

            // Return the attestation data
            return result.data.attestation;

        } catch (error) {
            // Structured error handling
            if (error instanceof TEEError) {
                return `Remote attestation failed: ${error.message}`;
            }

            // Generic error handling
            return `Unexpected error during attestation: ${error instanceof Error ? error.message : "Unknown error"
                }`;
        }
    }
};
