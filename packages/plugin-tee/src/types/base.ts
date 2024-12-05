// packages/plugin-tee/src/types/base.ts
import { Keypair } from "@solana/web3.js";
import { PrivateKeyAccount } from "viem";
import { DeriveKeyResponse } from "@phala/dstack-sdk";

/**
 * Generic response type for all TEE operations
 * @template T The type of successful response data
 */
export interface TEEResponse<T = unknown> {
    /** Error message if the operation failed */
    error?: string;
    /** Operation-specific response data */
    data?: T;
}

/**
 * Specific response types for different TEE operations
 */
export interface KeyDerivationResponse {
    derivedKey: DeriveKeyResponse;
}

export interface AttestationResponse {
    attestation: string;
    certificateChain?: string[];
}

export interface SolanaKeypairResponse {
    keypair: Keypair;
    publicKey: string;
}

export interface EVMKeypairResponse {
    keypair: PrivateKeyAccount;
    address: string;
}

/**
 * Core TEE service interface
 */
export interface ITEEService {
    /**
     * Derives a cryptographic key from the given path and subject
     * @param path Hierarchical path for key derivation
     * @param subject Subject identifier for key derivation
     */
    deriveKey(path: string, subject: string): Promise<TEEResponse<KeyDerivationResponse>>;

    /**
     * Generates a remote attestation proof
     */
    generateAttestation(): Promise<TEEResponse<AttestationResponse>>;

    /**
     * Derives an Ed25519 keypair for Solana
     * @param path Hierarchical path for key derivation
     * @param subject Subject identifier for key derivation
     */
    deriveEd25519Keypair(path: string, subject: string): Promise<TEEResponse<SolanaKeypairResponse>>;

    /**
     * Derives an ECDSA keypair for EVM chains
     * @param path Hierarchical path for key derivation
     * @param subject Subject identifier for key derivation
     */
    deriveEcdsaKeypair(path: string, subject: string): Promise<TEEResponse<EVMKeypairResponse>>;
}
