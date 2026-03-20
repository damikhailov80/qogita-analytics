'use client';

import BaseUpdate from './base-update';

export default function QogitaUpdate() {
    return (
        <BaseUpdate
            title="Обновление товаров Qogita"
            logEndpoint="/api/logs/qogita"
            updateEndpoint="/api/products/qogita/update"
            confirmMessage={
                '⚠️ ВНИМАНИЕ!\n\n' +
                '• Все существующие товары Qogita будут удалены из базы данных\n' +
                '• Обновление может занять продолжительное время\n' +
                '• Не закрывайте страницу до завершения операции\n\n' +
                'Продолжить?'
            }
            buttonText="Обновить каталог"
            buttonTextLoading="Обновление..."
            requiresFile={false}
            renderResult={(result) => (
                <div className="text-sm text-green-600 dark:text-green-400">
                    <p>✅ Загружено товаров: {result.count || 0}</p>
                </div>
            )}
        />
    );
}
