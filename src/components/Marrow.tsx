"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import Decor from "@/components/Decor";
import PixelSprite, { PixelRects } from "@/components/PixelSprite";
import { getLine, warmUp, type MarrowEvent } from "@/lib/marrow/marrowLines";
import {
  DECOR_PALETTE,
  MARROW_BODY,
  MARROW_FACES,
  MARROW_H,
  MARROW_LEGS_A,
  MARROW_LEGS_B,
  MARROW_LEGS_Y,
  MARROW_PALETTE,
  MARROW_W,
  STAR,
  type Expr,
} from "@/lib/marrow/sprites";

/* ------------------------------------------------------------------ *
 * THE BIG IDEA
 * Marrow is a tiny game. Two kinds of data, handled differently:
 *   - Per-FRAME data (x, y, velocity): lives in a ref and is written straight to the DOM
 *     60 times a second. Putting this in React state would re-render 60x/sec.
 *   - Per-EVENT data (mode, expression, speech): lives in React state, because it changes
 *     rarely and React needs to redraw when it does.
 * ------------------------------------------------------------------ */

type Mode = "walk" | "pause" | "drag" | "fall" | "dizzy"; // a state machine
type Sample = { x: number; y: number; t: number };

const EXPR_FOR: Record<Mode, Expr> = {
  walk: "happy",
  pause: "happy",
  drag: "oh",
  fall: "oh",
  dizzy: "dizzy",
};

const SCALE = 5; // each art pixel = 5 screen pixels
const W = MARROW_W * SCALE;
const H = MARROW_H * SCALE;
const FLOOR = 34; // px between his feet and the bottom of the scene
const GRAVITY = 1800; // px per second^2
const WALK_SPEED = 22; // px per second: slow and calm
const DRAG_THRESHOLD = 6; // px of movement before a press counts as a drag, not a tap
const HARD_LANDING = 420; // px/s of impact speed that makes him dizzy
const BUBBLE_OFFSET = 72; // bubble starts this far from his left edge (beside his face)

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

/** Reveals text letter by letter. The unrevealed rest is invisible but still takes up space,
 *  so the bubble is full size from the start and doesn't jump as it types. */
function Typewriter({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setN((v) => Math.min(v + 1, text.length)), 28);
    return () => clearInterval(id);
  }, [text]);
  return (
    <>
      {text.slice(0, n)}
      <span style={{ visibility: "hidden" }}>{text.slice(n)}</span>
    </>
  );
}

type Props = {
  /** "day" | "dusk" | "night": tints the scene (see pixel.css) */
  phase?: string;
  /** sky description, passed to Gemma so lines fit the weather */
  sky?: string;
  /** overrides the greeting line */
  say?: string;
};

