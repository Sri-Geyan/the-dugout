import Database from 'better-sqlite3';
import path from 'path';

async function main() {
    const sqlitePath = path.join(process.cwd(), 'data', 'players.db');
    const sqliteDb = new Database(sqlitePath);

    const updateStmt = sqliteDb.prepare("UPDATE players SET name = 'Vicky Kanhaiya Ostwal' WHERE name = 'Vicky Ostwal'");
    const res = updateStmt.run();

    console.log("Updated Vicky Ostwal's name: ", res.changes);
    sqliteDb.close();
}

main().catch(console.error);
