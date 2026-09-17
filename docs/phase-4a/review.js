'use strict';
// Workshop only: no persistence, HTTP writes, real orders, or payment verification.
const $ = (id) => document.getElementById(id);
const money = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
let order = null;
let nextOrder = 1;
let pending = null;
let privateStep = 0;

function showScreen(name) {
  document.querySelectorAll('main > section').forEach((section) => {
    section.hidden = section.id !== `screen-${name}`;
  });
  document.querySelectorAll('nav [data-screen]').forEach((button) => {
    if (button.dataset.screen === name)
      button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  const heading = document.querySelector(`#screen-${name} h1`);
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  if (window.innerWidth < 650) heading.scrollIntoView({ block: 'start' });
}
document
  .querySelectorAll('[data-screen]')
  .forEach((button) =>
    button.addEventListener('click', () => showScreen(button.dataset.screen)),
  );

function calculation() {
  if (!$('schedule-form').checkValidity() || !$('pax').checkValidity())
    throw new Error('Isi harga, kuota, pax, dan DP dengan angka yang valid.');
  const price = BigInt($('price').valueAsNumber);
  const pax = Number($('pax').value);
  const capacity = Number($('capacity').value);
  if (pax > capacity)
    throw new Error(
      'Jumlah pax melebihi kuota contoh. Kurangi pax atau ubah kuota di tab Admin jadwal.',
    );
  const total = price * BigInt(pax);
  let dp;
  if ($('dp-mode').value === 'percentage') {
    const bps = BigInt(Math.round($('dp-value').valueAsNumber * 100));
    dp = (total * bps + 9999n) / 10000n;
  } else {
    dp =
      BigInt($('dp-value').valueAsNumber) *
      ($('dp-basis').value === 'pax' ? BigInt(pax) : 1n);
  }
  if (dp <= 0n || dp > total)
    throw new Error(
      'DP minimum harus lebih dari nol dan tidak melebihi total pesanan.',
    );
  return { price, pax, total, dp, capacity };
}
function renderQuote() {
  try {
    const quote = calculation();
    $('quote-price').textContent = money(quote.price);
    $('quote-pax').textContent = `${quote.pax} pax`;
    $('quote-total').textContent = money(quote.total);
    $('quote-dp').textContent = money(quote.dp);
    $('quote-balance').textContent = money(quote.total - quote.dp);
    $('calculation-error').hidden = true;
  } catch (error) {
    [
      'quote-price',
      'quote-pax',
      'quote-total',
      'quote-dp',
      'quote-balance',
    ].forEach((id) => {
      $(id).textContent = '—';
    });
    $('calculation-error').hidden = false;
    $('calculation-error').textContent = error.message;
  }
}
$('dp-mode').addEventListener('change', () => {
  const percentage = $('dp-mode').value === 'percentage';
  $('dp-basis').disabled = percentage;
  if (percentage) $('dp-basis').value = 'order';
  $('dp-value-label').textContent = percentage
    ? 'Persentase DP (%)'
    : 'Nominal DP (Rp)';
  $('dp-value').min = percentage ? '0.01' : '1';
  $('dp-value').max = percentage ? '100' : '1000000000';
  $('dp-value').step = percentage ? '0.01' : '1';
  $('dp-value').value = percentage ? '30' : '1000000';
  renderQuote();
});
['price', 'capacity', 'dp-value', 'dp-basis', 'pax'].forEach((id) =>
  $(id).addEventListener('input', renderQuote),
);
$('schedule-form').addEventListener('submit', (event) => {
  event.preventDefault();
  showScreen('checkout');
});
$('checkout-form').addEventListener('submit', (event) => {
  event.preventDefault();
  try {
    const quote = calculation();
    order = {
      ...quote,
      number: `LJ-OT-DEMO-${String(nextOrder++).padStart(3, '0')}`,
      paid: 0n,
      state: 'awaiting_payment',
      history: ['Order simulasi dibuat. Kuota ditahan dalam contoh.'],
    };
    pending = null;
    $('order-message').textContent =
      'Simulasi terbaru menggantikan contoh invoice sebelumnya. Tidak ada order yang disimpan di server.';
    $('payment-amount').value = String(order.dp);
    renderInvoice();
    showScreen('invoice');
  } catch (error) {
    $('order-message').textContent = error.message;
    renderQuote();
  }
});

function renderInvoice() {
  $('no-order').hidden = Boolean(order);
  $('invoice-content').hidden = !order;
  if (!order) return;
  const status =
    order.paid === 0n ? 'Unpaid' : order.paid < order.total ? 'DP' : 'Paid';
  const expired = order.state === 'expired';
  $('payment-status').textContent = status;
  $('booking-status').textContent = expired
    ? 'Kedaluwarsa'
    : order.state === 'confirmed'
      ? 'Terkonfirmasi'
      : 'Menunggu DP';
  $('seat-status').textContent = expired
    ? 'Dilepas'
    : order.state === 'confirmed'
      ? `${order.pax} pax terkonfirmasi`
      : `${order.pax} pax ditahan`;
  $('invoice-number').textContent = order.number;
  $('invoice-description').textContent =
    `Labuan Bajo · 18–25 Oktober 2026 · ${order.pax} pax · PIC contoh: Raka`;
  $('invoice-total').textContent = money(order.total);
  $('invoice-dp').textContent = money(order.dp);
  $('invoice-paid').textContent = money(order.paid);
  $('invoice-dp-short').textContent = money(
    order.dp > order.paid ? order.dp - order.paid : 0n,
  );
  $('invoice-balance').textContent = money(
    order.total > order.paid ? order.total - order.paid : 0n,
  );
  $('invoice-overpaid').textContent = money(
    order.paid > order.total ? order.paid - order.total : 0n,
  );
  $('wa-message').textContent =
    `[SIMULASI] Halo LebihJauh, saya ingin membahas order ${order.number}.\nLabuan Bajo, 18–25 Oktober 2026, ${order.pax} pax.\nTotal ${money(order.total)} · Down Payment minimum ${money(order.dp)}.\nStatus pembayaran: ${status}.`;
  $('review-status').textContent = pending
    ? `Bukti contoh ${money(pending)} menunggu verifikasi. Belum menambah jumlah terbayar.`
    : expired && order.paid > 0n
      ? 'Ada uang diterima pada order kedaluwarsa. Admin perlu rekonsiliasi; kursi tidak kembali otomatis.'
      : 'Belum ada bukti pending.';
  $('accept-payment').disabled = pending === null;
  $('reject-payment').disabled = pending === null;
  $('payment-form').querySelector('button').disabled = pending !== null;
  $('expire-order').disabled = order.state !== 'awaiting_payment';
  $('ledger-list').replaceChildren(
    ...order.history.map((entry) => {
      const li = document.createElement('li');
      li.textContent = entry;
      return li;
    }),
  );
}
$('payment-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!order || pending !== null || !$('payment-form').reportValidity()) return;
  pending = BigInt($('payment-amount').valueAsNumber);
  order.history.push(
    `Bukti masuk (simulasi): ${money(pending)}. Menunggu pemeriksaan.`,
  );
  renderInvoice();
});
$('accept-payment').addEventListener('click', () => {
  if (!order || pending === null) return;
  order.paid += pending;
  order.history.push(`Admin menerima ${money(pending)} dalam simulasi.`);
  pending = null;
  if (order.state === 'awaiting_payment' && order.paid >= order.dp)
    order.state = 'confirmed';
  $('payment-amount').value = String(
    order.total > order.paid ? order.total - order.paid : 1n,
  );
  renderInvoice();
});
$('reject-payment').addEventListener('click', () => {
  if (!order || pending === null) return;
  order.history.push(
    `Bukti ${money(pending)} ditolak dalam simulasi. Saldo tidak berubah.`,
  );
  pending = null;
  renderInvoice();
});
$('expire-order').addEventListener('click', () => {
  if (!order || order.state !== 'awaiting_payment') return;
  order.state = 'expired';
  order.history.push(
    'Simulasi hold berakhir dan alokasi dilepas. Perlakuan grace bukti pending masih keputusan D04.',
  );
  renderInvoice();
});
function renderPrivate() {
  const states = [
    'Request baru',
    'Diskusi kebutuhan',
    'Penawaran contoh',
    'Kesepakatan contoh',
    'LJ-PT-DEMO-001 · invoice contoh',
  ];
  const labels = [
    'Simulasikan admin menindaklanjuti ↗',
    'Simulasikan membuat penawaran ↗',
    'Simulasikan kesepakatan ↗',
    'Simulasikan konversi ke invoice ↗',
    'Konversi contoh sudah ditampilkan',
  ];
  $('private-state').textContent = states[privateStep];
  $('private-next').textContent = labels[privateStep];
  $('private-next').disabled = privateStep === 4;
  document.querySelectorAll('[data-private-step]').forEach((li) => {
    li.classList.toggle(
      'current',
      Number(li.dataset.privateStep) === privateStep,
    );
    li.classList.toggle('done', Number(li.dataset.privateStep) < privateStep);
  });
}
$('private-next').addEventListener('click', () => {
  if (privateStep < 4) privateStep++;
  renderPrivate();
});
$('private-reset').addEventListener('click', () => {
  privateStep = 0;
  renderPrivate();
});
renderQuote();
renderInvoice();
renderPrivate();
