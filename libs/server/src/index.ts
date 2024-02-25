import { serve } from './serve';

process.title = 'local-tunnel dev server';

process.on('SIGINT', () => {
    process.exit();
});

process.on('SIGTERM', () => {
    process.exit();
});

serve();