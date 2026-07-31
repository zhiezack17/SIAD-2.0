#!/bin/bash
# Deploy Modul Aset SIAD 2.0 (jalankan di VPS sebagai root)
# Pakai: bash deploy-aset.sh /root/siad-aset-patch.tar.gz
set -e
PATCH="${1:-/root/siad-aset-patch.tar.gz}"
BACKEND=/opt/siad-backend
FRONTEND=/root/siad-v2

echo "==> 1. Ekstrak patch"
mkdir -p /tmp/aset-patch && rm -rf /tmp/aset-patch/* 
tar xzf "$PATCH" -C /tmp/aset-patch

echo "==> 2. Copy file"
mkdir -p $FRONTEND/src/lib $FRONTEND/src/hooks $FRONTEND/src/routes/_app $BACKEND/src/routes
cp /tmp/aset-patch/root/siad-v2/src/lib/aset.ts            $FRONTEND/src/lib/
cp /tmp/aset-patch/root/siad-v2/src/hooks/use-aset.ts      $FRONTEND/src/hooks/
cp /tmp/aset-patch/root/siad-v2/src/routes/_app/aset.tsx   $FRONTEND/src/routes/_app/
cp /tmp/aset-patch/opt/siad-backend/src/routes/aset.js     $BACKEND/src/routes/

echo "==> 3. Migrasi SQL"
SQL=/tmp/aset-patch/siad-migrations/09_schema_aset.sql
# sesuaikan kredensial bila beda
DB_NAME="${DB_NAME:-siad}"
DB_USER="${DB_USER:-postgres}"
sudo -u postgres psql -d "$DB_NAME" -f "$SQL" || psql -U "$DB_USER" -d "$DB_NAME" -f "$SQL"

echo "==> 4. Daftarkan route di entry backend"
ENTRY=""
for f in $BACKEND/src/index.js $BACKEND/src/server.js $BACKEND/src/app.js $BACKEND/index.js; do
  [ -f "$f" ] && ENTRY="$f" && break
done
if [ -z "$ENTRY" ]; then
  echo "!! Entry backend tidak ditemukan. Cari manual: grep -rn \"app.use('/api\" $BACKEND/src"
else
  if grep -q "/api/aset" "$ENTRY"; then
    echo "   sudah terdaftar di $ENTRY"
  else
    # sisipkan tepat setelah baris route terakhir yang sudah ada
    LAST=$(grep -n "app.use('/api" "$ENTRY" | tail -1 | cut -d: -f1)
    sed -i "${LAST}a app.use('/api/aset', require('./routes/aset'));" "$ENTRY"
    echo "   ditambahkan ke $ENTRY (baris $((LAST+1)))"
  fi
fi

echo "==> 5. Restart backend"
pm2 restart siad-api

echo "==> 6. Rebuild + restart frontend"
cd $FRONTEND && npm run build && pm2 restart siad-v2-frontend

echo "==> Selesai. Cek: curl -s https://api.siad-v2.com/api/aset | head -c 300"
