// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const fs = require('fs');

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/create-checkout-session', async (req, res) => {
  const { email, phone, schedule } = req.body;
 
  // Validación de datos
  if (!email || !phone || !schedule) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  // Guarda los datos del cliente
  const clientData = { 
    email, 
    phone, 
    schedule, 
    paid: false, 
    timestamp: new Date().toISOString() 
  };
 
  // Lee y escribe en clients.json
  try {
    const clientsPath = path.join(__dirname, 'clients.json');
    let clients = [];
    if (fs.existsSync(clientsPath)) {
      const fileContent = fs.readFileSync(clientsPath, 'utf8');
      clients = fileContent ? JSON.parse(fileContent) : [];
    }
    clients.push(clientData);
    fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));
  } catch (fileError) {
    console.error('Error manejando archivo de clientes:', fileError);
  }

  try {
    // Obtener el dominio base correctamente
    const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    console.log('Base URL para Stripe:', baseUrl); // Para debug

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Servicio de Jardinería',
            description: `Horario: ${schedule}, Email: ${email}`
          },
          unit_amount: 8990, // $89.90 USD
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/cancel`,
      customer_email: email,
      metadata: {
        email: email,
        phone: phone,
        schedule: schedule
      }
    });

    console.log('Sesión de Stripe creada:', session.id); // Para debug
    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error("Error al crear sesión de Stripe:", err);
    res.status(500).json({ error: 'Error interno del servidor', details: err.message });
  }
});

// Webhook para confirmar pagos (opcional pero recomendado)
app.post('/webhook', express.raw({type: 'application/json'}), (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    console.log('Pago completado:', session.id);
    // Aquí puedes actualizar el estado del cliente a "paid: true"
  }

  res.json({received: true});
});

// Páginas de éxito y cancelación mejoradas
app.get('/success', (req, res) => {
  const sessionId = req.query.session_id;
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
        ${sessionId ? `<p><small>ID de sesión: ${sessionId}</small></p>` : ''}
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

// Rutas para ver clientes
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