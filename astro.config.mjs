import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { loadEnv } from 'vite';

// Load semua env vars dari .env ke process.env supaya tersedia di SSR runtime
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
Object.assign(process.env, env);

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  devToolbar: { enabled: false },
});
