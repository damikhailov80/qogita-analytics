import 'dotenv/config';
import { Worker } from 'bullmq';
import { allegroUploadWorker } from '../lib/workers/allegro-update-worker';
import { qogitaUpdateWorker } from '../lib/workers/qogita-update-worker';
import { offersUpdateAllWorker } from '../lib/workers/offers-updateall-worker';
import { redisConnection } from '../lib/workers/queue';

const workers = [
    { worker: allegroUploadWorker, name: 'Allegro Upload' },
    { worker: qogitaUpdateWorker, name: 'Qogita Update' },
    { worker: offersUpdateAllWorker, name: 'Offers UpdateAll' }
];

console.log('🚀 Starting Workers...');
console.log(`📡 Connecting to Redis at ${redisConnection.host}:${redisConnection.port}`);

function setupWorkerListeners(worker: Worker, name: string) {
    worker.on('ready', () => {
        console.log(`✅ ${name} Worker is ready and waiting for jobs`);
    });

    worker.on('active', (job) => {
        console.log(`📝 [${name}] Processing job ${job.id}`);
    });

    worker.on('completed', (job) => {
        console.log(`✅ [${name}] Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job, err) => {
        console.error(`❌ [${name}] Job ${job?.id} failed:`, err.message);
    });

    worker.on('error', (err) => {
        console.error(`[${name}] Worker error:`, err);
    });
}

// Setup listeners for all workers
workers.forEach(({ worker, name }) => setupWorkerListeners(worker, name));

async function shutdown() {
    console.log('Shutting down workers...');
    await Promise.all(workers.map(({ worker }) => worker.close()));
    process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
