import { Pool } from 'pg';

// Database connection pool configuration
const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: {
    rejectUnauthorized: false, // Required for some cloud databases
  },
  // Connection pool settings
  max: 10,                      // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,     // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection fails
});

// Log connection errors (helpful for debugging in production)
pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err);
});

export default pool;
