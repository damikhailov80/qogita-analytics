# API Documentation

## Endpoints

### GET /api/brands

Получение списка всех брендов с количеством элементов.

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

Получение списка всех категорий с количеством элементов.

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

### GET /api/logs/[name]

Получение последних 10 логов воркера (allegro или qogita).

#### Параметры

- `name` - тип воркера: `allegro` или `qogita`

#### Примеры запросов

```bash
GET /api/logs/allegro
GET /api/logs/qogita
```

#### Пример ответа

```json
[
  {
    "id": 1,
    "workerType": "qogita-update",
    "status": "success",
    "message": "Обновление завершено успешно",
    "details": { "productsCount": 5000 },
    "createdAt": "2026-03-18T10:00:00.000Z"
  }
]
```

---

## Products API

### GET /api/products/qogita

Получение продуктов Qogita с фильтрацией через query параметры.

#### Query параметры

- `page` - номер страницы (по умолчанию: 1)
- `pageSize` - размер страницы (по умолчанию: 20)
- `sortField` - поле для сортировки (по умолчанию: id)
- `sortOrder` - порядок сортировки: asc/desc (по умолчанию: asc)
- `whitelist` - бренды для включения (через запятую)
- `blacklist` - бренды для исключения (через запятую)

#### Пример запроса

```bash
GET /api/products/qogita?page=1&pageSize=20&whitelist=Nike,Adidas
```

---

### POST /api/products/qogita/search

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

#### Пример ответа

```json
{
  "products": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

### POST /api/products/qogita/export

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

#### Ответ

Возвращает CSV файл с заголовками:
- GTIN, Name, Category, Brand, € Lowest Price inc. shipping, Unit, и др.

---

### POST /api/products/qogita/update

Запуск асинхронного обновления каталога Qogita через BullMQ.

#### Пример успешного ответа

```json
{
  "success": true,
  "jobId": "1",
  "message": "Обновление запущено"
}
```

#### Пример ответа при ошибке (409)

```json
{
  "error": "Обновление уже в очереди или выполняется"
}
```

#### Важно

- Нельзя запустить новое обновление, пока не завершится текущее
- Процесс выполняется асинхронно через Worker
- Используйте GET /api/products/qogita/update для отслеживания прогресса

---

### GET /api/products/qogita/update

Получение статуса последней задачи обновления Qogita.

#### Пример ответа

```json
{
  "jobId": "1",
  "state": "completed",
  "progress": 100,
  "logs": [
    "Аутентификация в Qogita API...",
    "Загрузка каталога...",
    "Обработано 5000 продуктов"
  ],
  "result": {
    "success": true,
    "productsCount": 5000
  },
  "error": null,
  "createdAt": 1234567890,
  "processedAt": 1234567891,
  "finishedAt": 1234567900
}
```

#### Возможные состояния (state)

- `waiting` - задача в очереди
- `active` - задача обрабатывается
- `completed` - задача завершена успешно
- `failed` - задача завершена с ошибкой
- `delayed` - задача отложена

#### Настройка

Добавьте в `.env`:

```env
QOGITA_API_BASE_URL="https://api.qogita.com"
QOGITA_EMAIL="your-email@example.com"
QOGITA_PASSWORD="your-password"
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Offers API

### GET /api/offers

Получение всех offers для конкретного продукта по GTIN.

#### Query параметры

- `gtin` - GTIN продукта (обязательный)

#### Пример запроса

```bash
GET /api/offers?gtin=1234567890123
```

#### Пример ответа

```json
{
  "gtin": "1234567890123",
  "product": {
    "name": "Product Name",
    "brand": "Brand Name",
    "category": "Category",
    "imageUrl": "https://..."
  },
  "offersCount": 5,
  "offers": [
    {
      "id": 1,
      "price": "10.50",
      "priceCurrency": "EUR",
      "inventory": 100,
      "seller": {
        "code": "SELLER1",
        "minOrderValue": "500.00",
        "currency": "EUR"
      },
      "updatedAt": "2026-03-18T10:00:00.000Z"
    }
  ]
}
```

