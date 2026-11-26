// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Static output for now. Server routes (auth, bookings) come with later
// milestones, together with a host adapter chosen in M1.
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },
});
