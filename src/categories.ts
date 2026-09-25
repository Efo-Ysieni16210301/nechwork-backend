export const defaultCategories = [
  "Coffee",
  "Tea",
  "Pantry",
  "Home & gifts",
] as const;

export function categorySlug(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
