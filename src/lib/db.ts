import { Pool } from 'pg';

// Singleton pattern for serverless environments
// Prevents creating new pool on every function invocation
declare global {
   
  var pgPool: Pool | undefined;
}

// Database connection pool configuration optimized for serverless (Vercel)
const pool = global.pgPool || new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: false, // Required for some cloud databases
  },
  // Connection pool settings optimized for serverless
  max: 3,                       // Reduced for serverless - each function gets its own pool
  idleTimeoutMillis: 10000,     // Close idle clients faster (10 seconds)
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection fails
});

// Cache pool in global for development (hot reloading)
if (process.env.NODE_ENV !== 'production') {
  global.pgPool = pool;
}

// Log connection errors (helpful for debugging in production)
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
});

export default pool;
