import { db } from '../db';
import { MonthlyDistributionConfig } from '../../types';

export async function getAllDistributions(): Promise<Record<string, MonthlyDistributionConfig>> {
  const list = await db.distributions.toArray();
  const map: Record<string, MonthlyDistributionConfig> = {};
  for (const item of list) {
    map[item.month] = item;
  }
  return map;
}

export async function getDistributionForMonth(month: string): Promise<MonthlyDistributionConfig | undefined> {
  return await db.distributions.get(month);
}

export async function saveDistribution(config: MonthlyDistributionConfig): Promise<void> {
  const toSave: MonthlyDistributionConfig = {
    ...config,
    updatedAt: config.updatedAt || new Date().toISOString(),
  };
  await db.distributions.put(toSave);
}

export async function saveDistributionsBulk(configs: MonthlyDistributionConfig[]): Promise<void> {
  await db.distributions.bulkPut(configs);
}
