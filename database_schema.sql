-- Schema bazy danych dla aplikacji Expense Flow / Trade Log
-- Aplikacja do śledzenia transakcji handlowych i wydatków

-- Tabela użytkowników
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    language VARCHAR(10) DEFAULT 'pl',
    is_active BOOLEAN DEFAULT 1,
    email_verified BOOLEAN DEFAULT 0,
    email_verification_token VARCHAR(255),
    password_reset_token VARCHAR(255),
    password_reset_expires DATETIME,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela sesji użytkowników
CREATE TABLE user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela kont handlowych
CREATE TABLE trading_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    broker VARCHAR(255),
    account_number VARCHAR(100),
    account_type VARCHAR(50) DEFAULT 'Demo', -- Demo, Live
    initial_balance DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    current_balance DECIMAL(15,2),
    max_risk_per_trade DECIMAL(5,2), -- procent
    max_daily_loss DECIMAL(5,2), -- procent
    max_weekly_loss DECIMAL(5,2), -- procent
    max_monthly_loss DECIMAL(5,2), -- procent
    max_daily_loss_amount DECIMAL(15,2),
    max_weekly_loss_amount DECIMAL(15,2),
    max_monthly_loss_amount DECIMAL(15,2),
    status VARCHAR(50) DEFAULT 'Aktywne',
    notes TEXT,
    color VARCHAR(7) DEFAULT '#3b82f6', -- hex color
    profit_target DECIMAL(15,2),
    max_drawdown DECIMAL(5,2), -- procent
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela strategii handlowych
CREATE TABLE strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timeframe VARCHAR(50), -- 1m, 5m, 15m, 1h, 4h, 1d, 1w
    instruments TEXT, -- JSON array of instruments
    risk_per_trade DECIMAL(5,2), -- procent
    expected_win_rate DECIMAL(5,2), -- procent
    expected_risk_reward DECIMAL(5,2), -- ratio
    performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 5),
    status VARCHAR(50) DEFAULT 'Active',
    tags TEXT, -- JSON array of tags
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela transakcji handlowych
CREATE TABLE trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id INTEGER REFERENCES trading_accounts(id),
    strategy_id INTEGER REFERENCES strategies(id),
    symbol VARCHAR(20) NOT NULL,
    side VARCHAR(10) NOT NULL CHECK (side IN ('Buy', 'Sell')),
    quantity DECIMAL(15,8) NOT NULL,
    entry_price DECIMAL(15,8) NOT NULL,
    exit_price DECIMAL(15,8),
    stop_loss DECIMAL(15,8),
    take_profit DECIMAL(15,8),
    commission DECIMAL(15,2) DEFAULT 0,
    swap DECIMAL(15,2) DEFAULT 0,
    profit_loss DECIMAL(15,2),
    profit_loss_percentage DECIMAL(8,4),
    date DATETIME NOT NULL,
    exit_date DATETIME,
    status VARCHAR(50) DEFAULT 'Open', -- Open, Closed, Cancelled
    notes TEXT,
    tags TEXT, -- JSON array of tags
    screenshots TEXT, -- JSON array of image URLs
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela celów inwestycyjnych
CREATE TABLE goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    target_amount DECIMAL(15,2) NOT NULL,
    current_amount DECIMAL(15,2) DEFAULT 0,
    target_date DATE,
    category VARCHAR(100), -- Profit, Account Growth, Risk Management, etc.
    status VARCHAR(50) DEFAULT 'Active', -- Active, Completed, Cancelled
    priority VARCHAR(20) DEFAULT 'Medium', -- Low, Medium, High
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela wycieczek
CREATE TABLE trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    destination VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    budget DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'PLN',
    status VARCHAR(50) DEFAULT 'Planned', -- Planned, Active, Completed, Cancelled
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabela wydatków
CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id INTEGER REFERENCES trips(id),
    vendor VARCHAR(255),
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'PLN',
    date DATE NOT NULL,
    category VARCHAR(100),
    payment_method VARCHAR(50),
    description TEXT,
    receipt_url VARCHAR(500), -- URL to receipt image
    tags TEXT, -- JSON array of tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indeksy dla lepszej wydajności
CREATE INDEX idx_trades_user_id ON trades(user_id);
CREATE INDEX idx_trades_account_id ON trades(account_id);
CREATE INDEX idx_trades_strategy_id ON trades(strategy_id);
CREATE INDEX idx_trades_date ON trades(date);
CREATE INDEX idx_trades_status ON trades(status);

CREATE INDEX idx_trading_accounts_user_id ON trading_accounts(user_id);

CREATE INDEX idx_strategies_user_id ON strategies(user_id);

CREATE INDEX idx_goals_user_id ON goals(user_id);

CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_trip_id ON expenses(trip_id);
CREATE INDEX idx_expenses_date ON expenses(date);

CREATE INDEX idx_trips_user_id ON trips(user_id);
CREATE INDEX idx_trips_dates ON trips(start_date, end_date);

-- Widoki dla analiz
-- Całkowity P&L per konto
CREATE VIEW account_performance AS
SELECT
    ta.id,
    ta.name,
    ta.currency,
    COUNT(t.id) as total_trades,
    SUM(t.profit_loss) as total_profit_loss,
    AVG(t.profit_loss) as avg_profit_loss,
    SUM(CASE WHEN t.profit_loss > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN t.profit_loss < 0 THEN 1 ELSE 0 END) as losing_trades,
    ROUND(
        (SUM(CASE WHEN t.profit_loss > 0 THEN 1 ELSE 0 END) * 100.0 / COUNT(t.id)), 2
    ) as win_rate
FROM trading_accounts ta
LEFT JOIN trades t ON ta.id = t.account_id AND t.status = 'Closed'
GROUP BY ta.id, ta.name, ta.currency;

-- Wydatki per kategoria
CREATE VIEW expense_summary AS
SELECT
    category,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount,
    AVG(amount) as avg_amount,
    currency
FROM expenses
WHERE category IS NOT NULL
GROUP BY category, currency
ORDER BY total_amount DESC;

-- Miesięczne podsumowanie transakcji
CREATE VIEW monthly_trade_summary AS
SELECT
    DATE_TRUNC('month', date) as month,
    COUNT(*) as trade_count,
    SUM(profit_loss) as monthly_pl,
    SUM(CASE WHEN profit_loss > 0 THEN profit_loss ELSE 0 END) as gross_profit,
    SUM(CASE WHEN profit_loss < 0 THEN ABS(profit_loss) ELSE 0 END) as gross_loss,
    AVG(profit_loss) as avg_trade_pl
FROM trades
WHERE status = 'Closed'
GROUP BY DATE_TRUNC('month', date)
ORDER BY month DESC;</content>
<parameter name="filePath">c:\Users\pawel\Desktop\expense-flow-copy-43bc5e1e\database_schema.sql