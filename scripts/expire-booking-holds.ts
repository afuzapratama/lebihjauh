import { expireDueBookingHolds } from '../src/lib/booking-admin';

const expired = await expireDueBookingHolds();
console.log(
  `Booking hold cleanup selesai: ${expired} hold kedaluwarsa diproses.`,
);
