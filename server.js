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
  
  // Guarda los datos del cliente
  const clientData = { email, phone, schedule, paid: false, timestamp: new Date().toISOString() };
  
  // Lee y escribe en clients.json
  const clientsPath = path.join(__dirname, 'clients.json');
  let clients = [];
  if (fs.existsSync(clientsPath)) {
    clients = JSON.parse(fs.readFileSync(clientsPath));
  }
  clients.push(clientData);
  fs.writeFileSync(clientsPath, JSON.stringify(clients, null, 2));

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'affirm'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Servicio de Jardinería'
          },
          unit_amount: 8990, // $89.90 USD
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/success`,
      cancel_url: `${req.headers.origin}/cancel`
    });
    res.json({ id: session.id });
  } catch (err) {
    console.error("Error al crear sesión:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Páginas de éxito y cancelación
app.get('/success', (req, res) => {
  res.send('<h1>✅ ¡Pago exitoso!</h1>');
});

app.get('/cancel', (req, res) => {
  res.send('<h1>❌ Pago cancelado</h1>');
});

// Rutas para ver clientes
app.get('/clientes', (req, res) => {
  const clientsPath = path.join(__dirname, 'clients.json');
  if (!fs.existsSync(clientsPath)) {
    return res.json([]);
  }
  const clients = JSON.parse(fs.readFileSync(clientsPath));
  res.json(clients);
});

app.get('/clientes-html', (req, res) => {
  const clientsPath = path.join(__dirname, 'clients.json');
  if (!fs.existsSync(clientsPath)) {
    return res.send('<h1>No hay clientes aún</h1>');
  }
  const clients = JSON.parse(fs.readFileSync(clientsPath));
  let html = `
    <h1>Clientes Registrados</h1>
    <table border="1" cellpadding="10">
      <tr><th>Email</th><th>Teléfono</th><th>Horario</th><th>Fecha</th></tr>
  `;
  clients.forEach(client => {
    html += `
      <tr>
        <td>${client.email}</td>
        <td>${client.phone}</td>
        <td>${client.schedule}</td>
        <td>${new Date(client.timestamp).toLocaleString()}</td>
      </tr>
    `;
  });
  html += '</table>';
  res.send(html);
});

// Archivo estático al final
app.use(express.static('public'));

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});