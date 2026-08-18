import crypto from 'crypto';
import { memDb, getPool } from '../db';
import { AdminAuditLog } from '../../src/types';

export class AuditService {
  static async log(
    adminId: string,
    adminName: string,
    action: string,
    targetType: 'USER' | 'GAME' | 'DEPOSIT' | 'WITHDRAWAL' | 'SETTINGS',
    targetId: string | undefined,
    details: string,
    ipAddress?: string
  ) {
    const id = `aud-${crypto.randomUUID()}`;
    const now = new Date().toISOString();
    const pool = getPool();

    if (pool) {
      await pool.query(
        `INSERT INTO admin_audit_logs (id, admin_id, action, target_type, target_id, details, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [id, adminId, action, targetType, targetId || null, details, ipAddress || null]
      );
    } else {
      const entry: AdminAuditLog = {
        id,
        adminId,
        adminName,
        action,
        targetType,
        targetId,
        details,
        ipAddress,
        createdAt: now,
      };
      memDb.auditLogs.unshift(entry);
    }
  }

  static async getLogs(limit = 100): Promise<AdminAuditLog[]> {
    const pool = getPool();
    if (pool) {
      const res = await pool.query(
        `SELECT a.id, a.admin_id as "adminId", a.action, a.target_type as "targetType", 
                a.target_id as "targetId", a.details, a.ip_address as "ipAddress", a.created_at as "createdAt",
                u.first_name as "adminName"
         FROM admin_audit_logs a
         JOIN users u ON a.admin_id = u.id
         ORDER BY a.created_at DESC LIMIT $1`,
        [limit]
      );
      return res.rows;
    }

    return memDb.auditLogs.slice(0, limit);
  }
}
