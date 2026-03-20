'use client';

import { useState, useRef } from 'react';

interface UploadStatus {
    state: string;
    progress: number;
    logs: string[];
    result?: any;
    error?: string;
}

export default function AllegroUpload() {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [status, setStatus] = useState<UploadStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile && selectedFile.name.endsWith('.csv')) {
            setFile(selectedFile);
            setError(null);
        } else {
            setError('Пожалуйста, выберите CSV файл');
            setFile(null);
        }
    };

    const handleUpload = async () => {
        if (!file) {
            setError('Выберите файл для загрузки');
            return;
        }

        // Предупреждение о длительной операции и удалении данных
        if (!confirm(
            '⚠️ ВНИМАНИЕ!\n\n' +
            '• Все существующие товары Allegro будут удалены из базы данных\n' +
            '• Обработка файла может занять продолжительное время\n' +
            '• Не закрывайте страницу до завершения операции\n\n' +
            'Продолжить?'
        )) {
            return;
        }

        try {
            setUploading(true);
            setError(null);
            setStatus(null);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/products/allegro/upload', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка загрузки файла');
            }

            // Начинаем опрос статуса
            pollStatus();
        } catch (err: any) {
            setError(err.message || 'Ошибка при загрузке файла');
            setUploading(false);
        }
    };

    const pollStatus = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }

        pollIntervalRef.current = setInterval(async () => {
            try {
                const response = await fetch('/api/products/allegro/upload');
                const data = await response.json();

                setStatus(data);

                if (data.state === 'completed') {
                    clearInterval(pollIntervalRef.current!);
                    setUploading(false);
                    pollIntervalRef.current = null;
                } else if (data.state === 'failed') {
                    clearInterval(pollIntervalRef.current!);
                    setUploading(false);
                    setError(data.error || 'Ошибка обработки файла');
                    pollIntervalRef.current = null;
                }
            } catch (err) {
                console.error('Error polling status:', err);
            }
        }, 1000);

        // Останавливаем опрос через 30 минут
        setTimeout(() => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                setUploading(false);
                setError('Превышено время ожидания обработки');
            }
        }, 1800000);
    };

    const handleReset = () => {
        setFile(null);
        setStatus(null);
        setError(null);
        setUploading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    return (
        <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Загрузка товаров Allegro</h2>

            <div className="space-y-4">
                {/* File Input */}
                <div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        disabled={uploading}
                        className="block w-full text-sm text-zinc-900 dark:text-zinc-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-zinc-100 file:text-zinc-900 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {file && (
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                            Выбран файл: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                        </p>
                    )}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Upload Status */}
                {status && (
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-md space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                                Статус: {
                                    status.state === 'waiting' ? '⏳ Ожидание' :
                                        status.state === 'active' ? '🔄 Обработка' :
                                            status.state === 'completed' ? '✅ Завершено' :
                                                status.state === 'failed' ? '❌ Ошибка' :
                                                    status.state
                                }
                            </span>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                {status.progress}%
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                            <div
                                className="bg-zinc-900 dark:bg-zinc-50 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${status.progress}%` }}
                            />
                        </div>

                        {/* Logs */}
                        {status.logs && status.logs.length > 0 && (
                            <div className="max-h-40 overflow-y-auto">
                                <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Логи:</p>
                                <div className="space-y-1">
                                    {status.logs.slice(-5).map((log, index) => (
                                        <p key={index} className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                                            {log}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Result */}
                        {status.result && (
                            <div className="text-sm text-green-600 dark:text-green-400">
                                <p>✅ Обработано товаров: {status.result.count || 0}</p>
                                {status.result.totalRows !== undefined && (
                                    <p>📊 Всего строк: {status.result.totalRows}</p>
                                )}
                                {status.result.ignoredRows !== undefined && status.result.ignoredRows > 0 && (
                                    <p>⚠️ Пропущено строк: {status.result.ignoredRows}</p>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleUpload}
                        disabled={!file || uploading}
                        className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                        {uploading ? 'Загрузка...' : 'Загрузить'}
                    </button>

                    {(status?.state === 'completed' || status?.state === 'failed' || error) && (
                        <button
                            onClick={handleReset}
                            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 px-6 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        >
                            Сбросить
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
