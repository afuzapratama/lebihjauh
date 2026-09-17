const filters = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
const cards = document.querySelectorAll<HTMLElement>('.trip-card');
filters.forEach((button) =>
  button.addEventListener('click', () => {
    filters.forEach((filter) => {
      const active = filter === button;
      filter.classList.toggle('active', active);
      filter.setAttribute('aria-pressed', String(active));
    });
    let count = 0;
    cards.forEach((card) => {
      card.hidden =
        button.dataset.filter !== 'all' &&
        card.dataset.category !== button.dataset.filter;
      if (!card.hidden) count++;
    });
    const status = document.querySelector('#filter-status');
    if (status) status.textContent = `${count} trip ditampilkan`;
  }),
);

let dialogTrigger: HTMLElement | null = null;
document
  .querySelectorAll<HTMLButtonElement>('[data-dialog]')
  .forEach((button) =>
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.dialog ?? '');
      if (!(dialog instanceof HTMLDialogElement)) return;
      dialogTrigger = button;
      dialog.showModal();
      document.body.classList.add('dialog-open');
    }),
  );
document.querySelectorAll<HTMLDialogElement>('dialog').forEach((dialog) => {
  dialog
    .querySelectorAll<HTMLElement>('[data-close]')
    .forEach((button) =>
      button.addEventListener('click', () => dialog.close()),
    );
  dialog.addEventListener('click', (event) => {
    const bounds = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < bounds.left ||
        event.clientX > bounds.right ||
        event.clientY < bounds.top ||
        event.clientY > bounds.bottom)
    )
      dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    dialogTrigger?.focus({ preventScroll: true });
  });
});

const requestForm = document.querySelector<HTMLFormElement>('#request-form');
const requestResult = document.querySelector<HTMLElement>('#request-result');
const summary = document.querySelector<HTMLElement>('#request-summary');
const dateInput =
  requestForm?.querySelector<HTMLInputElement>('input[type="date"]');
if (dateInput) {
  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 10);
  dateInput.min = localDate;
}
requestForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!requestForm.reportValidity() || !summary || !requestResult) return;
  const data = new FormData(requestForm);
  const date = new Date(`${data.get('date')}T00:00:00`).toLocaleDateString(
    'id-ID',
    { day: 'numeric', month: 'long', year: 'numeric' },
  );
  summary.textContent = `RENCANA PRIVATE TRIP — LEBIHJAUH\nDraft pribadi • belum dikirim / bukan reservasi\n\nNama: ${String(data.get('name')).trim()}\nDestinasi: ${data.get('destination')}\nRencana berangkat: ${date}\nPeserta: ${data.get('people')} orang\nCatatan: ${String(data.get('notes')).trim() || 'Belum ada catatan'}\n`;
  requestForm.hidden = true;
  requestResult.hidden = false;
  document.querySelector<HTMLButtonElement>('#download-request')?.focus();
});
document.querySelector('#edit-request')?.addEventListener('click', () => {
  if (!requestForm || !requestResult) return;
  requestForm.hidden = false;
  requestResult.hidden = true;
  const status = document.querySelector('#download-status');
  if (status) status.textContent = '';
  requestForm.querySelector('input')?.focus();
});
document.querySelector('#download-request')?.addEventListener('click', () => {
  if (!summary?.textContent) return;
  const url = URL.createObjectURL(
    new Blob([summary.textContent], { type: 'text/plain;charset=utf-8' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rencana-trip-lebihjauh.txt';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  const status = document.querySelector('#download-status');
  if (status)
    status.textContent =
      'Ringkasan siap diunduh. Rencana belum dikirim ke LebihJauh.';
});
