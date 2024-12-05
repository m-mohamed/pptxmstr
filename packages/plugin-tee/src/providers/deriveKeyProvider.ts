// packages/plugin-tee/src/providers/deriveKeyProvider.ts
import { IAgentRuntime, Memory, Provider, State } from "@ai16z/eliza";
import { TEEServiceFactory } from '../services';
import { TEEError, TEEErrorCode } from '../types';

export const deriveKeyProvider: Provider = {
    get: async (runtime: IAgentRuntime, _message?: Memory, _state?: State): Promise<string> => {
        try {
            const teeService = TEEServiceFactory.create({
                endpoint: runtime.getSetting("TEE_SERVICE_ENDPOINT"),
                awsRegion: runtime.getSetting("AWS_REGION"),
                awsKmsKeyId: runtime.getSetting("AWS_KMS_KEY_ID")
            });

            const secretSalt = runtime.getSetting("WALLET_SECRET_SALT");
            if (!secretSalt) {
                throw new TEEError(
                    TEEErrorCode.INVALID_INPUT,
                    "Wallet secret salt is not configured in settings"
                );
            }

            // Derive keypairs in parallel for better performance
            const [solanaResponse, evmResponse] = await Promise.all([
                teeService.deriveEd25519Keypair("/", secretSalt),
                teeService.deriveEcdsaKeypair("/", secretSalt)
            ]);

            // Handle potential errors from both operations
            if (solanaResponse.error) {
                throw new TEEError(
                    TEEErrorCode.KEY_DERIVATION_FAILED,
                    `Failed to derive Solana keypair: ${solanaResponse.error}`
                );
            }

            if (evmResponse.error) {
                throw new TEEError(
                    TEEErrorCode.KEY_DERIVATION_FAILED,
                    `Failed to derive EVM keypair: ${evmResponse.error}`
                );
            }

            // Ensure we have the required data
            if (!solanaResponse.data?.keypair?.publicKey || !evmResponse.data?.keypair?.address) {
                throw new TEEError(
                    TEEErrorCode.KEY_DERIVATION_FAILED,
                    "Missing required keypair data in response"
                );
            }

            return JSON.stringify({
                solana: solanaResponse.data.keypair.publicKey,
                evm: evmResponse.data.keypair.address,
            });

        } catch (error) {
            console.error("Error in derive key provider:", error);

            // Proper error handling with type discrimination
            if (error instanceof TEEError) {
                return `Failed to derive keys: ${error.message}`;
            }

            return `Unexpected error during key derivation: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
    },
};
