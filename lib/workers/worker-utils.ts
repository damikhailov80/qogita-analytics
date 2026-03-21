import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';
import Redis from 'ioredis';
import { redisConnection } from './queue';

/**
 * Результат выполнения worker job
 */
export interface WorkerResult {
    success: boolean;
    count: number;
    [key: string]: any;
}

/**
 * Базовое состояние для возобновляемых воркеров
 */
export interface BaseWorkerState {
    [key: string]: any;
}

/**
 * Контекст для логирования worker job
 */
export class WorkerJobLogger {
    private logs: string[] = [];

    constructor(private job: Job) { }

    /**
     * Логирует сообщение и сохраняет в массив
     */
    async log(message: string): Promise<void> {
        await this.job.log(message);
        this.logs.push(message);
    }

    /**
     * Обновляет прогресс job
     */
    async updateProgress(progress: number): Promise<void> {
        await this.job.updateProgress(progress);
    }

    /**
     * Возвращает все накопленные логи
     */
    getLogs(): string[] {
        return [...this.logs];
    }
}

/**
 * Сохраняет логи worker job в базу данных
 */
export async function saveWorkerLog(params: {
    workerType: string;
    jobId: string;
    status: 'completed' | 'failed';
    logs: string[];
    result?: WorkerResult;
    error?: string;
    startedAt: Date;
    completedAt: Date;
}): Promise<void> {
    try {
        await prisma.workerLog.create({
            data: {
                workerType: params.workerType,
                jobId: params.jobId,
                status: params.status,
                logs: params.logs,
                result: params.result || undefined,
                error: params.error || null,
                startedAt: params.startedAt,
                completedAt: params.completedAt
            }
        });
    } catch (err) {
        console.error('[Worker Utils] Failed to save worker log:', err);
        if (err instanceof Error && err.stack) {
            console.error('[Worker Utils] Error stack:', err.stack);
        }
    }
}

/**
 * Обрабатывает массив элементов батчами
 */
export async function processBatches<T>(
    items: T[],
    batchSize: number,
    processor: (batch: T[]) => Promise<void>,
    onProgress?: (processed: number, total: number) => Promise<void>
): Promise<void> {
    let processed = 0;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        await processor(batch);

        processed += batch.length;

        if (onProgress) {
            await onProgress(processed, items.length);
        }
    }
}

/**
 * Вычисляет прогресс в процентах в заданном диапазоне
 */
export function calculateProgress(
    current: number,
    total: number,
    startPercent: number,
    endPercent: number
): number {
    const range = endPercent - startPercent;
    const progress = startPercent + Math.floor((current / total) * range);
    return Math.min(progress, endPercent);
}

/**
 * Форматирует размер файла в читаемый вид
 */
