import Database from 'better-sqlite3';
import * as fs from 'fs';
import sexp from 'sexpression';

export interface NodeData {
  id: string;
  title: string;
  heading: string | null;
  tags: string[] | null;
}

export interface EdgeData {
  source: string;
  dest: string;
  type: string;
  outline: string | null;
}

export interface ProbeResult {
  node_data: NodeData[];
  edge_data: EdgeData[];
}

export class SqliteProbe {
  /**
   * Probes a better-sqlite3 database and extracts node and edge data.
   * @param dbPath - Path to the SQLite database file.
   * @returns Object containing node_data and edge_data arrays.
   */
  public static probeDatabase(dbPath: string): ProbeResult {
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database file not found: ${dbPath}`);
    }

    const db = new Database(dbPath, { readonly: true });

    const edge_data: EdgeData[] = db
      .prepare(`SELECT source, dest, type, properties FROM links;`)
      .all()
      .map((row: { source: string; dest: string; type: string; properties: string }) => {
        const parsedProperties = sexp.parse(row.properties.replaceAll(/\\"/g, "'"));
        const outlineRaw = (parsedProperties as any).outline;
        const outline = outlineRaw ? outlineRaw.join('/') : null;

        return {
          source: JSON.parse(row.source) as string,
          dest: JSON.parse(row.dest) as string,
          type: JSON.parse(row.type) as string,
          outline,
        };
      });

    const node_data: NodeData[] = db
      .prepare(`SELECT properties FROM nodes;`)
      .all()
      .map((row: { properties: string }) => {
        const normalized = row.properties
          .replaceAll(/\\"/g, "'")
          .replaceAll('#(', '(');

        const das = sexp.parse(normalized) as any[];
        const res = Object.fromEntries(new Map(das.map((x) => [x.car, x.cdr])));

        let tags: string[] | null = null;
        if ('ALLTAGS' in res && Array.isArray(res['ALLTAGS'])) {
          tags = res['ALLTAGS'][0]
            .split(':')
            .filter((x: string) => x !== '' && x !== 'ATTACH');
        }

        return {
          id: res['ID'] as string,
          title: res['CATEGORY'] as string,
          heading: (res['ITEM'] as string) || null,
          tags,
        };
      });

    db.close();

    return { node_data, edge_data };
  }
}

// CLI usage
const dbPath = process.argv[2];
if (!dbPath) {
  console.error('Usage: npx tsx database.ts <db-path>');
  process.exit(1);
}
const info = SqliteProbe.probeDatabase(dbPath);
console.log(JSON.stringify(info, null, 2));