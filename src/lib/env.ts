// Environment variable validation
// This ensures all required env vars are present at build/runtime

const requiredEnvVars = [
  'DATABASE_HOST',
  'DATABASE_PORT',
  'DATABASE_NAME',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
] as const;

type EnvVar = (typeof requiredEnvVars)[number];

function getEnvVar(name: EnvVar): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  DATABASE_HOST: getEnvVar('DATABASE_HOST'),
  DATABASE_PORT: parseInt(process.env.DATABASE_PORT || '5432'),
  DATABASE_NAME: getEnvVar('DATABASE_NAME'),
  DATABASE_USER: getEnvVar('DATABASE_USER'),
  DATABASE_PASSWORD: getEnvVar('DATABASE_PASSWORD'),
} as const;

// Validate on import (will throw if env vars are missing)
export function validateEnv() {
  requiredEnvVars.forEach((name) => {
    if (!process.env[name]) {
      console.error(`Missing required environment variable: ${name}`);
    }
  });
}
