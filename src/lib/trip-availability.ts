type Allocation = {
  pax: number;
  pickupOptionId: string | null;
  state: string;
  expiresAt: Date | null;
};

type Pickup = {
  id: string;
  capacity: number | null;
  pricePerPax: string;
};

/** Read-side availability. Quote and booking still recheck capacity on the server. */
export function availableTripOptions<T extends Pickup>(
  capacity: number,
  pickups: T[],
  allocations: Allocation[],
  now: Date,
) {
  const occupiedByPickup = new Map<string, number>();
  let occupied = 0;
  for (const allocation of allocations) {
    if (
      allocation.state !== 'committed' &&
      !(
        allocation.state === 'held' &&
        allocation.expiresAt &&
        allocation.expiresAt > now
      )
    )
      continue;
    occupied += allocation.pax;
    if (allocation.pickupOptionId) {
      occupiedByPickup.set(
        allocation.pickupOptionId,
        (occupiedByPickup.get(allocation.pickupOptionId) ?? 0) + allocation.pax,
      );
    }
  }
  const available = Math.max(0, capacity - occupied);
  const pickupOptions = pickups
    .map((pickup) => ({
      ...pickup,
      available:
        pickup.capacity === null
          ? available
          : Math.max(
              0,
              Math.min(
                available,
                pickup.capacity - (occupiedByPickup.get(pickup.id) ?? 0),
              ),
            ),
    }))
    .filter((pickup) => pickup.available > 0);
  if (!pickupOptions.length) return null;
  const unitPrice = pickupOptions.reduce(
    (minimum, pickup) =>
      BigInt(pickup.pricePerPax) < BigInt(minimum)
        ? pickup.pricePerPax
        : minimum,
    pickupOptions[0].pricePerPax,
  );
  return { available, pickupOptions, unitPrice };
}
