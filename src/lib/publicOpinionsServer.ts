import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { CountryId } from "@/lib/countries";
import type { StoredOpinion } from "@/lib/publicOpinions";

const DATA_FILE = path.join(process.cwd(), "data", "public-opinions.json");

type FileShape = Partial<Record<CountryId, StoredOpinion[]>>;

let writeChain: Promise<void> = Promise.resolve();

async function readAll(): Promise<FileShape> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === "object" && !Array.isArray(j)) return j as FileShape;
  } catch {
    /* missing or invalid */
  }
  return {};
}

export async function listOpinionsForCountry(countryId: CountryId): Promise<StoredOpinion[]> {
  const all = await readAll();
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
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    const all = await readAll();
    const prev = all[countryId] ?? [];
    const nextList = [row, ...prev].slice(0, 500);
    const next: FileShape = { ...all, [countryId]: nextList };
    await writeFile(DATA_FILE, JSON.stringify(next, null, 2), "utf8");
  });
  writeChain = task.catch(() => {
    /* keep chain alive */
  });
  await task;
  return row;
}
