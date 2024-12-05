// packages/plugin-tee/src/index.ts
import { Plugin, Provider, Service, ServiceType } from "@ai16z/eliza";
import {
    TEEServiceFactory,
    ITEEService,
    TEEServiceConfig
} from './services';
import {
    TEEResponse,
    TEEError,
    TEEErrorCode
} from './types';

// Initialize TEE service with default configuration
const teeService = TEEServiceFactory.create({
    endpoint: process.env.TEE_SERVICE_ENDPOINT,
    awsRegion: process.env.AWS_REGION,
    awsKmsKeyId: process.env.AWS_KMS_KEY_ID
});

// Define providers that conform to the Provider interface
const remoteAttestationProvider: Provider = {
    get: async () => {
        try {
            const result = await teeService.generateAttestation();
            return result.error ?
                `Failed to generate attestation: ${result.error}` :
                `Attestation generated successfully: ${JSON.stringify(result.data)}`;
        } catch (error) {
            return `Attestation generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
};

const deriveKeyProvider: Provider = {
    get: async () => {
        try {
            const result = await teeService.deriveKey("/", "default");
            return result.error ?
                `Failed to derive key: ${result.error}` :
                `Key derived successfully: ${JSON.stringify(result.data)}`;
        } catch (error) {
            return `Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
};

// Define service using only the properties defined in the Service interface
const teeServiceInstance: Service = {
    serviceType: 'plugin' as ServiceType,
    initialize: async (): Promise<void> => {
        try {
            // Initialization logic for the TEE service
            await Promise.resolve();
        } catch (error) {
            console.error('TEE service initialization failed:', error);
            throw error;
        }
    }
};

// Plugin configuration
export const teePlugin: Plugin = {
    name: "tee",
    description: "TEE plugin for secure key operations and remote attestations",
    actions: [],
    evaluators: [],
    providers: [
        remoteAttestationProvider,
        deriveKeyProvider,
    ],
    services: [teeServiceInstance],
};

// Type exports for external consumption
export {
    ITEEService,
    TEEServiceConfig,
    TEEServiceFactory,
    TEEResponse,
    TEEError,
    TEEErrorCode,
};
