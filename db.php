<?php
// Configuración de la base de datos
$host = 'localhost';
$db   = 'fibra_db';
$user = 'root'; // Ajustar si el usuario es diferente
$pass = '';     // Poner la contraseña de MariaDB aquí
$charset = 'utf8mb4';

$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
     $pdo = new PDO($dsn, $user, $pass, $options);
} catch (\PDOException $e) {
     // En producción no mostrar el error detallado
     die("Error de conexión: " . $e->getMessage());
}
?>
