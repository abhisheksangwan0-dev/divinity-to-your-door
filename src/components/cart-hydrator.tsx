import { useEffect } from "react";
import { useCart } from "@/lib/cart";

export function CartHydrator() {
  useEffect(() => {
    void Promise.resolve(useCart.persist.rehydrate()).finally(() => {
      useCart.getState().setHydrated(true);
    });
  }, []);
  return null;
}
