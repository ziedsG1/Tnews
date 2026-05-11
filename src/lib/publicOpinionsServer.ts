import { mkdir, readFile, writeFile } from "fs/promises";
import { tmpdir } from "node:os";
import path from "path";
import type { CountryId } from "@/lib/countries";
import type { StoredOpinion } from "@/lib/publicOpinions";

type FileShape = Partial<Record<CountryId, StoredOpinion[]>>;

/** After a successful write, all reads/writes use this path until restart. */
let activeStorageFile: string | null = null;

/**
 * Preferred JSON path. `TNEWS_OPINIONS_FILE` wins; serverless defaults to temp dir;
 * otherwise `data/public-opinions.json` under the app root.
 */
function preferredStoragePath(): string {
  const fromEnv = process.env.TNEWS_OPINIONS_FILE?.trim();
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join(tmpdir(), "tnews-public-opinions.json");
  }
  return path.join(process.cwd(), "data", "public-opinions.json");
}

function fallbackStoragePath(): string {
  return path.join(tmpdir(), "tnews-public-opinions.json");
}

function storageFile(): string {
  return activeStorageFile ?? preferredStoragePath();
}

async function readAllFrom(file: string): Promise<FileShape> {
  try {
    const raw = await readFile(file, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) return j as FileShape;
  } catch {
    /* missing or invalid */
  }
  return {};
}

let writeChain: Promise<void> = Promise.resolve();

async function persistOpinions(file: string, next: FileShape): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(next, null, 2), "utf8");
}

export async function listOpinionsForCountry(countryId: CountryId): Promise<StoredOpinion[]> {
  const primary = preferredStoragePath();
  const tmp = fallbackStoragePath();

  let all = await readAllFrom(storageFile());
  if (Object.keys(all).length === 0 && activeStorageFile === null && primary !== tmp) {
    const fromTmp = await readAllFrom(tmp);
    if (Object.keys(fromTmp).length > 0) {
      activeStorageFile = tmp;
      all = fromTmp;
    }
  }

  const list = all[countryId] ?? [];
  return [...list]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, 200);
}

export async function appendOpinion(
  countryId: CountryId,
  body: string,
  author: string,
): Promise<StoredOpinion> {
  const row: StoredOpinion = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    countryId,
    body,
    author,
    createdAt: new Date().toISOString(),
  };

  const task = writeChain.then(async () => {
    const primary = preferredStoragePath();
    const tmp = fallbackStoragePath();
    const candidates =
      activeStorageFile != null
        ? [activeStorageFile]
        : primary === tmp
          ? [primary]
          : [primary, tmp];

    let lastErr: unknown;
    for (const file of candidates) {
      try {
        const all = await readAllFrom(file);
        const prev = all[countryId] ?? [];
        const nextList = [row, ...prev].slice(0, 500);
        const next: FileShape = { ...all, [countryId]: nextList };
        await persistOpinions(file, next);
        activeStorageFile = file;
        return;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error("Opinion write failed");
  });

  writeChain = task.catch(() => {
    /* keep chain alive */
  });
  await task;
  return row;
}
