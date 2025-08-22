import { sveltekit } from '@sveltejs/kit/vite';

// Export plain object to avoid TS type conflicts across monorepo vite versions
const config = {
    plugins: [sveltekit()],
    optimizeDeps: {
        include: ['@corlena/core']
    },
    ssr: {
        noExternal: ['@corlena/core']
    },
    server: {
        host: true,
        port: 5176,
        strictPort: true
    }
};

export default config;
