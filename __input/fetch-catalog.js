import QogitaAPIClient from '../lib/api-client.js';
import fs from 'fs/promises';
import path from 'path';

async function fetchCatalog() {
    const client = new QogitaAPIClient();

    try {
        console.log('Начинаем загрузку каталога...\n');

        // Аутентификация
        await client.authenticate();

        // Получение каталога
        console.log('Загрузка каталога продуктов...');
        const catalogCSV = await client.getCatalog();

        // Создание директории для каталога
        const catalogDir = path.join(process.cwd(), 'catalog');
        await fs.mkdir(catalogDir, { recursive: true });

        // Сохранение каталога в CSV файл
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `catalog-${timestamp}.csv`;
        const filepath = path.join(catalogDir, filename);

        await fs.writeFile(filepath, catalogCSV);

        console.log(`\n✓ Каталог успешно сохранен: ${filename}`);
        console.log(`  Путь: ${filepath}`);

        // Вывод статистики
        const lines = catalogCSV.split('\n').filter(line => line.trim());
        console.log(`  Количество строк: ${lines.length}`);
        console.log(`  Количество продуктов: ${lines.length - 1}`); // минус заголовок

    } catch (error) {
        console.error('\n✗ Ошибка при загрузке каталога:', error.message);
        process.exit(1);
    }
}

fetchCatalog();
