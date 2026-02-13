import functions from "firebase-functions";
import admin from "firebase-admin";
import Stripe from "stripe";

admin.initializeApp();

const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

export const createCheckoutSession = functions.https.onRequest(async (req, res) => {
  if (!stripe) {
    res.status(500).json({ error: "Stripe not configured" });
    return;
  }
  try {
    const { priceId, successUrl, cancelUrl, customerEmail, userId } = req.body || {};
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      metadata: {
        userId: userId || ""
      }
    });
    res.json({ id: session.id, url: session.url });
  } catch (error) {
    res.status(500).json({ error: "Unable to create session" });
  }
});

export const createPortalSession = functions.https.onRequest(async (req, res) => {
  if (!stripe) {
    res.status(500).json({ error: "Stripe not configured" });
    return;
  }
  try {
    const { returnUrl, userId } = req.body || {};
    if (!userId) {
      res.status(400).json({ error: "Missing userId" });
      return;
    }
    const doc = await admin.firestore().collection("subscriptions").doc(String(userId)).get();
    const data = doc.data() || {};
    if (!data.customerId) {
      res.status(400).json({ error: "Missing customer" });
      return;
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: data.customerId,
      return_url: returnUrl
    });
    res.json({ url: portal.url });
  } catch (error) {
    res.status(500).json({ error: "Unable to create portal session" });
  }
});

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  if (!stripe) {
    res.status(500).send("Stripe not configured");
    return;
  }
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, signature, webhookSecret);
  } catch (error) {
    res.status(400).send("Webhook error");
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId || session.id;
    await admin.firestore().collection("subscriptions").doc(String(userId)).set({
      status: session.status,
      customerId: session.customer,
      email: session.customer_email,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    const snap = await admin.firestore().collection("subscriptions").where("customerId", "==", customerId).limit(1).get();
    if (!snap.empty) {
      const doc = snap.docs[0];
      await doc.ref.set({
        status: subscription.status,
        currentPeriodEnd: subscription.current_period_end || null
      }, { merge: true });
    }
  }

  res.json({ received: true });
});
