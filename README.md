# Qogita - Product Catalog

Next.js приложение с PostgreSQL базой данных для управления каталогом продуктов.

## Требования

- PostgreSQL 12+
- Node.js 18+

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
```

3. Примените схему к базе данных:
```bash
npm run db:push
```

## Команды

- `npm run dev` - Запуск dev сервера
- `npm run build` - Сборка проекта
- `npm run start` - Запуск production сервера
- `npm run db:push` - Применение схемы к БД
- `npm run db:studio` - Открытие Prisma Studio

## Структура таблицы products

- `gtin` - Уникальный идентификатор товара (GTIN)
- `name` - Название товара
- `category` - Категория товара
- `brand` - Бренд товара
- `lowestPriceIncShipping` - Минимальная цена с доставкой (€)
- `unit` - Единица измерения
- `lowestPricedOfferInventory` - Количество товара по минимальной цене
- `isPreOrder` - Является ли товар предзаказом
- `estimatedDeliveryTimeWeeks` - Ожидаемое время доставки (недели)
- `numberOfOffers` - Количество предложений
- `totalInventoryAllOffers` - Общее количество товара по всем предложениям
- `productUrl` - URL товара
- `imageUrl` - URL изображения товара
- `createdAt` - Дата создания записи
- `updatedAt` - Дата последнего обновления
