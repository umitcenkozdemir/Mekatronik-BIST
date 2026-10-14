(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const form = $('#f'), vin = $('#vin'), alerts = $('#alerts');
  const csrf = document.querySelector('meta[name=csrf]').content;
  const MEMO = ['warehouse', 'inspector_id', 'inspected_at']; // ardışık araçlarda hatırlanan alanlar
  let lastDecoded = null;

  const say = (type, html) => { alerts.innerHTML = `<div class="alert alert-${type} py-2">${html}</div>`; };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = (k, v) => { try { v === undefined ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} };
  const recall = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };

  // Yeni kayıtta son kullanılan ambar/ekspert/tarihi doldur
  if (!form.elements.inspection_id.value) {
    MEMO.forEach((k) => { const v = recall('memo_' + k); if (v && form.elements[k] && !form.elements[k].value) form.elements[k].value = v; });
  }
  MEMO.forEach((k) => form.elements[k].addEventListener('change', () => store('memo_' + k, form.elements[k].value)));

  const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  vin.addEventListener('input', () => {
    vin.value = clean(vin.value).slice(0, 17);
    $('#vinCount').textContent = vin.value.length;
    if (vin.value.length === 17) decode();
  });
  $('#decodeBtn').addEventListener('click', decode);
  $('#vinCount').textContent = vin.value.length;

  async function decode() {
    const v = vin.value;
    if (v.length !== 17) return say('warning', 'Şasi numarası 17 haneli olmalı.');
    const btn = $('#decodeBtn'); btn.disabled = true; btn.textContent = '...';
    try {
      const r = await fetch('api/decode.php?vin=' + encodeURIComponent(v), { headers: { Accept: 'application/json' } });
      const j = await r.json();
      if (!j.ok) return say('danger', esc(j.error || 'Sorgu başarısız.'));
      if (j.exists) {
        return say('info', 'Bu araç daha önce kaydedilmiş. <a href="index.php?id=' + j.inspection_id + '">Kaydı aç</a>');
      }
      fill(j.fields || {});
      $('#decode_sources').value = (j.sources || []).join(',');
      const n = Object.keys(j.fields || {}).length;
      const warn = (j.warnings || []).map(esc).join('<br>');
      say(n ? (warn ? 'warning' : 'success') : 'warning',
        (n ? `${n} alan otomatik dolduruldu (sarı). Kontrol edin.` : 'Otomatik veri bulunamadı, formu elle doldurun.') + (warn ? '<br><small>' + warn + '</small>' : ''));
    } catch (e) {
      say('warning', 'Sunucuya/API\'ye ulaşılamadı. Formu elle doldurabilirsiniz.');
    } finally { btn.disabled = false; btn.textContent = 'Sorgula'; }
  }

  function fill(fields) {
    Object.entries(fields).forEach(([k, val]) => {
      const el = form.elements[k];
      if (!el || el.type === 'hidden' || el.value) return; // elle girilen veriyi ezme
      el.value = val; el.classList.add('auto');
      el.addEventListener('input', () => el.classList.remove('auto'), { once: true });
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#saveBtn'); btn.disabled = true; btn.textContent = 'Kaydediliyor...';
    try {
      const r = await fetch('api/save.php', { method: 'POST', body: new FormData(form), headers: { 'X-CSRF-Token': csrf } });
      const j = await r.json();
      if (!j.ok) return say('danger', (j.errors || [j.error || 'Hata']).map(esc).join('<br>'));
      form.elements.inspection_id.value = j.inspection_id;
      $('#pdfBtn').href = j.pdf; $('#pdfBtn').classList.remove('d-none'); $('#nextBtn').classList.remove('d-none');
      say('success', 'Kaydedildi. PDF hazır.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      say('danger', 'Bağlantı hatası — kayıt yapılamadı, tekrar deneyin.');
    } finally { btn.disabled = false; btn.textContent = 'Kaydet'; }
  });
})();
