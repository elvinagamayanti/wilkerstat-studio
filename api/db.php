<?php
// CORS & Output headers for REST API
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: POST, GET, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");
// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}
date_default_timezone_set('Asia/Makassar');
$db_name = 'wilkerstat_studio';
// Multi-fallback database credentials matching MAMP (port 8889) and XAMPP (port 3306)
$configs = [
    // Standar / XAMPP (port 3306, root/no password)
    ['host' => '127.0.0.1', 'port' => '3306', 'user' => 'root', 'pass' => ''],
    ['host' => 'localhost', 'port' => '3306', 'user' => 'root', 'pass' => ''],
    // MAMP default (port 8889, root/root)
    ['host' => '127.0.0.1', 'port' => '8889', 'user' => 'root', 'pass' => 'root'],
    ['host' => 'localhost', 'port' => '8889', 'user' => 'root', 'pass' => 'root'],
    // Standar dengan password (port 3306, root/root)
    ['host' => '127.0.0.1', 'port' => '3306', 'user' => 'root', 'pass' => 'root'],
    ['host' => 'localhost', 'port' => '3306', 'user' => 'root', 'pass' => 'root']
];
$conn = null;
$error = "";
// 1. Coba koneksi ke MySQL server (tanpa memilih database dulu)
foreach ($configs as $config) {
    try {
        $dsn = "mysql:host={$config['host']};port={$config['port']};charset=utf8mb4";
        $conn = new PDO($dsn, $config['user'], $config['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_TIMEOUT => 2
        ]);
        break; // Berhasil terhubung
    } catch (PDOException $e) {
        $error = $e->getMessage();
    }
}
if (!$conn) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Gagal menghubungkan ke database MySQL. Error terakhir: " . $error
    ]);
    exit();
}
try {
    // 2. Buat database jika belum ada
    $conn->exec("CREATE DATABASE IF NOT EXISTS `$db_name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $conn->exec("USE `$db_name`");

    // 3. Buat tabel-tabel jika belum ada

    // Basis data peta WA/WS/WSS yang sudah disimpan (TemplateView)
    $conn->exec("
        CREATE TABLE IF NOT EXISTS peta_tersimpan (
            id INT AUTO_INCREMENT PRIMARY KEY,
            map_key VARCHAR(60) NOT NULL UNIQUE,   -- contoh: 'WA:7310041002', 'WS:73100410020005', 'WSS:73100410020005'
            mode ENUM('WA','WS','WSS') NOT NULL,
            idkec VARCHAR(10) NOT NULL,            -- id kecamatan (7 digit)
            iddesa VARCHAR(15) NOT NULL,           -- id desa (10 digit)
            idsls VARCHAR(20) DEFAULT NULL,        -- id SLS (14 digit), NULL untuk mode WA
            idsubsls VARCHAR(20) DEFAULT NULL,     -- id sub-SLS (16 digit), khusus mode WSS
            label VARCHAR(200) NOT NULL,           -- nama desa / nama SLS untuk ditampilkan
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_mode_kec (mode, idkec),
            INDEX idx_mode_desa (mode, iddesa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // Daftar WS-Inset tersimpan (InsetView)
    $conn->exec("
        CREATE TABLE IF NOT EXISTS inset_tersimpan (
            id INT AUTO_INCREMENT PRIMARY KEY,
            no INT NOT NULL DEFAULT 1,             -- nomor inset ke-n untuk SLS yang sama
            name VARCHAR(200) NOT NULL,
            idkec VARCHAR(10) NOT NULL,
            iddesa VARCHAR(15) NOT NULL,
            idsls VARCHAR(20) NOT NULL,
            nmsls VARCHAR(150) NOT NULL,
            center_lat DOUBLE NOT NULL,
            center_lng DOUBLE NOT NULL,
            zoom DOUBLE NOT NULL,
            basemap VARCHAR(20) NOT NULL DEFAULT 'sat',        -- 'sat' | 'street'
            orientasi VARCHAR(20) NOT NULL DEFAULT 'landscape', -- 'landscape' | 'portrait'
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_idsls (idsls)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        "status" => "error",
        "message" => "Gagal inisialisasi basis data: " . $e->getMessage()
    ]);
    exit();
}
?>