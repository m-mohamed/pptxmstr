// packages/plugin-tee/src/services/base/baseTEEService.ts
import {
    ITEEService,
    TEEResponse,
    KeyDerivationResponse,
    AttestationResponse,
    SolanaKeypairResponse,
    EVMKeypairResponse,
    TEEError,
    TEEErrorCode,
    TEEServiceConfig
} from '../../types';
import crypto from 'crypto';
import { Keypair } from "@solana/web3.js";
import { privateKeyToAccount } from "viem/accounts";
import { keccak256 } from "viem";

export abstract class BaseTEEService implements ITEEService {
    protected constructor(protected readonly config: TEEServiceConfig) { }

    abstract deriveKey(path: string, subject: string): Promise<TEEResponse<KeyDerivationResponse>>;
    abstract generateAttestation(): Promise<TEEResponse<AttestationResponse>>;

    async deriveEd25519Keypair(path: string, subject: string): Promise<TEEResponse<SolanaKeypairResponse>> {
        try {
            const keyResponse = await this.deriveKey(path, subject);
            if (keyResponse.error || !keyResponse.data) {
                return { error: keyResponse.error };
            }

            const uint8ArrayDerivedKey = keyResponse.data.derivedKey.asUint8Array();
            const hash = crypto.createHash("sha256");
            hash.update(uint8ArrayDerivedKey);
            const seed = hash.digest();
            const seedArray = new Uint8Array(seed);
            const keypair = Keypair.fromSeed(seedArray.slice(0, 32));

            return {
                data: {
                    keypair,
                    publicKey: keypair.publicKey.toBase58()
                }
            };
        } catch (error) {
            throw new TEEError(
                TEEErrorCode.KEYPAIR_GENERATION_FAILED,
                'Failed to derive Ed25519 keypair',
                error
            );
        }
    }

    async deriveEcdsaKeypair(path: string, subject: string): Promise<TEEResponse<EVMKeypairResponse>> {
        try {
            const keyResponse = await this.deriveKey(path, subject);
            if (keyResponse.error || !keyResponse.data) {
                return { error: keyResponse.error };
            }

            const hex = keccak256(keyResponse.data.derivedKey.asUint8Array());
            const keypair = privateKeyToAccount(hex);

            return {
                data: {
                    keypair,
                    address: keypair.address
                }
            };
        } catch (error) {
            throw new TEEError(
                TEEErrorCode.KEYPAIR_GENERATION_FAILED,
                'Failed to derive ECDSA keypair',
                error
            );
        }
    }

    protected validateInput(path: string, subject: string): void {
        if (!path || !subject) {
            throw new TEEError(
                TEEErrorCode.INVALID_INPUT,
                'Path and subject are required for key derivation'
            );
        }
    }
}
