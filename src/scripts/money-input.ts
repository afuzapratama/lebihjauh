/** Input uang hanya menangani Rupiah bulat. Nilai tampilan boleh "Rp3.000.000",
 * tetapi pemanggil selalu dapat mengirim `rupiahDigits(value)` ke API. */
export const rupiahDigits = (value: unknown) =>
  String(value ?? '').replace(/\D/g, '');

export const formatRupiahInput = (value: unknown) => {
  const digits = rupiahDigits(value).replace(/^0+(?=\d)/, '');
  return digits ? `Rp${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` : '';
};

export function setRupiahInput(input: HTMLInputElement, value: unknown) {
  input.value = formatRupiahInput(value);
}

export function bindRupiahInput(
  input: HTMLInputElement,
  isCurrency: () => boolean = () => true,
) {
  const sync = () => {
    input.value = isCurrency()
      ? formatRupiahInput(input.value)
      : rupiahDigits(input.value);
  };
  input.addEventListener('input', sync);
  input.addEventListener('paste', () => requestAnimationFrame(sync));
  return sync;
}
