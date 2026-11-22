// Extracted from the immutable approved HTML (SHA-256 5a406bd6...).
const pbPaths = {
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  spark: 'M12 2 14.6 9.4 22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6Z',
  ticket: 'M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4ZM15 6v2m0 3v2m0 3v2',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  mark: 'M12 3v18M7 7l5-4 5 4M5 12l7 9 7-9',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
};
const pbIcon = (name) =>
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
  (pbPaths[name] || pbPaths.spark) +
  '"/></svg>';
const pbSparkArt =
  '<svg viewBox="0 0 30 36"><defs><linearGradient id="pb-spark-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fffdf4"/><stop offset=".46" stop-color="#e4d3ae"/><stop offset=".52" stop-color="#a48d67"/><stop offset="1" stop-color="#f3e6c3"/></linearGradient></defs><path d="M15 1C17 13 19 15 29 18C19 21 17 23 15 35C13 23 11 21 1 18C11 15 13 13 15 1Z" fill="url(#pb-spark-metal)"/><path d="M15 1V18L1 18C11 15 13 13 15 1Z" fill="#fffcf2"/></svg>';
const pbCoreArt =
  '<svg viewBox="0 0 64 64"><defs><linearGradient id="pb-shell" x1=".15" y1="0" x2=".85" y2="1"><stop stop-color="#4e5d6e"/><stop offset=".19" stop-color="#e7e8e3"/><stop offset=".3" stop-color="#7a8b9b"/><stop offset=".52" stop-color="#303b49"/><stop offset=".75" stop-color="#c5cbd0"/><stop offset="1" stop-color="#535e69"/></linearGradient><radialGradient id="pb-glass" cx=".38" cy=".26" r=".8"><stop stop-color="#4b5d70"/><stop offset=".4" stop-color="#1d3043"/><stop offset=".8" stop-color="#0c1725"/><stop offset="1" stop-color="#080f19"/></radialGradient><linearGradient id="pb-core-gold" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#fff4d7"/><stop offset=".5" stop-color="#d2bd8d"/><stop offset="1" stop-color="#8e794f"/></linearGradient></defs><circle cx="32" cy="33" r="29" fill="#19212d"/><circle cx="32" cy="31" r="28" fill="url(#pb-shell)"/><circle cx="32" cy="31" r="24.2" fill="url(#pb-glass)" stroke="#a8b3bb" stroke-width=".65"/><circle cx="32" cy="31" r="21.5" fill="none" stroke="#8a7e62" stroke-width=".55" opacity=".7"/><path d="M8 22A26 26 0 0 1 33 5" fill="none" stroke="#fffaf0" stroke-width="1.1" opacity=".75"/><path d="M56 40A26 26 0 0 1 32 57" fill="none" stroke="#dbe4ed" stroke-width=".7" opacity=".7"/><path d="M13 12l3 3M48 47l3 3M13 50l3-3M48 15l3-3" stroke="#15232f" stroke-width="1.5"/><path d="M32 15 36 27 48 31 36 35 32 47 28 35 16 31 28 27Z" fill="url(#pb-core-gold)"/><path d="M32 15v16L16 31l12-4Z" fill="#f5e6bb"/><path d="M32 31v16l4-12 12-4Z" fill="#9d865c"/><path d="M27 31h10M32 26v10" stroke="#fff7df" stroke-width=".55"/><ellipse cx="25" cy="17" rx="13" ry="5" transform="rotate(-28 25 17)" fill="#cde3f0" opacity=".08"/></svg>';
const pbCoinArt =
  '<svg viewBox="0 0 100 110"><defs><linearGradient id="pb-metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff1c9"/><stop offset=".32" stop-color="#d5ba83"/><stop offset=".6" stop-color="#f6dfab"/><stop offset="1" stop-color="#8f7148"/></linearGradient></defs><path d="M50 6 61 39 88 54 61 68 50 103 39 68 12 54 39 39Z" fill="#8c6d47" transform="translate(0 3)"/><path d="M50 6 61 39 88 54 61 68 50 103 39 68 12 54 39 39Z" fill="url(#pb-metal)" stroke="#fff0c6" stroke-width=".7"/><path d="M50 6v48L39 39Z" fill="#fff2c8"/><path d="M50 6 61 39 50 54Z" fill="#b89559"/><path d="M88 54H50L61 39Z" fill="#f9e6b7"/><path d="M88 54 61 68 50 54Z" fill="#a58553"/><path d="M50 103V54L61 68Z" fill="#d8b984"/><path d="M50 103 39 68 50 54Z" fill="#f6dfa8"/><path d="M12 54H50L39 68Z" fill="#9c7d4b"/><path d="M12 54 39 39 50 54Z" fill="#e6ca92"/><path d="m50 33 4.5 16.5L69 54l-14.5 4.5L50 75l-4.5-16.5L31 54l14.5-4.5Z" fill="#fff6d6" opacity=".38"/><path d="M50 10 40 40 16 54" stroke="#fff5d9" stroke-width="1" fill="none" opacity=".8"/></svg>';
const pbTicketArt =
  '<svg viewBox="0 0 172 100"><defs><linearGradient id="pb-ticket-face" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e5dbf4"/><stop offset=".48" stop-color="#b8a6d1"/><stop offset="1" stop-color="#8b78a9"/></linearGradient><linearGradient id="pb-ticket-stub" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f1e9e1"/><stop offset="1" stop-color="#d0bcaa"/></linearGradient></defs><path d="M10 8h150q6 0 6 6v19a14 14 0 0 0 0 28v19q0 6-6 6H10q-6 0-6-6V61a14 14 0 0 0 0-28V14q0-6 6-6Z" transform="translate(1 4)" fill="#564c70"/><path d="M10 8h150q6 0 6 6v19a14 14 0 0 0 0 28v19q0 6-6 6H10q-6 0-6-6V61a14 14 0 0 0 0-28V14q0-6 6-6Z" fill="url(#pb-ticket-face)" stroke="#ede3f6" stroke-width=".8"/><path d="M124 8h36q6 0 6 6v19a14 14 0 0 0 0 28v19q0 6-6 6h-36Z" fill="url(#pb-ticket-stub)"/><path d="M124 16v62" stroke="#927e9d" stroke-width=".8" stroke-dasharray="2 3"/><path d="M21 20h90M21 74h90" stroke="#eee1f8" stroke-width=".7" opacity=".55"/><path d="m65 27 5.4 14.6L85 47l-14.6 5.4L65 67l-5.4-14.6L45 47l14.6-5.4Z" fill="#f7ead0"/><path d="M65 27v40L45 47Z" fill="#c2a980" opacity=".5"/><path d="M137 30h16m-16 5h12m-12 20h16m-16 5h9" stroke="#958379" stroke-width="1"/><path d="M11 9h148" stroke="#f5eaff" stroke-width=".6" opacity=".8"/></svg>';
function pbArt(kind, id) {
  return (kind === 'coin' ? pbCoinArt : pbTicketArt)
    .replaceAll('pb-', id + '-')
    .replace('<svg ', '<svg aria-hidden="true" class="pb-art-' + kind + '" ');
}
const pbCore = (id) =>
  pbCoreArt.replaceAll('pb-', id + '-').replace('<svg ', '<svg aria-hidden="true" ');
export { pbIcon, pbSparkArt, pbArt, pbCore };
