const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('U08: Verifikasi Aset & Integrasi Modul Tutorial Interaktif SIAD 2.0', () => {
    const rootDir = path.resolve(__dirname, '..');

    // 1. Verifikasi File Aset Statis Tutorial
    const driverCssPath = path.join(rootDir, 'public', 'css', 'driver.css');
    const tutorialCssPath = path.join(rootDir, 'public', 'css', 'siad-tutorial.css');
    const driverJsPath = path.join(rootDir, 'public', 'js', 'driver.js.iife.js');
    const tutorialJsPath = path.join(rootDir, 'public', 'js', 'siad-tutorial.js');

    assert.ok(fs.existsSync(driverCssPath), 'File driver.css harus ada di public/css');
    assert.ok(fs.statSync(driverCssPath).size > 1000, 'driver.css tidak boleh kosong');

    assert.ok(fs.existsSync(tutorialCssPath), 'File siad-tutorial.css harus ada di public/css');
    assert.ok(fs.statSync(tutorialCssPath).size > 500, 'siad-tutorial.css tidak boleh kosong');

    assert.ok(fs.existsSync(driverJsPath), 'File driver.js.iife.js harus ada di public/js');
    assert.ok(fs.statSync(driverJsPath).size > 5000, 'driver.js.iife.js tidak boleh kosong');

    assert.ok(fs.existsSync(tutorialJsPath), 'File siad-tutorial.js harus ada di public/js');
    assert.ok(fs.statSync(tutorialJsPath).size > 1000, 'siad-tutorial.js tidak boleh kosong');

    // 2. Verifikasi Template views/layout.ejs
    const layoutContent = fs.readFileSync(path.join(rootDir, 'views', 'layout.ejs'), 'utf8');
    assert.ok(layoutContent.includes('/css/driver.css'), 'layout.ejs harus memuat driver.css');
    assert.ok(layoutContent.includes('/css/siad-tutorial.css'), 'layout.ejs harus memuat siad-tutorial.css');
    assert.ok(layoutContent.includes('btn-panduan-topbar'), 'layout.ejs harus memiliki tombol btn-panduan-topbar');
    assert.ok(layoutContent.includes('siadStartTour()'), 'Tombol panduan harus memanggil siadStartTour()');
    assert.ok(layoutContent.includes('/js/driver.js.iife.js'), 'layout.ejs harus memuat driver.js.iife.js');
    assert.ok(layoutContent.includes('/js/siad-tutorial.js'), 'layout.ejs harus memuat siad-tutorial.js');

    // 3. Verifikasi Logika Tutorial (Induk SPJ, Pajak, Surat, Dashboard)
    const tutorialJsContent = fs.readFileSync(tutorialJsPath, 'utf8');
    assert.ok(tutorialJsContent.includes('dashboard:'), 'siad-tutorial.js harus memiliki tour dashboard');
    assert.ok(tutorialJsContent.includes('spj_kegiatan:'), 'siad-tutorial.js harus memiliki tour SPJ kegiatan');
    assert.ok(tutorialJsContent.includes('spj_pajak:'), 'siad-tutorial.js harus memiliki tour SPJ rekap pajak');
    assert.ok(tutorialJsContent.includes('surat_masuk:'), 'siad-tutorial.js harus memiliki tour surat masuk');
    assert.ok(tutorialJsContent.includes('surat_keluar:'), 'siad-tutorial.js harus memiliki tour surat keluar');
    assert.ok(tutorialJsContent.includes('pengaturan:'), 'siad-tutorial.js harus memiliki tour pengaturan');
});
