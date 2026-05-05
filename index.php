<?php include 'db.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zenith Optic | Conectividad de Fibra Óptica</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <header>
        <div class="logo">ZENITH OPTIC</div>
        <nav>
            <a href="#inicio">Inicio</a>
            <a href="#beneficios">Beneficios</a>
            <a href="#planes">Planes</a>
            <a href="#nosotros">Nosotros</a>
            <a href="#contacto">Contacto</a>
        </nav>
    </header>

    <div class="hero" id="inicio">
        <h2>Internet de Fibra Óptica Real</h2>
        <p>Experimenta la velocidad simétrica que tu hogar o negocio necesita. Sin límites, sin caídas.</p>
        <div style="margin-top:30px;">
            <a href="#planes" class="btn">Ver Planes Disponibles</a>
            <a href="#contacto" class="btn" style="background:transparent; border:2px solid white; margin-left:10px;">Contactar</a>
        </div>
    </div>

    <section id="beneficios">
        <div class="section-title">
            <h2>¿Por qué elegir nuestra Fibra Óptica?</h2>
            <p>Descubre los beneficios de navegar con tecnología de punta.</p>
        </div>
        <div class="grid">
            <div class="card">
                <h3>Velocidad Simétrica</h3>
                <p>Sube tus archivos a la misma velocidad que los descargas. Ideal para creadores de contenido y gamers.</p>
            </div>
            <div class="card">
                <h3>Estabilidad 99.9%</h3>
                <p>Nuestra infraestructura de fibra directa al hogar garantiza que nunca pierdas la conexión.</p>
            </div>
            <div class="card">
                <h3>Sin Contratos Forzosos</h3>
                <p>Creemos en nuestro servicio. Quédate con nosotros por la calidad, no por una obligación legal.</p>
            </div>
        </div>
    </section>

    <section id="planes" style="background-color: #f1f5f9;">
        <div class="section-title">
            <h2>Planes Diseñados para Ti</h2>
            <p>Elige el plan que mejor se adapte a tu ritmo de vida.</p>
        </div>

        <?php if(isset($_GET['status'])): ?>
            <?php if($_GET['status'] == 'success'): ?>
                <div style="background:#dcfce7; color:#166534; padding:15px; border-radius:5px; margin-bottom:30px; text-align:center; border:1px solid #bbf7d0;">
                    ¡Solicitud registrada! Tus datos ya están en nuestra base de datos MariaDB.
                </div>
            <?php else: ?>
                <div style="background:#fee2e2; color:#991b1b; padding:15px; border-radius:5px; margin-bottom:30px; text-align:center; border:1px solid #fecaca;">
                    Error al guardar los datos. Revisa la conexión con la base de datos.
                </div>
            <?php endif; ?>
        <?php endif; ?>

        <div class="grid">
            <?php
            try {
                $stmt = $pdo->query("SELECT * FROM planes");
                while ($row = $stmt->fetch()) {
                    echo '<div class="card">';
                    echo '<h3>' . htmlspecialchars($row['nombre']) . '</h3>';
                    echo '<div class="price">S/ ' . number_format($row['precio'], 2) . ' <span style="font-size:1rem; color:#64748b;">/ mes</span></div>';
                    echo '<p>' . htmlspecialchars($row['descripcion']) . '</p>';
                    echo '<ul style="margin:20px 0; padding-left:20px; font-size:0.9rem;">';
                    echo '<li>Instalación gratuita</li>';
                    echo '<li>Router WiFi de doble banda</li>';
                    echo '<li>Soporte técnico prioritario</li>';
                    echo '</ul>';
                    echo '<a href="#contacto" class="btn" style="display:block; text-align:center;">Lo quiero</a>';
                    echo '</div>';
                }
            } catch (Exception $e) {
                echo "<p>Error: No se pudo conectar con la base de datos MariaDB.</p>";
            }
            ?>
        </div>
    </section>

    <section id="nosotros">
        <div class="section-title">
            <h2>Nuestra Empresa</h2>
        </div>
        <div style="display:flex; gap:40px; flex-wrap:wrap; align-items:center;">
            <div style="flex:1; min-width:300px;">
                <p><strong>Zenith Optic</strong> nació como un proyecto académico en SENATI y hoy busca convertirse en un referente de conectividad en el Perú. Nuestra misión es acortar la brecha digital brindando internet de alta velocidad a precios competitivos.</p>
                <p>Utilizamos tecnología GPON de última generación para asegurar que cada bit llegue a su destino con la menor latencia posible.</p>
            </div>
            <div style="flex:1; min-width:300px; background:#fff; padding:30px; border-radius:10px; border:1px solid #e2e8f0;">
                <h3>Nuestra Cobertura</h3>
                <p>Actualmente operamos en:</p>
                <ul>
                    <li>Lima Norte (Los Olivos, SMP, Comas)</li>
                    <li>Lima Centro</li>
                    <li>Próximamente: Callao y Lima Sur</li>
                </ul>
            </div>
        </div>
    </section>

    <section id="contacto" style="background-color: #f1f5f9;">
        <div class="section-title">
            <h2>Formulario de Solicitud</h2>
            <p>Completa tus datos y la información se guardará automáticamente en nuestra tabla de solicitudes.</p>
        </div>
        <form action="registro.php" method="POST">
            <div class="form-group">
                <label>Nombre Completo</label>
                <input type="text" name="nombre" placeholder="Ej. Alessandro Garcia" required>
            </div>
            <div class="form-group">
                <label>Teléfono o WhatsApp</label>
                <input type="tel" name="telefono" placeholder="Ej. 987654321" required>
            </div>
            <div class="form-group">
                <label>Plan de Interés</label>
                <select name="plan" required>
                    <option value="" disabled selected>Selecciona un plan</option>
                    <option value="Plan Hogar">Plan Hogar 200 Mbps</option>
                    <option value="Plan Gamer">Plan Gamer 500 Mbps</option>
                    <option value="Plan Negocio">Plan Negocio 1000 Mbps</option>
                </select>
            </div>
            <button type="submit" class="btn" style="width:100%;">Enviar mi Solicitud</button>
        </form>
    </section>

    <footer>
        <div style="margin-bottom:20px;">
            <h3>ZENITH OPTIC</h3>
            <p>Ingeniería de Software e IA - Alessandro Flores Campos</p>
        </div>
        <p>&copy; 2026 Todos los derechos reservados. Proyecto Académico SENATI.</p>
    </footer>

</body>
</html>
