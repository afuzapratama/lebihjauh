import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { loadEnv } from 'vite';

// Load semua env vars dari .env ke process.env supaya tersedia di SSR runtime
const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), '');
Object.assign(process.env, env);

// Astro hanya mempercayai header X-Forwarded-* untuk domain yang didaftarkan.
// Ini menjaga URL request tetap memakai origin publik saat aplikasi berjalan di
// belakang reverse proxy (misalnya Nginx), sehingga pemeriksaan CSRF tidak
// membandingkan origin HTTPS browser dengan origin HTTP internal Node.
const appUrl = new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:4321');

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  devToolbar: { enabled: false },
  security: {
    allowedDomains: [
      {
        protocol: appUrl.protocol.slice(0, -1),
        hostname: appUrl.hostname,
        ...(appUrl.port ? { port: appUrl.port } : {}),
      },
    ],
  },
});
