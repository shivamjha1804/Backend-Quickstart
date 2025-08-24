interface Config {
  server: {
    port: number;
    host: string;
    env: string;
    bodyParserLimit: string;
    name?: string;
    audience?: string;
    trustProxy?: boolean | string | number;
    timeout?: number;
    keepAliveTimeout?: number;
    headersTimeout?: number;
  };
  database: {
    dialect?: string;
    host: string;
    port: number;
    name: string;
    username?: string;
    password?: string;
    logging: boolean;
    ssl?: boolean;
    isolationLevel?: string;
    pool?: {
      max: number;
      min: number;
      acquire: number;
      idle: number;
      evict?: number;
    };
  };
  jwt?: {
    secret: string;
    refreshSecret: string;
    expiresIn: string;
    refreshExpiresIn: string;
  };
  security: {
    bcryptRounds: number;
    rateLimitWindow: number;
    rateLimitMax: number;
    maxRequestSize?: string;
    maxConcurrentSessions?: number;
    blacklistedIPs?: string[];
    whitelistedIPs?: string[];
  };
  cors?: {
    origins?: string[];
    origin?: string | string[];
    credentials: boolean;
  };
  email?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
  cluster?: {
    enabled: boolean;
    maxWorkers?: number;
    minWorkers?: number;
    restartThreshold?: number;
  };
  session?: {
    enabled: boolean;
  };
}

export const config: Config = {

  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development',
    bodyParserLimit: process.env.BODY_PARSER_LIMIT || '10mb',
    name: process.env.SERVER_NAME || 'test-middleware',
    audience: process.env.SERVER_AUDIENCE || 'api-client',
    trustProxy: process.env.TRUST_PROXY ? parseInt(process.env.TRUST_PROXY) : process.env.NODE_ENV === 'production',
    timeout: parseInt(process.env.SERVER_TIMEOUT || '120000', 10),
    keepAliveTimeout: parseInt(process.env.KEEP_ALIVE_TIMEOUT || '65000', 10),
    headersTimeout: parseInt(process.env.HEADERS_TIMEOUT || '66000', 10)
  },
  
  database: {
    dialect: 'postgresql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || 
      '5432'
      
      
      , 10),
    name: process.env.DB_NAME || 'test-middleware',
    username: process.env.DB_USERNAME || 
      'postgres'
      
      ,
    password: process.env.DB_PASSWORD || '',
    
    logging: process.env.NODE_ENV !== 'production',
    ssl: process.env.DB_SSL === 'true',
    isolationLevel: process.env.DB_ISOLATION_LEVEL || 'READ_COMMITTED',
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: parseInt(process.env.DB_POOL_MIN || '5', 10),
      acquire: parseInt(process.env.DB_POOL_ACQUIRE || '60000', 10),
      idle: parseInt(process.env.DB_POOL_IDLE || '10000', 10),
      evict: parseInt(process.env.DB_POOL_EVICT || '1000', 10)
    }
    
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },

  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb',
    maxConcurrentSessions: parseInt(process.env.MAX_CONCURRENT_SESSIONS || '5', 10),
    blacklistedIPs: process.env.BLACKLISTED_IPS ? process.env.BLACKLISTED_IPS.split(',') : [],
    whitelistedIPs: process.env.WHITELISTED_IPS ? process.env.WHITELISTED_IPS.split(',') : []
  },

  cors: {
    origins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: process.env.CORS_CREDENTIALS === 'true'
  },

  

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined
  },

  cluster: {
    enabled: process.env.CLUSTER_ENABLED === 'true',
    maxWorkers: process.env.CLUSTER_MAX_WORKERS ? parseInt(process.env.CLUSTER_MAX_WORKERS, 10) : undefined,
    minWorkers: process.env.CLUSTER_MIN_WORKERS ? parseInt(process.env.CLUSTER_MIN_WORKERS, 10) : undefined,
    restartThreshold: parseInt(process.env.CLUSTER_RESTART_THRESHOLD || '10', 10)
  },

  session: {
    enabled: process.env.SESSION_ENABLED === 'true'
  }
};

