<?php include 'db.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Panel de Administración - Zenith Optic</title>
    <link rel="stylesheet" href="style.css">
    <style>
        table { width: 100%; border-collapse: collapse; margin-top: 20px; background: white; }
        th, td { padding: 12px; border: 1px solid #e2e8f0; text-align: left; }
        th { background-color: #2563eb; color: white; }
        tr:nth-child(even) { background-color: #f8fafc; }
    </style>
</head>
<body>
    <header>
        <div class="logo">ZENITH OPTIC - ADMINISTRACIÓN</div>
        <nav><a href="index.php">Volver a la Web</a></nav>
    </header>

    <div class="container">
        <h2>Listado de Solicitudes de Clientes</h2>
        <p>A continuación se muestran las personas interesadas en contratar el servicio:</p>

        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Plan</th>
                    <th>Fecha de Registro</th>
                </tr>
            </thead>
            <tbody>
                <?php
                try {
                    $stmt = $pdo->query("SELECT * FROM solicitudes ORDER BY fecha DESC");
                    while ($row = $stmt->fetch()) {
                        echo "<tr>";
                        echo "<td>" . htmlspecialchars($row['id']) . "</td>";
                        echo "<td>" . htmlspecialchars($row['nombre']) . "</td>";
                        echo "<td>" . htmlspecialchars($row['telefono']) . "</td>";
                        echo "<td>" . htmlspecialchars($row['plan_interes']) . "</td>";
                        echo "<td>" . htmlspecialchars($row['fecha']) . "</td>";
                        echo "</tr>";
                    }
                } catch (Exception $e) {
                    echo "<tr><td colspan='5'>Error al cargar los datos.</td></tr>";
                }
                ?>
            </tbody>
        </table>
    </div>

    <footer>
        <p>Panel de Control Interno - Zenith Optic 2026</p>
    </footer>
</body>
</html>
