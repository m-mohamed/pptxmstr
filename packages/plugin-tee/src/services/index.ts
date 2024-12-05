// packages/plugin-tee/src/services/index.ts
// Export service interfaces and types
export { ITEEService, TEEServiceConfig } from '../types';

// Export base service
export { BaseTEEService } from './base/baseTEEService';

// Export concrete implementations
export { LocalTEEService } from './local/localTEEService';
export { CloudTEEService } from './cloud/cloudTEEService';

// Export factory as the primary means of service instantiation
export { TEEServiceFactory } from './factory/teeServiceFactory';

// Export error types for proper error handling
export { TEEError, TEEErrorCode } from '../types';
