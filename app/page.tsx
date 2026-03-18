'use client';

import Link from "next/link";
import { useEffect, useState } from "react";

interface Update {
  name: string;
  status: string;
  progress: number;
  message: string | null;
  updatedAt: string;
}

interface UpdateStatus {
  status: string;
  progress: number;
  message: string | null;
  startedAt?: string;
  updatedAt?: string;
}

export default function Home() {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUpdates();
    fetchUpdateStatus();
  }, []);

  const fetchUpdates = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/updates');
      if (!response.ok) throw new Error('Failed to fetch updates');
      const data = await response.json();
      setUpdates(data);
    } catch (err) {
      setError('Не удалось подключиться к базе данных');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpdateStatus = async () => {
    try {
      const response = await fetch('/api/updates/qogita');
      if (!response.ok) throw new Error('Failed to fetch update status');
      const data = await response.json();
      setUpdateStatus(data);

      // Если обновление в процессе, продолжаем опрос
      if (data.status === 'running') {
        setUpdating(true);
        pollUpdateStatus();
      }
    } catch (err) {
      console.error('Error fetching update status:', err);
    }
  };

  const handleUpdate = async () => {
    if (!confirm('Загрузка данных может занять несколько минут. Продолжить?')) {
      return;
    }

    try {
      setUpdating(true);
      setError(null);

      const response = await fetch('/api/updates/qogita', {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start update');
      }

      // Начинаем опрос статуса
      pollUpdateStatus();
    } catch (err: any) {
      setError(err.message || 'Ошибка при запуске обновления');
      console.error(err);
      setUpdating(false);
    }
  };

  const pollUpdateStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/updates/qogita');
        const data = await response.json();
        setUpdateStatus(data);

        if (data.status === 'success') {
          clearInterval(interval);
          setUpdating(false);
          alert('Данные успешно обновлены!');
          await fetchUpdates();
        } else if (data.status === 'error') {
          clearInterval(interval);
          setUpdating(false);
          setError(data.message || 'Ошибка при обновлении данных');
        }
        // Если status === 'running', продолжаем опрос
      } catch (err) {
        console.error('Error polling status:', err);
      }
    }, 2000); // Опрос каждые 2 секунды

    // Останавливаем опрос через 10 минут на случай зависания
    setTimeout(() => {
      clearInterval(interval);
      if (updating) {
        setUpdating(false);
        setError('Превышено время ожидания обновления');
      }
    }, 600000);
  };

  const lastUpdate = updates.length > 0 ? updates[0] : null;

  return (
    <div className="container mx-auto py-20">
      <div className="max-w-2xl">
        <h1 className="text-4xl font-bold mb-4">Welcome to Qogita</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 mb-8">
          Product catalog management system
        </p>

        {/* Database Status */}
        <div className="mb-8 p-6 border border-zinc-200 dark:border-zinc-800 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Состояние базы данных</h2>

          {loading ? (
            <p className="text-zinc-600 dark:text-zinc-400">Проверка подключения...</p>
          ) : error ? (
            <div>
              <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
              <button
                onClick={fetchUpdates}
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                Повторить попытку
              </button>
            </div>
          ) : (
            <div>
              {lastUpdate && (
                <p className="text-zinc-600 dark:text-zinc-400 mb-2">
                  Последнее обновление: {new Date(lastUpdate.updatedAt).toLocaleString('ru-RU')}
                </p>
              )}

              {/* Update Status */}
              {updateStatus && updateStatus.status !== 'idle' && (
                <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">
                      Статус: {
                        updateStatus.status === 'running' ? '🔄 Выполняется' :
                          updateStatus.status === 'success' ? '✅ Успешно' :
                            updateStatus.status === 'error' ? '❌ Ошибка' :
                              '⏸️ Ожидание'
                      }
                    </span>
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">
                      {updateStatus.progress}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-zinc-900 dark:bg-zinc-50 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${updateStatus.progress}%` }}
                    />
                  </div>

                  {updateStatus.message && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {updateStatus.message}
                    </p>
                  )}
                </div>
              )}

              {!lastUpdate ? (
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  Данные отсутствуют. Загрузите каталог продуктов.
                </p>
              ) : null}

              <button
                onClick={handleUpdate}
                disabled={updating}
                className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-6 text-sm font-medium text-zinc-50 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {updating ? 'Обновление...' : lastUpdate ? 'Обновить данные' : 'Загрузить данные'}
              </button>
            </div>
          )}
        </div>

        <Link
          href="/catalog"
          className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-8 text-sm font-medium text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          View Catalog
        </Link>
      </div>
    </div>
  );
}
