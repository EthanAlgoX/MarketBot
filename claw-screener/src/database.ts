import initSqlJs, { Database as SqlJsDatabase } from "sql.js";
import { readFileSync, existsSync, writeFileSync } from "fs";
import { join } from "path";

export interface OHLC {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

export interface PriceData {
  ticker: string;
  data: OHLC[];
  fetchedAt: string;
}

export interface SECData {
  [key: string]: unknown;
}

let sqlPromise: ReturnType<typeof initSqlJs> | null = null;

async function getSql(): Promise<ReturnType<typeof initSqlJs>> {
  if (!sqlPromise) {
    sqlPromise = initSqlJs();
  }
  return sqlPromise;
}

export class PriceDataManager {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private ttl: number;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(dbPath: string = "price_cache.db", ttlDays: number = 1) {
    this.dbPath = dbPath;
    this.ttl = ttlDays * 24 * 60 * 60 * 1000;
    this.initPromise = this.initDatabase();
  }

  private async initDatabase(): Promise<void> {
    if (this.initialized) return;
    
    const SQL = await getSql();
    
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    
    this.db.run(`
      CREATE TABLE IF NOT EXISTS price_data (
        ticker TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      )
    `);
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
  }

  private getCachedPrices(ticker: string): OHLC[] | null {
    if (!this.db) return null;

    const stmt = this.db.prepare(
      "SELECT data_json, fetched_at FROM price_data WHERE ticker = ?"
    );
    stmt.bind([ticker]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as { data_json: string; fetched_at: string };
      stmt.free();

      const fetchedAt = new Date(row.fetched_at).getTime();
      if (Date.now() - fetchedAt > this.ttl) return null;

      return JSON.parse(row.data_json);
    }

    stmt.free();
    return null;
  }

  private storePrices(ticker: string, data: OHLC[]): void {
    if (!this.db) return;

    this.db.run(
      `INSERT OR REPLACE INTO price_data (ticker, data_json, fetched_at) VALUES (?, ?, ?)`,
      [ticker, JSON.stringify(data), new Date().toISOString()]
    );
    this.saveToFile();
  }

  private saveToFile(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  async getPrices(ticker: string): Promise<OHLC[] | null> {
    await this.ensureInitialized();
    return this.getCachedPrices(ticker);
  }

  async setPrices(ticker: string, data: OHLC[]): Promise<void> {
    await this.ensureInitialized();
    this.storePrices(ticker, data);
  }

  close(): void {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }
}

export class SECDataManager {
  private db: SqlJsDatabase | null = null;
  private dbPath: string;
  private ttl: number;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor(dbPath: string = "sec_cache.db", ttlDays: number = 7) {
    this.dbPath = dbPath;
    this.ttl = ttlDays * 24 * 60 * 60 * 1000;
    this.initPromise = this.initDatabase();
  }

  private async initDatabase(): Promise<void> {
    if (this.initialized) return;
    
    const SQL = await getSql();
    
    if (existsSync(this.dbPath)) {
      const buffer = readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }
    
    this.db.run(`
      CREATE TABLE IF NOT EXISTS sec_data (
        cik TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        fetched_at TEXT NOT NULL
      )
    `);
    this.initialized = true;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && this.initPromise) {
      await this.initPromise;
    }
  }

  async getData(cik: string, forceRefresh: boolean = false): Promise<SECData | null> {
    await this.ensureInitialized();
    
    if (!forceRefresh) {
      return this.getCachedData(cik);
    }
    return null;
  }

  private getCachedData(cik: string): SECData | null {
    if (!this.db) return null;

    const stmt = this.db.prepare(
      "SELECT data_json, fetched_at FROM sec_data WHERE cik = ?"
    );
    stmt.bind([cik]);

    if (stmt.step()) {
      const row = stmt.getAsObject() as { data_json: string; fetched_at: string };
      stmt.free();

      const fetchedAt = new Date(row.fetched_at).getTime();
      if (Date.now() - fetchedAt > this.ttl) return null;

      return JSON.parse(row.data_json);
    }

    stmt.free();
    return null;
  }

  storeData(cik: string, data: SECData): void {
    if (!this.db) return;

    this.db.run(
      `INSERT OR REPLACE INTO sec_data (cik, data_json, fetched_at) VALUES (?, ?, ?)`,
      [cik, JSON.stringify(data), new Date().toISOString()]
    );
    this.saveToFile();
  }

  private saveToFile(): void {
    if (!this.db) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    writeFileSync(this.dbPath, buffer);
  }

  close(): void {
    if (this.db) {
      this.saveToFile();
      this.db.close();
      this.db = null;
    }
  }
}
