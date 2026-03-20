import { Job } from 'bullmq';
import { prisma } from '@/lib/prisma';

/**
 * Результат выполнения worker job
 */
export interface WorkerResult {
    success: boolean;
    count: number;
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
                result: params.result || null,
                error: params.error || null,
                startedAt: params.startedAt,
                completedAt: params.completedAt
            }
        });
    } catch (err) {
        console.error('Failed to save worker log:', err);
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
    });
}

/**
 * Обертка для выполнения worker job с автоматическим логированием
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
