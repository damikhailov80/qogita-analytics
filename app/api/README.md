# API Documentation

## Endpoints

### GET /api/products

Получение списка продуктов с пагинацией, сортировкой и фильтрацией по брендам.

#### Query параметры

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `page` | number | 1 | Номер страницы (минимум 1) |
| `pageSize` | number | 20 | Размер страницы (максимум 50) |
| `sortField` | string | 'id' | Поле для сортировки |
| `sortOrder` | string | 'asc' | Порядок сортировки ('asc' или 'desc') |
| `whitelist` | string | - | Список брендов для включения (через запятую) |
| `blacklist` | string | - | Список брендов для исключения (через запятую) |

#### Доступные поля для сортировки

- `id` - ID продукта
- `name` - Название
- `brand` - Бренд
- `category` - Категория
- `lowestPrice` - Минимальная цена
- `createdAt` - Дата создания
- `updatedAt` - Дата обновления

#### Пример запроса

```bash
GET /api/products?page=1&pageSize=20&sortField=name&sortOrder=asc&whitelist=Nike,Adidas
```

#### Пример ответа

```json
{
  "data": [
    {
      "id": 1,
      "gtin": "12345678901234",
      "name": "Product Name",
      "category": "Category",
      "brand": "Brand",
      "lowestPrice": "99.99",
      "unit": "piece",
      "lowestPricedOfferInventory": 100,
      "isPreOrder": false,
      "estimatedDeliveryTimeWeeks": 2,
      "numberOfOffers": 5,
      "totalInventoryAllOffers": 500,
      "productUrl": "https://example.com/product",
      "imageUrl": "https://example.com/image.jpg",
      "createdAt": "2026-03-17T00:00:00.000Z",
      "updatedAt": "2026-03-17T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "sort": {
    "field": "name",
    "order": "asc"
  }
}
```

#### Коды ответов

- `200` - Успешный запрос
- `400` - Неверные параметры запроса
- `500` - Внутренняя ошибка сервера

---

### POST /api/products/search

Расширенный поиск продуктов с фильтрацией по брендам и категориям.

#### Body параметры

```json
{
  "page": 1,
  "pageSize": 20,
  "sortField": "name",
  "sortOrder": "asc",
  "whitelist": ["Nike", "Adidas"],
  "blacklist": ["Puma"],
  "categoryWhitelist": ["Shoes", "Clothing"],
  "categoryBlacklist": ["Accessories"]
}
```

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `page` | number | 1 | Номер страницы |
| `pageSize` | number | 20 | Размер страницы |
| `sortField` | string | 'id' | Поле для сортировки |
| `sortOrder` | string | 'asc' | Порядок сортировки |
| `whitelist` | string[] | [] | Бренды для включения |
| `blacklist` | string[] | [] | Бренды для исключения |
| `categoryWhitelist` | string[] | [] | Категории для включения |
| `categoryBlacklist` | string[] | [] | Категории для исключения |

#### Пример ответа

Формат ответа аналогичен GET /api/products.

---

### POST /api/products/export

Экспорт продуктов в CSV с учётом фильтров.

#### Body параметры

```json
{
  "whitelist": ["Nike", "Adidas"],
  "blacklist": ["Puma"],
  "categoryWhitelist": ["Shoes"],
  "categoryBlacklist": ["Accessories"]
}
```

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `whitelist` | string[] | [] | Бренды для включения |
| `blacklist` | string[] | [] | Бренды для исключения |
| `categoryWhitelist` | string[] | [] | Категории для включения |
| `categoryBlacklist` | string[] | [] | Категории для исключения |

#### Пример ответа

Возвращает CSV файл с заголовками:
- GTIN
- Name
- Category
- Brand
- € Lowest Price inc. shipping
- Unit
- Lowest Priced Offer Inventory
- Is a pre-order?
- Estimated Delivery Time (weeks)
- Number of Offers
- Total Inventory of All Offers
- Product URL
- Image URL

---

### GET /api/brands

Получение списка всех брендов с количеством продуктов.

#### Пример ответа

```json
[
  {
    "name": "Nike",
    "product_count": 150
  },
  {
    "name": "Adidas",
    "product_count": 120
  }
]
```

---

### GET /api/categories

Получение списка всех категорий с количеством продуктов.

#### Пример ответа

```json
[
  {
    "name": "Shoes",
    "product_count": 200
  },
  {
    "name": "Clothing",
    "product_count": 180
  }
]
```

---

### GET /api/updates

Получение истории всех обновлений каталога.

#### Пример ответа

```json
[
  {
    "id": 1,
    "name": "qogita",
    "status": "success",
    "progress": 100,
    "message": "Успешно загружено 5000 продуктов",
    "startedAt": "2026-03-16T20:49:29.911Z",
    "updatedAt": "2026-03-16T20:55:00.000Z"
  }
]
```

---

### GET /api/updates/qogita

Получение текущего статуса обновления каталога из Qogita API.

#### Пример ответа

```json
{
  "status": "running",
  "progress": 75,
  "message": "Загружено 750/1000 продуктов...",
  "startedAt": "2026-03-18T10:00:00.000Z",
  "updatedAt": "2026-03-18T10:05:00.000Z"
}
```

#### Возможные статусы

- `idle` - Обновление еще не запускалось
- `running` - Обновление выполняется
- `success` - Обновление завершено успешно
- `error` - Произошла ошибка

---

### POST /api/updates/qogita

Запуск процесса обновления каталога продуктов из Qogita API.

#### Процесс обновления

1. Аутентификация в Qogita API (10%)
2. Загрузка каталога продуктов (30%)
3. Парсинг CSV данных (50%)
4. Удаление старых данных из БД (60%)
5. Загрузка новых данных батчами по 1000 записей (70-95%)
6. Завершение (100%)

#### Пример успешного ответа

```json
{
  "message": "Обновление запущено",
  "status": "running"
}
```

#### Пример ответа при ошибке (409)

```json
{
  "error": "Обновление уже выполняется. Дождитесь завершения текущего обновления."
}
```

#### Важно

- Нельзя запустить новое обновление, пока не завершится текущее
- Процесс может занять несколько минут
- Используйте GET /api/updates/qogita для отслеживания прогресса

#### Настройка

Добавьте в `.env`:

```env
QOGITA_API_BASE_URL="https://api.qogita.com"
QOGITA_EMAIL="your-email@example.com"
QOGITA_PASSWORD="your-password"
```
