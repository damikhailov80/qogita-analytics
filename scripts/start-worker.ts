import 'dotenv/config';
import { allegroUploadWorker } from '../lib/workers/allegro-upload-worker';
import { redisConnection } from '../lib/queue';

console.log('🚀 Starting Allegro Upload Worker...');
console.log(`📡 Connecting to Redis at ${redisConnection.host}:${redisConnection.port}`);

allegroUploadWorker.on('ready', () => {
    console.log('✅ Worker is ready and waiting for jobs');
});

allegroUploadWorker.on('active', (job) => {
    console.log(`📝 Processing job ${job.id}`);
});

allegroUploadWorker.on('completed', (job) => {
    console.log(`✅ Job ${job.id} completed successfully`);
});

allegroUploadWorker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed:`, err.message);
});

allegroUploadWorker.on('error', (err) => {
    console.error('Worker error:', err);
});

process.on('SIGTERM', async () => {
    console.log('Shutting down worker...');
    await allegroUploadWorker.close();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('Shutting down worker...');
    await allegroUploadWorker.close();
    process.exit(0);
});
