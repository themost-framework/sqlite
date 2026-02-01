import { babel } from '@rollup/plugin-babel';
import * as pkg from './package.json';
import dts from 'rollup-plugin-dts';
import replace from 'rollup-plugin-replace';

export default [
    {
        input: 'src/index.js',
        output: {
            dir: 'dist',
            format: 'cjs',
            sourcemap: true
        },
        external: Object.keys(pkg.dependencies).concat(Object.keys(pkg.peerDependencies)),
        plugins: [
            babel({ babelHelpers: 'bundled' })
        ]
    },
    {
        input: 'src/index.js',
        output: {
            file: 'dist/index.esm.js',
            format: 'esm',
            sourcemap: true
        },
        external: Object.keys(pkg.dependencies).concat(Object.keys(pkg.peerDependencies)),
        plugins: [
            replace({
                '__dirname': 'import.meta?.dirname'
            }),
            babel({ babelHelpers: 'bundled' })
        ]
    },
    {
        input: 'src/index.d.ts',
        output: [
            { 
                file: 'dist/index.d.ts'
            }
        ],
        external: Object.keys(pkg.dependencies).concat(Object.keys(pkg.peerDependencies)),
        plugins: [dts()],
      }
];