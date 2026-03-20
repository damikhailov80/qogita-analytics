'use client';

import { useState, useRef, useEffect } from 'react';

interface UpdateStatus {
    state: string;
    progress: number;
    logs: string[];
    result?: any;
    error?: string;
}

export default function QogitaUpdate() {
    const [updating, setUpdating] = useState(false);
    const [status, setStatus] = useState<UpdateStatus | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Загружаем последний лог при монтировании
    useEffect(() => {
        fetchLastLog();
    }, []);

    const fetchLastLog = async () => {
        try {
            const response = await fetch('/api/logs/qogita');
            if (response.ok) {
                const logs = await response.json();
                if (logs.length > 0) {
                    const lastLog = logs[0];
                    // Показываем последний завершенный лог
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
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching last log:', err);
        }
    };

    const handleUpdate = async () => {
        // Предупреждение о длительной операции и удалении данных
        if (!confirm(
            '⚠️ ВНИМАНИЕ!\n\n' +
            '• Все существующие товары Qogita будут удалены из базы данных\n' +
            '• Обновление может занять продолжительное время\n' +
            '• Не закрывайте страницу до завершения операции\n\n' +
            'Продолжить?'
        )) {
            return;
        }

        try {
            setUpdating(true);
            setError(null);
            setStatus(null);

            const response = await fetch('/api/products/qogita/update', {
                method: 'POST',
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка запуска обновления');
            }

            // Начинаем опрос статуса
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
                const response = await fetch('/api/products/qogita/update');

                if (!response.ok) {
                    // Если задача не найдена, продолжаем опрос
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
                } else if (data.state === 'failed') {
                    clearInterval(pollIntervalRef.current!);
                    setUpdating(false);
                    setError(data.error || 'Ошибка обновления');
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
                setUpdating(false);
                setError('Превышено время ожидания обновления');
            }
        }, 1800000);
    };

    return (
        <div className="p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Обновление товаров Qogita</h2>

            <div className="space-y-4">
                {/* Error Message */}
                {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                )}

                {/* Update Status */}
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
                                <p>✅ Загружено товаров: {status.result.count || 0}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3">
                    <button
                        onClick={handleUpdate}
                        disabled={updating}
                        className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                        {updating ? 'Обновление...' : 'Обновить каталог'}
                    </button>
                </div>
            </div>
        </div>
    );
}
