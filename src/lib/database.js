import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const DB_PATH = path.join(process.cwd(), 'expense_flow.db');

// Upewnij się, że folder istnieje
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db;

try {
  db = new Database(DB_PATH);
  console.log('Połączono z bazą danych SQLite');
} catch (error) {
  console.error('Błąd połączenia z bazą danych:', error);
  process.exit(1);
}

// Funkcje inicjalizacji bazy danych
export const initDatabase = () => {
  try {
    // Włącz foreign keys
    db.pragma('foreign_keys = ON');

    // Tworzenie tabel
    const schema = fs.readFileSync(path.join(process.cwd(), 'database_schema.sql'), 'utf8');

    // Podziel na poszczególne instrukcje SQL
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    // Wykonaj każdą instrukcję
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          db.exec(statement);
        } catch (error) {
          // Ignoruj błędy dla tabel, które już istnieją
          if (!error.message.includes('already exists')) {
            console.error('Błąd wykonania instrukcji SQL:', statement);
            console.error(error);
          }
        }
      }
    }

    console.log('Baza danych została zainicjalizowana');
  } catch (error) {
    console.error('Błąd inicjalizacji bazy danych:', error);
  }
};

// Funkcje użytkowników
export const createUser = async (email, password, fullName = '') => {
  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const stmt = db.prepare(`
      INSERT INTO users (email, password_hash, full_name, created_at, updated_at)
      VALUES (?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(email, hashedPassword, fullName);
    return { id: result.lastInsertRowid, email, fullName };
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new Error('Użytkownik z tym adresem email już istnieje');
    }
    throw error;
  }
};

export const authenticateUser = async (email, password) => {
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1');
    const user = stmt.get(email);

    if (!user) {
      throw new Error('Nieprawidłowy email lub hasło');
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      throw new Error('Nieprawidłowy email lub hasło');
    }

    // Aktualizuj last_login
    const updateStmt = db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?');
    updateStmt.run(user.id);

    // Usuń wrażliwe dane
    const { password_hash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  } catch (error) {
    throw error;
  }
};

export const getUserById = (id) => {
  try {
    const stmt = db.prepare('SELECT id, email, full_name, language, is_active, email_verified, last_login, created_at, updated_at FROM users WHERE id = ?');
    return stmt.get(id);
  } catch (error) {
    throw error;
  }
};

export const updateUser = (id, updates) => {
  try {
    const allowedFields = ['full_name', 'language', 'is_active', 'email_verified'];
    const updateFields = [];
    const values = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        values.push(updates[key]);
      }
    });

    if (updateFields.length === 0) {
      throw new Error('Brak pól do aktualizacji');
    }

    values.push(id);

    const stmt = db.prepare(`
      UPDATE users
      SET ${updateFields.join(', ')}, updated_at = datetime('now')
      WHERE id = ?
    `);

    stmt.run(...values);
    return getUserById(id);
  } catch (error) {
    throw error;
  }
};

// Funkcje sesji
export const createSession = (userId) => {
  try {
    const sessionToken = jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '7d' });
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 dni

    const stmt = db.prepare(`
      INSERT INTO user_sessions (user_id, session_token, expires_at, created_at)
      VALUES (?, ?, ?, datetime('now'))
    `);

    stmt.run(userId, sessionToken, expiresAt.toISOString());
    return sessionToken;
  } catch (error) {
    throw error;
  }
};

export const validateSession = (sessionToken) => {
  try {
    // Najpierw sprawdź JWT
    const decoded = jwt.verify(sessionToken, process.env.JWT_SECRET || 'your-secret-key');

    // Następnie sprawdź w bazie danych
    const stmt = db.prepare(`
      SELECT us.*, u.email, u.full_name, u.language
      FROM user_sessions us
      JOIN users u ON us.user_id = u.id
      WHERE us.session_token = ? AND us.expires_at > datetime('now') AND u.is_active = 1
    `);

    const session = stmt.get(sessionToken);
    if (!session) {
      throw new Error('Sesja jest nieprawidłowa lub wygasła');
    }

    return {
      id: session.user_id,
      email: session.email,
      fullName: session.full_name,
      language: session.language
    };
  } catch (error) {
    throw new Error('Sesja jest nieprawidłowa lub wygasła');
  }
};

export const destroySession = (sessionToken) => {
  try {
    const stmt = db.prepare('DELETE FROM user_sessions WHERE session_token = ?');
    stmt.run(sessionToken);
  } catch (error) {
    throw error;
  }
};

// Funkcje dla innych encji (trading accounts, trades, etc.)
export const getTradingAccounts = (userId) => {
  try {
    const stmt = db.prepare('SELECT * FROM trading_accounts WHERE user_id = ? ORDER BY created_at DESC');
    return stmt.all(userId);
  } catch (error) {
    throw error;
  }
};

export const createTradingAccount = (userId, accountData) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO trading_accounts (
        user_id, name, broker, account_number, account_type, initial_balance,
        currency, current_balance, max_risk_per_trade, max_daily_loss,
        max_weekly_loss, max_monthly_loss, max_daily_loss_amount,
        max_weekly_loss_amount, max_monthly_loss_amount, status, notes,
        color, profit_target, max_drawdown, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      userId,
      accountData.name,
      accountData.broker || null,
      accountData.account_number || null,
      accountData.account_type || 'Demo',
      accountData.initial_balance || null,
      accountData.currency || 'USD',
      accountData.current_balance || accountData.initial_balance || null,
      accountData.max_risk_per_trade || null,
      accountData.max_daily_loss || null,
      accountData.max_weekly_loss || null,
      accountData.max_monthly_loss || null,
      accountData.max_daily_loss_amount || null,
      accountData.max_weekly_loss_amount || null,
      accountData.max_monthly_loss_amount || null,
      accountData.status || 'Aktywne',
      accountData.notes || null,
      accountData.color || '#3b82f6',
      accountData.profit_target || null,
      accountData.max_drawdown || null
    );

    return { id: result.lastInsertRowid, ...accountData };
  } catch (error) {
    throw error;
  }
};

export const getTrades = (userId, filters = {}) => {
  try {
    let query = 'SELECT * FROM trades WHERE user_id = ?';
    const params = [userId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.account_id) {
      query += ' AND account_id = ?';
      params.push(filters.account_id);
    }

    if (filters.strategy_id) {
      query += ' AND strategy_id = ?';
      params.push(filters.strategy_id);
    }

    query += ' ORDER BY date DESC';

    const stmt = db.prepare(query);
    return stmt.all(...params);
  } catch (error) {
    throw error;
  }
};

export const createTrade = (userId, tradeData) => {
  try {
    const stmt = db.prepare(`
      INSERT INTO trades (
        user_id, account_id, strategy_id, symbol, side, quantity,
        entry_price, exit_price, stop_loss, take_profit, commission,
        swap, profit_loss, profit_loss_percentage, date, exit_date,
        status, notes, tags, screenshots, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    const result = stmt.run(
      userId,
      tradeData.account_id || null,
      tradeData.strategy_id || null,
      tradeData.symbol,
      tradeData.side,
      tradeData.quantity,
      tradeData.entry_price,
      tradeData.exit_price || null,
      tradeData.stop_loss || null,
      tradeData.take_profit || null,
      tradeData.commission || 0,
      tradeData.swap || 0,
      tradeData.profit_loss || null,
      tradeData.profit_loss_percentage || null,
      tradeData.date,
      tradeData.exit_date || null,
      tradeData.status || 'Open',
      tradeData.notes || null,
      tradeData.tags ? JSON.stringify(tradeData.tags) : null,
      tradeData.screenshots ? JSON.stringify(tradeData.screenshots) : null
    );

    return { id: result.lastInsertRowid, ...tradeData };
  } catch (error) {
    throw error;
  }
};

// Zamknij połączenie przy wyjściu
process.on('exit', () => {
  if (db) {
    db.close();
    console.log('Połączenie z bazą danych zostało zamknięte');
  }
});

export { db };