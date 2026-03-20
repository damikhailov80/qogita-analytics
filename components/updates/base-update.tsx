'use client';

import { useState, useRef, useEffect, ReactNode } from 'react';

export interface UpdateStatus {
    state: string;
    progress: number;
    logs: string[];
    result?: any;
    error?: string;
}

interface BaseUpdateProps {
    title: string;
    logEndpoint: string;
    updateEndpoint: string;
    confirmMessage: string;
    buttonText: string;
    buttonTextLoading: string;
    requiresFile?: boolean;
    acceptedFileTypes?: string;
    onBeforeUpdate?: () => boolean;
    renderResult?: (result: any) => ReactNode;
}

export default function BaseUpdate({
    title,
    logEndpoint,
    updateEndpoint,
    confirmMessage,
    buttonText,
    buttonTextLoading,
    requiresFile = false,
    acceptedFileTypes = '.csv',
    onBeforeUpdate,
    renderResult,
}: BaseUpdateProps) {
    const [file, setFile] = useState<File | null>(null);
    const [updating, setUpdating] = useState(false);
    const [status, setStatus] = useState<UpdateStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdateTime, setLastUpdateTime] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        fetchLastLog();
    }, []);

    const fetchLastLog = async () => {
        try {
            const response = await fetch(logEndpoint);
            if (response.ok) {
                const logs = await response.json();
                if (logs.length > 0) {
                    const lastLog = logs[0];
                    if (lastLog.status === 'completed' || lastLog.status === 'failed') {
                        setStatus({
                            state: lastLog.status,
                            progress: lastLog.status === 'completed' ? 100 : 0,
                            logs: lastLog.logs || [],
                            result: lastLog.result,
                            error: lastLog.error
                        });
                        if (lastLog.status === 'failed' && lastLog.error) {
                            setError(lastLog.error);
                        }
                        if (lastLog.completedAt) {
                            setLastUpdateTime(lastLog.completedAt);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching last log:', err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        const fileExtension = acceptedFileTypes.replace('.', '');

        if (selectedFile && selectedFile.name.endsWith(fileExtension)) {
            setFile(selectedFile);
            setError(null);
        } else {
            setError(`Пожалуйста, выберите ${fileExtension.toUpperCase()} файл`);
            setFile(null);
        }
    };

    const handleUpdate = async () => {
        if (requiresFile && !file) {
            setError('Выберите файл для загрузки');
            return;
        }

        if (onBeforeUpdate && !onBeforeUpdate()) {
            return;
        }

        if (!confirm(confirmMessage)) {
            return;
        }

        try {
            setUpdating(true);
            setError(null);
            setStatus(null);

            const body = requiresFile && file ? (() => {
                const formData = new FormData();
                formData.append('file', file);
                return formData;
            })() : undefined;

            const response = await fetch(updateEndpoint, {
                method: 'POST',
                body,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка запуска обновления');
            }

            pollStatus();
        } catch (err: any) {
            setError(err.message || 'Ошибка при запуске обновления');
            setUpdating(false);
        }
    };

    const pollStatus = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
        }

        pollIntervalRef.current = setInterval(async () => {
            try {
                const response = await fetch(updateEndpoint);

                if (!response.ok) {
                    if (response.status === 404) {
                        return;
                    }
                    throw new Error('Ошибка получения статуса');
                }

                const data = await response.json();
                setStatus(data);

                if (data.state === 'completed') {
                    clearInterval(pollIntervalRef.current!);
                    setUpdating(false);
                    pollIntervalRef.current = null;
                    setLastUpdateTime(new Date().toISOString());

                    if (requiresFile) {
                        setFile(null);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    }
                } else if (data.state === 'failed') {
                    clearInterval(pollIntervalRef.current!);
                    setUpdating(false);
                    setError(data.error || 'Ошибка обработки');
                    pollIntervalRef.current = null;
                }
            } catch (err) {
                console.error('Error polling status:', err);
            }
        }, 1000);

        setTimeout(() => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
                setUpdating(false);
                setError('Превышено время ожидания обработки');
            }
        }, 1800000);
    };

    const getStatusLabel = (state: string) => {
        switch (state) {
            case 'waiting': return '⏳ Ожидание';
            case 'active': return '🔄 Обработка';
            case 'completed': return '✅ Завершено';
            case 'failed': return '❌ Ошибка';
            default: return state;
        }
    };

    const defaultRenderResult = (result: any) => (
        <div className="text-sm text-green-600 dark:text-green-400">
            <p>✅ Обработано товаров: {result.count || 0}</p>
            {result.totalRows !== undefined && (
                <p>📊 Всего строк: {result.totalRows}</p>
            )}
            {result.ignoredRows !== undefined && result.ignoredRows > 0 && (
                <p>⚠️ Пропущено строк: {result.ignoredRows}</p>
            )}
        </div>
    );

    const formatDateTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString('ru-RU', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };

    return (
        <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">{title}</h2>
                {lastUpdateTime && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Последнее обновление: {formatDateTime(lastUpdateTime)}
                    </p>
                )}
            </div>

            <div className="space-y-4">
                {requiresFile && (
                    <div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={acceptedFileTypes}
                            onChange={handleFileChange}
                            disabled={updating}
                            className="block w-full text-sm text-zinc-900 dark:text-zinc-100 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-zinc-100 file:text-zinc-900 hover:file:bg-zinc-200 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                        {file && (
                            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                                Выбран файл: {file.name} ({(file.size / 1024).toFixed(2)} KB)
                            </p>
                        )}
                    </div>
                )}

                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {status && (
                    <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-md space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                                Статус: {getStatusLabel(status.state)}
                            </span>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400">
                                {status.progress}%
                            </span>
                        </div>

                        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                            <div
                                className="bg-zinc-900 dark:bg-zinc-50 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${status.progress}%` }}
                            />
                        </div>

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

                        {status.result && (
                            renderResult ? renderResult(status.result) : defaultRenderResult(status.result)
                        )}
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={handleUpdate}
                        disabled={(requiresFile && !file) || updating}
                        className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                        {updating ? buttonTextLoading : buttonText}
                    </button>
                </div>
            </div>
        </div>
    );
}
