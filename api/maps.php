<?php
require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'];

try {
    if ($method === 'GET') {
        // GET /api/maps.php                        -> semua peta tersimpan
        // GET /api/maps.php?mode=WA&idkec=7310041  -> filter per mode + kecamatan
        // GET /api/maps.php?mode=WS&iddesa=7310041002
        $where = [];
        $params = [];
        if (!empty($_GET['mode'])) {
            $where[] = 'mode = :mode';
            $params[':mode'] = $_GET['mode'];
        }
        if (!empty($_GET['idkec'])) {
            $where[] = 'idkec = :idkec';
            $params[':idkec'] = $_GET['idkec'];
        }
        if (!empty($_GET['iddesa'])) {
            $where[] = 'iddesa = :iddesa';
            $params[':iddesa'] = $_GET['iddesa'];
        }
        $sql = 'SELECT * FROM peta_tersimpan';
        if ($where) $sql .= ' WHERE ' . implode(' AND ', $where);
        $sql .= ' ORDER BY created_at DESC';

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);
        echo json_encode(["status" => "success", "data" => $stmt->fetchAll()]);
        exit();
    }

    if ($method === 'POST') {
        // Body JSON: { map_key, mode, idkec, iddesa, idsls?, idsubsls?, label }
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || empty($input['map_key']) || empty($input['mode']) ||
            empty($input['idkec']) || empty($input['iddesa']) || empty($input['label'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Field map_key, mode, idkec, iddesa, dan label wajib diisi."]);
            exit();
        }
        if (!in_array($input['mode'], ['WA', 'WS', 'WSS'], true)) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Mode harus WA, WS, atau WSS."]);
            exit();
        }

        // Simpan / perbarui (idempoten berdasarkan map_key)
        $stmt = $conn->prepare("
            INSERT INTO peta_tersimpan (map_key, mode, idkec, iddesa, idsls, idsubsls, label)
            VALUES (:map_key, :mode, :idkec, :iddesa, :idsls, :idsubsls, :label)
            ON DUPLICATE KEY UPDATE
                label = VALUES(label),
                idsls = VALUES(idsls),
                idsubsls = VALUES(idsubsls)
        ");
        $stmt->execute([
            ':map_key'  => $input['map_key'],
            ':mode'     => $input['mode'],
            ':idkec'    => $input['idkec'],
            ':iddesa'   => $input['iddesa'],
            ':idsls'    => $input['idsls'] ?? null,
            ':idsubsls' => $input['idsubsls'] ?? null,
            ':label'    => $input['label'],
        ]);
        echo json_encode(["status" => "success", "message" => "Peta tersimpan ke basis data."]);
        exit();
    }

    if ($method === 'DELETE') {
        // DELETE /api/maps.php?map_key=WA:7310041002
        if (empty($_GET['map_key'])) {
            http_response_code(400);
            echo json_encode(["status" => "error", "message" => "Parameter map_key wajib diisi."]);
            exit();
        }
        $stmt = $conn->prepare("DELETE FROM peta_tersimpan WHERE map_key = :map_key");
        $stmt->execute([':map_key' => $_GET['map_key']]);
        echo json_encode(["status" => "success", "message" => "Peta dihapus dari basis data."]);
        exit();
    }

    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Metode tidak diizinkan."]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Kesalahan database: " . $e->getMessage()]);
}
?>