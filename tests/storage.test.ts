import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { getBlobAccessMode, getStorageBackend, getStorageRoot } from "../lib/storage";

const ENV_KEYS = [
  "BLOB_READ_WRITE_TOKEN",
  "BLOB_ACCESS",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "S3_REGION",
  "S3_FORCE_PATH_STYLE",
  "STORAGE_DIR",
  "NODE_ENV"
] as const;

function withEnv(values: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>, fn: () => void) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

  for (const key of ENV_KEYS) {
    const nextValue = values[key];

    if (typeof nextValue === "undefined") {
      delete process.env[key];
    } else {
      (process.env as Record<string, string | undefined>)[key] = nextValue;
    }
  }

  try {
    fn();
  } finally {
    for (const key of ENV_KEYS) {
      const previousValue = previous[key];

      if (typeof previousValue === "undefined") {
        delete process.env[key];
      } else {
        (process.env as Record<string, string | undefined>)[key] = previousValue;
      }
    }
  }
}

test("getStorageBackend prefers blob, then s3, then local", () => {
  withEnv(
    {
      BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_store_id",
      S3_ENDPOINT: "https://storage.yandexcloud.net",
      S3_BUCKET: "bucket",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret"
    },
    () => {
      assert.equal(getStorageBackend(), "blob");
    }
  );

  withEnv(
    {
      BLOB_READ_WRITE_TOKEN: undefined,
      S3_ENDPOINT: "https://storage.yandexcloud.net",
      S3_BUCKET: "bucket",
      S3_ACCESS_KEY_ID: "key",
      S3_SECRET_ACCESS_KEY: "secret"
    },
    () => {
      assert.equal(getStorageBackend(), "s3");
    }
  );

  withEnv(
    {
      BLOB_READ_WRITE_TOKEN: undefined,
      S3_ENDPOINT: undefined,
      S3_BUCKET: undefined,
      S3_ACCESS_KEY_ID: undefined,
      S3_SECRET_ACCESS_KEY: undefined
    },
    () => {
      assert.equal(getStorageBackend(), "local");
    }
  );
});

test("getBlobAccessMode defaults to private and supports public mode", () => {
  withEnv({ BLOB_ACCESS: undefined }, () => {
    assert.equal(getBlobAccessMode(), "private");
  });

  withEnv({ BLOB_ACCESS: "public" }, () => {
    assert.equal(getBlobAccessMode(), "public");
  });
});

test("getStorageRoot respects STORAGE_DIR and environment defaults", () => {
  withEnv({ STORAGE_DIR: ".custom/uploads" }, () => {
    assert.equal(getStorageRoot(), path.resolve(process.cwd(), ".custom/uploads"));
  });

  withEnv({ STORAGE_DIR: undefined, NODE_ENV: "production" }, () => {
    assert.equal(getStorageRoot(), path.join("/tmp", "uploads"));
  });

  withEnv({ STORAGE_DIR: undefined, NODE_ENV: "development" }, () => {
    assert.equal(getStorageRoot(), path.join(process.cwd(), "storage", "uploads"));
  });
});
