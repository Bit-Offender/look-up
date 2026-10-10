"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ChangeEvent } from "react";

import Marrow from "@/components/Marrow";
import { useGetContext } from "@/hooks/useGetContext";
import { useActiveMission } from "@/lib/missions/activeMissions";
import { addJournalEntry } from "@/lib/db/db";
import { describePhoto } from "@/lib/journal/describe";
import { downscale } from "@/lib/journal/image";
import { getPhaseAt, sceneTint } from "@/lib/world/sun";

type Status = "idle" | "reading" | "typing" | "ready" | "failed";

const SAYS: Record<Status, string> = {
  idle: "Show me what you saw.",
  reading: "Hold on, let me squint at that.",
  typing: "Here is what I made of it.",
  ready: "Fix anything I got wrong. My eyes are old.",
  failed: "My eyes gave out. You write this one.",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reveals the finished entry a couple of characters at a time so it reads like live writing. */
async function typeOut(full: string, onUpdate: (s: string) => void, skip: { current: boolean }) {
  for (let i = 2; i < full.length; i += 2) {
    if (skip.current) break;
    onUpdate(full.slice(0, i));
    await sleep(22);
  }
  onUpdate(full);
}

export default function NewEntryPage() {
  const router = useRouter();
  const mission = useActiveMission();
  const { context } = useGetContext();
  const scene = context ? sceneTint(getPhaseAt(new Date(), context.latitude, context.longitude)) : "day";

  const [status, setStatus] = useState<Status>("idle");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<string | null>(null);
  const skipTyping = useRef(false);

  // Stop the typewriter and free the preview URL when leaving the page.
  useEffect(
    () => () => {
      skipTyping.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    },
    [],
  );

  async function write(blob: Blob) {
    skipTyping.current = false;
    setError(null);
    setStatus("reading");
    setText("");
    const phase = context ? getPhaseAt(new Date(), context.latitude, context.longitude) : "unknown";
    const entry = await describePhoto(blob, { missionTitle: mission.title, phase });
    if (!entry) {
      setStatus("failed");
      return;
    }
    setStatus("typing");
    await typeOut(entry, setText, skipTyping);
    setStatus("ready");
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the user pick the same file again
    if (!file) return;
    setError(null);
    setStatus("reading");
    try {
      const small = await downscale(file);
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
      const url = URL.createObjectURL(small);
      previewRef.current = url;
      setPhoto(small);
      setPreview(url);
      await write(small);
    } catch {
      setStatus("idle");
      setError("Couldn't read that photo. Try another one, or just write the entry.");
    }
  }

  async function save() {
    const note = text.trim();
    if (!note && !photo) return;
    setSaving(true);
    try {
      await addJournalEntry({
        missionId: mission.id,
        missionTitle: mission.title,
        note,
        photo: photo ?? undefined,
      });
      router.push("/journal");
    } catch {
      setSaving(false);
      setError("Couldn't save the entry on this device.");
    }
  }

  const busy = status === "reading" || status === "typing";
  const canSave = !saving && !busy && (text.trim().length > 0 || photo !== null);

  return (
    <main className="shell">
      <Marrow phase={scene} say={SAYS[status]} />
      <h1 className="page-title">New entry</h1>
      <p className="entry__title">{mission.title}</p>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />

      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="entry__photo" src={preview} alt="Your photo from this outing" />
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className="px-box" disabled={busy || saving} onClick={() => fileRef.current?.click()}>
          {photo ? "Retake photo" : "Take a photo"}
        </button>
        {photo && !busy && (
          <button type="button" className="px-box" disabled={saving} onClick={() => write(photo)}>
            Write it again
          </button>
        )}
        {status === "typing" && (
          <button type="button" className="px-box" onClick={() => (skipTyping.current = true)}>
            Show all
          </button>
        )}
      </div>

      {status === "reading" && <p className="empty px-box mt-4">Marrow is looking at your photo&hellip;</p>}

      <textarea
        className="px-box mt-4 min-h-40 w-full"
        placeholder="What did you see?"
        value={text}
        readOnly={status === "typing"}
        onChange={(e) => setText(e.target.value)}
      />

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
      {photo && (
        <p className="mt-2 text-xs opacity-60">
          Your photo is sent to Gemma (Google AI) to write the entry. It is stored only on this device.
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button type="button" className="px-box" disabled={!canSave} onClick={save}>
          {saving ? "Saving…" : "Save entry"}
        </button>
        <Link href="/journal" className="px-box">
          Cancel
        </Link>
      </div>
    </main>
  );
}
