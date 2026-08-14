# Настройка Cloudflare D1 и развёртывание

## 1. Инициализация базы данных D1

```bash
# Создайте базу данных D1
wrangler d1 create registry-db

# После создания скопируйте database_id из вывода и вставьте в wrangler.toml
# Замените YOUR_DATABASE_ID_HERE на реальный ID
```

## 2. Инициализация схемы БД

```bash
# Для локальной разработки
npm run db:init

# Для продакшена
npm run db:prod:init
```

## 3. Настройка JWT_SECRET

Откройте `wrangler.toml` и замените секретный ключ на случайную строку:

```toml
[vars]
JWT_SECRET = "ваш-уникальный-секретный-ключ-минимум-32-символа"
```

## 4. Локальная разработка

```bash
npm install
npm run dev
```

Приложение будет доступно по адресу `http://localhost:8787`

Страницы:
- `/` - главная страница (список отчётов)
- `/auth` - страница входа/регистрации

## 5. Развёртывание в Cloudflare

```bash
npm run deploy
```

## API Endpoints

### Публичные (без авторизации)
- `POST /api/register` - регистрация нового пользователя
- `POST /api/login` - вход в систему

### Защищённые (требуется JWT токен)
- `GET /api/me` - получить данные текущего пользователя
- `GET /api/reports` - список отчётов пользователя
- `POST /api/reports` - создать отчёт
- `DELETE /api/reports/:id` - удалить отчёт
- `GET /api/situations/:reportId` - получить ситуации отчёта
- `POST /api/situations` - создать ситуацию
- `PUT /api/situations/:id` - обновить ситуацию
- `DELETE /api/situations/:id` - удалить ситуацию

## Примеры запросов

### Регистрация
```bash
curl -X POST http://localhost:8787/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123","name":"Иван"}'
```

### Вход
```bash
curl -X POST http://localhost:8787/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secret123"}'
```

### Создание отчёта (с токеном)
```bash
curl -X POST http://localhost:8787/api/reports \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"title":"Мой новый отчёт"}'
```

## Структура базы данных

### users
- `id` TEXT PRIMARY KEY
- `email` TEXT UNIQUE NOT NULL
- `password_hash` TEXT NOT NULL
- `name` TEXT
- `created_at` INTEGER

### reports
- `id` TEXT PRIMARY KEY
- `title` TEXT NOT NULL
- `code` TEXT NOT NULL
- `date` TEXT NOT NULL
- `progress` INTEGER DEFAULT 0
- `user_id` TEXT NOT NULL (foreign key → users.id)
- `created_at` INTEGER

### situations
- `id` TEXT PRIMARY KEY
- `report_id` TEXT NOT NULL (foreign key → reports.id)
- `subsection` TEXT NOT NULL
- `url` TEXT NOT NULL
- `description` TEXT
- `created_at` INTEGER
