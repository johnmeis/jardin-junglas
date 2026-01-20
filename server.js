// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

// === Agregar Square SDK ===
const { Client, Environment } = require('square');

const squareClient = new Client({
  accessToken: process.env.SQUARE_ACCESS_TOKEN,
  environment: Environment.Sandbox // Cambia a Production en producción
});

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === NUEVA RUTA: Procesar pago con Square ===
app.post('/process-payment', async (req, res) => {
  console.log('=== INICIO PROCESO DE PAGO CON SQUARE ===');
  console.log('Body recibido:', req.body);
  
  const { email, phone, schedule, sourceId, amount, currency } = req.body;
 
  // Validación de datos
  if (!email || !phone || !schedule || !sourceId || !amount || !currency) {
    console.log('Error: Campos faltantes');
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  console.log('Datos validados correctamente:', { email, phone, schedule });

  // Guarda los datos del cliente (igual que antes)
  const clientData = { 
    email, 
    phone, 
    schedule, 
    paid: true, // Ahora sí está pagado
    timestamp: new Date().toISOString(),
    paymentProvider: 'square'
  };
 
  try {
    const clientsPath = path.join(__dirname, 'clients.json');
    let clients = [];
    if (fs.existsSync(clientsPath)) {
      const fileContent = fs.readFileSync(clientsPath, 'utf8');
      clients = fileContent ? JSON.parse(fileContent) : [];
    }
    clients.push(clientData);
    fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
    console.log('Cliente guardado en archivo JSON');
  } catch (fileError) {
    console.error('Error manejando archivo de clientes:', fileError);
  }

  try {
    // Procesar pago con Square
    console.log('Creando pago con Square...');
    const payment = await squareClient.paymentsApi.createPayment({
      sourceId,
      amountMoney: {
        amount,
        currency
      },
      idempotencyKey: require('crypto').randomBytes(22).toString('hex'),
      referenceId: `jardinería-${Date.now()}`
    });

    console.log('Pago con Square creado exitosamente:', payment.payment.id);
    
    res.json({ 
      success: true,
      paymentId: payment.payment.id
    });
  } catch (err) {
    console.error("=== ERROR DETALLADO DE SQUARE ===");
    console.error("Mensaje:", err.message);
    console.error("Código:", err.code);
    console.error("Detalles:", JSON.stringify(err, null, 2));
    
    res.status(500).json({ 
      success: false,
      error: 'Error al procesar el pago',
      message: err.message
    });
  }
});

// Páginas de éxito y cancelación (sin cambios)
app.get('/success', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pago Exitoso</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; background: #e8f5e8; }
        .success-container { background: white; padding: 2rem; border-radius: 10px; max-width: 500px; margin: 0 auto; }
        .success-icon { font-size: 4rem; color: #4caf50; margin-bottom: 1rem; }
      </style>
    </head>
    <body>
      <div class="success-container">
        <div class="success-icon">✅</div>
        <h1>¡Pago Exitoso!</h1>
        <p>Tu pago ha sido procesado correctamente.</p>
        <p>Nos pondremos en contacto contigo pronto.</p>
        <button onclick="window.location.href='/'" style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Volver al inicio</button>
      </div>
    </body>
    </html>
  `);
});

app.get('/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Pago Cancelado</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 2rem; background: #ffeaa7; }
        .cancel-container { background: white; padding: 2rem; border-radius: 10px; max-width: 500px; margin: 0 auto; }
        .cancel-icon { font-size: 4rem; color: #ff6b6b; margin-bottom: 1rem; }
      </style>
    </head>
    <body>
      <div class="cancel-container">
        <div class="cancel-icon">❌</div>
        <h1>Pago Cancelado</h1>
        <p>Tu pago ha sido cancelado.</p>
        <p>Puedes intentar nuevamente cuando gustes.</p>
        <button onclick="window.location.href='/'" style="background: #ff6b6b; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Volver al inicio</button>
      </div>
    </body>
    </html>
  `);
});

// Rutas para ver clientes (sin cambios)
app.get('/clientes', (req, res) => {
  const clientsPath = path.join(__dirname, 'clients.json');
  if (!fs.existsSync(clientsPath)) {
    return res.json([]);
  }
  try {
    const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
    res.json(clients);
  } catch (error) {
    console.error('Error leyendo clientes:', error);
    res.status(500).json({ error: 'Error leyendo datos de clientes' });
  }
});

app.get('/clientes-html', (req, res) => {
  const clientsPath = path.join(__dirname, 'clients.json');
  if (!fs.existsSync(clientsPath)) {
    return res.send('<h1>No hay clientes aún</h1>');
  }
  
  try {
    const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf8'));
    let html = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <title>Clientes Registrados</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 2rem; }
          table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Clientes Registrados</h1>
        <table>
          <tr><th>Email</th><th>Teléfono</th><th>Horario</th><th>Fecha</th><th>Estado</th></tr>
    `;
    
    clients.forEach(client => {
      html += `
        <tr>
          <td>${client.email}</td>
          <td>${client.phone}</td>
          <td>${client.schedule}</td>
          <td>${new Date(client.timestamp).toLocaleString()}</td>
          <td>${client.paid ? '✅ Pagado' : '⏳ Pendiente'}</td>
        </tr>
      `;
    });
    
    html += '</table></body></html>';
    res.send(html);
  } catch (error) {
    console.error('Error mostrando clientes:', error);
    res.send('<h1>Error cargando datos de clientes</h1>');
  }
});

// Manejo de errores 404
app.use((req, res) => {
  res.status(404).send('Página no encontrada');
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
  console.log(`URL local: http://localhost:${PORT}`);
});