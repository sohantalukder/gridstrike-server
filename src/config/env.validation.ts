import { Type } from 'class-transformer';
import { IsIn, IsNotEmpty, IsOptional, IsString, IsInt, IsUrl } from 'class-validator';

export const ENV_KEYS = [
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_JWKS_URL',
  'DATABASE_URL',
  'DIRECT_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'JWT_ACCESS_EXPIRES_IN',
  'JWT_REFRESH_EXPIRES_IN',
  'NODE_ENV',
] as const;

export function pickEnvConfig(config: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    ENV_KEYS.filter((key) => config[key] !== undefined).map((key) => [key, config[key]]),
  );
}

export class EnvironmentVariables {
  @Type(() => Number)
  @IsInt()
  PORT = 3000;

  @IsUrl({ require_tld: false }, { message: 'SUPABASE_URL invalid' })
  @IsNotEmpty()
  SUPABASE_URL = 'https://example.supabase.co';

  @IsString()
  @IsNotEmpty()
  SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_change-me';

  @IsString()
  @IsNotEmpty()
  SUPABASE_SECRET_KEY = 'sb_secret_change-me';

  @IsUrl({ require_tld: false }, { message: 'SUPABASE_JWKS_URL invalid' })
  @IsNotEmpty()
  SUPABASE_JWKS_URL = 'https://example.supabase.co/auth/v1/.well-known/jwks.json';

  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL invalid' })
  DATABASE_URL = 'postgresql://postgres:password@localhost:5432/gridstrike';

  @IsString()
  @IsOptional()
  DIRECT_URL = 'postgresql://postgres:password@localhost:5432/gridstrike';

  @IsString()
  @IsNotEmpty()
  REDIS_HOST = '127.0.0.1';

  @Type(() => Number)
  @IsInt()
  REDIS_PORT = 6379;

  @IsString()
  @IsOptional()
  REDIS_PASSWORD = '';

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_SECRET = 'replace-with-secure-access-secret';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET = 'replace-with-secure-refresh-secret';

  @IsString()
  @IsNotEmpty()
  JWT_ACCESS_EXPIRES_IN = '15m';

  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_EXPIRES_IN = '30d';

  @IsString()
  @IsIn(['prod', 'local', 'dev'], { message: 'NODE_ENV must be prod, local, or dev' })
  NODE_ENV = 'prod';
}
