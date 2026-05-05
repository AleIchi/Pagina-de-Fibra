<?php
include 'db.php';

// Asegurar que procesamos todo en UTF-8
header('Content-Type: text/html; charset=utf-8');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $nombre = $_POST['nombre'];
    $telefono = $_POST['telefono'];
    $plan = $_POST['plan'];

    try {
        $sql = "INSERT INTO solicitudes (nombre, telefono, plan_interes) VALUES (?, ?, ?)";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$nombre, $telefono, $plan]);

        // Redirigir con éxito
        header("Location: index.php?status=success");
    } catch (Exception $e) {
        header("Location: index.php?status=error");
    }
}
?>
