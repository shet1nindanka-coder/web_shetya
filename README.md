# ШБЗ Школа (TutorFlow MVP)

Full-stack платформа для репетитора на `Next.js`, `TypeScript`, `Tailwind CSS`, `PostgreSQL` и `Prisma`.

Главная модель проекта:

- список тем общий для всех учеников;
- каждая тема содержит описание, файлы теории и заданий, а также список номеров;
- прогресс по номерам у каждого ученика индивидуальный (статус, заметка, дедлайн);
- преподаватель видит прогресс каждого ученика по каждой теме и номеру;
- к номеру можно прикрепить условие и ответ в формате `LaTeX` и файл-ответ.

## Стек

- `Next.js 15` (App Router, Server Actions)
- `React 19`
- `TypeScript`
- `Tailwind CSS`
- `PostgreSQL`
- `Prisma`
- cookie-based auth с ролями `TEACHER` и `STUDENT` (без сторонних библиотек)
- storage-слой для локального диска, `Vercel Blob` и S3-совместимых хранилищ
- `KaTeX` для отображения формул, `ExcelJS` для экспорта, `pino` для логирования
- обновление кабинетов в реальном времени через `Server-Sent Events`

## Реализовано

### Ученик

- вход в личный кабинет
- обзорная страница с краткой статистикой и streak-серией решений
- просмотр списка всех тем и переход на страницу темы
- просмотр названия и описания темы
- блок `Теория` с открытием файла в браузере и скачиванием
- блок `Задания` с открытием файла в браузере и скачиванием
- список номеров заданий и отдельная страница по каждому номеру
- условие и ответ номера в формате `LaTeX` (если их задал преподаватель)
- выбор статуса по каждому номеру:
  - `GREEN` — решен с первого раза и правильно
  - `YELLOW` — сначала была ошибка, но ученик сам её нашёл и исправил
  - `RED` — ученик не понимает, как решать номер
- личные заметки к номерам
- сохранение статусов и заметок в базе данных и повторный показ после входа
- дедлайны по номерам и их отображение в календаре
- streak-серия: текущая и лучшая серия, активность за неделю, цветовые «вехи» и анимации
- личные настройки профиля (имя, пароль) и настройки интерфейса
- поиск номера задания по темам

### Преподаватель

- вход в личный кабинет
- создание, редактирование и удаление темы
- загрузка, замена и удаление файлов теории и заданий
- редактирование списка номеров (поддерживаются диапазоны вида `1-5, 7, 10`)
- изменение порядка тем кнопками «выше» и «ниже»
- задание условий и ответов номеров в формате `LaTeX` с предпросмотром
- управление учениками: создание и удаление аккаунтов
- просмотр прогресса каждого ученика по каждой теме и каждому номеру
- назначение дедлайнов и заметок ученикам
- страница статистики с графиком динамики прогресса
- экспорт прогресса ученика в `Excel`
- личные настройки профиля (имя, пароль) и настройки интерфейса

## Поддерживаемые файлы

- `PDF`
- `DOCX`
- `PNG`
- `JPG` / `JPEG`

Что происходит с файлами:

- локально файлы сохраняются в каталог `STORAGE_DIR`
- при наличии `BLOB_READ_WRITE_TOKEN` файлы автоматически сохраняются в `Vercel Blob`
- при наличии `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` и `S3_SECRET_ACCESS_KEY` файлы сохраняются в S3-совместимое хранилище, например `Yandex Object Storage`
- бэкенд выбирается автоматически: `Vercel Blob` → S3 → локальный диск
- ключ файла хранит префикс бэкенда (`blob:` / `s3:` / `local:`), поэтому ранее загруженные файлы остаются доступны даже при смене хранилища
- метаданные файла хранятся в PostgreSQL
- доступ к файлам идёт через защищённый route handler `/files/[fileId]` с проверкой прав
- PDF отображается встроенно через `iframe`, изображения — прямо на странице, DOCX можно открыть в отдельной вкладке или скачать

## Реальное время, безопасность и логирование

- кабинеты ученика и преподавателя обновляются в реальном времени через `Server-Sent Events` (`/api/realtime` + `EventSource`); streak-серия имеет отдельную клиентскую шину событий
- защита маршрутов работает через `middleware.ts` и серверные проверки ролей (`requireUser`)
- пароли хешируются через `scrypt`, токены сессий хранятся в виде `sha256`-хэшей
- rate-limiting на входе и создании учеников (`lib/rate-limit.ts`)
- структурное логирование событий через `pino` (`lib/logger.ts`)

