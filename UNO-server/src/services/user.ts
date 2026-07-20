import crypto from 'crypto';
import type { RowDataPacket } from 'mysql2';
import { dbReady, pool } from './db';

// ---- 基础工具 ----
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const target = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, 64);
  return target.length === actual.length && crypto.timingSafeEqual(target, actual);
}

function genToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function normalizeName(name: unknown): string {
  return typeof name === 'string' ? name.trim() : '';
}

function rowToProfile(row: RowDataPacket): UserProfile {
  return { uid: row.uid, name: row.name, avatar: row.avatar || '', token: row.token || '' };
}

type Result = { ok: true; profile: UserProfile } | { ok: false; message: string };

// 拿到就绪后的连接池,拿不到说明数据库不可用
async function getPool() {
  await dbReady;
  return pool;
}

async function findByName(db: NonNullable<typeof pool>, name: string): Promise<RowDataPacket | undefined> {
  const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM users WHERE name = ? LIMIT 1', [name]);
  return rows[0];
}

async function genUid(db: NonNullable<typeof pool>): Promise<string> {
  for (let i = 0; i < 5; i += 1) {
    const uid = crypto.randomBytes(4).toString('hex'); // 8 位十六进制
    const [rows] = await db.query<RowDataPacket[]>('SELECT uid FROM users WHERE uid = ? LIMIT 1', [uid]);
    if (!rows.length) return uid;
  }
  return crypto.randomBytes(4).toString('hex');
}

// ---- 对外能力 ----
export async function registerAccount(rawName: string, password: string): Promise<Result> {
  const name = normalizeName(rawName);
  if (name.length < 1 || name.length > 16) return { ok: false, message: '用户名需为 1-16 个字符' };
  if (typeof password !== 'string' || password.length < 4) return { ok: false, message: '密码至少 4 位' };

  const db = await getPool();
  if (!db) return { ok: false, message: '数据库暂不可用，请稍后再试' };

  if (await findByName(db, name)) return { ok: false, message: '用户名已存在，请更换' };

  const profile: UserProfile = {
    uid: await genUid(db),
    name,
    avatar: '',
    token: genToken(),
  };
  try {
    await db.query(
      'INSERT INTO users (uid, name, password_hash, avatar, token, create_time) VALUES (?,?,?,?,?,?)',
      [profile.uid, profile.name, hashPassword(password), profile.avatar, profile.token, Date.now()]
    );
  } catch (err) {
    // 并发下用户名唯一约束兜底
    if ((err as { code?: string }).code === 'ER_DUP_ENTRY') {
      return { ok: false, message: '用户名已存在，请更换' };
    }
    throw err;
  }
  return { ok: true, profile };
}

export async function loginAccount(rawName: string, password: string): Promise<Result> {
  const name = normalizeName(rawName);
  const db = await getPool();
  if (!db) return { ok: false, message: '数据库暂不可用，请稍后再试' };

  const row = await findByName(db, name);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, message: '用户名或密码错误' };
  }
  // 每次登录换发新 token
  const token = genToken();
  await db.query('UPDATE users SET token = ? WHERE uid = ?', [token, row.uid]);
  return { ok: true, profile: { uid: row.uid, name: row.name, avatar: row.avatar || '', token } };
}

export async function loginByToken(token: string): Promise<Result> {
  if (!token) return { ok: false, message: '登录已失效，请重新登录' };
  const db = await getPool();
  if (!db) return { ok: false, message: '数据库暂不可用，请稍后再试' };

  const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM users WHERE token = ? LIMIT 1', [token]);
  const row = rows[0];
  if (!row) return { ok: false, message: '登录已失效，请重新登录' };
  return { ok: true, profile: rowToProfile(row) };
}

export async function updateAccount(token: string, name?: string, avatar?: string): Promise<Result> {
  const db = await getPool();
  if (!db) return { ok: false, message: '数据库暂不可用，请稍后再试' };

  const [rows] = await db.query<RowDataPacket[]>('SELECT * FROM users WHERE token = ? LIMIT 1', [token]);
  const row = rows[0];
  if (!row) return { ok: false, message: '登录已失效，请重新登录' };

  let nextName: string = row.name;
  let nextAvatar: string = row.avatar || '';

  if (typeof name === 'string') {
    const trimmed = normalizeName(name);
    if (trimmed.length < 1 || trimmed.length > 16) return { ok: false, message: '用户名需为 1-16 个字符' };
    const [dup] = await db.query<RowDataPacket[]>(
      'SELECT uid FROM users WHERE name = ? AND uid <> ? LIMIT 1',
      [trimmed, row.uid]
    );
    if (dup.length) return { ok: false, message: '用户名已存在，请更换' };
    nextName = trimmed;
  }

  if (typeof avatar === 'string') {
    // 限制头像大小(base64),避免消息过大
    if (avatar.length > 200_000) return { ok: false, message: '头像过大，请换一张更小的图片' };
    nextAvatar = avatar;
  }

  await db.query('UPDATE users SET name = ?, avatar = ? WHERE uid = ?', [nextName, nextAvatar, row.uid]);
  return { ok: true, profile: { uid: row.uid, name: nextName, avatar: nextAvatar, token: row.token || '' } };
}
