'use client';

import BaseUpdate from './base-update';

export default function OffersUpdate() {
    return (
        <BaseUpdate
            title="Обновление всех Offers для Allegro"
            logEndpoint="/api/logs/offers-updateall"
            updateEndpoint="/api/offers/updateall"
            confirmMessage={
                '⚠️ ВНИМАНИЕ!\n\n' +
                '• Все существующие offers для товаров из products_allegro будут удалены\n' +
                '• Будут загружены актуальные offers от Qogita API\n' +
                '• Sellers без offers будут удалены из базы данных\n' +
                '• Обновление может занять продолжительное время\n' +
                '• Не закрывайте страницу до завершения операции\n\n' +
                'Продолжить?'
            }
            buttonText="Обновить все offers"
            buttonTextLoading="Обновление..."
            requiresFile={false}
            renderResult={(result) => (
                <div className="text-sm space-y-1">
                    <p className="text-green-600 dark:text-green-400">
                        ✅ Обработано продуктов: {result.count || 0}
                    </p>
                    {result.offersDeleted !== undefined && (
                        <p className="text-zinc-600 dark:text-zinc-400">
                            🗑️ Удалено старых offers: {result.offersDeleted}
                        </p>
                    )}
                    {result.offersCreated !== undefined && (
                        <p className="text-blue-600 dark:text-blue-400">
                            ➕ Создано offers: {result.offersCreated}
                        </p>
                    )}
                    {result.offersUpdated !== undefined && (
                        <p className="text-blue-600 dark:text-blue-400">
                            🔄 Обновлено offers: {result.offersUpdated}
                        </p>
                    )}
                    {result.sellersCreated !== undefined && (
                        <p className="text-purple-600 dark:text-purple-400">
                            ➕ Создано sellers: {result.sellersCreated}
                        </p>
                    )}
                    {result.sellersUpdated !== undefined && (
                        <p className="text-purple-600 dark:text-purple-400">
                            🔄 Обновлено sellers: {result.sellersUpdated}
                        </p>
                    )}
                    {result.sellersDeleted !== undefined && result.sellersDeleted > 0 && (
                        <p className="text-orange-600 dark:text-orange-400">
                            🗑️ Удалено sellers без offers: {result.sellersDeleted}
                        </p>
                    )}
                    {result.errors && result.errors.length > 0 && (
                        <p className="text-red-600 dark:text-red-400">
                            ⚠️ Ошибок: {result.errors.length}
                        </p>
                    )}
                </div>
            )}
        />
    );
}
