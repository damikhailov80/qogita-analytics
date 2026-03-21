import 'dotenv/config';
import { Queue } from 'bullmq';

export interface AllegroUploadJobData {
    filePath: string;
    fileName: string;
    fileSize: number;
}

export interface QogitaUpdateJobData {
    triggeredAt: Date;
}

export interface OffersUpdateAllJobData {
    triggeredAt: Date;
}

export const ALLEGRO_UPLOAD_QUEUE_NAME = 'allegro-upload';
export const ALLEGRO_UPLOAD_JOB_NAME = 'upload-allegro-products';

export const QOGITA_UPDATE_QUEUE_NAME = 'qogita-update';
export const QOGITA_UPDATE_JOB_NAME = 'update-qogita-products';

export const OFFERS_UPDATEALL_QUEUE_NAME = 'offers-updateall';
export const OFFERS_UPDATEALL_JOB_NAME = 'update-all-offers';

export const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

export const workerOptions = {
    connection: redisConnection,
    concurrency: 1,
    lockDuration: 300000, // 5 минут
    lockRenewTime: 30000, // Обновлять lock каждые 30 секунд
};

export const allegroUploadQueue = new Queue<AllegroUploadJobData>(ALLEGRO_UPLOAD_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 1, // Не делаем retry для Allegro - файл может быть удален
        removeOnComplete: {
            count: 10, // Хранить последние 10 завершенных задач
        },
        removeOnFail: {
            count: 20, // Хранить последние 20 неудачных задач
        },
    },
});

export const qogitaUpdateQueue = new Queue<QogitaUpdateJobData>(QOGITA_UPDATE_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 10000,
        },
        removeOnComplete: {
            count: 10,
        },
        removeOnFail: {
            count: 20,
        },
    },
});

export const offersUpdateAllQueue = new Queue<OffersUpdateAllJobData>(OFFERS_UPDATEALL_QUEUE_NAME, {
    connection: redisConnection,
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'exponential',
            delay: 10000,
        },
        removeOnComplete: {
            count: 10,
        },
        removeOnFail: {
            count: 20,
        },
    },
});
