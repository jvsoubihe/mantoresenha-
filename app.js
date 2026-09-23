const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (v = '') => String(v).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

let PRODUCTS = [];
let fav = JSON.parse(localStorage.getItem('mr_fav') || '[]');
let cart = JSON.parse(localStorage.getItem('mr_cart') || '[]');
let type = 'Todos', query = '', sort = 'recent', limit = 24;

const cfg = window.MR_SUPABASE || {};
const sb = (cfg.url && cfg.anonKey && window.supabase)
  ? window.supabase.createClient(cfg.url, cfg.anonKey)
  : null;

async function load() {
  try {
    const res = await fetch('products.json', { cache: 'no-store' });
    PRODUCTS = await res.json();
  } catch (e) {
    PRODUCTS = [];
  }

  if (sb) {
    try {
      const { data: overrides, error: overrideError } = await sb.from('catalog_overrides').select('*');
      if (!overrideError && overrides) {
        const map = Object.fromEntries(overrides.map((x) => [String(x.product_id), x]));
        PRODUCTS = PRODUCTS
          .filter((p) => !map[String(p.id)]?.hidden)
          .map((p) => ({ ...p, sizes: map[String(p.id)]?.sizes ?? p.sizes }));
      }

      const { data: custom, error: customError } = await sb
        .from('custom_products')
        .select('*')
        .eq('hidden', false);

      if (!customError && custom) {
        PRODUCTS.push(...custom.map((x) => ({
          id: `custom-${x.id}`,
          name: x.name,
          type: x.type,
          image: x.image_url,
          sizes: x.sizes || [],
          custom: true
        })));
      }
    } catch (e) {
      console.warn('Catálogo Supabase indisponível:', e);
    }
  }

  render();
  counts();
}

function save() {
  localStorage.setItem('mr_fav', JSON.stringify(fav));
  localStorage.setItem('mr_cart', JSON.stringify(cart));
  counts();
}

function counts() {
  const n = cart.reduce((a, b) => a + b.qty, 0);
  $('#cartN').textContent = n;
  $('#cartNm').textContent = n;
}

function filtered() {
  const q = query.toLowerCase();
  const a = PRODUCTS.filter((p) =>
    (type === 'Todos' || p.type === type) &&
    (!q || p.name.toLowerCase().includes(q))
  );
  if (sort === 'az') a.sort((x, y) => x.name.localeCompare(y.name, 'pt-BR'));
  return a;
}

function render() {
  const a = filtered();
  $('#count').textContent = `${a.length} camisas`;
  $('#grid').innerHTML = a.slice(0, limit).map((p) => `
    <article class="card">
      <button class="heart ${fav.includes(p.id) ? 'on' : ''}" data-fav="${esc(p.id)}" aria-label="Favoritar">${fav.includes(p.id) ? '♥' : '♡'}</button>
      <div class="photo"><img loading="lazy" src="${esc(p.image)}" alt="${esc(p.name)}"></div>
      <span class="tag">${esc(p.type)}</span>
      <h3>${esc(p.name)}</h3>
      <button class="view" data-view="${esc(p.id)}">Ver camisa</button>
    </article>`).join('') || '<div class="empty">Nenhuma camisa encontrada.</div>';
  $('#more').style.display = a.length > limit ? 'block' : 'none';
  bindCards();
}

function bindCards() {
  $$('[data-fav]').forEach((b) => b.onclick = () => {
    const id = b.dataset.fav;
    fav = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id];
    save(); render();
  });
  $$('[data-view]').forEach((b) => b.onclick = () => openProduct(b.dataset.view));
}

$$('.filters button').forEach((b) => b.onclick = () => {
  $$('.filters button').forEach((x) => x.classList.remove('active'));
  b.classList.add('active'); type = b.dataset.type; limit = 24; render();
});
$('#sort').onchange = (e) => { sort = e.target.value; render(); };
$('#more').onclick = () => { limit += 24; render(); };

function doSearch(v) {
  query = v.trim(); limit = 24;
  $('#q').value = query; $('#qTop').value = query;
  render();
  document.querySelector('main').scrollIntoView({ behavior: 'smooth' });
}
$('#topSearch').onsubmit = (e) => { e.preventDefault(); doSearch($('#qTop').value); };
$('#searchForm').onsubmit = (e) => { e.preventDefault(); doSearch($('#q').value); };

