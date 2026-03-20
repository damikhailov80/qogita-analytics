import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { allegroUploadQueue, ALLEGRO_UPLOAD_JOB_NAME } from '@/lib/queue';

const UPLOAD_DIR = '/tmp/allegro-uploads';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Создаем директорию если не существует
        await mkdir(UPLOAD_DIR, { recursive: true });

        // Сохраняем файл на диск
        const buffer = await file.arrayBuffer();
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = join(UPLOAD_DIR, fileName);

        await writeFile(filePath, Buffer.from(buffer));

        // Создаем задачу в очереди с путем к файлу
        const job = await allegroUploadQueue.add(ALLEGRO_UPLOAD_JOB_NAME, {
            filePath,
            fileName: file.name,
            fileSize: file.size
        });

        return NextResponse.json({
            success: true,
            jobId: job.id,
            message: 'Upload job created successfully'
        });
    } catch (error) {
        console.error('Error creating upload job:', error);
        return NextResponse.json(
            { error: 'Failed to create upload job' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        // Получаем задачи из очереди
        const jobs = await allegroUploadQueue.getJobs(['waiting', 'active', 'completed', 'failed']);

        // Находим все задачи с именем ALLEGRO_UPLOAD_JOB_NAME и берем последнюю
        const allegroJobs = jobs.filter(j => j.name === ALLEGRO_UPLOAD_JOB_NAME);

        if (allegroJobs.length === 0) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Берем последнюю созданную задачу
        const job = allegroJobs.sort((a, b) => b.timestamp - a.timestamp)[0];

        const state = await job.getState();
        const progress = job.progress;
        const logs = await allegroUploadQueue.getJobLogs(job.id as string);

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
        console.error('Error fetching job status:', error);
        return NextResponse.json(
            { error: 'Failed to fetch job status' },
            { status: 500 }
        );
    }
}
