"use client";
import { useEffect, useState } from "react";

export default function GpuTest() {
  const [msg, setMsg] = useState("checking...");
  useEffect(() => {
    setMsg("gpu" in navigator ? "WebGPU available" : "No WebGPU");
  }, []);
  return <main className="p-6 text-xl">{msg}</main>;
}