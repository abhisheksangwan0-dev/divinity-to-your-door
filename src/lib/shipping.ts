export type Zone = {
  id: string;
  name: string;
  eta: string;
  baseCents: number;
  perItemCents: number;
};

export const FREE_SOUTH_ASIA_CENTS = 4000;

export const ZONES: Zone[] = [
  {
    id: "south-asia",
    name: "South Asia",
    eta: "4–8 days",
    baseCents: 450,
    perItemCents: 120,
  },
  {
    id: "mena",
    name: "Middle East & North Africa",
    eta: "7–14 days",
    baseCents: 1200,
    perItemCents: 280,
  },
  {
    id: "europe",
    name: "Europe",
    eta: "8–16 days",
    baseCents: 1400,
    perItemCents: 320,
  },
  {
    id: "americas",
    name: "The Americas",
    eta: "9–18 days",
    baseCents: 1600,
    perItemCents: 380,
  },
  {
    id: "pacific",
    name: "East Asia & Pacific",
    eta: "8–16 days",
    baseCents: 1500,
    perItemCents: 340,
  },
  {
    id: "africa",
    name: "Sub-Saharan Africa",
    eta: "10–20 days",
    baseCents: 1700,
    perItemCents: 360,
  },
];

export const COUNTRIES: { name: string; zone: string }[] = [
  { name: "Argentina", zone: "americas" },
  { name: "Australia", zone: "pacific" },
  { name: "Bahrain", zone: "mena" },
  { name: "Bangladesh", zone: "south-asia" },
  { name: "Bhutan", zone: "south-asia" },
  { name: "Brazil", zone: "americas" },
  { name: "Canada", zone: "americas" },
  { name: "Chile", zone: "americas" },
  { name: "Colombia", zone: "americas" },
  { name: "Egypt", zone: "mena" },
  { name: "Ethiopia", zone: "africa" },
  { name: "France", zone: "europe" },
  { name: "Germany", zone: "europe" },
  { name: "Ghana", zone: "africa" },
  { name: "Greece", zone: "europe" },
  { name: "India", zone: "south-asia" },
  { name: "Indonesia", zone: "pacific" },
  { name: "Ireland", zone: "europe" },
  { name: "Israel", zone: "mena" },
  { name: "Italy", zone: "europe" },
  { name: "Japan", zone: "pacific" },
  { name: "Jordan", zone: "mena" },
  { name: "Kenya", zone: "africa" },
  { name: "Kuwait", zone: "mena" },
  { name: "Lebanon", zone: "mena" },
  { name: "Malaysia", zone: "pacific" },
  { name: "Maldives", zone: "south-asia" },
  { name: "Mexico", zone: "americas" },
  { name: "Morocco", zone: "mena" },
  { name: "Nepal", zone: "south-asia" },
  { name: "Netherlands", zone: "europe" },
  { name: "New Zealand", zone: "pacific" },
  { name: "Nigeria", zone: "africa" },
  { name: "Norway", zone: "europe" },
  { name: "Oman", zone: "mena" },
  { name: "Pakistan", zone: "south-asia" },
  { name: "Philippines", zone: "pacific" },
  { name: "Poland", zone: "europe" },
  { name: "Portugal", zone: "europe" },
  { name: "Qatar", zone: "mena" },
  { name: "Saudi Arabia", zone: "mena" },
  { name: "Singapore", zone: "pacific" },
  { name: "South Africa", zone: "africa" },
  { name: "South Korea", zone: "pacific" },
  { name: "Spain", zone: "europe" },
  { name: "Sri Lanka", zone: "south-asia" },
  { name: "Sweden", zone: "europe" },
  { name: "Switzerland", zone: "europe" },
  { name: "Tanzania", zone: "africa" },
  { name: "Thailand", zone: "pacific" },
  { name: "Turkey", zone: "mena" },
  { name: "United Arab Emirates", zone: "mena" },
  { name: "United Kingdom", zone: "europe" },
  { name: "United States", zone: "americas" },
];

export function zoneById(id: string) {
  return ZONES.find((zone) => zone.id === id) ?? null;
}

export function shippingCents(zoneId: string, itemCount: number, subtotalCents: number) {
  const zone = zoneById(zoneId);
  if (!zone || itemCount < 1) return null;
  if (zone.id === "south-asia" && subtotalCents >= FREE_SOUTH_ASIA_CENTS) return 0;
  return zone.baseCents + zone.perItemCents * itemCount;
}
