/*
 * Сверка `prisma/schema.prisma` с историей миграций.
 *
 * Зачем: модель `Notification` жила в схеме и в коде, но её не создавала ни одна
 * миграция — таблицу когда-то накатили локально через `db push` (ARCH-001).
 * Ни tsc, ни eslint, ни build, ни CI этого не ловили: Prisma-клиент генерируется
 * из схемы, а не из миграций, поэтому всё компилировалось, а на чистой базе фича
 * молча не работала.
 *
 * Скрипт «проигрывает» все migration.sql по порядку и собирает итоговое состояние
 * БД: какие таблицы, колонки и enum'ы существуют. Потом сравнивает с тем, что
 * объявлено в schema.prisma. Расхождение — код возврата 1.
 *
 * Это намеренно грубый парсер: он понимает тот диалект SQL, который пишет
 * `prisma migrate` (и который мы пишем руками по тому же образцу). Если однажды
 * появится экзотический DDL, скрипт лучше доучить, чем отключить.
 *
 * Запуск: npm run check:schema
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SCHEMA_PATH = path.join(process.cwd(), "prisma", "schema.prisma");
const MIGRATIONS_DIR = path.join(process.cwd(), "prisma", "migrations");

// ── Схема ────────────────────────────────────────────

type SchemaModel = {
  name: string;
  /** Имена колонок, которые Prisma реально создаёт в таблице. */
  columns: string[];
};

type SchemaShape = {
  models: SchemaModel[];
  enums: string[];
  /** Имена моделей — нужны, чтобы отличить поле-связь от скалярной колонки. */
  modelNames: Set<string>;
};

/** Строка вида `@@map("Имя")` переопределяет имя таблицы. */
function readMappedName(body: string, fallback: string) {
  const match = body.match(/@@map\(\s*"([^"]+)"\s*\)/);

  return match ? match[1]! : fallback;
}

function parseSchema(source: string): SchemaShape {
  const withoutComments = source
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");

  const enums = Array.from(withoutComments.matchAll(/^enum\s+(\w+)\s*\{([^}]*)\}/gm)).map((match) => {
    const body = match[2] ?? "";

    return readMappedName(body, match[1]!);
  });

  const rawModels = Array.from(withoutComments.matchAll(/^model\s+(\w+)\s*\{([^}]*)\}/gm)).map((match) => ({
    name: match[1]!,
    body: match[2] ?? ""
  }));

  const modelNames = new Set(rawModels.map((model) => model.name));
  const enumNames = new Set(enums);

  const models: SchemaModel[] = rawModels.map((model) => {
    const columns: string[] = [];

    for (const rawLine of model.body.split("\n")) {
      const line = rawLine.trim();

      if (!line || line.startsWith("@@") || line.startsWith("//")) {
        continue;
      }

      const fieldMatch = line.match(/^(\w+)\s+(\w+)(\[\])?(\?)?/);

      if (!fieldMatch) {
        continue;
      }

      const [, fieldName, fieldType, isList] = fieldMatch;

      // Поле-связь колонки не создаёт: внешний ключ живёт в отдельном
      // скалярном поле (`topicId`), которое разбирается обычным путём.
      if (modelNames.has(fieldType!) && !enumNames.has(fieldType!)) {
        continue;
      }

      // Скалярных списков в этой схеме нет; если появятся — это тоже колонка,
      // но лучше не угадывать молча.
      if (isList) {
        continue;
      }

      const mapMatch = line.match(/@map\(\s*"([^"]+)"\s*\)/);

      columns.push(mapMatch ? mapMatch[1]! : fieldName!);
    }

    return { name: readMappedName(model.body, model.name), columns };
  });

  return { models, enums, modelNames };
}

// ── Миграции ─────────────────────────────────────────

type DatabaseShape = {
  tables: Map<string, Set<string>>;
  enums: Set<string>;
};

function stripSqlComments(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

/** Имена колонок из тела `CREATE TABLE (...)`: строки, начинающиеся с "имя". */
function parseCreateTableColumns(body: string) {
  const columns: string[] = [];

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();
    const match = line.match(/^"([^"]+)"\s+\S/);

    if (match) {
      columns.push(match[1]!);
    }
  }

  return columns;
}

