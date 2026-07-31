// ============================================================
// SIAD 2.0 — Route: Produk Hukum
// CommonJS version for the VPS backend
// ============================================================
const router = require('express').Router();
const db = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

const ROLE_WRITE = new Set(['admin', 'editor', 'operator', 'sekretaris', 'penghulu', 'pimpinan']);
const JENIS_VALID = new Set([
  'peraturan_kepenghuluan',
  'peraturan_bersama_penghulu',
  'peraturan_penghulu',
  'keputusan_penghulu',
  'instruksi_penghulu',
]);
const STATUS_VALID = new Set(['draft', 'ditetapkan', 'diundangkan', 'dicabut']);

function canWrite(role) {
  return ROLE_WRITE.has(String(role || '').toLowerCase());
}

function isGlobalUser(user) {
  const role = String(user?.role || user?.peran || '').toLowerCase();
  return role === 'admin' || role === 'auditor';
}

function resolveTenant(user, bodyTenant) {
  if (isGlobalUser(user) && bodyTenant) return Number(bodyTenant);
  return Number(user?.kepenghuluan_id);
}

function mapRow(r) {
  if (!r) return null;
  return {
    id: String(r.id),
    tenantId: String(r.kepenghuluan_id),
    kepenghuluanNama: r.kepenghuluan_nama || undefined,
    jenis: r.jenis,
    nomor: r.nomor,
    tahun: r.tahun,
    judul: r.judul,
    tentang: r.tentang,
    tanggalDitetapkan: r.tanggal_ditetapkan ? new Date(r.tanggal_ditetapkan).toISOString().slice(0, 10) : undefined,
    tanggalDiundangkan: r.tanggal_diundangkan ? new Date(r.tanggal_diundangkan).toISOString().slice(0, 10) : undefined,
    ditetapkanOleh: r.ditetapkan_oleh || undefined,
    jabatan: r.jabatan || undefined,
    status: r.status,
    referensi: r.referensi || [],
    driveFileId: r.drive_file_id || undefined,
    driveFileUrl: r.drive_file_url || undefined,
    fileName: r.file_name || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

router.get('/', async (req, res) => {
  try {
    const { q, jenis, tahun, status, kepenghuluan_id } = req.query;
    const where = [];
    const params = [];

    if (!isGlobalUser(req.user)) {
      params.push(Number(req.user.kepenghuluan_id));
      where.push(`ph.kepenghuluan_id = $${params.length}`);
    } else if (kepenghuluan_id) {
      params.push(Number(kepenghuluan_id));
      where.push(`ph.kepenghuluan_id = $${params.length}`);
    }

    if (jenis && JENIS_VALID.has(String(jenis))) {
      params.push(String(jenis));
      where.push(`ph.jenis = $${params.length}`);
    }
    if (status && STATUS_VALID.has(String(status))) {
      params.push(String(status));
      where.push(`ph.status = $${params.length}`);
    }
    if (tahun) {
      params.push(Number(tahun));
      where.push(`ph.tahun = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(ph.judul ILIKE $${params.length} OR ph.tentang ILIKE $${params.length} OR ph.nomor ILIKE $${params.length})`);
    }

    const sql = `
      SELECT ph.*, k.nama AS kepenghuluan_nama
      FROM produk_hukum ph
      LEFT JOIN kepenghuluan k ON k.id = ph.kepenghuluan_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY ph.tahun DESC, ph.created_at DESC
      LIMIT 500
    `;
    const { rows } = await db.query(sql, params);
    res.json({ items: rows.map(mapRow), total: rows.length });
  } catch (err) {
    console.error('[produk-hukum:list]', err);
    res.status(500).json({ error: 'Gagal memuat produk hukum' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ph.*, k.nama AS kepenghuluan_nama
       FROM produk_hukum ph
       LEFT JOIN kepenghuluan k ON k.id = ph.kepenghuluan_id
       WHERE ph.id = $1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Tidak ditemukan' });
    res.json(mapRow(rows[0]));
  } catch (err) {
    console.error('[produk-hukum:get]', err);
    res.status(500).json({ error: 'Gagal memuat data' });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!canWrite(req.user.role || req.user.peran)) {
      return res.status(403).json({ error: `Akses ditolak untuk role: ${req.user.role || req.user.peran}` });
    }

    const {
      kepenghuluanId,
      kepenghuluan_id,
      jenis,
      nomor,
      tahun,
      judul,
      tentang,
      tanggalDitetapkan,
      tanggal_ditetapkan,
      tanggalDiundangkan,
      tanggal_diundangkan,
      ditetapkanOleh,
      ditetapkan_oleh,
      jabatan,
    } = req.body || {};

    if (!jenis || !JENIS_VALID.has(String(jenis))) return res.status(400).json({ error: 'Jenis tidak valid' });
    if (!nomor || !tahun || !judul || !tentang) return res.status(400).json({ error: 'Field wajib belum lengkap' });

    const tenantId = resolveTenant(req.user, kepenghuluanId || kepenghuluan_id);
    if (!tenantId) return res.status(400).json({ error: 'Kepenghuluan wajib dipilih' });

    const tglTetap = tanggalDitetapkan || tanggal_ditetapkan || null;
    const tglUndang = tanggalDiundangkan || tanggal_diundangkan || null;
    const penetap = ditetapkanOleh || ditetapkan_oleh || null;
    const status = tglUndang ? 'diundangkan' : tglTetap ? 'ditetapkan' : 'draft';

    const { rows } = await db.query(
      `INSERT INTO produk_hukum
        (kepenghuluan_id, jenis, nomor, tahun, judul, tentang,
         tanggal_ditetapkan, tanggal_diundangkan, ditetapkan_oleh, jabatan,
         status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        tenantId,
        String(jenis),
        String(nomor),
        Number(tahun),
        String(judul),
        String(tentang),
        tglTetap,
        tglUndang,
        penetap,
        jabatan || null,
        status,
        req.user.id || null,
      ],
    );

    await db.query(
      `INSERT INTO riwayat_produk_hukum (produk_hukum_id, aksi, status_baru, oleh_pengguna)
       VALUES ($1,$2,$3,$4)`,
      [rows[0].id, 'create', status, req.user.id || null],
    );

    res.status(201).json(mapRow(rows[0]));
  } catch (err) {
    console.error('[produk-hukum:create]', err);
    if (err.code === '23505') return res.status(409).json({ error: 'Nomor & tahun sudah terdaftar untuk jenis ini' });
    res.status(500).json({ error: 'Gagal menyimpan produk hukum' });
  }
});

router.post('/:id/status', async (req, res) => {
  try {
    if (!canWrite(req.user.role || req.user.peran)) {
      return res.status(403).json({ error: `Akses ditolak untuk role: ${req.user.role || req.user.peran}` });
    }

    const { status, catatan } = req.body || {};
    if (!STATUS_VALID.has(String(status))) return res.status(400).json({ error: 'Status tidak valid' });

    const cur = await db.query('SELECT * FROM produk_hukum WHERE id = $1', [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'Tidak ditemukan' });

    const updates = ['status = $1', 'updated_at = NOW()'];
    const params = [String(status)];
    if (status === 'ditetapkan' && !cur.rows[0].tanggal_ditetapkan) {
      params.push(new Date().toISOString().slice(0, 10));
      updates.push(`tanggal_ditetapkan = $${params.length}`);
    }
    if (status === 'diundangkan' && !cur.rows[0].tanggal_diundangkan) {
      params.push(new Date().toISOString().slice(0, 10));
      updates.push(`tanggal_diundangkan = $${params.length}`);
    }
    params.push(req.params.id);

    const { rows } = await db.query(
      `UPDATE produk_hukum SET ${updates.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    await db.query(
      `INSERT INTO riwayat_produk_hukum (produk_hukum_id, aksi, status_lama, status_baru, catatan, oleh_pengguna)
       VALUES ($1,'status',$2,$3,$4,$5)`,
      [req.params.id, cur.rows[0].status, String(status), catatan || null, req.user.id || null],
    );

    res.json(mapRow(rows[0]));
  } catch (err) {
    console.error('[produk-hukum:status]', err);
    res.status(500).json({ error: 'Gagal mengubah status' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (!canWrite(req.user.role || req.user.peran)) {
      return res.status(403).json({ error: `Akses ditolak untuk role: ${req.user.role || req.user.peran}` });
    }
    await db.query('DELETE FROM produk_hukum WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[produk-hukum:delete]', err);
    res.status(500).json({ error: 'Gagal menghapus' });
  }
});

module.exports = router;