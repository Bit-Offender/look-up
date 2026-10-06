"use client";
import { useGetContext } from "@/hooks/useGetContext";

export default function Home() {
  const { context, status, error } = useGetContext();
  if (status === "loading") return <p>Reading the sky…</p>;
  if (status === "error") return <p>{error}</p>;
  return <p>Sunset in {context!.sunsetInMinutes} min</p>;
}