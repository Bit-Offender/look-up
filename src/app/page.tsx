"use client";
import { useGetContext } from "@/hooks/useGetContext";
import ContextChips from "@/components/ContextChips";

export default function Home() {
  const { context, status, error } = useGetContext();

  if (status === "loading") return <p>Reading the sky…</p>;
  if (status === "error" || !context) return <p>{error ?? "Something went wrong"}</p>;

  return (
    <main className="p-6">
      <ContextChips context={context} />
    </main>
  );
}