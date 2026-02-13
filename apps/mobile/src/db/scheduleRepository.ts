import type { MonthlySchedule } from '../types/schedule';
import { getDatabase } from './database';

export interface ScheduleRepository {
  getSchedule(month: number, year: number): Promise<MonthlySchedule | null>;
  saveSchedule(month: number, year: number, schedule: MonthlySchedule): Promise<void>;
  hasSchedule(month: number, year: number): Promise<boolean>;
  getFetchedAt(month: number, year: number): Promise<string | null>;
  deleteSchedule(month: number, year: number): Promise<void>;
  clearAll(): Promise<void>;
  getCachedMonths(): Promise<Array<{ month: number; year: number; fetchedAt: string }>>;
}

export class SQLiteScheduleRepository implements ScheduleRepository {
  async getSchedule(month: number, year: number): Promise<MonthlySchedule | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ data: string }>(
      'SELECT data FROM schedules WHERE month = ? AND year = ?',
      [month, year],
    );
    if (!row) return null;
    return JSON.parse(row.data) as MonthlySchedule;
  }

  async saveSchedule(month: number, year: number, schedule: MonthlySchedule): Promise<void> {
    const db = await getDatabase();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO schedules (month, year, data, fetched_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(month, year) DO UPDATE SET data = excluded.data, fetched_at = excluded.fetched_at`,
      [month, year, JSON.stringify(schedule), now],
    );
  }

  async hasSchedule(month: number, year: number): Promise<boolean> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM schedules WHERE month = ? AND year = ?',
      [month, year],
    );
    return (row?.count ?? 0) > 0;
  }

  async getFetchedAt(month: number, year: number): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ fetched_at: string }>(
      'SELECT fetched_at FROM schedules WHERE month = ? AND year = ?',
      [month, year],
    );
    return row?.fetched_at ?? null;
  }

  async deleteSchedule(month: number, year: number): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM schedules WHERE month = ? AND year = ?', [month, year]);
  }

  async clearAll(): Promise<void> {
    const db = await getDatabase();
    await db.runAsync('DELETE FROM schedules');
  }

  async getCachedMonths(): Promise<Array<{ month: number; year: number; fetchedAt: string }>> {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ month: number; year: number; fetched_at: string }>(
      'SELECT month, year, fetched_at FROM schedules ORDER BY year, month',
    );
    return rows.map((r) => ({ month: r.month, year: r.year, fetchedAt: r.fetched_at }));
  }
}
