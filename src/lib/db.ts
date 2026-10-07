import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Forecast } from "./weather";
import type { Mission } from "./missions";

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

export function getDB() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  dbPromise ??= openDB<LookUpDB>("look-up", 1, {
    upgrade(db) {
      db.createObjectStore("forecastCache", { keyPath: "key" });
      db.createObjectStore("queue", { keyPath: "id" }).createIndex(
        "by-validUntil",
        "validUntil"
      );
      db.createObjectStore("journal", { keyPath: "id" }).createIndex(
        "by-createdAt",
        "createdAt"
      );
    },
  });
  return dbPromise;
}