export default function Marrow({ phase = "day", sky, say }: Props) {
  /* ---- React state: things that change rarely ---- */
  const [mode, setModeState] = useState<Mode>("walk");
  const [expr, setExpr] = useState<Expr>("happy");
  const [line, setLine] = useState<string | null>(null);

  /* ---- Refs: DOM handles + the per-frame simulation ---- */
  const nookRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLButtonElement>(null);
  const bubbleOpen = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSpoke = useRef(0);
  const factsRef = useRef({ phase, sky });

  const sim = useRef({
    ready: false,
    mode: "walk" as Mode,
    x: 40,
    y: 0,
    vx: 0,
    vy: 0,
    dir: 1 as 1 | -1,
    timer: 4, // seconds left in the current walk/pause/dizzy
    pressed: false,
    dragging: false,
    startX: 0,
    startY: 0,
    grabDX: 0,
    grabDY: 0,
    samples: [] as Sample[],
  });

  // Keep the latest sky facts available to callbacks without re-creating them.
  useEffect(() => {
    factsRef.current = { phase, sky };
  }, [phase, sky]);

  /** Change mode in BOTH places: the ref (read by the loop) and state (read by CSS/JSX). */
  const go = useCallback((m: Mode) => {
    sim.current.mode = m;
    setModeState(m);
    setExpr(EXPR_FOR[m]);
  }, []);

  const cancel = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const st = sim.current;
    if (!st.pressed) return;
    st.pressed = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (st.dragging) {
      st.dragging = false;
      st.vx = 0;
      st.vy = 0;
      go("fall"); // drop him where he is
    }
  };

  const show = useCallback((text: string) => {
    setLine(text);
    bubbleOpen.current = true;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(
      () => {
        bubbleOpen.current = false;
        setLine(null);
      },
      2600 + text.length * 45,
    ); // longer lines stay longer
  }, []);

  const speak = useCallback(
    (ev: MarrowEvent) => {
      const now = Date.now();
      if (ev !== "dropped" && now - lastSpoke.current < 800) return; // don't chatter
      lastSpoke.current = now;
      show(getLine(ev, factsRef.current));
    },
    [show],
  );

  /* ---- Greeting + start fetching Gemma lines in the background ---- */
  useEffect(() => {
    warmUp(factsRef.current);
    const t = setTimeout(
      () => show(say ?? getLine("greet", factsRef.current)),
      900,
    );
    return () => {
      clearTimeout(t);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [say, show]);

  /* ---- THE GAME LOOP ---- */
  useEffect(() => {
    const nook = nookRef.current;
    const el = elRef.current;
    if (!nook || !el) return;

    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      // dt = seconds since the last frame. Moving by (speed * dt) makes motion the same
      // speed on 60Hz and 120Hz screens. Capped so a background tab doesn't teleport him.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const st = sim.current;
      const maxX = Math.max(0, nook.clientWidth - W);
      const floorY = nook.clientHeight - FLOOR - H;

      if (!st.ready) {
        st.y = floorY;
        st.ready = true;
        el.style.opacity = "1"; // hidden by CSS until he has a real position (no flash at 0,0)
      }

      switch (st.mode) {
        case "walk":
          st.y = floorY;
          if (!reduced) st.x += st.dir * WALK_SPEED * dt;
          if (st.x <= 6) {
            st.x = 6;
            st.dir = 1;
          }
          if (st.x >= maxX - 6) {
            st.x = maxX - 6;
            st.dir = -1;
          }
          st.timer -= dt;
          if (st.timer <= 0) {
            st.timer = 2 + Math.random() * 2;
            go("pause");
          }
          break;

        case "pause": // stands, looks around, then picks a direction
          st.y = floorY;
          st.timer -= dt;
          if (st.timer <= 0) {
            st.dir = Math.random() < 0.5 ? 1 : -1;
            st.timer = 7 + Math.random() * 8;
            go("walk");
          }
          break;

        case "dizzy": // sitting stunned after a hard landing
          st.y = floorY;
          st.timer -= dt;
          if (st.timer <= 0) {
            st.timer = 1.5;
            go("pause");
          }
          break;

        case "fall": {
          // Euler integration: velocity changes by acceleration, position by velocity.
          st.vy += GRAVITY * dt;
          st.x += st.vx * dt;
          st.y += st.vy * dt;

          if (st.x < 0 || st.x > maxX) {
            // bounce softly off the side walls
            st.x = clamp(st.x, 0, maxX);
            st.vx *= -0.4;
          }
          if (st.y < 0) {
            // bonk the ceiling
            st.y = 0;
            st.vy = Math.abs(st.vy) * 0.3;
          }
          if (st.y >= floorY) {
            // landed. vy right now = how hard he hit.
            const impact = st.vy;
            st.y = floorY;
            st.vx = 0;
            st.vy = 0;
            if (impact > HARD_LANDING) {
              st.timer = 2;
              go("dizzy");
              speak("dropped");
            } else {
              st.timer = 1.5;
              go("pause");
            }
          }
          break;
        }

        case "drag":
          break; // the pointer handlers move him; the loop only draws
      }

      if (st.mode !== "drag" && st.mode !== "fall") st.x = clamp(st.x, 0, maxX); // survives resizes

      // ---- Write to the DOM directly (no React render) ----
      el.style.transform = `translate3d(${Math.round(st.x)}px, ${Math.round(st.y)}px, 0)`;
      if (el.dataset.dir !== String(st.dir)) el.dataset.dir = String(st.dir);

      // Put the bubble on whichever side of his head has more room, and size it to fit.
      if (bubbleOpen.current) {
        const roomRight = nook.clientWidth - st.x - BUBBLE_OFFSET - 8;
        const roomLeft = st.x;
        const side = roomRight >= roomLeft ? "right" : "left";
        el.dataset.side = side;
        el.style.setProperty(
          "--bw",
          `${clamp(side === "right" ? roomRight : roomLeft, 110, 190)}px`,
        );
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf); // stop the loop when the component unmounts
  }, [go, speak]);

  /* ---- POINTER EVENTS: one API for mouse, touch and pen ---- */
  const bounds = () => {
    const nook = nookRef.current!;
    return {
      rect: nook.getBoundingClientRect(),
      maxX: Math.max(0, nook.clientWidth - W),
      floorY: nook.clientHeight - FLOOR - H,
    };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!nookRef.current) return;
    // Capture: we keep receiving move/up events even if the pointer leaves the button.
    e.currentTarget.setPointerCapture(e.pointerId);
    const st = sim.current;
    const { rect } = bounds();
    st.pressed = true;
    st.dragging = false;
    st.startX = e.clientX;
    st.startY = e.clientY;
    // Remember WHERE on his body you grabbed, so he doesn't snap his corner to your finger.
    st.grabDX = e.clientX - rect.left - st.x;
    st.grabDY = e.clientY - rect.top - st.y;
    st.samples = [];
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const st = sim.current;
    if (!st.pressed || !nookRef.current) return;

    if (!st.dragging) {
      // A press that barely moved is a tap, not a drag.
      if (
        Math.hypot(e.clientX - st.startX, e.clientY - st.startY) <
        DRAG_THRESHOLD
      )
        return;
      st.dragging = true;
      go("drag");
      speak("picked_up");
    }

    const { rect, maxX, floorY } = bounds();
    st.x = clamp(e.clientX - rect.left - st.grabDX, 0, maxX);
    st.y = clamp(e.clientY - rect.top - st.grabDY, 0, floorY);

    // Keep the last few positions with timestamps; on release they give us a throw velocity.
    st.samples.push({ x: st.x, y: st.y, t: performance.now() });
    if (st.samples.length > 8) st.samples.shift();
  };

  const release = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const st = sim.current;
    if (!st.pressed) return;
    st.pressed = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);

    if (!st.dragging) {
      // It was a tap: he stops walking to chat.
      if (st.mode === "walk") {
        st.timer = 2.5;
        go("pause");
      }
      speak("tap");
      return;
    }
    st.dragging = false;

    // Velocity = distance / time over the last ~100ms of dragging.
    const now = performance.now();
    const recent = st.samples.filter((s) => now - s.t < 100);
    let vx = 0,
      vy = 0;
    if (recent.length >= 2) {
      const a = recent[0],
        b = recent[recent.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt > 0.01) {
        vx = clamp((b.x - a.x) / dt, -1100, 1100);
        vy = clamp((b.y - a.y) / dt, -1100, 1100);
      }
    }

    const { floorY } = bounds();
    if (st.y >= floorY - 2 && Math.abs(vy) < 200) {
      st.timer = 1.5; // set down gently on the grass
      go("pause");
    } else {
      st.vx = vx;
      st.vy = vy;
      go("fall");
      if (Math.hypot(vx, vy) > 650) speak("thrown");
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      speak("tap");
    }
  };

  return (
    <div className="nook px-box" data-phase={phase} ref={nookRef}>
      <div className="nook__sun" />
      <Decor />
      <div className="nook__ground" />

      {/* data-dir and data-side are set by the loop, so they are NOT in JSX:
          React would otherwise overwrite them on re-render. */}
      <button
        ref={elRef}
        className="marrow"
        data-mode={mode}
        aria-label="Old Marrow. Tap to chat, or drag him around."
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={release}
        onPointerCancel={cancel}
        onKeyDown={onKeyDown}
      >
        {/* Nested wrappers because two animations on one element would fight over `transform`. */}
        <span className="marrow__flip">
          <span className="marrow__squash">
            <span className="marrow__bob">
              <svg
                width={W}
                height={H}
                viewBox={`0 0 ${MARROW_W} ${MARROW_H}`}
                shapeRendering="crispEdges"
                aria-hidden
              >
                <PixelRects rows={MARROW_BODY} palette={MARROW_PALETTE} />
                <PixelRects
                  rows={MARROW_FACES[expr]}
                  palette={MARROW_PALETTE}
                />
                <g className="leg-a">
                  <PixelRects
                    rows={MARROW_LEGS_A}
                    palette={MARROW_PALETTE}
                    y0={MARROW_LEGS_Y}
                  />
                </g>
                <g className="leg-b">
                  <PixelRects
                    rows={MARROW_LEGS_B}
                    palette={MARROW_PALETTE}
                    y0={MARROW_LEGS_Y}
                  />
                </g>
              </svg>
            </span>
          </span>
        </span>

        {mode === "dizzy" && (
          <span className="stars">
            <PixelSprite rows={STAR} palette={DECOR_PALETTE} scale={3} />
            <PixelSprite rows={STAR} palette={DECOR_PALETTE} scale={3} />
          </span>
        )}

        {/* A child of the button but NOT of the flipped wrapper: it follows him around
            without ever being mirrored, and grows out of the side of his head. */}
        {line && (
          <span className="bubble" key={line} aria-live="polite">
            <Typewriter key={line} text={line} />
          </span>
        )}
      </button>
    </div>
  );
}
