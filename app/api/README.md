# API Documentation

## Endpoints

### GET /api/products

Получение списка продуктов с пагинацией и сортировкой.

#### Query параметры

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|--------------|----------|
| `page` | number | 1 | Номер страницы (минимум 1) |
| `pageSize` | number | 20 | Размер страницы (максимум 50) |
| `sortField` | string | 'id' | Поле для сортировки |
| `sortOrder` | string | 'asc' | Порядок сортировки ('asc' или 'desc') |

#### Доступные поля для сортировки

- `id` - ID продукта
- `name` - Название
- `brand` - Бренд
- `category` - Категория
- `lowestPriceIncShipping` - Минимальная цена с доставкой
- `createdAt` - Дата создания
- `updatedAt` - Дата обновления

#### Пример запроса

```bash
GET /api/products?page=1&pageSize=20&sortField=name&sortOrder=asc
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
      "lowestPriceIncShipping": "99.99",
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

### GET /api/updates

Получение информации об обновлениях каталога.

#### Пример ответа

```json
{
  "lastUpdate": "2026-03-16T20:49:29.911Z"
}
```
