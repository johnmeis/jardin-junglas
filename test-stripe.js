// Cargamos dotenv al inicio
require('dotenv').config();

// Ahora sí, importamos stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

console.log("Stripe inicializado correctamente");

stripe.products.list()
  .then(products => {
    console.log("Productos encontrados:", products.data.length);
  })
  .catch(err => {
    console.error("Error al conectar con Stripe:", err.message);
  });