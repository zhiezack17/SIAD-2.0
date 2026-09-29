#!/bin/bash
# ==============================================================
# SCRIPT PERBAIKAN SEMUA SEKALI JALAN: PATCH DB + .ENV + RESTART PM2
# Eksekusi dengan: bash /www/wwwroot/siad-v2.com/DEPLOY_FIX_ALL.sh
# ==============================================================
set -e
cd /www/wwwroot/siad-v2.com

echo "[1/4] Apply patch PATCH_FULL_183_DESA.sql ke postgresql sebagai superuser postgres..."
sudo -u postgres psql -d siad -f PATCH_FULL_183_DESA.sql
echo "✅ DB Patch selesai."

echo ""
echo "[2/4] Replace .env dengan 03_NEW_ENV_BACKEND_SIAD.env (backup .env lama ke .env_BACKUP_DEPL)"
if [ -f ".env" ]; then
    mv -f .env .env_BACKUP_DEPL
fi
if [ -f "03_NEW_ENV_BACKEND_SIAD.env" ]; then
    cp -f 03_NEW_ENV_BACKEND_SIAD.env .env
    echo "✅ .env berhasil di-update."
else
    echo "⚠️  File 03_NEW_ENV_BACKEND_SIAD.env tidak ada. Lewati update .env."
fi

echo ""
echo "[3/4] Restart PM2: siad-api + siad-v2-frontend"
pm2 restart siad-api || true
pm2 restart siad-v2-frontend || true
sleep 2
pm2 list
echo "✅ PM2 Services direstart."

echo ""
echo "[4/4] Clear Nginx Cache (proxy_cache_dir)"
rm -rf proxy_cache_dir/*
nginx -s reload || true
echo "✅ Nginx cache clear & reload done."

echo ""
echo "🎉🎉🎉 SEMUA PERBAIKAN SELESAI!🎉🎉🎉"
echo "Silakan test login di https://siad-v2.com dengan:"
echo "   Username: admin_rohil"
echo "   Password: Admin_SIAD_Rohil2026!"
echo ""
