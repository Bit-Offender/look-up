import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Forecast } from "../world/weather";
import type { Mission } from "../missions/missions";

export type QueuedMission = Mission & {
  slotId: string;
  validFrom: number;
  validUntil: number;
  generated: true;
};

export type JournalEntry = {
  id: string;
  missionId: string;
  missionTitle: string;
  note: string;
  photo?: Blob;
  createdAt: number;
};

interface LookUpDB extends DBSchema {
  forecastCache: {
    key: string;
    value: { key: string; fetchedAt: number; forecast: Forecast };
  };
  queue: {
    key: string;
    value: QueuedMission;
    indexes: { "by-validUntil": number };
  };
  journal: {
    key: string;
    value: JournalEntry;
    indexes: { "by-createdAt": number };
  };
}

let dbPromise: Promise<IDBPDatabase<LookUpDB>> | null = null;

export async function listJournal(): Promise<JournalEntry[]> {
  const all = await (await getDB()).getAllFromIndex("journal", "by-createdAt");
  return all.reverse(); // newest first
}

export async function addJournalEntry(
  e: Omit<JournalEntry, "id" | "createdAt">,
): Promise<JournalEntry> {
  const entry = { ...e, id: crypto.randomUUID(), createdAt: Date.now() };
  await (await getDB()).add("journal", entry);
  return entry;
}


export function getDB() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  dbPromise ??= openDB<LookUpDB>("look-up", 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("forecastCache"))
        db.createObjectStore("forecastCache", { keyPath: "key" });
      if (!db.objectStoreNames.contains("queue"))
        db.createObjectStore("queue", { keyPath: "id" }).createIndex(
          "by-validUntil",
          "validUntil",
        );
      if (!db.objectStoreNames.contains("journal"))
        db.createObjectStore("journal", { keyPath: "id" }).createIndex(
          "by-createdAt",
          "createdAt",
        );
    },
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

export async function saveJournal(entry: Omit<JournalEntry, "id">): Promise<JournalEntry> {
  const db = await getDB(); 
  const full: JournalEntry = { ...entry, id: crypto.randomUUID() };
  await db.add("journal", full);
  return full;
}

export async function putQueued(m: QueuedMission) {
  await (await getDB()).put("queue", m);
}

export async function listQueue(): Promise<QueuedMission[]> {
  return (await getDB()).getAll("queue");
}

export async function pruneQueue(now = Date.now()) {
  const db = await getDB();
  const tx = db.transaction("queue", "readwrite");
  const expired = await tx.store.index("by-validUntil").getAllKeys(IDBKeyRange.upperBound(now));
  await Promise.all(expired.map((k) => tx.store.delete(k)));
  await tx.done;
}