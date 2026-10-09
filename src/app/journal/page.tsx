"use client";

import { useEffect, useState } from "react";

import Marrow from "@/components/Marrow";
import { useGetContext } from "@/hooks/useGetContext";
import { getPhaseAt, sceneTint } from "@/lib/world/sun";
// TODO: point this at your real idb helper in lib/db.ts
import { listJournal, type JournalEntry } from "@/lib/db/db";
import Image from "next/image";

function Photo({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = () => setUrl(reader.result as string);
    reader.readAsDataURL(blob);
    return () => {
      reader.onload = null;
    };
  }, [blob]);
  return url ? (
    <Image className="entry__photo" src={url} alt="Photo from this outing" />
  ) : null;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);

  useEffect(() => {
    listJournal()
      .then((list) =>
        setEntries(
          [...list].sort(
            (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
          ),
        ),
      )
      .catch(() => setEntries([]));
  }, []);

  const { context } = useGetContext();
  const phase = context
    ? sceneTint(getPhaseAt(new Date(), context.latitude, context.longitude))
    : "day";

  return (
    <main className="shell">
      <Marrow phase={phase} say="Write down what you saw. I forget things." />
      <h1 className="page-title">Field journal</h1>

      {entries === null && <p className="empty px-box">Opening the journal…</p>}

      {entries?.length === 0 && (
        <p className="empty px-box">
          Nothing here yet. Finish a mission and your first entry shows up here.
        </p>
      )}

      {entries?.map((e) => (
        <article key={e.id} className="entry px-box">
          <div className="entry__date">
            {new Date(e.createdAt).toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
          </div>
          {e.missionTitle && <h2 className="entry__title">{e.missionTitle}</h2>}
          {e.photo && <Photo blob={e.photo} />}
          <p className="entry__text">{e.note}</p>
        </article>
      ))}
    </main>
  );
}
