import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      output: {
        // Function form: Vite 8 (Rolldown) no longer accepts the object form.
        manualChunks(id) {
          if (id.includes('/node_modules/leaflet/')) return 'leaflet';
          if (/\/node_modules\/(supercluster|kdbush)\//.test(id)) return 'supercluster';
        },
      },
    },
  },
});
