import { IsNotEmpty, IsOptional, IsString, IsInt, IsUrl } from 'class-validator';

export class EnvironmentVariables {
  @IsInt()
  PORT = 3000;

  @IsUrl({ require_tld: false }, { message: 'DATABASE_URL invalid' })
  @IsNotEmpty()
  DATABASE_URL = 'postgresql://postgres:password@localhost:5432/gridstrike';

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
  NODE_ENV = 'development';
}
