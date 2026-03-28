# TutorFlow MVP

Full-stack платформа для репетитора на `Next.js`, `TypeScript`, `Tailwind CSS`, `PostgreSQL` и `Prisma`.

Главная модель проекта:

- список тем общий для всех учеников;
- каждая тема содержит описание, файлы и список номеров;
- прогресс по номерам у каждого ученика индивидуальный;
- преподаватель видит прогресс каждого ученика по каждой теме.

## Стек

- `Next.js 15`
- `TypeScript`
- `Tailwind CSS`
- `PostgreSQL`
- `Prisma`
- cookie-based auth с ролями `TEACHER` и `STUDENT`
- локальный storage-адаптер для файлов с подготовкой к замене на S3-совместимое хранилище

## Реализовано

### Ученик

- вход в личный кабинет
- просмотр списка всех тем
- переход на страницу темы
- просмотр названия и описания темы
- блок `Теория` с открытием файла в браузере и скачиванием
- блок `Домашнее задание` с открытием файла в браузере и скачиванием
- список номеров домашнего задания
- выбор статуса по каждому номеру:
  - `GREEN` — решен с первого раза и правильно
  - `YELLOW` — сначала была ошибка, но ученик сам её нашёл и исправил
  - `RED` — ученик не понимает, как решать номер
- сохранение статусов в базе данных
- повторное отображение сохранённых статусов после входа
- краткий прогресс по каждой теме

### Преподаватель

- вход в личный кабинет
- создание темы
- редактирование темы
- удаление темы
- загрузка файла теории
- загрузка файла домашнего задания
- замена файлов
- удаление файлов
- редактирование списка номеров
- просмотр прогресса каждого ученика по теме
- просмотр статусов всех номеров у каждого ученика

## Поддерживаемые файлы

- `PDF`
- `DOCX`
- `PNG`
- `JPG` / `JPEG`

Что происходит с файлами:

- локально файлы сохраняются в каталог `STORAGE_DIR`
- при наличии `BLOB_READ_WRITE_TOKEN` файлы автоматически сохраняются в `Vercel Blob`
- метаданные файла хранятся в PostgreSQL
- доступ к файлам идёт через защищённый route handler `/files/[fileId]`
- PDF отображается встроенно через `iframe`
- изображения отображаются прямо на странице
- DOCX можно открыть в отдельной вкладке или скачать

## Структура проекта

```text
app/
  (auth)/login/                  вход
  (dashboard)/dashboard/         общий обзор
  (dashboard)/student/           список тем ученика
  (dashboard)/student/topics/    страница темы ученика
  (dashboard)/teacher/           список тем и создание темы
  (dashboard)/teacher/topics/    редактирование темы и прогресс учеников
  files/[fileId]/route.ts        защищённая выдача файлов

actions/
  auth.ts                        вход и выход
  topic.ts                       CRUD тем, загрузка файлов, статусы номеров

components/
  file-resource-card.tsx         карточка файла с preview/download
  homework-status-badge.tsx      цветной badge статуса номера
  progress-bar.tsx               полоска прогресса
  stat-card.tsx                  summary-карточки

lib/
  auth.ts                        сессии и роли
  password.ts                    хеширование паролей
  platform-data.ts               агрегаты для кабинетов
  prisma.ts                      singleton Prisma Client
  storage.ts                     storage-адаптер
  utils.ts                       форматирование, статусы, парсинг номеров

prisma/
  schema.prisma                  схема базы данных
  seed.ts                        тестовые пользователи, темы, файлы, статусы
  migrations/                    миграции
```

## Схема базы данных

### Основные сущности

- `User`
  - пользователь
  - роли: `TEACHER`, `STUDENT`

- `Session`
  - серверные сессии для авторизации через cookie

- `StoredFile`
  - метаданные файла
  - хранит имя, путь в storage, MIME-тип, размер и дату загрузки

- `Topic`
  - общая тема для всех учеников
  - содержит название, описание, ссылку на файл теории и ссылку на файл домашнего задания

- `TopicHomeworkNumber`
  - номер домашнего задания внутри темы

- `StudentTopicNumberStatus`
  - индивидуальный статус конкретного номера у конкретного ученика

### Почему эта схема соответствует требованиям

- темы не привязаны к конкретному ученику и существуют в одном общем списке;
- статусы номеров живут отдельно и привязаны к `studentId + homeworkNumberId`;
- поэтому одна и та же тема может иметь разный прогресс у разных учеников;
- преподаватель может читать все статусы и строить прогресс по любому ученику.

## Роуты

- `/` — лендинг
- `/login` — вход
- `/dashboard` — обзор по роли
- `/student` — список тем ученика
- `/student/topics/[topicId]` — детальная страница темы ученика
- `/teacher` — список тем преподавателя и создание темы
- `/teacher/topics/[topicId]` — редактирование темы и прогресс учеников
- `/files/[fileId]` — защищённый просмотр/скачивание файла

## Переменные окружения

Скопируйте пример:

```bash
cp .env.example .env
```

Пример:

