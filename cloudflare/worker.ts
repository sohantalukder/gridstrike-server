/// <reference types="@cloudflare/workers-types" />

import { Container, getContainer } from '@cloudflare/containers';

export interface Env {
  GRIDSTRIKE_SERVER: DurableObjectNamespace<GridStrikeServerContainer>;
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_JWKS_URL?: string;
  DATABASE_URL?: string;
  DIRECT_URL?: string;
  REDIS_HOST?: string;
  REDIS_PORT?: string;
  REDIS_PASSWORD?: string;
  JWT_ACCESS_SECRET?: string;
  JWT_REFRESH_SECRET?: string;
  JWT_ACCESS_EXPIRES_IN?: string;
  JWT_REFRESH_EXPIRES_IN?: string;
}

export class GridStrikeServerContainer extends Container {
  defaultPort = 8080;
  sleepAfter = '2h';
}

function containerEnv(env: Env): Record<string, string> {
  return {
    NODE_ENV: 'prod',
    PORT: '8080',
    SUPABASE_URL: env.SUPABASE_URL ?? '',
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY ?? '',
    SUPABASE_SECRET_KEY: env.SUPABASE_SECRET_KEY ?? '',
    SUPABASE_JWKS_URL: env.SUPABASE_JWKS_URL ?? '',
    DATABASE_URL: env.DATABASE_URL ?? '',
    DIRECT_URL: env.DIRECT_URL ?? '',
    REDIS_HOST: env.REDIS_HOST ?? '',
    REDIS_PORT: env.REDIS_PORT ?? '',
    REDIS_PASSWORD: env.REDIS_PASSWORD ?? '',
    JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET ?? '',
    JWT_REFRESH_SECRET: env.JWT_REFRESH_SECRET ?? '',
    JWT_ACCESS_EXPIRES_IN: env.JWT_ACCESS_EXPIRES_IN ?? '',
    JWT_REFRESH_EXPIRES_IN: env.JWT_REFRESH_EXPIRES_IN ?? '',
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = getContainer(env.GRIDSTRIKE_SERVER, 'api');

    await container.startAndWaitForPorts({
      ports: 8080,
      startOptions: {
        envVars: containerEnv(env),
      },
      cancellationOptions: {
        portReadyTimeoutMS: 120_000,
      },
    });

    return container.fetch(request);
  },
};
