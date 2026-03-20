'use client';

import BaseUpdate from './base-update';

export default function AllegroUpdate() {
    return (
        <BaseUpdate
            title="Обновление товаров Allegro"
            logEndpoint="/api/logs/allegro"
            updateEndpoint="/api/products/allegro/update"
            confirmMessage={
                '⚠️ ВНИМАНИЕ!\n\n' +
                '• Все существующие товары Allegro будут удалены из базы данных\n' +
                '• Обработка файла может занять продолжительное время\n' +
                '• Не закрывайте страницу до завершения операции\n\n' +
                'Продолжить?'
            }
            buttonText="Обновить каталог"
            buttonTextLoading="Обновление..."
            requiresFile={true}
            acceptedFileTypes=".csv"
        />
    );
}
