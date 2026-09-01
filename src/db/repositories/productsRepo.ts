import { db } from '../db';
import { Product } from '../../types';

export async function getAllProducts(): Promise<Product[]> {
  const products = await db.products.toArray();
  return products.filter(p => !p.isDeleted);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  return await db.products.get(id);
}

export async function saveProduct(product: Product): Promise<void> {
  const toSave: Product = {
    ...product,
    updatedAt: product.updatedAt || new Date().toISOString(),
  };
  await db.products.put(toSave);
}

export async function saveProductsBulk(products: Product[]): Promise<void> {
  await db.products.bulkPut(products);
}

export async function deleteProductById(id: string): Promise<void> {
  const existing = await db.products.get(id);
  if (existing) {
    await db.products.update(id, { isDeleted: true, updatedAt: new Date().toISOString() });
  } else {
    await db.products.delete(id);
  }
}
