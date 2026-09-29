const db = require('../config/db');

const dashboardController = {
    getIndex: async (req, res) => {
        try {
            // Get statistics
            const statsResult = await db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM workspace) as total_workspace,
                    (SELECT COUNT(*) FROM workspace_document) as total_dokumen,
                    (SELECT COUNT(*) FROM workspace WHERE status = 'SELESAI') as selesai_workspace
            `);
            const stats = statsResult.rows[0];

            // Get recent workspaces
            const recentWorkspacesResult = await db.query(`
                SELECT w.*, wt.nama as type_nama, wt.warna as type_warna, wt.icon as type_icon, mk.nama as kepenghuluan_nama 
                FROM workspace w
                LEFT JOIN workspace_type wt ON w.workspace_type_id = wt.id
                LEFT JOIN master_kepenghuluan mk ON w.kepenghuluan_id = mk.id
                ORDER BY w.created_at DESC 
                LIMIT 5
            `);
            const recentWorkspaces = recentWorkspacesResult.rows;

            res.render('dashboard', { 
                title: 'Dashboard - SIAD 2.0',
                stats: stats,
                workspaces: recentWorkspaces
            });
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            res.render('dashboard', { 
                title: 'Dashboard - SIAD 2.0',
                stats: { total_workspace: 0, total_dokumen: 0, selesai_workspace: 0 },
                workspaces: [],
                error: 'Gagal mengambil data dari server.'
            });
        }
    }
};

module.exports = dashboardController;