```env
# Docker example. Uses port 5433 to avoid conflicts with a local PostgreSQL on 5432.
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5433/tutor_mvp?schema=public"
# Local PostgreSQL example:
# DATABASE_URL="postgresql://YOUR_PG_USER@127.0.0.1:5432/tutor_mvp?schema=public"
SESSION_TTL_DAYS=30
# Optional for Vercel Blob in production. When set, files are stored in Blob instead of local disk.
# BLOB_READ_WRITE_TOKEN="vercel_blob_rw_..."
STORAGE_DIR="./storage/uploads"
```

## Запуск

### Вариант 1. Через Docker PostgreSQL

Требуется установленный Docker Desktop или совместимый `docker compose`.

```bash
docker compose up -d
cp .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Приложение будет доступно на:

- [http://localhost:3000](http://localhost:3000)

### Вариант 2. Локальный PostgreSQL

Если PostgreSQL уже установлен локально, достаточно:

1. создать базу `tutor_mvp`
2. прописать актуальный `DATABASE_URL` в `.env`, например `postgresql://YOUR_PG_USER@127.0.0.1:5432/tutor_mvp?schema=public`
3. выполнить те же команды `npm install`, `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, `npm run dev`

## Основные команды

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run db:generate
npm run db:migrate
npm run db:dev
npm run db:reset
npm run db:seed
```

## Публикация на GitHub

Проект уже подготовлен к публикации:

- локальные секреты остаются в `.env`, а в репозиторий идёт только `.env.example`
- `node_modules`, `.next`, `storage`, логи и IDE-файлы исключены через `.gitignore`
- добавлен workflow `.github/workflows/ci.yml`, который на GitHub проверяет `lint`, Prisma generate, миграции и `build`
- добавлены `.editorconfig` и `.gitattributes` для аккуратной истории и одинаковых переносов строк

Минимальная последовательность для первого пуша:

```bash
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git
git push -u origin main
```

Если репозиторий на GitHub уже создан через интерфейс, просто используйте его URL в `git remote add origin`.

## Vercel

Для Vercel в проекте уже включён запуск `prisma generate` во время `postinstall` и `build`, чтобы Prisma Client не ломался из-за кэша зависимостей.

Для рабочего деплоя на Vercel обязательно задайте:

- `DATABASE_URL` от внешней PostgreSQL-базы
- `SESSION_TTL_DAYS=30`
- `BLOB_READ_WRITE_TOKEN` от подключённого `Vercel Blob`

Важно:

- локальный `storage/uploads` используется только как fallback для локальной разработки
- на Vercel загрузка и выдача файлов должны идти через `Vercel Blob`

## Тестовые аккаунты

После `npm run db:seed` доступны:

- преподаватель: `teacher@example.com` / `teacher123`
- ученик: `ilya@example.com` / `student123`
- ученик: `maria@example.com` / `student123`

## Подготовка к деплою

В проект уже заложены важные для деплоя вещи:

- Prisma migrations лежат в репозитории
- route protection работает через middleware и server-side проверки ролей
- файлы выдаются не напрямую из `public`, а через защищённый route handler
- storage вынесен в отдельный слой `lib/storage.ts`
- для production можно заменить локальный storage на S3 / MinIO / Cloudflare R2 без переделки всей предметной логики

Что рекомендуется сделать на следующем этапе:

- заменить локальный storage на объектное хранилище
- добавить CSRF/allowed origins для server actions под конкретный домен
- добавить UI-ошибки загрузки файлов
- прикрутить аудит действий преподавателя
- вынести роли и пользователей в полноценную админку

## Проверка

Проект проверен командой:

```bash
npm run build
```

Сборка проходит успешно.

## Troubleshooting

Если кажется, что "работает только лендинг", проверьте следующее:

- Маршруты `/student` и `/teacher` защищены.
- Если открыть их без входа, приложение должно сделать редирект на `/login`. Это нормальное поведение.
- Сначала откройте [http://localhost:3000/login](http://localhost:3000/login) и войдите под тестовым аккаунтом.

Если `/login` не открывается или открывается старая версия:

```bash
lsof -ti :3000 | xargs kill -9
rm -rf .next
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

Если вы используете Docker-вариант:

- убедитесь, что запущен `docker compose up -d`
- убедитесь, что в `.env` используется строка подключения из `.env.example`
- по умолчанию контейнер публикуется на порту `5433`, а не `5432`

Если вы используете локальный PostgreSQL:

- убедитесь, что `DATABASE_URL` указывает на реально существующую локальную базу
- убедитесь, что база `tutor_mvp` создана
- убедитесь, что в строке подключения указан существующий пользователь PostgreSQL

Если видите ошибку вида `User postgres was denied access on the database tutor_mvp.public`:

- это значит, что приложение подключается не к Docker-контейнеру, а к другому локальному PostgreSQL на `5432`
- для Docker-режима используйте строку из `.env.example` с портом `5433`
- для локального PostgreSQL замените `postgres` в `DATABASE_URL` на своего пользователя, например `YOUR_PG_USER`
