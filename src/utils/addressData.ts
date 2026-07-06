export interface SocietyConfig {
  name: string;
  towers: string[];
  floorsCount: number;
  flatsPerFloor: number;
}

export const CENTURIAN_SOCIETIES: SocietyConfig[] = [
  {
    name: "Centurian Park - O2 Valley",
    towers: ["F-18", "F-17", "F-16"],
    floorsCount: 18,
    flatsPerFloor: 6
  },
  {
    name: "Centurian Park - Low Rise",
    towers: ["C1-C600", "D1-D33", "E1-29"],
    floorsCount: 4,
    flatsPerFloor: 4
  },
  {
    name: "Centurian Park - Terrace Homes",
    towers: ["A1-A5", "B1-B9"],
    floorsCount: 12,
    flatsPerFloor: 4
  },
  {
    name: "Centurian Park - Tropical Garden",
    towers: ["F1-F15"],
    floorsCount: 15,
    flatsPerFloor: 6
  }
];

export function generateFlats(flatsPerFloor: number): string[] {
  const flats = [];
  for (let i = 1; i <= flatsPerFloor; i++) {
    flats.push(`Flat ${i < 10 ? "0" + i : i}`);
  }
  return flats;
}

export function formatFlatId(society: string, tower: string, floor: number, flat: string): string {
  return `${society}, ${tower}, Floor ${floor}, ${flat}`;
}
