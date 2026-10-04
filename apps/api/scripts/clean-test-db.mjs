import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prismaDir = path.resolve(__dirname, "../prisma");
const rootDir = path.resolve(__dirname, "..");

const targets = [
  path.join(prismaDir, "test.db"),
  path.join(prismaDir, "test.db-journal"),
  path.join(prismaDir, "test.db-wal"),
  path.join(prismaDir, "test.db-shm"),
  path.join(rootDir, "test.db"),
  path.join(rootDir, "test.db-journal"),
  path.join(rootDir, "test.db-wal"),
  path.join(rootDir, "test.db-shm"),
];

for (const target of targets) {
  try {
    if (fs.existsSync(target)) {
      fs.rmSync(target, { force: true });
      console.log(`[clean-test-db] Removed ${target}`);
    }
  } catch (err) {
    console.warn(`[clean-test-db] Warning removing ${target}:`, err.message);
  }
}