function applyMigration(sql: string, shape: DatabaseShape) {
  const clean = stripSqlComments(sql);

  for (const match of clean.matchAll(/CREATE\s+TYPE\s+"([^"]+)"/gi)) {
    shape.enums.add(match[1]!);
  }

  for (const match of clean.matchAll(/DROP\s+TYPE\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi)) {
    shape.enums.delete(match[1]!);
  }

  for (const match of clean.matchAll(
    /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"\s*\(([\s\S]*?)\n\s*\);/gi
  )) {
    const table = match[1]!;
    const existing = shape.tables.get(table) ?? new Set<string>();

    for (const column of parseCreateTableColumns(match[2]!)) {
      existing.add(column);
    }

    shape.tables.set(table, existing);
  }

  for (const match of clean.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi)) {
    shape.tables.delete(match[1]!);
  }

  for (const match of clean.matchAll(/ALTER\s+TABLE\s+"([^"]+)"\s+RENAME\s+TO\s+"([^"]+)"/gi)) {
    const columns = shape.tables.get(match[1]!);

    if (columns) {
      shape.tables.delete(match[1]!);
      shape.tables.set(match[2]!, columns);
    }
  }

  // Один ALTER TABLE может нести несколько операций через запятую, поэтому
  // разбираем весь стейтмент целиком, а не построчно.
  for (const match of clean.matchAll(/ALTER\s+TABLE\s+"([^"]+)"([\s\S]*?);/gi)) {
    const table = match[1]!;
    const operations = match[2]!;
    const columns = shape.tables.get(table);

    if (!columns) {
      continue;
    }

    for (const added of operations.matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/gi)) {
      columns.add(added[1]!);
    }

    for (const dropped of operations.matchAll(/DROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"([^"]+)"/gi)) {
      columns.delete(dropped[1]!);
    }

    for (const renamed of operations.matchAll(/RENAME\s+COLUMN\s+"([^"]+)"\s+TO\s+"([^"]+)"/gi)) {
      columns.delete(renamed[1]!);
      columns.add(renamed[2]!);
    }
  }
}

function buildDatabaseShape(): DatabaseShape {
  const shape: DatabaseShape = { tables: new Map(), enums: new Set() };
  const directories = readdirSync(MIGRATIONS_DIR)
    .filter((entry) => statSync(path.join(MIGRATIONS_DIR, entry)).isDirectory())
    .sort();

  for (const directory of directories) {
    const file = path.join(MIGRATIONS_DIR, directory, "migration.sql");

    try {
      applyMigration(readFileSync(file, "utf8"), shape);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return shape;
}

// ── Сверка ───────────────────────────────────────────

function main() {
  const schema = parseSchema(readFileSync(SCHEMA_PATH, "utf8"));
  const database = buildDatabaseShape();
  const problems: string[] = [];

  for (const enumName of schema.enums) {
    if (!database.enums.has(enumName)) {
      problems.push(`enum ${enumName}: нет CREATE TYPE ни в одной миграции`);
    }
  }

  for (const model of schema.models) {
    const columns = database.tables.get(model.name);

    if (!columns) {
      problems.push(`модель ${model.name}: нет CREATE TABLE ни в одной миграции`);
      continue;
    }

    const missing = model.columns.filter((column) => !columns.has(column));

    if (missing.length > 0) {
      problems.push(`модель ${model.name}: колонок нет в миграциях — ${missing.join(", ")}`);
    }
  }

  if (problems.length > 0) {
    console.error("Схема и миграции разошлись:\n");

    for (const problem of problems) {
      console.error(`  • ${problem}`);
    }

    console.error(
      "\nСкорее всего, изменение накатили локально через `db push`. Оформите миграцию руками:" +
        "\n  prisma/migrations/<timestamp>_<name>/migration.sql\n"
    );
    process.exit(1);
  }

  console.log(
    `Схема и миграции сходятся: ${schema.models.length} моделей, ${schema.enums.length} enum'ов, ` +
      `${database.tables.size} таблиц в истории миграций.`
  );
}

main();