> Реалтайм-шина и rate-limiting реализованы в памяти процесса и корректны для одного инстанса. Для горизонтального масштабирования потребуется внешний брокер и общее хранилище.

## Структура проекта

```text
app/
  (auth)/login/                          вход
  (dashboard)/dashboard/                 общий обзор по роли
  (dashboard)/student/                   обзор, темы, дедлайны, инфо, аккаунт, настройки
  (dashboard)/student/topics/[topicId]/  страница темы и страницы отдельных номеров
  (dashboard)/teacher/                   темы, ученики, статистика, аккаунт, настройки
  (dashboard)/teacher/topics/[topicId]/  редактирование темы и страницы номеров
  (dashboard)/teacher/students/[id]/     прогресс ученика и экспорт в Excel
  api/                                   route handlers (статусы, дедлайны, LaTeX, realtime, поиск, загрузки)
  files/[fileId]/route.ts                защищённая выдача файлов

actions/
  auth.ts                                вход и выход
  topic.ts                               CRUD тем, файлы, статусы номеров
  student.ts                             создание и удаление учеников
  profile.ts                             обновление имени и пароля

components/                              UI-компоненты кабинетов (статусы, прогресс, календарь,
                                         streak, карточки номеров, формы тем и т.д.)

lib/
  auth.ts                                сессии и роли
  password.ts                            хеширование паролей и токенов
  platform-data.ts                       агрегаты данных для кабинетов
  platform-data-cache.ts                 теги кеша и ревалидация
  storage.ts                             storage-адаптер (local / Blob / S3)
  file-access.ts                         проверка доступа к файлам
  dashboard-realtime.ts                  pub/sub для realtime
  student-streak.ts                      расчёт streak-серии
  progress-timeline.ts                   динамика прогресса для статистики
  rate-limit.ts                          ограничение частоты запросов
  logger.ts                              структурное логирование
  utils.ts                               форматирование, статусы, парсинг номеров
  prisma.ts                              singleton Prisma Client

prisma/
  schema.prisma                          схема базы данных
  seed.ts                                тестовые пользователи, темы, файлы, статусы
  migrations/                            миграции

tests/                                   модульные тесты логики (tsx --test)
```

## Схема базы данных

### Основные сущности

- `User` — пользователь, роли `TEACHER` и `STUDENT`
- `Session` — серверные сессии для авторизации через cookie
- `StoredFile` — метаданные файла (имя, ключ в storage, MIME-тип, размер, дата загрузки)
- `Topic` — общая тема: название, описание, порядок, ссылки на файлы теории и заданий
- `TopicHomeworkNumber` — номер задания внутри темы (номер, условие и ответ в `LaTeX`, файл-ответ)
- `StudentTopicNumberStatus` — индивидуальные данные ученика по номеру: статус, заметка, дедлайн

### Почему эта схема соответствует требованиям

- темы не привязаны к конкретному ученику и существуют в одном общем списке;
- статусы, заметки и дедлайны живут отдельно и привязаны к `studentId + homeworkNumberId`;
- поэтому одна и та же тема может иметь разный прогресс у разных учеников;
- преподаватель может читать все статусы и строить прогресс по любому ученику.

## Роуты

