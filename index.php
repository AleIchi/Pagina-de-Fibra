<?php include 'db.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Zenith Optic - Internet de Fibra Óptica</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <header>
        <div class="logo">Zenith Optic</div>
        <nav>
            <a href="#inicio">Inicio</a>
            <a href="#planes">Planes</a>
            <a href="#nosotros">Nosotros</a>
            <a href="#contacto">Contacto</a>
        </nav>
    </header>

    <div class="hero" id="inicio">
        <h1>Internet de Alta Velocidad para tu Hogar</h1>
        <p>Conéctate a la red de fibra óptica más estable del país.</p>
    </div>

    <section id="planes">
        <div class="section-title">
            <h2>Nuestros Planes</h2>
            <p>Elige el plan que mejor se acomode a tu presupuesto.</p>
        </div>

        <?php if(isset($_GET['status'])): ?>
            <?php if($_GET['status'] == 'success'): ?>
                <div class="alert alert-success">¡Gracias! Tu solicitud ha sido guardada en nuestra base de datos.</div>
            <?php else: ?>
                <div class="alert alert-error">Error al guardar la solicitud. Verifica que la tabla 'solicitudes' exista en MariaDB.</div>
            <?php endif; ?>
        <?php endif; ?>

        <div class="plans-grid">
            <?php
            try {
                $stmt = $pdo->query("SELECT * FROM planes");
                while ($row = $stmt->fetch()) {
                    echo '<div class="plan-card">';
                    echo '<h3>' . htmlspecialchars($row['nombre']) . '</h3>';
                    echo '<p class="price">S/ ' . number_format($row['precio'], 2) . '</p>';
                    echo '<p>' . htmlspecialchars($row['descripcion']) . '</p>';
                    echo '<hr style="margin:15px 0; opacity:0.2;">';
                    echo '<ul style="list-style:none; text-align:left; font-size:0.9rem;">';
                    echo '<li>- Fibra Óptica Pura</li>';
                    echo '<li>- Soporte 24 horas</li>';
                    echo '<li>- Sin límite de datos</li>';
                    echo '</ul>';
                    echo '<a href="#contacto" class="btn" style="display:inline-block; margin-top:15px; text-decoration:none;">Me interesa</a>';
                    echo '</div>';
                }
            } catch (Exception $e) {
                echo "<p>Error: No se pudieron cargar los planes de la base de datos.</p>";
            }
            ?>
        </div>
    </section>

    <section id="nosotros" style="background:#eee;">
        <div class="section-title">
            <h2>Sobre Nosotros</h2>
        </div>
        <div style="max-width:800px; margin:0 auto; text-align:center;">
            <p>Somos una empresa dedicada a brindar soluciones de conectividad de alta calidad. Nuestro objetivo es que cada hogar peruano cuente con internet de alta velocidad a un precio justo.</p>
        </div>
    </section>

    <section id="contacto">
        <div class="section-title">
            <h2>Solicita tu Instalación</h2>
            <p>Completa el formulario y aparecerás en nuestra base de datos de solicitudes.</p>
        </div>
        
        <div class="contact-container">
            <form action="registro.php" method="POST">
                <div class="form-group">
                    <label>Tu Nombre:</label>
                    <input type="text" name="nombre" required>
                </div>
                <div class="form-group">
                    <label>Teléfono:</label>
                    <input type="tel" name="telefono" required>
                </div>
                <div class="form-group">
                    <label>Plan que deseas:</label>
                    <select name="plan" required>
                        <option value="Plan Básico">Plan Básico</option>
                        <option value="Plan Intermedio">Plan Intermedio</option>
                        <option value="Plan Avanzado">Plan Avanzado</option>
                    </select>
                </div>
                <button type="submit" class="btn">Enviar Solicitud</button>
            </form>
        </div>
    </section>

    <footer>
        <p>&copy; 2026 Zenith Optic | Proyecto desarrollado por Alessandro Flores - SENATI</p>
    </footer>

</body>
</html>
