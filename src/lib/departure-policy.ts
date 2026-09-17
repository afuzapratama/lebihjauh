/**
 * Aturan penghapusan jadwal dipakai oleh API dan UI. Pada 4C belum ada tabel
 * order, sehingga pemanggil memberikan 0. Ketika 4E hadir, gantikan sumber angka
 * tersebut dengan jumlah order aktif/riwayat yang terkait departure—aturan dan UI
 * tidak perlu diubah lagi.
 */
export function departureDeletionPolicy(
  orderCount: number,
  blockers: { activeQuoteCount?: number; expenseCount?: number } = {},
) {
  const normalizedOrderCount = Math.max(0, Math.trunc(orderCount));
  const activeQuoteCount = Math.max(
    0,
    Math.trunc(blockers.activeQuoteCount ?? 0),
  );
  const expenseCount = Math.max(0, Math.trunc(blockers.expenseCount ?? 0));
  const canDelete =
    normalizedOrderCount === 0 && activeQuoteCount === 0 && expenseCount === 0;
  const deleteReason = normalizedOrderCount
    ? `${normalizedOrderCount} order sudah terkait dengan jadwal ini. Jadwal tidak dapat dihapus.`
    : activeQuoteCount
      ? `${activeQuoteCount} proses checkout masih aktif. Tunggu hingga kedaluwarsa sebelum menghapus jadwal.`
      : expenseCount
        ? `${expenseCount} catatan biaya terkait dengan jadwal ini. Jadwal tidak dapat dihapus karena riwayat keuangan harus dipertahankan.`
        : null;
  return {
    orderCount: normalizedOrderCount,
    activeQuoteCount,
    expenseCount,
    canDelete,
    deleteReason,
  };
}

export function tripArchivePolicy(departures: Array<{ orderCount: number }>) {
  const orderCount = departures.reduce(
    (total, departure) => total + Math.max(0, Math.trunc(departure.orderCount)),
    0,
  );
  const canArchive = orderCount === 0;
  return {
    orderCount,
    canArchive,
    archiveReason: canArchive
      ? null
      : `${orderCount} order terkait dengan jadwal trip ini. Trip tidak dapat diarsipkan.`,
  };
}
