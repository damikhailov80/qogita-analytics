# Qogita - Product Management

Next.js приложение с PostgreSQL базой данных для управления каталогом продуктов.

## Требования

- PostgreSQL 12+
- Node.js 18+
- Redis 6+

## Установка

```bash
npm install
```

## Настройка базы данных

1. Создайте базу данных PostgreSQL:
```sql
CREATE DATABASE qogita;
```

2. Обновите `.env` файл с вашими данными подключения:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/qogita?schema=public"
REDIS_HOST="localhost"
REDIS_PORT="6379"
```

3. Примените миграции к базе данных:
```bash
# Для разработки (создает БД и применяет миграции)
npm run db:migrate:dev

# Для production (только применяет существующие миграции)
npm run db:migrate
```

## Команды

### Приложение
- `npm run dev` - Запуск dev сервера
- `npm run build` - Сборка проекта
- `npm run start` - Запуск production сервера

### База данных
- `npm run db:migrate:dev` - Применить миграции (для разработки)
- `npm run db:migrate` - Применить миграции (для production)
- `npm run db:push` - Синхронизация схемы без миграций (не рекомендуется)
- `npm run db:reset` - Очистка всей базы
- `npm run db:generate` - Генерация Prisma Client
- `npm run db:studio` - GUI для просмотра данных

### Воркеры
- `npm run worker` - Запуск всех воркеров (Allegro, Qogita, Offers)

### Redis
- `npm run redis:start` - Запуск Redis сервера
- `npm run redis:stop` - Остановка Redis сервера
- `npm run redis:status` - Проверка статуса Redis
- `npm run redis:clear` - Очистка всех очередей BullMQ (безопасно)
- `npm run redis:flush` - Полная очистка Redis БД (удаляет ВСЕ данные!)

## Очистка застрявших задач

Если воркер завис или задача застряла:

```bash
# Безопасная очистка только очередей
npm run redis:clear

# Или полная очистка Redis (осторожно!)
npm run redis:flush
```

После очистки перезапустите воркеры:
```bash
npm run worker
```

## Структура таблицы products

- `gtin` - Уникальный идентификатор товара (GTIN)
- `name` - Название товара
- `category` - Категория товара
- `brand` - Бренд товара
- `lowestPrice` - Минимальная цена с доставкой (€)
- `unit` - Единица измерения
- `lowestPricedOfferInventory` - Количество товара по минимальной цене
- `isPreOrder` - Является ли товар предзаказом
- `estimatedDeliveryTimeWeeks` - Ожидаемое время доставки (недели)
- `numberOfOffers` - Количество предложений
- `totalInventoryAllOffers` - Общее количество товара по всем предложениям
- `productUrl` - URL товара
- `imageUrl` - URL изображения товара

## Materialized View: order_candidates

Представление для анализа прибыльных заказов с учетом ограничения стоимости закупки одного товара.

### Ключевые колонки:
- `total_cost` - Стоимость закупки товара с ограничением в 1000€. Если `price * inventory > 1000`, то используется 1000€
- `total_profit` - Прибыль с учетом ограничения стоимости закупки
- `cumulative_cost` - Накопительная стоимость по продавцу (отсортировано по убыванию прибыли)
- `reached_min_order` - Флаг достижения минимальной суммы заказа

### Логика расчета:
Для каждого товара `total_cost` рассчитывается с ограничением в 1000€:
- Если `price * inventory ≤ 1000`, то `total_cost = price * inventory`
- Если `price * inventory > 1000`, то `total_cost = 1000`

Это гарантирует, что один товар не будет превышать лимит в 1000€ при закупке.

### Обновление view:
```bash
REFRESH MATERIALIZED VIEW order_candidates;
```
