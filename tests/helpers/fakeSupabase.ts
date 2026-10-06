import crypto from 'crypto';

/**
 * Tiny in-memory stand-in for the subset of supabase-js used by the API
 * (select / insert / upsert / update / delete, eq / in / ilike, order, limit,
 * maybeSingle / single). It also mimics the ON DELETE CASCADE rules, so the
 * tests exercise the real handler + store code, not a mock of it.
 */
type Row = Record<string, any>;

export function createFakeSupabase() {
  const tables: Record<string, Row[]> = {
    users: [], user_roles: [], admin_audit_logs: [],
    academy_courses: [], academy_lessons: [], academy_user_progress: [], academy_access: [],
  };
  let userCounter = 100;

  const withDefaults = (table: string, row: Row): Row => {
    const r = { ...row };
    const now = new Date().toISOString();
    if (!r.created_at) r.created_at = now;
    if (['users', 'academy_user_progress', 'academy_access', 'admin_audit_logs', 'user_roles'].includes(table) && !r.id) {
      r.id = crypto.randomUUID();
    }
    if (table === 'users') {
      r.customer_code ??= `YK-${++userCounter}`;
      r.status ??= 'active';
    }
    return r;
  };

  const cascade = (table: string, removed: Row[]) => {
    const ids = new Set(removed.map(r => r.id));
    if (table === 'users') {
      tables.academy_user_progress = tables.academy_user_progress.filter(r => !ids.has(r.user_id));
      tables.academy_access = tables.academy_access.filter(r => !ids.has(r.user_id));
    }
    if (table === 'academy_lessons') {
      tables.academy_user_progress = tables.academy_user_progress.filter(r => !ids.has(r.lesson_id));
    }
    if (table === 'academy_courses') {
      const lessonIds = new Set(tables.academy_lessons.filter(l => ids.has(l.course_id)).map(l => l.id));
      tables.academy_lessons = tables.academy_lessons.filter(l => !ids.has(l.course_id));
      tables.academy_user_progress = tables.academy_user_progress.filter(r => !lessonIds.has(r.lesson_id));
      tables.academy_access = tables.academy_access.filter(r => !ids.has(r.course_id));
    }
  };

  class Query {
    private filters: Array<(r: Row) => boolean> = [];
    private op: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
    private payload: any;
    private onConflict?: string;
    private sort?: { col: string; asc: boolean };
    private max?: number;
    private returning = false;
    private table: string;
    constructor(table: string) { this.table = table; }

    select(_cols?: string) { if (this.op !== 'select') this.returning = true; return this; }
    insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
    upsert(p: any, o?: { onConflict?: string }) { this.op = 'upsert'; this.payload = p; this.onConflict = o?.onConflict; return this; }
    update(p: any) { this.op = 'update'; this.payload = p; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(c: string, v: any) { this.filters.push(r => r[c] === v); return this; }
    in(c: string, vs: any[]) { this.filters.push(r => vs.includes(r[c])); return this; }
    ilike(c: string, pat: string) {
      const needle = pat.replace(/%/g, '').toLowerCase();
      this.filters.push(r => String(r[c] ?? '').toLowerCase().includes(needle));
      return this;
    }
    order(col: string, o?: { ascending?: boolean }) { this.sort = { col, asc: o?.ascending !== false }; return this; }
    limit(n: number) { this.max = n; return this; }

    private run(): { data: any; error: any } {
      const rows = tables[this.table];
      if (!rows) return { data: null, error: { message: `no such table ${this.table}` } };
      const match = (r: Row) => this.filters.every(f => f(r));

      if (this.op === 'insert' || this.op === 'upsert') {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(p => withDefaults(this.table, p));
        const out: Row[] = [];
        for (const row of list) {
          let existing: Row | undefined;
          if (this.op === 'upsert' && this.onConflict) {
            const keys = this.onConflict.split(',');
            existing = rows.find(r => keys.every(k => r[k] === row[k]));
          }
          if (existing) { Object.assign(existing, { ...row, id: existing.id, customer_code: existing.customer_code ?? row.customer_code }); out.push(existing); }
          else { rows.push(row); out.push(row); }
        }
        return { data: out, error: null };
      }
      if (this.op === 'update') {
        const hit = rows.filter(match);
        hit.forEach(r => Object.assign(r, this.payload));
        return { data: hit, error: null };
      }
      if (this.op === 'delete') {
        const hit = rows.filter(match);
        tables[this.table] = rows.filter(r => !hit.includes(r));
        cascade(this.table, hit);
        return { data: hit, error: null };
      }
      let out = rows.filter(match).map(r => ({ ...r }));
      if (this.sort) {
        const { col, asc } = this.sort;
        out.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (asc ? 1 : -1));
      }
      if (this.max !== undefined) out = out.slice(0, this.max);
      return { data: out, error: null };
    }

    maybeSingle() { const r = this.run(); return Promise.resolve({ data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error }); }
    single() { return this.maybeSingle(); }
    then(resolve: any, reject: any) { return Promise.resolve(this.run()).then(resolve, reject); }
  }

  return {
    tables,
    from: (t: string) => new Query(t),
    seedAcademy() {
      tables.academy_courses.push(
        { id: 'course_cargo_101', title: 'Cargo kursi', description: '', category: 'cargo', icon: '📦', order: 1, active: true },
      );
      const mk = (n: number) => ({
        id: `les_${n}`, course_id: 'course_cargo_101', order: n, title: `Dars ${n}`, description: '',
        youtube_video_id: `VIDEOID${String(n).padStart(4, '0')}`, duration_seconds: 100,
      });
      tables.academy_lessons.push(mk(1), mk(2), mk(3));
    },
  };
}
