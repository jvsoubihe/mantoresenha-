const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v = '') => String(v).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const cfg = window.MR_SUPABASE || {};
const ADMIN_EMAIL = (cfg.adminEmail || 'jvsoubihe@gmail.com').toLowerCase();

if (!cfg.url || !cfg.anonKey || !window.supabase) {
  $('#err').textContent = 'A conexão com o Supabase não está configurada.';
  $('#enter').disabled = true;
} else {
  const sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  let base = [], overrides = {}, custom = [], editingCustomId = null;

  $('#email').value = ADMIN_EMAIL;
  $('#email').readOnly = true;

  function showStatus(text, error = false) {
    const el = $('#adminMsg');
    if (!el) return;
    el.textContent = text;
    el.className = error ? 'adminMsg error' : 'adminMsg ok';
    if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ''; }, 3500);
  }

  async function auth() {
    const { data } = await sb.auth.getSession();
    const u = data.session?.user;
    if (u && u.email?.toLowerCase() === ADMIN_EMAIL) {
      $('#login').classList.add('hidden');
      $('#panel').classList.remove('hidden');
      await refreshAll();
    } else if (u) {
      await sb.auth.signOut();
      $('#err').textContent = 'Este usuário não possui acesso administrativo.';
    }
  }

  $('#enter').onclick = async () => {
    $('#err').textContent = 'Entrando...';
    const { error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL, password: $('#pass').value });
    if (error) $('#err').textContent = 'Senha inválida ou conta administrativa ainda não cadastrada.';
    else { $('#err').textContent = ''; auth(); }
  };
  $('#pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#enter').click(); });
  $('#logout').onclick = async () => { await sb.auth.signOut(); location.reload(); };

  $$('.tab').forEach((b) => b.onclick = () => {
    $$('.tab').forEach((x) => x.classList.remove('active'));
    b.classList.add('active');
    ['orders','customers','catalog'].forEach((t) => $(`#${t}Tab`).classList.toggle('hidden', t !== b.dataset.tab));
  });

  async function refreshAll() {
    base = await fetch('products.json', { cache: 'no-store' }).then((r) => r.json());
    await Promise.all([loadOverrides(), loadCustom(), renderOrders(), renderCustomers()]);
    renderCatalog();
  }

  async function loadOverrides() {
    const { data, error } = await sb.from('catalog_overrides').select('*');
    if (error) { showStatus(error.message, true); return; }
    overrides = Object.fromEntries((data || []).map((x) => [String(x.product_id), x]));
  }

  async function loadCustom() {
    const { data, error } = await sb.from('custom_products').select('*').order('id', { ascending: false });
    if (error) { showStatus(error.message, true); return; }
    custom = data || [];
  }

  async function renderOrders() {
    const { data, error } = await sb.from('order_interests').select('*').order('created_at', { ascending: false });
    $('#orders').innerHTML = error ? `<p>${esc(error.message)}</p>` : (data || []).map((o) => `
      <div class="lead"><b>${esc(o.email || 'Visitante')}</b><p>CEP: ${esc(o.cep)}</p><p>Endereço: ${esc(o.address)}</p>
      <p>${(o.items || []).map((i) => `${esc(i.id)} · ${esc(i.size)} · ${Number(i.qty) || 1} un.`).join('<br>')}</p>
      <small class="muted">${new Date(o.created_at).toLocaleString('pt-BR')}</small></div>`).join('') || '<p>Nenhum interesse registrado ainda.</p>';
  }

  async function renderCustomers() {
    const { data, error } = await sb.from('customer_profiles').select('*').order('created_at', { ascending: false });
    $('#customers').innerHTML = error ? `<p>${esc(error.message)}</p>` : (data || []).map((c) => `
      <div class="lead"><b>${esc(c.email)}</b><br><small class="muted">Cadastro: ${new Date(c.created_at).toLocaleString('pt-BR')}</small></div>`).join('') || '<p>Nenhum cadastro ainda.</p>';
  }

  function sizesHtml(prefix, id, sizes) {
    return ['P','M','G','GG'].map((s) => `<label><input data-size-group="${prefix}-${id}" value="${s}" type="checkbox" ${sizes.includes(s) ? 'checked' : ''}>${s}</label>`).join('');
  }

  function baseCard(p) {
    const x = overrides[String(p.id)] || {};
    const sizes = x.sizes ?? p.sizes ?? [];
    return `<div class="catalogCard">
      <img src="${esc(p.image)}" alt=""><div class="catalogInfo"><b>${esc(p.name)}</b><small>${esc(p.type)} · catálogo original</small>
      <div class="sizesA">${sizesHtml('base', p.id, sizes)}</div>
      <div class="catalogActions"><button data-save-base="${esc(p.id)}">Salvar tamanhos</button><button class="secondaryAdmin" data-hide-base="${esc(p.id)}">${x.hidden ? 'Reativar camisa' : 'Ocultar camisa'}</button></div></div></div>`;
  }

  function customCard(p) {
    return `<div class="catalogCard ${p.hidden ? 'isHidden' : ''}">
      <img src="${esc(p.image_url)}" alt=""><div class="catalogInfo"><b>${esc(p.name)}</b><small>${esc(p.type)} · adicionada pelo admin${p.hidden ? ' · OCULTA' : ''}</small>
      <div class="sizesA">${sizesHtml('custom', p.id, p.sizes || [])}</div>
      <div class="catalogActions"><button data-save-custom-sizes="${p.id}">Salvar tamanhos</button><button data-edit-custom="${p.id}">Editar</button><button class="secondaryAdmin" data-hide-custom="${p.id}">${p.hidden ? 'Reativar' : 'Ocultar'}</button><button class="dangerAdmin" data-delete-custom="${p.id}">Excluir</button></div></div></div>`;
  }

  function renderCatalog() {
    const q = ($('#find').value || '').trim().toLowerCase();
    const b = base.filter((p) => !q || p.name.toLowerCase().includes(q));
    const c = custom.filter((p) => !q || p.name.toLowerCase().includes(q));
    $('#catalogCount').textContent = `${b.length + c.length} resultado(s)`;
    $('#list').innerHTML = [...c.map(customCard), ...b.map(baseCard)].join('') || '<p>Nenhuma camisa encontrada.</p>';

    $$('[data-save-base]').forEach((btn) => btn.onclick = async () => {
      const id = btn.dataset.saveBase;
      const sizes = [...document.querySelectorAll(`[data-size-group="base-${CSS.escape(id)}"]:checked`)].map((x) => x.value);
      const old = overrides[id] || {};
      const { error } = await sb.from('catalog_overrides').upsert({ product_id: id, hidden: !!old.hidden, sizes });
      if (error) return showStatus(error.message, true);
      overrides[id] = { product_id: id, hidden: !!old.hidden, sizes };
      showStatus('Tamanhos atualizados.');
    });

    $$('[data-hide-base]').forEach((btn) => btn.onclick = async () => {
      const id = btn.dataset.hideBase;
      const p = base.find((x) => String(x.id) === String(id));
      const old = overrides[id] || {};
      const row = { product_id: id, hidden: !old.hidden, sizes: old.sizes ?? p.sizes ?? [] };
      const { error } = await sb.from('catalog_overrides').upsert(row);
      if (error) return showStatus(error.message, true);
      overrides[id] = row; renderCatalog(); showStatus(row.hidden ? 'Camisa ocultada da loja.' : 'Camisa reativada.');
    });

    $$('[data-save-custom-sizes]').forEach((btn) => btn.onclick = async () => {
      const id = Number(btn.dataset.saveCustomSizes);
      const sizes = [...document.querySelectorAll(`[data-size-group="custom-${id}"]:checked`)].map((x) => x.value);
      const { error } = await sb.from('custom_products').update({ sizes }).eq('id', id);
      if (error) return showStatus(error.message, true);
      const p = custom.find((x) => x.id === id); if (p) p.sizes = sizes;
      showStatus('Tamanhos atualizados.');
    });

    $$('[data-hide-custom]').forEach((btn) => btn.onclick = async () => {
      const id = Number(btn.dataset.hideCustom);
      const p = custom.find((x) => x.id === id);
      const { error } = await sb.from('custom_products').update({ hidden: !p.hidden }).eq('id', id);
      if (error) return showStatus(error.message, true);
      p.hidden = !p.hidden; renderCatalog(); showStatus(p.hidden ? 'Camisa ocultada da loja.' : 'Camisa reativada.');
    });

    $$('[data-delete-custom]').forEach((btn) => btn.onclick = async () => {
      const id = Number(btn.dataset.deleteCustom);
      const p = custom.find((x) => x.id === id);
      if (!confirm(`Excluir definitivamente "${p.name}"?`)) return;
      const { error } = await sb.from('custom_products').delete().eq('id', id);
      if (error) return showStatus(error.message, true);
      custom = custom.filter((x) => x.id !== id); renderCatalog(); showStatus('Camisa excluída.');
    });

    $$('[data-edit-custom]').forEach((btn) => btn.onclick = () => startEdit(Number(btn.dataset.editCustom)));
  }

  function formSizes() { return [...document.querySelectorAll('[data-new-size]:checked')].map((x) => x.value); }
  function setFormSizes(sizes) { $$('[data-new-size]').forEach((x) => x.checked = sizes.includes(x.value)); }
  function resetForm() {
    editingCustomId = null;
    $('#name').value = ''; $('#type').value = 'Torcedor'; $('#img').value = ''; setFormSizes(['P','M','G','GG']);
    $('#add').textContent = 'Adicionar camisa'; $('#cancelEdit').classList.add('hidden'); $('#formTitle').textContent = 'Adicionar nova camisa';
  }
  function startEdit(id) {
    const p = custom.find((x) => x.id === id); if (!p) return;
    editingCustomId = id; $('#name').value = p.name; $('#type').value = p.type; $('#img').value = p.image_url; setFormSizes(p.sizes || []);
    $('#add').textContent = 'Salvar alterações'; $('#cancelEdit').classList.remove('hidden'); $('#formTitle').textContent = 'Editar camisa';
    $('#catalogTab').scrollIntoView({ behavior: 'smooth' });
  }

  $('#cancelEdit').onclick = resetForm;
  $('#add').onclick = async () => {
    const name = $('#name').value.trim(), type = $('#type').value, image_url = $('#img').value.trim(), sizes = formSizes();
    if (!name || !image_url) return showStatus('Informe nome e URL da foto.', true);
    if (!sizes.length) return showStatus('Selecione pelo menos um tamanho.', true);
    let error;
    if (editingCustomId) {
      ({ error } = await sb.from('custom_products').update({ name, type, image_url, sizes }).eq('id', editingCustomId));
      if (!error) { const p = custom.find((x) => x.id === editingCustomId); Object.assign(p, { name, type, image_url, sizes }); }
    } else {
      const res = await sb.from('custom_products').insert({ name, type, image_url, sizes, hidden: false }).select().single();
      error = res.error; if (!error && res.data) custom.unshift(res.data);
    }
    if (error) return showStatus(error.message, true);
    showStatus(editingCustomId ? 'Camisa atualizada.' : 'Camisa adicionada.');
    resetForm(); renderCatalog();
  };

  $('#find').oninput = renderCatalog;
  resetForm();
  auth();
}
