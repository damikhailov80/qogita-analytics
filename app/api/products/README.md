# Products API

## Allegro Products Upload (Async)

Асинхронная загрузка продуктов Allegro через CSV файл с использованием BullMQ и Redis.

### Endpoints

#### POST /api/products/allegro/upload
Загружает CSV файл и создает асинхронную задачу для обработки.

**Request:**
```bash
curl -X POST http://localhost:3000/api/products/allegro/upload \
  -F "file=@products.csv"
```

**Response:**
```json
{
  "success": true,
  "jobId": "1",
  "message": "Upload job created successfully"
}
```

#### GET /api/products/allegro/upload?jobId={jobId}
Проверяет статус задачи загрузки.

**Request:**
```bash
curl http://localhost:3000/api/products/allegro/upload?jobId=1
```

**Response:**
```json
{
  "jobId": "1",
  "state": "completed",
  "progress": 100,
  "logs": [
    "Processing file: products.csv (2.5 MB)",
    "Estimated ~500 rows based on first 10 rows (avg 120 bytes/row)",
    "Processed 100 products, ignored 5 rows",
    "Processed 200 products, ignored 12 rows",
    "Successfully processed 450 products from 500 rows (50 ignored)"
  ],
  "result": {
    "success": true,
    "count": 450,
    "totalRows": 500,
    "ignoredRows": 50,
    "fileName": "products.csv"
  },
  "error": null,
  "createdAt": 1234567890,
  "processedAt": 1234567891,
  "finishedAt": 1234567900
}
```

**Job States:**
- `waiting` - задача в очереди
- `active` - задача обрабатывается
- `completed` - задача завершена успешно
- `failed` - задача завершена с ошибкой
- `delayed` - задача отложена

#### GET /api/products/allegro
Получает все продукты Allegro.

**Request:**
```bash
curl http://localhost:3000/api/products/allegro
```

### CSV Format

CSV файл должен содержать следующие колонки:
- `GTIN` - уникальный идентификатор продукта
- `traffic` - количество продаж в формате "N osoby" (например "2 osoby")
- `price_netto` - цена продукта в формате "N,NN zł" (например "80,49 zł")

**Пример CSV:**
```csv
GTIN,is_exists_cataloque,is_exists_traffic,traffic,price_netto,checking_date
773602420667,TRUE,TRUE,2 osoby,80,49 zł,Thu Mar 19 2026 16:42:17 GMT+0100
773602593040,TRUE,TRUE,5 osoby,149,02 zł,Thu Mar 19 2026 16:42:17 GMT+0100
```

**Правила обработки:**
- Строки где `traffic` не начинается с числа (например "dostawa w sobotę") - пропускаются
- Из `traffic` извлекается только число (например "2 osoby" → 2)
- Из `price_netto` извлекается число с заменой запятой на точку (например "80,49 zł" → 80.49)

### Setup

1. Установите и запустите Redis:
```bash
# macOS
brew install redis
brew services start redis

# Проверьте что Redis работает
redis-cli ping
# Должен вернуть: PONG

# Docker
docker run -d -p 6379:6379 redis:alpine
```

2. Убедитесь что переменные окружения настроены в `.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

3. Запустите Worker в отдельном терминале:
```bash
npm run worker
```

4. Запустите Next.js приложение:
```bash
npm run dev
```

### Managing Worker

**Остановка Worker:**
```bash
# Graceful shutdown (рекомендуется)
Ctrl+C в терминале где запущен Worker
```

**Если Worker завис:**
```bash
# Найти процесс
ps aux | grep start-worker

# Убить принудительно
kill -9 <PID>
```

### Architecture

```
Client → POST /upload → Queue (Redis) → Worker → Database
                ↓
         Returns jobId
                ↓
Client → GET /upload?jobId=X → Check Status
```

Worker обрабатывает задачи батчами по 100 записей и обновляет прогресс в реальном времени.