function openProduct(id) {
  const p = PRODUCTS.find((x) => String(x.id) === String(id));
  if (!p) return;
  let selected = p.sizes?.[0] || '', q = 1;
  const draw = () => {
    $('#modalContent').innerHTML = `<div class="productdetail">
      <div class="big"><img src="${esc(p.image)}" alt="${esc(p.name)}"></div>
      <div><span class="tag">${esc(p.type)}</span><h2>${esc(p.name)}</h2>
      <p>Escolha o tamanho</p>
      <div class="sizes">${['P','M','G','GG'].map((s) => `<button data-size="${s}" ${p.sizes.includes(s) ? '' : 'disabled'} class="${selected === s ? 'sel' : ''}">${s}</button>`).join('')}</div>
      <p>Quantidade</p><div class="qty"><button id="minus">−</button><b>${q}</b><button id="plus">+</button></div>
      <button class="add" ${!selected ? 'disabled' : ''}>Adicionar à sacola</button></div></div>`;
    $$('[data-size]').forEach((b) => b.onclick = () => { selected = b.dataset.size; draw(); });
    $('#minus').onclick = () => { q = Math.max(1, q - 1); draw(); };
    $('#plus').onclick = () => { q++; draw(); };
    $('.add').onclick = () => {
      const x = cart.find((x) => String(x.id) === String(id) && x.size === selected);
      x ? x.qty += q : cart.push({ id, size: selected, qty: q });
      save(); closeModal(); openCart();
    };
  };
  draw(); $('#modal').classList.add('on');
}

function closeModal() { $('#modal').classList.remove('on'); }
$('.mclose').onclick = closeModal;
$('#modal').onclick = (e) => { if (e.target === $('#modal')) closeModal(); };
function drawer(html) { $('#drawerContent').innerHTML = html; $('#overlay').classList.add('on'); $('#drawer').classList.add('on'); }
function closeDrawer() { $('#overlay').classList.remove('on'); $('#drawer').classList.remove('on'); }
$('.close').onclick = closeDrawer; $('#overlay').onclick = closeDrawer;

async function currentUser() {
  if (!sb) return null;
  try { const { data } = await sb.auth.getUser(); return data.user || null; }
  catch { return null; }
}

function authErrorMessage(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já possui cadastro. Use Entrar.';
  if (m.includes('invalid login credentials')) return 'E-mail ou senha inválidos.';
  if (m.includes('password')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde um pouco e tente novamente.';
  if (m.includes('email')) return 'Confira se o e-mail foi digitado corretamente.';
  return error?.message || 'Não foi possível concluir. Tente novamente.';
}

async function openAccount() {
  if (!sb) {
    drawer('<h2>Minha conta</h2><div class="notice">A conexão de cadastro está temporariamente indisponível.</div>');
    return;
  }

  const u = await currentUser();
  if (u) {
    const adminLink = u.email?.toLowerCase() === (cfg.adminEmail || '').toLowerCase()
      ? '<a class="actionBtn adminShortcut" href="gestao-mr-7x29q.html">Abrir administração</a>' : '';
    drawer(`<h2>Minha conta</h2><p class="accountHello">Conectado como <b>${esc(u.email)}</b></p>${adminLink}<button id="signout" class="actionBtn secondary">Sair da conta</button>`);
    $('#signout').onclick = async () => { await sb.auth.signOut(); closeDrawer(); };
    return;
  }

  drawer(`<h2>Entrar ou criar conta</h2>
    <p class="accountIntro">Crie sua conta para identificar seus pedidos e acessar a Manto Resenha com seu e-mail.</p>
    <label class="fieldLabel">E-mail</label>
    <input id="authEmail" class="checkoutInput" type="email" autocomplete="email" placeholder="seu@email.com">
    <label class="fieldLabel">Senha</label>
    <input id="authPass" class="checkoutInput" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres">
    <div class="authBtns"><button id="loginBtn" class="actionBtn">Entrar</button><button id="signupBtn" class="actionBtn secondary">Criar conta</button></div>
    <p id="authMsg" class="formMsg"></p>`);

  $('#loginBtn').onclick = async () => {
    const email = $('#authEmail').value.trim();
    const password = $('#authPass').value;
    const msg = $('#authMsg');
    if (!email || !password) { msg.textContent = 'Preencha e-mail e senha.'; return; }
    msg.textContent = 'Entrando...';
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { msg.textContent = authErrorMessage(error); return; }
    msg.textContent = 'Login realizado.';
    setTimeout(openAccount, 250);
  };

  $('#signupBtn').onclick = async () => {
    const email = $('#authEmail').value.trim();
    const password = $('#authPass').value;
    const msg = $('#authMsg');
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = 'Informe um e-mail válido.'; return; }
    if (password.length < 6) { msg.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
    msg.textContent = 'Criando sua conta...';
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) { msg.textContent = authErrorMessage(error); return; }
    if (data.session) {
      msg.textContent = 'Conta criada e login realizado.';
      setTimeout(openAccount, 350);
    } else {
      msg.innerHTML = 'Conta criada. <b>Confira seu e-mail para confirmar o cadastro</b> e depois entre com sua senha.';
    }
  };
}

