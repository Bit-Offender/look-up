export type Mission = {
  id: string;
  title: string;
  time: string[];
  sky: string[];
  instruction: string;
  min: number;
};

export const missions: Mission[] = [
  {
    id: "cloud-zoo",
    title: "Cloud Zoo",
    time: ["day"],
    sky: ["cloudy"],
    instruction: "Find three animals or objects in the clouds.",
    min: 5,
  },
  {
    id: "shadow-clock",
    title: "Shadow Clock",
    time: ["day"],
    sky: ["clear"],
    instruction:
      "Mark your shadow's tip with a stone. Wait, then see how far it moved.",
    min: 5,
  },
  {
    id: "golden-hands",
    title: "Golden Hands",
    time: ["golden"],
    sky: ["clear"],
    instruction:
      "Watch the light change on one surface until it turns orange.",
    min: 5,
  },
  {
    id: "moon-hello",
    title: "Moon Hello",
    time: ["dusk", "night"],
    sky: ["clear"],
    instruction:
      "Find the moon. Look for one dark patch and one bright patch.",
    min: 3,
  },
  {
    id: "first-star",
    title: "First Star",
    time: ["dusk"],
    sky: ["clear"],
    instruction:
      "Wait for the first star or planet. Stay until you spot three.",
    min: 8,
  },
  {
    id: "rain-orchestra",
    title: "Rain Orchestra",
    time: ["any"],
    sky: ["rain"],
    instruction:
      "Stay under cover. Count the different sounds the rain makes.",
    min: 5,
  },
  {
    id: "wind-reader",
    title: "Wind Reader",
    time: ["day"],
    sky: ["any"],
    instruction:
      "Use leaves or trees to find the wind's direction. Face it for a minute.",
    min: 3,
  },
  {
    id: "bird-count",
    title: "Bird Count",
    time: ["dawn", "day"],
    sky: ["clear", "cloudy"],
    instruction:
      "Stand still and count distinct bird calls.",
    min: 5,
  },
  {
    id: "sunset-colors",
    title: "Sunset Colors",
    time: ["golden", "dusk"],
    sky: ["clear"],
    instruction:
      "Watch the sky colors change near the horizon, not the sun itself. Name three.",
    min: 8,
  },
  {
    id: "tree-gaps",
    title: "Tree Gaps",
    time: ["day"],
    sky: ["any"],
    instruction:
      "Stand under a tree and look up. Trace the shape of one sky gap.",
    min: 3,
  },
  {
    id: "contrail-hunt",
    title: "Contrail Hunt",
    time: ["day"],
    sky: ["clear"],
    instruction:
      "Find a plane trail and follow it to where it fades.",
    min: 4,
  },
  {
    id: "dark-adapt",
    title: "Dark Adapt",
    time: ["night"],
    sky: ["clear"],
    instruction:
      "Look at the sky, no phone, for 5 minutes. Count how many more stars appear.",
    min: 6,
  },
  {
    id: "far-point",
    title: "Far Point",
    time: ["any"],
    sky: ["any"],
    instruction:
      "Find the farthest thing you can see. Look at it for two minutes.",
    min: 2,
  },
  {
    id: "puddle-sky",
    title: "Puddle Sky",
    time: ["day"],
    sky: ["any"],
    instruction:
      "Find a puddle with the sky in it. Spot something up there you'd missed.",
    min: 3,
  },
  {
    id: "dew-check",
    title: "Dew Check",
    time: ["dawn"],
    sky: ["clear"],
    instruction:
      "Find one water drop on a leaf or grass. Look at what it reflects.",
    min: 3,
  },
];
