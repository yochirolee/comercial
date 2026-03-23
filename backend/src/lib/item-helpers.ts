/**
 * Helpers for items that may be "free" (no productoId) or catalog-linked.
 * A "free" item has productoId = null and uses nombreProducto / codigoProducto instead.
 */

interface ItemLike {
  producto?: { nombre: string; codigo?: string | null; unidadMedida?: { abreviatura: string } | null } | null;
  nombreProducto?: string | null;
  codigoProducto?: string | null;
}

export function getItemNombre(item: ItemLike): string {
  return item.producto?.nombre ?? item.nombreProducto ?? '';
}

export function getItemCodigo(item: ItemLike): string {
  return item.producto?.codigo ?? item.codigoProducto ?? '';
}

export function getItemUnidadMedida(item: ItemLike): string {
  return item.producto?.unidadMedida?.abreviatura ?? '';
}
