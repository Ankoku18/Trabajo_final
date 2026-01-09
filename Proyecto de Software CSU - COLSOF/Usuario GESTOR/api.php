<?php
header('Content-Type: application/json');

// Ajusta la ruta si conexion.php está en una carpeta diferente
require_once '../conexion.php';

$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_next_id':
        // Obtener el siguiente ID para un caso (simulado con MAX id + 1 o un conteo)
        // Asumimos que tienes una tabla llamada 'casos'
        $sql = "SELECT MAX(id) as max_id FROM casos";
        $result = $conn->query($sql);
        $row = $result->fetch_assoc();
        $nextId = ($row['max_id']) ? $row['max_id'] + 1 : 1;
        // Formato 030XXXX
        echo json_encode(['new_id' => '030' . str_pad($nextId, 4, '0', STR_PAD_LEFT)]);
        break;

    case 'get_dashboard_stats':
        // Obtener estadísticas reales para Reportes
        $stats = [
            'reportes_generados' => 0,
            'descargas' => 0,
            'usuarios_activos' => 0
        ];

        // Ejemplo: Contar casos totales
        $res = $conn->query("SELECT COUNT(*) as total FROM casos");
        if ($res) $stats['reportes_generados'] = $res->fetch_assoc()['total'];

        // Ejemplo: Contar usuarios
        $resUser = $conn->query("SELECT COUNT(*) as total FROM usuarios"); // Asumiendo tabla usuarios
        if ($resUser) $stats['usuarios_activos'] = $resUser->fetch_assoc()['total'];

        echo json_encode($stats);
        break;

    case 'save_case':
        // Guardar un nuevo caso
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            
            // Asegúrate de validar y limpiar los datos antes de insertar
            $cliente = $conn->real_escape_string($data['cliente'] ?? '');
            $categoria = $conn->real_escape_string($data['categoria'] ?? '');
            $prioridad = $conn->real_escape_string($data['prioridad'] ?? '');
            $descripcion = $conn->real_escape_string($data['descripcion'] ?? '');
            $asignado = $conn->real_escape_string($data['asignado'] ?? '0');

            $sql = "INSERT INTO casos (cliente, categoria, prioridad, descripcion, asignado_a, fecha_creacion) 
                    VALUES ('$cliente', '$categoria', '$prioridad', '$descripcion', '$asignado', NOW())";

            if ($conn->query($sql) === TRUE) {
                echo json_encode(['success' => true, 'message' => 'Caso creado correctamente']);
            } else {
                echo json_encode(['success' => false, 'error' => $conn->error]);
            }
        }
        break;

    case 'get_recent_reports':
        // Obtener lista de últimos casos/reportes
        $sql = "SELECT id, cliente, categoria, fecha_creacion FROM casos ORDER BY fecha_creacion DESC LIMIT 5";
        $result = $conn->query($sql);
        $reports = [];
        while($row = $result->fetch_assoc()) {
            $reports[] = $row;
        }
        echo json_encode($reports);
        break;

    default:
        echo json_encode(['error' => 'Acción no válida']);
        break;
}
$conn->close();
?>