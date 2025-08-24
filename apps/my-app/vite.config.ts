import { sveltekit } from '@sveltejs/kit/vite';

// Export plain object to avoid TS type conflicts across monorepo vite versions
const config = {
    plugins: [sveltekit()],
    optimizeDeps: {
        // Avoid prebundling the wasm wrapper so Vite can handle the .wasm asset
        exclude: ['corlena/wasm', '@corlena/wasm']
    },
    ssr: {
        noExternal: ['corlena', 'corlena/wasm', '@corlena/wasm']
    },
    assetsInclude: ['**/*.wasm'],
    server: {
        host: true,
        port: 5176,
        strictPort: true
    }
};

export default config;
