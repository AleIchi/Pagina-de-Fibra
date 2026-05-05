<?php include 'db.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Zenith Optic - Venta de Internet</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <header>
        <h1>Zenith Optic</h1>
    </header>

    <nav>
        <a href="#inicio">Inicio</a>
        <a href="#planes">Planes</a>
        <a href="#nosotros">Nosotros</a>
        <a href="#faq">Preguntas</a>
        <a href="#contacto">Contratar</a>
    </nav>

    <div class="hero" id="inicio">
        <h2>Bienvenido a Zenith Optic</h2>
        <p>Ofrecemos servicio de internet por fibra óptica de alta velocidad.</p>
    </div>

    <div class="container">
        
        <section id="planes">
            <h2>Nuestros Planes de Internet</h2>
            
            <?php if(isset($_GET['status'])): ?>
                <?php if($_GET['status'] == 'success'): ?>
                    <p style="color: green; font-weight: bold;">Tu solicitud se guardó correctamente.</p>
                <?php else: ?>
                    <p style="color: red; font-weight: bold;">Ocurrió un error al guardar.</p>
                <?php endif; ?>
            <?php endif; ?>

            <div class="grid">
                <?php
                try {
                    $stmt = $pdo->query("SELECT * FROM planes");
                    while ($row = $stmt->fetch()) {
                        echo '<div class="card">';
                        echo '<h3>' . htmlspecialchars($row['nombre']) . '</h3>';
                        echo '<p><strong>Precio: S/ ' . number_format($row['precio'], 2) . '</strong></p>';
                        echo '<p>' . htmlspecialchars($row['descripcion']) . '</p>';
                        echo '<ul>';
                        echo '<li>Instalación rápida</li>';
                        echo '<li>Internet ilimitado</li>';
                        echo '</ul>';
                        echo '<a href="#contacto" class="btn">Solicitar este plan</a>';
                        echo '</div>';
                    }
                } catch (Exception $e) {
                    echo "<p>Error al conectar con la base de datos.</p>";
                }
                ?>
            </div>
        </section>

        <section id="nosotros">
            <h2>Sobre la Empresa</h2>
            <p>Somos Zenith Optic, una empresa peruana con sede en Lima. Nos dedicamos a la instalación de redes de fibra óptica para hogares y pequeños negocios. Buscamos dar un servicio estable y a buen precio.</p>
            <p><strong>Zonas de Cobertura:</strong> Lima, Callao y alrededores.</p>
        </section>

        <section id="faq">
            <h2>Preguntas Frecuentes</h2>
            <ul>
                <li><strong>¿Tienen internet simétrico?</strong> Sí, la velocidad de subida y bajada es la misma.</li>
                <li><strong>¿Cuánto demora la instalación?</strong> Entre 1 y 2 días hábiles.</li>
                <li><strong>¿Dan router?</strong> Sí, el router se entrega en préstamo.</li>
            </ul>
        </section>

        <section id="contacto">
            <h2>Formulario de Contacto</h2>
            <p>Si deseas contratar un plan, deja tus datos aquí y se guardarán en nuestra base de datos para llamarte.</p>
            
            <form action="registro.php" method="POST">
                <label>Nombre Completo:</label>
                <input type="text" name="nombre" required>
                
                <label>Tu Teléfono:</label>
                <input type="tel" name="telefono" required>
                
                <label>Elige un Plan:</label>
                <select name="plan">
                    <option value="Plan Hogar">Plan Hogar</option>
                    <option value="Plan Gamer">Plan Gamer</option>
                    <option value="Plan Negocio">Plan Negocio</option>
                </select>
                
                <button type="submit" class="btn">Enviar Mis Datos</button>
            </form>
        </section>

    </div>

    <footer>
        <p>Alessandro Flores - Ingeniería de Software e IA - SENATI 2026</p>
    </footer>

</body>
</html>
