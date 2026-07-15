<?php
require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // GET /api/insets.php            -> semua inset
        // GET /api/insets.php?idsls=...  -> inset untuk satu SLS
        if (!empty($_GET['idsls'])) {
            $stmt = $conn->prepare("SELECT * FROM inset_tersimpan WHERE idsls = :idsls ORDER BY created_at ASC");
            $stmt->execute([':idsls' => $_GET['idsls']]);
        } else {
            $stmt = $conn->query("SELECT * FROM inset_tersimpan ORDER BY created_at ASC");
        }
        $rows = $stmt->fetchAll();
        // Bentuk ulang agar cocok dengan state frontend (center sebagai objek {lat, lng})
        $data = array_map(function ($r) {
            return [
                'id'        => (int)$r['id'],
                'no'        => (int)$r['no'],
                'name'      => $r['name'],
                'idkec'     => $r['idkec'],
                'iddesa'    => $r['iddesa'],
                'idsls'     => $r['idsls'],
                'nmsls'     => $r['nmsls'],
                'center'    => ['lat' => (float)$r['center_lat'], 'lng' => (float)$r['center_lng']],
                'zoom'      => (float)$r['zoom'],
                'basemap'   => $r['basemap'],
                'orientasi' => $r['orientasi'],
                'savedAt'   => date('d/m/Y H:i', strtotime($r['created_at'])),
            ];
        }, $rows);
        echo json_encode(["status" => "success", "data" => $data]);
        exit();
    }

    if ($method === 'POST') {
        // Body JSON: { no, name, idkec, iddesa, idsls, nmsls, center: {lat, lng}, zoom, basemap, orientasi }
        $input = json_decode(file_get_contents('php://input'), true);
        $required = ['name', 'idkec', 'iddesa', 'idsls', 'nmsls', 'center', 'zoom'];
        foreach ($required as $f) {
            if (!isset($input[$f]) || $input[$f] === '') {
                http_response_code(400);
                echo json_encode(["status" => "error", "message" => "Field '$f' wajib diisi."]);
                exit();
            }
        }
        $stmt = $conn->prepare("
            INSERT INTO inset_tersimpan
                (no, name, idkec, iddesa, idsls, nmsls, center_lat, center_lng, zoom, basemap, orientasi)
            VALUES
                (:no, :name, :idkec, :iddesa, :idsls, :nmsls, :lat, :lng, :zoom, :basemap, :orientasi)
        ");
        $stmt->execute([
            ':no'        => (int)($input['no'] ?? 1),
            ':name'      => $input['name'],
            ':idkec'     => $input['idkec'],
            ':iddesa'    => $input['iddesa'],
            ':idsls'     => $input['idsls'],
            ':nmsls'     => $input['nmsls'],
            ':lat'       => (float)$input['center']['lat'],
            ':lng'       => (float)$input['center']['lng'],
            ':zoom'      => (float)$input['zoom'],
            ':basemap'   => $input['basemap'] ?? 'sat',
            ':orientasi' => $input['orientasi'] ?? 'landscape',
        ]);
        $id = (int)$conn->lastInsertId();
        echo json_encode([
            "status" => "success",
            "message" => "WS-Inset berhasil disimpan.",
            "data" => [
                'id'        => $id,
                'no'        => (int)($input['no'] ?? 1),
                'name'      => $input['name'],
                'idkec'     => $input['idkec'],
                'iddesa'    => $input['iddesa'],
                'idsls'     => $input['idsls'],
                'nmsls'     => $input['nmsls'],
                'center'    => $input['center'],
                'zoom'      => (float)$input['zoom'],
                'basemap'   => $input['basemap'] ?? 'sat',
                'orientasi' => $input['orientasi'] ?? 'landscape',
                'savedAt'   => date('d/m/Y H:i'),
            ]
        ]);
        exit();
    }

    if ($method === 'DELETE') {
        // DELETE /api/insets.php?id=123
        if (empty($_GET['id'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Parameter id wajib diisi."]);
            exit();
        }
        $stmt = $conn->prepare("DELETE FROM inset_tersimpan WHERE id = :id");
        $stmt->execute([':id' => (int)$_GET['id']]);
        echo json_encode(["status" => "success", "message" => "WS-Inset dihapus."]);
        exit();
    }

    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Metode tidak diizinkan."]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Kesalahan database: " . $e->getMessage()]);
}
?>