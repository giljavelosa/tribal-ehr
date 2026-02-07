export interface AppConfig {
  server: {
    port: number;
    corsOrigin: string | string[];
    nodeEnv: string;
  };
  database: {
    url: string;
    pool: {
      min: number;
      max: number;
    };
  };
  redis: {
    url: string;
  };
  rabbitmq: {
    url: string;
  };
  fhir: {
    serverUrl: string;
  };
  auth: {
    jwtSecret: string;
    tokenExpiry: string;
    refreshExpiry: string;
    sessionTimeout: number;
    mfaRequired: boolean;
  };
  encryption: {
    key: string;
    algorithm: string;
  };
}

function parseCorOrigin(origin: string | undefined): string | string[] {
  if (!origin) return 'http://localhost:3000';
  if (origin.includes(',')) {
    return origin.split(',').map((o) => o.trim());
  }
  return origin;
}

export const config: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    corsOrigin: parseCorOrigin(process.env.CORS_ORIGIN),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tribal_ehr',
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    },
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  },
  fhir: {
    serverUrl: process.env.FHIR_SERVER_URL || 'http://localhost:8080/fhir',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
    tokenExpiry: process.env.TOKEN_EXPIRY || '15m',
    refreshExpiry: process.env.REFRESH_EXPIRY || '7d',
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '1800', 10), // 30 minutes
    mfaRequired: process.env.MFA_REQUIRED === 'true',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || 'development-encryption-key-change-in-production',
    algorithm: 'aes-256-gcm',
  },
};

export default config;
