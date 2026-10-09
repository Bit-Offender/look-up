/**
 * Pixel art as DATA.
 * Each sprite is an array of strings: one character = one pixel, "." = transparent.
 * A palette maps characters to colors. PixelSprite.tsx turns this into SVG.
 * To edit art, change a letter. To recolor, change the palette.
 */

export const MARROW_W = 16;
export const MARROW_H = 20;
/** Rows 0-17 are body; rows 18-19 are legs, drawn in two frames for the walk cycle. */
export const MARROW_LEGS_Y = 18;

export const MARROW_PALETTE: Record<string, string> = {
  h: "#f0c46a", H: "#d9a64a", B: "#5f8a34", f: "#ff7f8e", F: "#ffe08a", // straw hat, band, flower
  s: "#f6d2ab", r: "#f2958a", e: "#3b2a1e", E: "#ffffff", m: "#b5523b", // skin, blush, eyes, sparkle, mouth
  w: "#fbf6ea", // hair + beard
  c: "#d98a55", C: "#b06a3c", g: "#fff3dc", // cardigan, shade, buttons
  p: "#55708f", k: "#5a3b22", t: "#8a6a42", l: "#7fae45", // trousers, boots, stick, leaf
};

export type Expr = "happy" | "oh" | "dizzy";

export const MARROW_BODY = [
  "......hhhh......",
  "....hhhhhhhh....",
  "...hhBBBBfFhh...",
  "..hhhhhhhhhhhh..",
  ".HHHHHHHHHHHHHH.",
  "..wwssssssssww..",
  "..wssssssssssw..",
  "..wseEsssseEsw..",
  "..wseesssseeswl.",
  "..wrrssssssrrwt.",
  "...wwwsmmswww.t.",
  "...wwwwwwwwww.t.",
  "...ccwwwwwwcc.t.",
  "...ccccgccccc.t.",
  "..Cccccccccccst.",
  "..scccgcccccc.t.",
  "...cccccccccc.t.",
  "....pppppppp..t."
];

export const MARROW_LEGS_A = [
  "....ppp..ppp..t.",
  "...kkkk..kkkk.t."
];

export const MARROW_LEGS_B = [
  ".....ppp.ppp..t.",
  "....kkkk.kkkk.t."
];

/** Face overlays: same size as the body, drawn on top. Only the changed pixels are non-".". */
export const MARROW_FACES: Record<Expr, string[]> = {
  "happy": [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................"
  ],
  "oh": [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    ".......ee.......",
    ".......ee.......",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................"
  ],
  "dizzy": [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "....ss....ss....",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "................"
  ]
};

export const DECOR_PALETTE: Record<string, string> = {
  g: "#6f9a3a", G: "#4a7030", L: "#a3b83e", T: "#8a5a35", D: "#5f3d22", a: "#e86a6a", // tree
  f: "#ff8fa3", q: "#ffd36a", Y: "#f2a33a", S: "#4a7030", l: "#6f9a3a", // flowers
  R: "#e0584f", W: "#fff3dc", u: "#f3e2c3", c: "#d8c29a", // mushroom
  P: "#ff9ec7", K: "#3b2a1e", Z: "#ffe08a", z: "#fff3dc", // butterfly, star
  // These use CSS variables, so day/dusk/night can recolor them from pixel.css:
  C: "var(--cloud)", V: "var(--cloud-shade)", H: "var(--hill)",
};

export const TREE = [
  "....GGGG....",
  "..GGggggGG..",
  ".GggLggggGg.",
  ".GgggggaggG.",
  "GggLggggggGG",
  "GgggggagggGG",
  ".GggggggggG.",
  "..GGgggggG..",
  "....GGGG....",
  ".....TD.....",
  ".....TD.....",
  ".....TD.....",
  "....TTDD....",
  "...TTTDDD..."
];

export const FLOWER_A = [
  ".fff.",
  "fYYYf",
  ".fff.",
  "..S..",
  ".lS..",
  "..Sl.",
  "..S.."
];

export const FLOWER_B = [
  ".qqq.",
  "qYYYq",
  ".qqq.",
  "..S..",
  ".lS..",
  "..Sl.",
  "..S.."
];

export const MUSHROOM = [
  "..RRR..",
  ".RWRRWR",
  "RRRRRRR",
  "..ucu..",
  "..ucu..",
  "..uuu.."
];

export const CLOUD = [
  "....CCC.......",
  "..CCCCCCC.CC..",
  ".CCCCCCCCCCCC.",
  "CCCCCCCCCCCCCC",
  "..VVVVVVVVVV.."
];

export const HILL = [
  ".......HHHHHH.......",
  ".....HHHHHHHHHH.....",
  "...HHHHHHHHHHHHHH...",
  ".HHHHHHHHHHHHHHHHHH.",
  "HHHHHHHHHHHHHHHHHHHH"
];

export const BUTTERFLY = [
  "PP..PP",
  "PPKKPP",
  ".PKKP.",
  "..KK.."
];

export const STAR = [
  "..Z..",
  "..Z..",
  "ZZzZZ",
  "..Z..",
  "..Z.."
];