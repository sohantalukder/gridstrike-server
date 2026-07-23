"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GridStrikeServerContainer = void 0;
const containers_1 = require("@cloudflare/containers");
class GridStrikeServerContainer extends containers_1.Container {
    constructor() {
        super(...arguments);
        this.defaultPort = 8080;
        this.sleepAfter = '2h';
    }
}
exports.GridStrikeServerContainer = GridStrikeServerContainer;
function containerEnv(env) {
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
exports.default = {
    async fetch(request, env) {
        const container = (0, containers_1.getContainer)(env.GRIDSTRIKE_SERVER, 'api');
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
//# sourceMappingURL=worker.js.map