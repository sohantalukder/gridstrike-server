import { IsIn, IsNotEmpty, IsOptional, IsString, IsInt, IsUrl } from 'class-validator';

export class EnvironmentVariables {
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

  @IsUrl({ require_tld: false }, { message: 'DATABASE_URL invalid' })
  @IsNotEmpty()
  DATABASE_URL = 'postgresql://postgres:password@localhost:5432/gridstrike';

  @IsUrl({ require_tld: false }, { message: 'DIRECT_URL invalid' })
  @IsOptional()
  DIRECT_URL = 'postgresql://postgres:password@localhost:5432/gridstrike';

  @IsString()
  @IsNotEmpty()
  REDIS_HOST = '127.0.0.1';

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
  @IsIn(['prod'], { message: 'NODE_ENV must be prod' })
  NODE_ENV = 'prod';
}
