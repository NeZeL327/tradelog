import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

const emptyState = {
  status: "free",
  plan: "free",
  currentPeriodEnd: null,
  customerId: null
};

const toMilliseconds = (value) => {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value?.toDate === "function") return value.toDate().getTime();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const deriveTrialFromRegistration = (subscription, userCreatedAt) => {
  if (subscription.customerId || subscription.status === "active") {
    return subscription;
  }

  const createdAtMs = toMilliseconds(userCreatedAt);
  if (!createdAtMs) {
    return subscription;
  }

  const trialEndMs = createdAtMs + TRIAL_DURATION_MS;
  const trialEndsInMs = trialEndMs - Date.now();

  if (trialEndsInMs > 0) {
    return {
      ...subscription,
      status: "trialing",
      trialEnd: Math.floor(trialEndMs / 1000)
    };
  }

  return {
    ...subscription,
    status: "trial_expired",
    trialEnd: Math.floor(trialEndMs / 1000)
  };
};

export function useSubscription(userId, userCreatedAt = null) {
  const [subscription, setSubscription] = useState(emptyState);
  const [isLoading, setIsLoading] = useState(Boolean(userId));

  useEffect(() => {
    if (!userId || !db) {
      setSubscription(emptyState);
      setIsLoading(false);
      return undefined;
    }

    const ref = doc(db, "subscriptions", String(userId));
    const unsubscribe = onSnapshot(
      ref,
      (snapshot) => {
        if (!snapshot.exists()) {
          setSubscription(emptyState);
        } else {
          setSubscription({ ...emptyState, ...snapshot.data() });
        }
        setIsLoading(false);
      },
      () => {
        setSubscription(emptyState);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  const effectiveSubscription = deriveTrialFromRegistration(subscription, userCreatedAt);

  return {
    subscription: effectiveSubscription,
    isLoading,
    isPremium: effectiveSubscription.status === "active" || effectiveSubscription.status === "trialing"
  };
}
