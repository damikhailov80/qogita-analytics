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
