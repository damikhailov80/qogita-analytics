import { NextResponse } from 'next/server';
import { qogitaUpdateQueue, QOGITA_UPDATE_JOB_NAME } from '@/lib/workers/queue';

export async function POST() {
    try {
        // Проверяем активные задачи в очереди
        const activeJobs = await qogitaUpdateQueue.getJobs(['waiting', 'active']);
        const qogitaJobs = activeJobs.filter(j => j.name === QOGITA_UPDATE_JOB_NAME);

        if (qogitaJobs.length > 0) {
            return NextResponse.json(
                { error: 'Обновление уже в очереди или выполняется' },
                { status: 409 }
            );
        }

        // Создаем задачу в очереди
        const job = await qogitaUpdateQueue.add(QOGITA_UPDATE_JOB_NAME, {
            triggeredAt: new Date()
        });

        return NextResponse.json({
            success: true,
            jobId: job.id,
            message: 'Обновление запущено'
        });
    } catch (error) {
        console.error('[Qogita Update API] Error creating update job:', error);
        return NextResponse.json(
            { error: 'Failed to create update job' },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        // Получаем задачи из очереди
        const jobs = await qogitaUpdateQueue.getJobs(['waiting', 'active', 'completed', 'failed']);

        // Находим все задачи с именем QOGITA_UPDATE_JOB_NAME и берем последнюю
        const qogitaJobs = jobs.filter(j => j.name === QOGITA_UPDATE_JOB_NAME);

        if (qogitaJobs.length === 0) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Берем последнюю созданную задачу
        const job = qogitaJobs.sort((a, b) => b.timestamp - a.timestamp)[0];

        const state = await job.getState();
        const progress = job.progress;
        const logs = await qogitaUpdateQueue.getJobLogs(job.id as string);

        let result = null;
        if (state === 'completed') {
            result = job.returnvalue;
        }

        let error = null;
        if (state === 'failed') {
            error = job.failedReason;
        }

        return NextResponse.json({
            jobId: job.id,
            state,
            progress,
            logs: logs.logs,
            result,
            error,
            createdAt: job.timestamp,
            processedAt: job.processedOn,
            finishedAt: job.finishedOn
        });
    } catch (error) {
        console.error('[Qogita Update API] Error fetching job status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch job status' },
            { status: 500 }
        );
    }
}
