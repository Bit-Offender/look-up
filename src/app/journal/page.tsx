"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import Marrow from "@/components/Marrow";
import { useGetContext } from "@/hooks/useGetContext";
import { getPhaseAt, sceneTint } from "@/lib/world/sun";
import { listJournal, type JournalEntry } from "@/lib/db/db";

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

  // next/image needs known dimensions and cannot optimise data URLs, so a plain <img> is right here.
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="entry__photo" src={url} alt="Photo from this outing" /> : null;
}

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[] | null>(null); // null = still loading

  useEffect(() => {
    listJournal()
      .then(setEntries) // already newest first
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

      <Link href="/journal/new" className="px-box">
        New entry
      </Link>

      {entries === null && <p className="empty px-box">Opening the journal&hellip;</p>}

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
