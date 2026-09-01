import { db } from '../db';
import { StaffShift } from '../../types';

export async function getAllShifts(): Promise<StaffShift[]> {
  const shifts = await db.shifts.toArray();
  return shifts.sort((a, b) => (b.checkInDate + (b.checkInTime || '')).localeCompare(a.checkInDate + (a.checkInTime || '')));
}

export async function getShiftById(id: string): Promise<StaffShift | undefined> {
  return await db.shifts.get(id);
}

export async function saveShift(shift: StaffShift): Promise<void> {
  const toSave: StaffShift = {
    ...shift,
    createdAt: shift.createdAt || new Date().toISOString(),
    updatedAt: shift.updatedAt || new Date().toISOString(),
  };
  await db.shifts.put(toSave);
}

export async function saveShiftsBulk(shifts: StaffShift[]): Promise<void> {
  await db.shifts.bulkPut(shifts);
}

export async function deleteShift(id: string): Promise<void> {
  await db.shifts.delete(id);
}

export async function clearAllShifts(): Promise<void> {
  await db.shifts.clear();
}
