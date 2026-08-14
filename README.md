# Реестр отчётов - Cloudflare Workers + D1

## Настройка и запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Аутентификация в Cloudflare

```bash
npx wrangler login
```

### 3. Создание D1 базы данных

```bash
npx wrangler d1 create registry-db
```

После создания скопируйте `database_id` из вывода и обновите `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "registry-db"
database_id = "ВАШ_DATABASE_ID"
```

### 4. Инициализация базы данных

Для локальной разработки:
```bash
npm run db:init
```

Для продакшена:
```bash
npm run db:prod:init
```

### 5. Локальная разработка

```bash
npm run dev
```

Сервер запустится на `http://localhost:8787`

### 6. Деплой

```bash
npm run deploy
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Регистрация нового пользователя
  ```json
  { "email": "user@example.com", "password": "secret123", "name": "Имя" }
  ```

- `POST /api/auth/login` - Вход
  ```json
  { "email": "user@example.com", "password": "secret123" }
  ```

- `GET /api/auth/me` - Получить текущего пользователя (требуется токен)

### Reports

- `GET /api/reports` - Список отчётов текущего пользователя
- `GET /api/reports/:id` - Получить отчёт по ID
- `POST /api/reports` - Создать новый отчёт
- `PUT /api/reports/:id` - Обновить отчёт
- `DELETE /api/reports/:id` - Удалить отчёт

### Situations

- `GET /api/reports/:id/situations` - Получить все ситуации отчёта
- `POST /api/reports/:id/situations` - Добавить ситуацию
- `PUT /api/situations/:id` - Обновить ситуацию
- `DELETE /api/situations/:id` - Удалить ситуацию

## Безопасность

- Пароли хешируются с помощью PBKDF2 с солью
- JWT токены используются для аутентификации
- Все данные изолированы по пользователям
- CORS настроен для защиты от межсайтовых запросов

## Структура проекта

```
/workspace
├── index.html          # Фронтенд приложение
├── src/
│   └── worker.js       # Cloudflare Worker (бэкенд)
├── schema.sql          # Схема базы данных
├── wrangler.toml       # Конфигурация Wrangler
├── package.json        # Зависимости и скрипты
└── README.md           # Этот файл
```
