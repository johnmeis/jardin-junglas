// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Crear sesión de Stripe
app.post('/create-checkout-session', async (req, res) => {
  const { email, phone, schedule } = req.body;

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
      cancel_url: `${req.headers.origin}/cancel`,
      customer_email: email || undefined
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

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});