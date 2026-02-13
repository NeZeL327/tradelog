import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const emptyState = {
  status: "free",
  plan: "free",
  currentPeriodEnd: null,
  customerId: null
};

export function useSubscription(userId) {
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

  return {
    subscription,
    isLoading,
    isPremium: subscription.status === "active" || subscription.status === "trialing"
  };
}