- `/` — редирект на кабинет по роли или на `/login`
- `/login` — вход
- `/dashboard` — обзор по роли
- `/student` — обзор ученика и streak
- `/student/topics` и `/student/topics/[topicId]` — список тем и страница темы
- `/student/topics/[topicId]/numbers/[number]` — страница отдельного номера
- `/student/deadlines` — календарь дедлайнов
- `/student/info`, `/student/account`, `/student/settings` — информация и настройки
- `/teacher` — список тем и создание темы
- `/teacher/topics/[topicId]` и `.../numbers/[number]` — редактирование темы и номеров
- `/teacher/students` и `/teacher/students/[studentId]` — ученики и их прогресс
- `/teacher/students/[studentId]/export` — экспорт прогресса в Excel
- `/teacher/statistics` — статистика и динамика прогресса
- `/teacher/account`, `/teacher/settings` — настройки
- `/files/[fileId]` — защищённый просмотр/скачивание файла
- `/api/...` — route handlers для интерактивных действий и realtime

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
# Optional for S3-compatible storage, for example Yandex Object Storage.
# S3_ENDPOINT="https://storage.yandexcloud.net"
# S3_REGION="ru-central1"
# S3_BUCKET="tutorflow-files"
# S3_ACCESS_KEY_ID="your-access-key-id"
# S3_SECRET_ACCESS_KEY="your-secret-access-key"
# S3_FORCE_PATH_STYLE="true"
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
npm run dev          # запуск в режиме разработки
npm run build        # prisma generate + сборка
npm run start        # запуск собранного приложения
npm run lint         # проверка eslint (без предупреждений)
npm run test         # модульные тесты (tsx --test)
npm run db:generate  # генерация Prisma Client
npm run db:migrate   # применение миграций
npm run db:dev       # миграции для разработки
npm run db:reset     # сброс базы
npm run db:seed      # наполнение тестовыми данными
```

## Тесты и CI

- модульные тесты логики лежат в `tests/` и запускаются через `npm run test` (без базы и сети)
- workflow `.github/workflows/ci.yml` на GitHub проверяет `lint`, Prisma generate, миграции и `build` на сервисе PostgreSQL

## Публикация на GitHub

Проект подготовлен к публикации:

- локальные секреты остаются в `.env`, а в репозиторий идёт только `.env.example`
- `node_modules`, `.next`, `storage`, логи и IDE-файлы исключены через `.gitignore`
- добавлены `.editorconfig` и `.gitattributes` для аккуратной истории и одинаковых переносов строк

Минимальная последовательность для первого пуша:

```bash
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git
git push -u origin main
```

## Vercel

Для Vercel в проекте уже включён запуск `prisma generate` во время `postinstall` и `build`, чтобы Prisma Client не ломался из-за кэша зависимостей.

Для рабочего деплоя на Vercel обязательно задайте:

- `DATABASE_URL` от внешней PostgreSQL-базы
- `SESSION_TTL_DAYS=30`
- `BLOB_READ_WRITE_TOKEN` от подключённого `Vercel Blob`

Важно:

- локальный `storage/uploads` используется только как fallback для локальной разработки
- на Vercel загрузка и выдача файлов должны идти через `Vercel Blob`

## Yandex Cloud

Для переноса в `Yandex Cloud` в проект добавлены:

- поддержка S3-совместимого storage через `Yandex Object Storage`
- production `Dockerfile`
- `docker-compose.prod.yml` для запуска приложения на VM
- `.dockerignore`

Рекомендуемая схема:

- приложение: `Compute Cloud VM`
- база данных: `Managed Service for PostgreSQL`
- файлы: `Yandex Object Storage`

Минимальный порядок миграции:

1. Создайте PostgreSQL-кластер в Yandex Cloud и получите внешний `DATABASE_URL`.
2. Создайте бакет в `Object Storage` и статический ключ доступа.
3. Подготовьте на VM файл `.env.production`, например:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:6432/DBNAME?sslmode=require&schema=public"
SESSION_TTL_DAYS=30
S3_ENDPOINT="https://storage.yandexcloud.net"
S3_REGION="ru-central1"
S3_BUCKET="tutorflow-files"
S3_ACCESS_KEY_ID="your-access-key-id"
S3_SECRET_ACCESS_KEY="your-secret-access-key"
S3_FORCE_PATH_STYLE="true"
```

4. На VM запустите:

```bash
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_PROJECT_DIR>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy
docker compose -f docker-compose.prod.yml up -d
```

После этого приложение будет работать на VM, PostgreSQL останется в управляемом сервисе, а файлы будут храниться в `Yandex Object Storage`.

## Тестовые аккаунты

После `npm run db:seed` доступны:

- преподаватель: `teacher@example.com` / `teacher123`
- ученик: `ilya@example.com` / `student123`
- ученик: `maria@example.com` / `student123`

## Что можно сделать дальше

- заменить локальный storage на объектное хранилище в production
- вынести realtime-шину и rate-limiting во внешнее хранилище для масштабирования
- добавить CSRF/allowed origins для server actions под конкретный домен
- расширить аудит действий преподавателя
- вынести роли и пользователей в полноценную админку

## Troubleshooting

Если кажется, что "работает только лендинг", проверьте следующее:

- Маршруты `/student` и `/teacher` защищены.
- Если открыть их без входа, приложение делает редирект на `/login`. Это нормальное поведение.
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