---

### POST /api/offers/update

Обновление offers для конкретного продукта по GTIN.

#### Body параметры

```json
{
  "gtin": "1234567890123"
}
```

#### Пример ответа

```json
{
  "success": true,
  "gtin": "1234567890123",
  "offersFromQogita": 5,
  "sellersCreated": 2,
  "sellersUpdated": 3,
  "offersCreated": 3,
  "offersUpdated": 2,
  "errors": []
}
```

---

### POST /api/offers/updateall

Запуск массового обновления всех offers для продуктов из `products_allegro`.

#### Процесс работы

1. Получает все GTIN из таблицы `products_allegro`
2. Удаляет все существующие offers для этих GTIN
3. Для каждого продукта с `productUrl` получает актуальные offers от Qogita API
4. Создает/обновляет sellers и offers в базе данных
5. Удаляет sellers без offers

#### Обработка Rate Limit

Worker автоматически обрабатывает rate limit от Qogita API:
- При получении ошибки "Rate limit exceeded" worker делает паузу на указанное время + 5 минут
- Состояние сохраняется в Redis перед паузой
- После паузы worker автоматически продолжает с того места где остановился
- Состояние хранится в Redis 24 часа и автоматически очищается после успешного завершения

#### Пример успешного ответа

```json
{
  "success": true,
  "jobId": "1",
  "message": "Обновление всех offers запущено"
}
```

#### Пример ответа при ошибке (409)

```json
{
  "error": "Обновление уже в очереди или выполняется"
}
```

#### Важно

- Нельзя запустить новое обновление, пока не завершится текущее
- Процесс выполняется асинхронно через Worker
- Используйте GET /api/offers/updateall для отслеживания прогресса

---

### GET /api/offers/updateall

Получение статуса последней задачи массового обновления offers.

#### Пример ответа

```json
{
  "jobId": "1",
  "state": "completed",
  "progress": 100,
  "logs": [
    "Starting offers update for all products from products_allegro",
    "Found 150 GTINs in products_allegro",
    "Deleted 500 existing offers",
    "Processing 150 products...",
    "Successfully processed 150 products"
  ],
  "result": {
    "success": true,
    "count": 150,
    "offersDeleted": 500,
    "offersCreated": 450,
    "offersUpdated": 50,
    "sellersCreated": 20,
    "sellersUpdated": 30,
    "sellersDeleted": 5,
    "errors": []
  },
  "error": null,
  "createdAt": 1234567890,
  "processedAt": 1234567891,
  "finishedAt": 1234567900
}
```

#### Возможные состояния (state)

- `waiting` - задача в очереди
- `active` - задача обрабатывается
- `completed` - задача завершена успешно
- `failed` - задача завершена с ошибкой

---

## Allegro Products API

### POST /api/products/allegro/update

Загрузка CSV файла с данными Allegro (GTIN, traffic, price_netto).

#### Формат запроса

- Content-Type: `multipart/form-data`
- Поле: `file` (CSV файл)

#### Пример успешного ответа

```json
{
  "success": true,
  "jobId": "1",
  "message": "Upload job created successfully"
}
```

#### Важно

- CSV файл должен содержать колонки: GTIN, traffic, price_netto
- Процесс выполняется асинхронно через Worker
- Используйте GET /api/products/allegro/update для отслеживания прогресса

---

### GET /api/products/allegro/update

Получение статуса последней задачи загрузки Allegro.

#### Пример ответа

```json
{
  "jobId": "1",
  "state": "completed",
  "progress": 100,
  "logs": [
    "Processing file: allegro-data.csv (2.50 MB)",
    "Deleted 1000 existing products",
    "Processed 1500 products, ignored 50 rows"
  ],
  "result": {
    "success": true,
    "count": 1500,
    "totalRows": 1550,
    "ignoredRows": 50,
    "fileName": "allegro-data.csv"
  },
  "error": null,
  "createdAt": 1234567890,
  "processedAt": 1234567891,
  "finishedAt": 1234567900
}
```
