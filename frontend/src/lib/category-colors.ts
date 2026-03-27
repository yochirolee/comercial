export function getCategoryBadgeClass(categoryName?: string | null): string {
  if (!categoryName) {
    return "border-slate-200 bg-slate-50 text-slate-600";
  }

  const key = categoryName.trim().toLowerCase();

  // Common category aliases first for stable visual identity.
  if (/(alimento|comida|food|bebida)/.test(key)) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (/(quimic|chemical|limpieza)/.test(key)) {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  if (/(constru|cemento|acero|metal|herramienta)/.test(key)) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }
  if (/(electr|tecno|hardware|equipo)/.test(key)) {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (/(textil|ropa|moda|calzado)/.test(key)) {
    return "border-pink-200 bg-pink-50 text-pink-700";
  }

  const palette = [
    "border-blue-200 bg-blue-50 text-blue-700",
    "border-indigo-200 bg-indigo-50 text-indigo-700",
    "border-teal-200 bg-teal-50 text-teal-700",
    "border-cyan-200 bg-cyan-50 text-cyan-700",
    "border-lime-200 bg-lime-50 text-lime-700",
    "border-orange-200 bg-orange-50 text-orange-700",
    "border-rose-200 bg-rose-50 text-rose-700",
  ];

  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}
