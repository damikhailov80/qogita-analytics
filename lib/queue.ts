import 'dotenv/config';
import { Queue } from 'bullmq';

export interface AllegroUploadJobData {
    filePath: string;
    fileName: string;
    fileSize: number;
}

export const ALLEGRO_UPLOAD_QUEUE_NAME = 'allegro-upload';
export const ALLEGRO_UPLOAD_JOB_NAME = 'upload-allegro-products';

export const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const allegroUploadQueue = new Queue<AllegroUploadJobData>(ALLEGRO_UPLOAD_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    },
});
