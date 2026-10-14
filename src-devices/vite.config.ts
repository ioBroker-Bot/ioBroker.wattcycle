import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import { federation } from '@module-federation/vite';
import { moduleFederationShared } from '@iobroker/dm-widgets/modulefederation.devices.config';

/**
 * The tile of a WattCycle battery for the devices app.
 *
 * The views come from `../src-shared` and are the same as in the vis-2 widget. They resolve `react`
 * from this project (see `dedupe`), as they have no `node_modules` of their own.
 *
 * React and MUI of the devices app are taken from its globals through `@iobroker/dm-widgets`; the
 * shared views use no hooks, so it does not matter which copy of the JSX runtime creates their elements.
 */
const dir = (relative: string): string => fileURLToPath(new URL(relative, import.meta.url));

const config = {
    plugins: [
        federation({
            manifest: true,
            name: 'DevicesWidgetWattCycleSet',
            filename: 'customDevices.js',
            exposes: {
                './Components': './src/Components.tsx',
                './translations': './src/translations',
            },
            remotes: {},
            // MUI and gui-components are only imported as types here; their runtime comes from the host's
            // globals. Sharing them would bundle megabytes of fallback copies that are never loaded.
            shared: moduleFederationShared(['react', 'react-dom', '@iobroker/dm-widgets']),
            dts: false,
        }),
        react(),
        commonjs(),
    ],
    resolve: {
        dedupe: ['react', 'react-dom'],
    },
    server: {
        port: 3000,
        fs: {
            allow: [dir('..')],
        },
        proxy: {
            '/files': 'http://localhost:8081',
            '/adapter': 'http://localhost:8081',
            '/session': 'http://localhost:8081',
            '/log': 'http://localhost:8081',
            '/lib': 'http://localhost:8081',
        },
    },
    base: './',
    build: {
        // Top-level await, emitted by the federation plugin, needs chrome89+
        target: 'chrome89',
        outDir: './build',
        rollupOptions: {
            onwarn(warning: { code: string }, warn: (warning: { code: string }) => void): void {
                // Suppress "Module level directives cause errors when bundled" warnings
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') {
                    return;
                }
                warn(warning);
            },
        },
    },
};

export default config;
