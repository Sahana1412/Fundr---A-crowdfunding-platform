require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Stripe = require('stripe');

const app = express();
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors({ origin: process.env.FRONTEND_URL }));
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB connection error:", err));

// Mongoose schemas
const profileSchema = new mongoose.Schema({
  category: String,
  name: String,
  picture: String,
  biodata: String,
  purpose: String,
});

const donationSchema = new mongoose.Schema({
  profileId: mongoose.Types.ObjectId,
  amount: Number,
  appAmount: Number,
  date: { type: Date, default: Date.now },
});

const Profile = mongoose.model('Profile', profileSchema);
const Donation = mongoose.model('Donation', donationSchema);

// Routes

// Get all profiles or by category
app.get('/profiles', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    const profiles = await Profile.find(filter);
    res.json(profiles);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a new profile
app.post('/profiles', async (req, res) => {
  try {
    const { category, name, picture, biodata, purpose } = req.body;
    if (!category || !name || !picture || !biodata || !purpose) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const profile = new Profile({ category, name, picture, biodata, purpose });
    await profile.save();
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create a Stripe payment intent
app.post('/create-payment-intent', async (req, res) => {
  try {
    const { amount, donateToApp, profileId } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    // Calculate shares
    const totalAmount = Math.round(amount * 100); // cents
    const appShare = donateToApp ? Math.round(totalAmount * 0.1) : 0;
    const profileShare = totalAmount - appShare;

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: 'usd',
      metadata: {
        profileId: profileId || 'none',
        appShare,
        profileShare,
      },
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Payment intent creation failed' });
  }
});

// Webhook to confirm payment and record donation
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const metadata = paymentIntent.metadata;

    // Save donation record
    const donation = new Donation({
      profileId: metadata.profileId !== 'none' ? metadata.profileId : null,
      amount: metadata.profileShare / 100,
      appAmount: metadata.appShare / 100,
    });
    donation.save().catch(console.error);
  }

  res.json({ received: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
