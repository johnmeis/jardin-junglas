require('dotenv').config();
const express = require('express');
const path = require('path');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const app = express();

// ✅ 1. Middlewares para recibir datos
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ 2. Tus rutas van primero
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/create-checkout-session', async (req, res) => {
  // Aquí ya puedes desestructurar sin problemas
  const { email, phone, schedule } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'affirm'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Servicio de Jardinería',
          },
          unit_amount: 5000,
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

app.get('/success', (req, res) => {
  res.send('<h1>✅ ¡Pago exitoso!</h1>');
});

app.get('/cancel', (req, res) => {
  res.send('<h1>❌ Pago cancelado</h1>');
});

// ✅ 3. Servir archivos estáticos al final
app.use(express.static(path.join(__dirname, 'public')));

// ✅ Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});