import mysql from 'mysql2/promise';

// Production credentials are supplied through environment variables.
const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'uno',
};

// 连接池(初始化完成后赋值)
export let pool: mysql.Pool | undefined;

// The database itself is provisioned by deployment; the app owns its tables only.
export const dbReady: Promise<void> = (async () => {
  try {
    pool = mysql.createPool({
      ...config,
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    });

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        uid CHAR(8) NOT NULL PRIMARY KEY,
        name VARCHAR(32) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar MEDIUMTEXT,
        token VARCHAR(64),
        create_time BIGINT NOT NULL,
        UNIQUE KEY uk_name (name),
        KEY idx_token (token)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    console.log(`MySQL 已就绪 (${config.host}:${config.port}/${config.database})`);
  } catch (err) {
    console.error('MySQL 初始化失败:', (err as Error).message);
  }
})();