function cepOnly(v) { return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2'); }

function openCart() {
  const rows = cart.map((c, i) => {
    const p = PRODUCTS.find((x) => String(x.id) === String(c.id));
    if (!p) return '';
    return `<div class="bagitem"><img src="${esc(p.image)}" alt=""><div><h4>${esc(p.name)}</h4><p>Tamanho ${esc(c.size)} · ${c.qty} un.</p></div><button class="remove" data-rm="${i}">×</button></div>`;
  }).join('');

  drawer(`<h2>Sua sacola</h2>${rows || '<div class="empty">Sua sacola está vazia.</div>'}${rows ? `<div class="checkoutBox"><h3>Dados para entrega</h3><p>Realizamos entregas em todo o estado de São Paulo. O frete é calculado de acordo com o CEP informado.</p><label class="fieldLabel">CEP</label><input id="checkoutCep" class="checkoutInput" inputmode="numeric" maxlength="9" placeholder="00000-000"><label class="fieldLabel">Endereço</label><input id="checkoutAddress" class="checkoutInput" placeholder="Rua, número, complemento e bairro"><p id="checkoutMsg" class="formMsg"></p><button id="finishWhats" class="whats">Tenho interesse · WhatsApp</button></div>` : ''}`);

  $$('[data-rm]').forEach((b) => b.onclick = () => { cart.splice(+b.dataset.rm, 1); save(); openCart(); });
  if (!rows) return;
  $('#checkoutCep').oninput = (e) => e.target.value = cepOnly(e.target.value);
  $('#finishWhats').onclick = async () => {
    const cep = $('#checkoutCep').value.trim();
    const address = $('#checkoutAddress').value.trim();
    if (cep.replace(/\D/g, '').length !== 8 || address.length < 5) {
      $('#checkoutMsg').textContent = 'Preencha o CEP e o endereço para continuar.'; return;
    }
    const user = await currentUser();
    const items = cart.map((c) => {
      const p = PRODUCTS.find((x) => String(x.id) === String(c.id));
      return p ? `• ${p.name} — Tamanho ${c.size} — ${c.qty} un.` : '';
    }).filter(Boolean);
    const msg = `Olá! Tenho interesse nestas camisas da Manto Resenha:\n\n${items.join('\n')}\n\n📍 Entrega:\nCEP: ${cep}\nEndereço: ${address}${user ? `\n\nCadastro: ${user.email}` : ''}`;
    if (sb) {
      try { await sb.from('order_interests').insert({ user_id: user?.id || null, email: user?.email || null, cep, address, items: cart }); }
      catch (e) { console.warn('Não foi possível registrar o interesse:', e); }
    }
    window.open(`https://wa.me/5511996122259?text=${encodeURIComponent(msg)}`, '_blank');
  };
}

function openFav() {
  const ps = PRODUCTS.filter((p) => fav.includes(p.id));
  drawer(`<h2>Favoritos</h2>${ps.map((p) => `<div class="bagitem"><img src="${esc(p.image)}" alt=""><div><h4>${esc(p.name)}</h4><p>${esc(p.type)}</p></div><button class="view" data-view="${esc(p.id)}">Ver</button></div>`).join('') || '<div class="empty">Você ainda não favoritou nenhuma camisa.</div>'}`);
  $$('[data-view]').forEach((b) => b.onclick = () => { closeDrawer(); openProduct(b.dataset.view); });
}

$('#cartTop').onclick = openCart;
$('#favTop').onclick = openFav;
$('#accountTop').onclick = openAccount;
$$('.mobileNav button').forEach((b) => b.onclick = () => {
  const g = b.dataset.go;
  if (g === 'home') scrollTo({ top: 0, behavior: 'smooth' });
  if (g === 'search') { $('#qTop').focus(); scrollTo({ top: 0, behavior: 'smooth' }); }
  if (g === 'fav') openFav();
  if (g === 'account') openAccount();
  if (g === 'cart') openCart();
});

load();
