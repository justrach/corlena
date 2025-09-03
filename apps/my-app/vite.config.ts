import { sveltekit } from '@sveltejs/kit/vite';
import { resolve } from 'path';

// Export plain object to avoid TS type conflicts across monorepo vite versions
const config = {
    plugins: [sveltekit()],
    resolve: {
        alias: {
            'corlena/svelte': resolve(__dirname, '../../packages/corlena/svelte/index.js')
        }
    },
    optimizeDeps: {
        // Avoid prebundling the wasm wrapper so Vite can handle the .wasm asset
        exclude: ['corlena/wasm', '@corlena/wasm']
    },
    ssr: {
        noExternal: ['corlena', 'corlena/wasm', 'corlena/svelte', '@corlena/wasm'],
        // Prevent SSR from trying to process these modules
        external: []
    },
    assetsInclude: ['**/*.wasm'],
    server: {
        host: true,
        port: 5177,
        strictPort: true,
        fs: {
            allow: ['..', '../../packages']
        }
    }
};

export default config;