export function formatFileSize(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Стандартные обработчики событий для worker
 */
export function setupWorkerEventHandlers(
    worker: any,
    workerName: string
): void {
    worker.on('completed', (job: Job) => {
        console.log(`[${workerName}] Job ${job.id} completed successfully`);
    });

    worker.on('failed', (job: Job | undefined, err: Error) => {
        console.error(`[${workerName}] Job ${job?.id} failed:`, err);
        console.error(`[${workerName}] Error stack:`, err.stack);
    });
}

/**
 * Обертка для выполнения worker job с автоматическим логированием (невозобновляемый)
 */
export async function executeWorkerJob<TData, TResult extends WorkerResult>(
    job: Job<TData>,
    workerType: string,
    handler: (job: Job<TData>, logger: WorkerJobLogger) => Promise<TResult>
): Promise<TResult> {
    const startTime = new Date();
    const logger = new WorkerJobLogger(job);

    try {
        const result = await handler(job, logger);

        await saveWorkerLog({
            workerType,
            jobId: job.id as string,
            status: 'completed',
            logs: logger.getLogs(),
            result,
            startedAt: startTime,
            completedAt: new Date()
        });

        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error(`[${workerType}] Job ${job.id} error:`, errorMessage);
        if (errorStack) {
            console.error(`[${workerType}] Error stack:`, errorStack);
        }

        await logger.log(`Error: ${errorMessage}`);

        await saveWorkerLog({
            workerType,
            jobId: job.id as string,
            status: 'failed',
            logs: logger.getLogs(),
            error: errorMessage,
            startedAt: startTime,
            completedAt: new Date()
        });

        throw error;
    }
}

/**
 * Менеджер состояния для возобновляемых воркеров
 */
export class ResumableWorkerStateManager<TState extends BaseWorkerState> {
    private redis: Redis;
    private stateKey: string;
    private dbKey: string;

    constructor(
        private workerType: string,
        private jobId: string,
        private persistentKey?: string // Опциональный постоянный ключ для состояния
    ) {
        this.redis = new Redis(redisConnection);
        // Используем persistentKey если есть, иначе jobId
        const key = persistentKey || jobId;
        this.stateKey = `${workerType}:state:${key}`;
        this.dbKey = key;
    }

    /**
     * Загружает состояние из Redis или БД
     */
    async loadState(): Promise<TState | null> {
        // Сначала пробуем Redis
        const savedStateStr = await this.redis.get(this.stateKey);
        if (savedStateStr) {
            console.log(`[${this.workerType}] Resuming from saved state (Redis)`);
            return JSON.parse(savedStateStr) as TState;
        }

        // Если в Redis нет, пробуем БД
        const savedStateDb = await prisma.workerState.findUnique({
            where: { jobId: this.dbKey }
        });

        if (savedStateDb) {
            console.log(`[${this.workerType}] Resuming from saved state (DB)`);
            const state = savedStateDb.state as TState;
            // Восстанавливаем в Redis
            await this.saveState(state);
            return state;
        }

        return null;
    }

    /**
     * Сохраняет состояние в Redis и опционально в БД
     */
    async saveState(state: TState, saveToDB: boolean = false): Promise<void> {
        // Всегда сохраняем в Redis (быстро)
        await this.redis.set(this.stateKey, JSON.stringify(state), 'EX', 86400); // 24 часа

        // Опционально сохраняем в БД (медленнее, но надежнее)
        if (saveToDB) {
            await prisma.workerState.upsert({
                where: { jobId: this.dbKey },
                create: {
                    workerType: this.workerType,
                    jobId: this.dbKey,
                    state: state as any
                },
                update: {
                    state: state as any
                }
            });
        }
    }

    /**
     * Очищает сохраненное состояние
     */
    async clearState(): Promise<void> {
        await this.redis.del(this.stateKey);
        await prisma.workerState.deleteMany({
            where: { jobId: this.dbKey }
        });
    }

    /**
     * Закрывает соединение с Redis
     */
    async close(): Promise<void> {
        await this.redis.quit();
    }
}

/**
 * Обертка для выполнения возобновляемого worker job
 */
export async function executeResumableWorkerJob<
    TData,
    TState extends BaseWorkerState,
    TResult extends WorkerResult
>(
    job: Job<TData>,
    workerType: string,
    handler: (
        job: Job<TData>,
        logger: WorkerJobLogger,
        stateManager: ResumableWorkerStateManager<TState>
    ) => Promise<TResult>,
    persistentKey?: string
): Promise<TResult> {
    const startTime = new Date();
    const logger = new WorkerJobLogger(job);
    const stateManager = new ResumableWorkerStateManager<TState>(
        workerType,
        job.id as string,
        persistentKey
    );

    try {
        const result = await handler(job, logger, stateManager);

        // Очищаем состояние после успешного завершения
        await stateManager.clearState();

        await saveWorkerLog({
            workerType,
            jobId: job.id as string,
            status: 'completed',
            logs: logger.getLogs(),
            result,
            startedAt: startTime,
            completedAt: new Date()
        });

        await stateManager.close();
        return result;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;

        console.error(`[${workerType}] Job ${job.id} error:`, errorMessage);
        if (errorStack) {
            console.error(`[${workerType}] Error stack:`, errorStack);
        }

        await logger.log(`Error: ${errorMessage}`);

        await saveWorkerLog({
            workerType,
            jobId: job.id as string,
            status: 'failed',
            logs: logger.getLogs(),
            error: errorMessage,
            startedAt: startTime,
            completedAt: new Date()
        });

        await stateManager.close();
        throw error;
    }
}
