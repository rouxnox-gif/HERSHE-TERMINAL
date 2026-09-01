import { db } from '../db';
import { Expense } from '../../types';

export async function getAllExpenses(): Promise<Expense[]> {
  const expenses = await db.expenses.toArray();
  return expenses
    .filter(e => !e.isDeleted)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function getExpenseById(id: string): Promise<Expense | undefined> {
  return await db.expenses.get(id);
}

export async function saveExpense(expense: Expense): Promise<void> {
  const toSave: Expense = {
    ...expense,
    createdAt: expense.createdAt || new Date().toISOString(),
    updatedAt: expense.updatedAt || new Date().toISOString(),
  };
  await db.expenses.put(toSave);
}

export async function saveExpensesBulk(expenses: Expense[]): Promise<void> {
  await db.expenses.bulkPut(expenses);
}

export async function deleteExpenseById(id: string): Promise<void> {
  const existing = await db.expenses.get(id);
  if (existing) {
    await db.expenses.update(id, { isDeleted: true, updatedAt: new Date().toISOString() });
  } else {
    await db.expenses.delete(id);
  }
}
