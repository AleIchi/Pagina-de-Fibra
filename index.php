<?php include 'db.php'; ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Zenith Optic | Internet de Ultra Velocidad</title>
    <meta name="description" content="Conectividad de fibra óptica de última generación para hogares y empresas.">
    
    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="bg-glow">
        <div class="glow-orb"></div>
    </div>

    <nav>
        <div class="logo">ZENITH<span>OPTIC</span></div>
        <ul class="nav-links">
            <li><a href="#inicio">Inicio</a></li>
            <li><a href="#planes">Planes</a></li>
            <li><a href="#nosotros">Nosotros</a></li>
            <li><a href="#contacto">Contacto</a></li>
        </ul>
        <a href="#contacto" class="btn-primary" style="padding: 0.6rem 1.5rem;">Suscribirse</a>
    </nav>

    <header class="hero" id="inicio">
        <h1>Conecta tu mundo con <span>Zenith Optic</span>.</h1>
        <p>Vive la experiencia de navegación sin interrupciones con la tecnología más avanzada del mercado. 100% Fibra, 100% Velocidad.</p>
        <div class="hero-btns">
            <a href="#planes" class="btn-primary">Ver Planes Disponibles</a>
        </div>
    </header>

    <section class="plans-container" id="planes">
        <div class="section-title">
            <h2>Planes diseñados para ti</h2>
            <p>Elige la velocidad que mejor se adapte a tus necesidades.</p>
        </div>

        <?php if(isset($_GET['status'])): ?>
            <?php if($_GET['status'] == 'success'): ?>
                <div class="alert alert-success">¡Solicitud enviada con éxito! Un asesor de Zenith Optic te contactará pronto.</div>
            <?php else: ?>
                <div class="alert alert-error">Hubo un error al enviar tu solicitud. Por favor intenta de nuevo.</div>
            <?php endif; ?>
        <?php endif; ?>

        <div class="plans-grid">
            <?php
            try {
                $stmt = $pdo->query("SELECT * FROM planes");
                while ($row = $stmt->fetch()) {
                    ?>
                    <div class="plan-card">
                        <h3><?php echo htmlspecialchars($row['nombre']); ?></h3>
                        <div class="plan-price">S/ <?php echo number_format($row['precio'], 2); ?><span>/mes</span></div>
                        <p class="plan-description"><?php echo htmlspecialchars($row['descripcion']); ?></p>
                        <ul>
                            <li>Internet 100% Fibra Óptica</li>
                            <li>Velocidad Simétrica</li>
                            <li>Soporte Técnico 24/7</li>
                            <li>Instalación Inmediata</li>
                        </ul>
                        <a href="#contacto" class="btn-primary">Lo quiero</a>
                    </div>
                    <?php
                }
            } catch (Exception $e) {
                echo "<p>Error al cargar los planes. Por favor, asegúrese de que la base de datos está activa.</p>";
            }
            ?>
        </div>
    </section>

    <section class="contact-section" id="contacto">
        <div class="section-title">
            <h2>¿Listo para la ultra velocidad?</h2>
            <p>Déjanos tus datos y nos pondremos en contacto contigo hoy mismo.</p>
        </div>
        
        <div class="contact-container">
            <form action="registro.php" method="POST">
                <div class="form-group">
                    <label for="nombre">Nombre Completo</label>
                    <input type="text" id="nombre" name="nombre" placeholder="Ej. Alessandro Garcia" required>
                </div>
                <div class="form-group">
                    <label for="telefono">Teléfono / WhatsApp</label>
                    <input type="tel" id="telefono" name="telefono" placeholder="Ej. 987654321" required>
                </div>
                <div class="form-group">
                    <label for="plan">Plan de Interés</label>
                    <select id="plan" name="plan" required>
                        <option value="" disabled selected>Selecciona un plan</option>
                        <option value="Plan Hogar 200 Mbps">Plan Hogar 200 Mbps</option>
                        <option value="Plan Gamer 500 Mbps">Plan Gamer 500 Mbps</option>
                        <option value="Plan Negocio 1000 Mbps">Plan Negocio 1000 Mbps</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary" style="width: 100%; border-radius: 12px; margin-top: 1rem;">Solicitar Información</button>
            </form>
        </div>
    </section>

    <footer>
        <p>&copy; <?php echo date('Y'); ?> Zenith Optic - Proyecto Académico SENATI. Alessandro - Ing. de Software e IA.</p>
    </footer>

    <script>
        // Smooth Scroll
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            });
        });
    </script>
</body>
</html>
