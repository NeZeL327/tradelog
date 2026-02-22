import functions from "firebase-functions";
import admin from "firebase-admin";
import Stripe from "stripe";
import cors from "cors";

admin.initializeApp();

const stripeSecret = process.env.STRIPE_SECRET_KEY || functions.config()?.stripe?.secret_key || "";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || functions.config()?.stripe?.webhook_secret || "";
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;
const REGISTRATION_TRIAL_DAYS = 14;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const corsHandler = cors({ origin: true });

export const createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!stripe) {
    throw new functions.https.HttpsError("unavailable", "Stripe not configured");
  }

  try {
    const { priceId, successUrl, cancelUrl, customerEmail, userId } = data;
    let effectiveTrialDays = 0;
    if (userId) {
      const existing = await admin.firestore().collection("subscriptions").doc(String(userId)).get();
      const hasCustomer = existing.exists && Boolean(existing.data()?.customerId);

      if (!hasCustomer) {
        const userDoc = await admin.firestore().collection("users").doc(String(userId)).get();
        const createdAt = userDoc.data()?.createdAt;
        const createdAtMs = typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : null;

        if (createdAtMs) {
          const trialEndMs = createdAtMs + REGISTRATION_TRIAL_DAYS * DAY_IN_MS;
          const remainingMs = trialEndMs - Date.now();
          if (remainingMs > 0) {
            effectiveTrialDays = Math.max(1, Math.ceil(remainingMs / DAY_IN_MS));
          }
        }
      }
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: customerEmail,
      client_reference_id: userId || undefined,
      subscription_data: effectiveTrialDays > 0 ? { trial_period_days: effectiveTrialDays } : undefined,
      metadata: {
        userId: userId || ""
      }
    });
    return { id: session.id, url: session.url };
  } catch (error) {
    console.error("createCheckoutSession error:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Unable to create session");
  }
});

export const createPortalSession = functions.https.onCall(async (data, context) => {
  if (!stripe) {
    throw new functions.https.HttpsError("unavailable", "Stripe not configured");
  }

  try {
    const { returnUrl, userId } = data;
    if (!userId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing userId");
    }

    const doc = await admin.firestore().collection("subscriptions").doc(String(userId)).get();
    const subscriptionData = doc.data() || {};
    let customerId = subscriptionData.customerId;

    // Fallback: if no customerId locally, try to fetch from Stripe using subscriptionId
    if (!customerId && subscriptionData.subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(String(subscriptionData.subscriptionId));
        customerId = subscription.customer;
      } catch (error) {
        // Ignore fallback error
      }
    }

    if (!customerId) {
      throw new functions.https.HttpsError("not-found", "Missing customer");
    }

    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });

    return { url: portal.url };
  } catch (error) {
    console.error("createPortalSession error:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Unable to create portal session");
  }
});

export const cancelSubscription = functions.https.onCall(async (data, context) => {
  if (!stripe) {
    throw new functions.https.HttpsError("unavailable", "Stripe not configured");
  }

  try {
    const { userId } = data;
    if (!userId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing userId");
    }

    const userSubscriptionRef = admin.firestore().collection("subscriptions").doc(String(userId));
    const userSubscriptionDoc = await userSubscriptionRef.get();
    const current = userSubscriptionDoc.data() || {};
    const subscriptionId = current.subscriptionId;

    if (!subscriptionId) {
      throw new functions.https.HttpsError("not-found", "Missing subscription");
    }

    const canceled = await stripe.subscriptions.update(String(subscriptionId), {
      cancel_at_period_end: true
    });

    await userSubscriptionRef.set({
      status: canceled.status,
      currentPeriodEnd: canceled.current_period_end || null,
      trialEnd: canceled.trial_end || null,
      subscriptionId: canceled.id || null,
      cancelAtPeriodEnd: Boolean(canceled.cancel_at_period_end),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return { ok: true, cancelAtPeriodEnd: Boolean(canceled.cancel_at_period_end) };
  } catch (error) {
    console.error("cancelSubscription error:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Unable to cancel subscription");
  }
});

export const syncCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!stripe) {
    throw new functions.https.HttpsError("unavailable", "Stripe not configured");
  }

  try {
    const { sessionId, userId } = data;
    if (!sessionId || !userId) {
      throw new functions.https.HttpsError("invalid-argument", "Missing sessionId or userId");
    }

    const session = await stripe.checkout.sessions.retrieve(String(sessionId), {
      expand: ["subscription"]
    });

    const ownerUserId = session.metadata?.userId || session.client_reference_id || session.id;
    if (String(ownerUserId) !== String(userId)) {
      throw new functions.https.HttpsError("permission-denied", "Session does not belong to user");
    }

    let subscriptionData = null;
    if (session.subscription && typeof session.subscription === "object") {
      subscriptionData = session.subscription;
    } else if (session.subscription) {
      subscriptionData = await stripe.subscriptions.retrieve(String(session.subscription));
    }

    const payload = {
      status: subscriptionData?.status || session.status,
      customerId: session.customer || null,
      email: session.customer_email || null,
      subscriptionId: subscriptionData?.id || session.subscription || null,
      currentPeriodEnd: subscriptionData?.current_period_end || null,
      trialEnd: subscriptionData?.trial_end || null,
      cancelAtPeriodEnd: Boolean(subscriptionData?.cancel_at_period_end),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await admin.firestore().collection("subscriptions").doc(String(userId)).set(payload, { merge: true });
    return { ok: true, ...payload };
  } catch (error) {
    console.error("syncCheckoutSession error:", error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError("internal", "Unable to sync checkout session");
  }
});

export const stripeWebhook = functions.https.onRequest((req, res) => {
  corsHandler(req, res, async () => {
    if (!stripe) {
      res.status(500).send("Stripe not configured");
      return;
    }

    try {
      const signature = req.headers["stripe-signature"];
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
        let subscriptionData = null;
        if (session.subscription) {
          try {
            subscriptionData = await stripe.subscriptions.retrieve(String(session.subscription));
          } catch (error) {
            subscriptionData = null;
          }
        }
        await admin.firestore().collection("subscriptions").doc(String(userId)).set({
          status: subscriptionData?.status || session.status,
          customerId: session.customer,
          email: session.customer_email,
          subscriptionId: session.subscription || null,
          currentPeriodEnd: subscriptionData?.current_period_end || null,
          trialEnd: subscriptionData?.trial_end || null,
          cancelAtPeriodEnd: Boolean(subscriptionData?.cancel_at_period_end),
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
            currentPeriodEnd: subscription.current_period_end || null,
            trialEnd: subscription.trial_end || null,
            subscriptionId: subscription.id || null,
            cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end)
          }, { merge: true });
        }
      }

      res.json({ received: true });
    } catch (error) {
      console.error("stripeWebhook error:", error);
      res.status(500).json({ error: "Webhook processing error" });
    }
  });
});
