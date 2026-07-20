import mysql from 'mysql2/promise';

// 本地默认: 127.0.0.1:3306 root/123456 库 uno,可用环境变量覆盖(docker 里 MYSQL_HOST=mysql)
const config = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '123456',
  database: process.env.MYSQL_DATABASE || 'uno',
};

// 连接池(初始化完成后赋值)
export let pool: mysql.Pool | undefined;

// 初始化:确保数据库与表存在。失败只记录日志,不让进程崩溃(账号相关接口会返回友好错误)
export const dbReady: Promise<void> = (async () => {
  try {
    // 先用不指定 database 的连接建库
    const bootstrap = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    });
    await bootstrap.query(
      `CREATE DATABASE IF NOT EXISTS \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`
    );
    await bootstrap.end();

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
