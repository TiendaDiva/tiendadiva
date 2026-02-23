// --- CONFIGURACIÓN FIREBASE (COMPLETAR AQUÍ) ---
const firebaseConfig = {
    apiKey: "AIzaSyCoFktFXJSr73W58NMbAG-oIqgODhx25Jw",
    authDomain: "diva-e8e3f.firebaseapp.com",
    projectId: "diva-e8e3f",
    storageBucket: "diva-e8e3f.firebasestorage.app",
    messagingSenderId: "467138288300",
    appId: "1:467138288300:web:e9108f47987364a75ddd09",
    measurementId: "G-00MVBM27C2"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// --- CONSTANTES Y VARIABLES ---
const ADMIN_EMAIL = "pepito@gmail.com"; 
const INSTAGRAM_USER = "diva_rosario1167"; // <--- CAMBIAR POR TU USUARIO REAL (SIN ARROBA)

let currentAudience = 'todos';
let currentCategory = 'todos';
let allProducts = [];
let cart = [];
let cartUnsubscribe = null;
let selectedSize = null; 
let deliveryOption = 'retiro'; // 'retiro' o 'envio'

// --- LÓGICA DEL CARRUSEL DE BANNERS ---
let heroImages = [
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?ixlib=rb-4.0.3&auto=format&fit=crop&w=1470&q=80'
];
let currentSlide = 0;
let slideInterval;

function startHeroCarousel() {
    const container = document.getElementById('hero-slides');
    if(!container) return;
    container.innerHTML = "";
    
    heroImages.forEach((url, index) => {
        const img = document.createElement('img');
        img.src = url;
        img.classList.add('hero-slide');
        if(index === 0) img.classList.add('active');
        container.appendChild(img);
    });

    if(slideInterval) clearInterval(slideInterval);
    currentSlide = 0;
    
    if(heroImages.length > 1) {
        slideInterval = setInterval(() => {
            const slides = document.querySelectorAll('.hero-slide');
            if(slides.length === 0) return;
            slides[currentSlide].classList.remove('active');
            currentSlide = (currentSlide + 1) % slides.length;
            slides[currentSlide].classList.add('active');
        }, 5000); 
    }
}

db.collection('settings').doc('hero').onSnapshot(doc => {
    if(doc.exists && doc.data().images && doc.data().images.length > 0) {
        heroImages = doc.data().images;
    }
    const bannerInput = document.getElementById('banner-urls');
    if(bannerInput) bannerInput.value = heroImages.join(', ');
    startHeroCarousel();
});

function saveBannerConfig() {
    const raw = document.getElementById('banner-urls').value;
    if(!raw) return alert("Ingresa al menos una URL");
    const urls = raw.split(',').map(u => u.trim()).filter(u => u.length > 0);
    db.collection('settings').doc('hero').set({ images: urls })
        .then(() => alert("Banner actualizado!"))
        .catch(e => alert("Error: " + e.message));
}

// --- DATA FISCAL ---
db.collection('settings').doc('data_fiscal').onSnapshot(doc => {
    if(doc.exists && doc.data().code) {
        // En lugar de una imagen, buscamos el contenedor div
        const containerFooter = document.getElementById('footer-afip-container');
        if(containerFooter) containerFooter.innerHTML = doc.data().code;
        
        // Rellenamos el textarea del administrador
        const inputAdmin = document.getElementById('data-fiscal-code');
        if(inputAdmin) inputAdmin.value = doc.data().code;
    }
});

function saveDataFiscalConfig() {
    // Tomamos el código HTML completo
    const code = document.getElementById('data-fiscal-code').value.trim();
    if(!code) return alert("Ingresa el código HTML de AFIP");
    
    // Lo guardamos en Firestore como 'code'
    db.collection('settings').doc('data_fiscal').set({ code: code })
        .then(() => alert("¡Código Data Fiscal actualizado!"))
        .catch(e => alert("Error: " + e.message));
}

// --- AUTH ---
auth.onAuthStateChanged(user => {
    const btnLogin = document.getElementById('btn-login-trigger');
    const userDisplay = document.getElementById('user-display');
    const adminPanel = document.getElementById('admin-panel');

    if (user) {
        btnLogin.style.display = 'none';
        userDisplay.style.display = 'flex';
        document.getElementById('user-email-text').innerText = "Hola, " + user.email.split('@')[0];
        adminPanel.style.display = (user.email === ADMIN_EMAIL) ? 'block' : 'none';
        cartUnsubscribe = db.collection('carts').doc(user.uid)
            .onSnapshot((doc) => {
                cart = doc.exists ? (doc.data().items || []) : [];
                renderCartUI();
            });
    } else {
        btnLogin.style.display = 'block';
        userDisplay.style.display = 'none';
        adminPanel.style.display = 'none';
        if (cartUnsubscribe) cartUnsubscribe();
        cart = [];
        renderCartUI();
    }
    if(document.getElementById('view-collection').classList.contains('active')) renderProducts();
});

function openAuth() { toggleAuthView('login'); document.getElementById('auth-modal').style.display = 'flex'; }
function toggleAuthView(view) {
    document.getElementById('view-login-form').classList.remove('active');
    document.getElementById('view-register-form').classList.remove('active');
    document.getElementById('view-forgot-pass').classList.remove('active');
    if(view === 'login') document.getElementById('view-login-form').classList.add('active');
    else if(view === 'register') document.getElementById('view-register-form').classList.add('active');
    else if(view === 'forgot') document.getElementById('view-forgot-pass').classList.add('active');
}
function togglePass(id) {
    const input = document.getElementById(id);
    if (input.type === "password") input.type = "text"; else input.type = "password";
}

// --- REGISTRO Y LOGIN ---
function registerUser() { 
    const dni = document.getElementById('reg-dni').value.trim();
    const nombre = document.getElementById('reg-nombre').value.trim();
    const apellido = document.getElementById('reg-apellido').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const celular = document.getElementById('reg-celular').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const passConf = document.getElementById('reg-pass-conf').value;

    const regexDNI = /^\d{8}$/;
    if (!regexDNI.test(dni)) return alert("⚠️ Error en DNI: Debe contener exactamente 8 números.");
    const regexNombres = /^[a-zA-ZÀ-ÿ\s]+$/;
    if (!regexNombres.test(nombre)) return alert("⚠️ Error en Nombre: Solo letras.");
    if (!regexNombres.test(apellido)) return alert("⚠️ Error en Apellido: Solo letras.");
    const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regexEmail.test(email)) return alert("⚠️ Error: Email inválido.");
    const regexCel = /^\d{10}$/;
    if (!regexCel.test(celular)) return alert("⚠️ Error en Celular: Deben ser 10 números (Cód. Área + Nro).");

    if (!pass || !passConf) return alert("Faltan contraseñas.");
    if (pass !== passConf) return alert("Las contraseñas no coinciden.");
    if (pass.length < 6) return alert("La contraseña debe tener 6+ caracteres.");
    
    auth.createUserWithEmailAndPassword(email, pass).then((userCredential) => {
        const user = userCredential.user;
        return db.collection('users').doc(user.uid).set({dni, nombre, apellido, email, celular, fechaRegistro: new Date()});
    }).then(() => {
        alert("¡Cuenta creada con éxito! Bienvenido " + nombre);
        closeModal('auth-modal');
        document.getElementById('reg-dni').value = ''; document.getElementById('reg-nombre').value = ''; 
        document.getElementById('reg-apellido').value = ''; document.getElementById('reg-email').value = ''; 
        document.getElementById('reg-celular').value = ''; document.getElementById('reg-pass').value = ''; 
        document.getElementById('reg-pass-conf').value = '';
    }).catch((error) => { console.error(error); alert("Error: " + error.message); });
}

function loginUser(){
    const e = document.getElementById('login-email').value, p = document.getElementById('login-pass').value;
    if(!e || !p) return alert("Ingresa email y contraseña");
    auth.signInWithEmailAndPassword(e, p).then(() => closeModal('auth-modal')).catch((error) => alert("Error de credenciales."));
}

function validateAndRecover() {
    const email = document.getElementById('rec-email').value.trim();
    const dni = document.getElementById('rec-dni').value.trim();
    const celular = document.getElementById('rec-celular').value.trim();
    if(!email || !dni || !celular) return alert("Completá todos los campos.");

    db.collection('users').where('email', '==', email).get()
        .then(querySnapshot => {
            if (querySnapshot.empty) return alert("❌ Email no registrado.");
            let usuarioEncontrado = false;
            querySnapshot.forEach(doc => {
                const data = doc.data();
                if(data.dni === dni && data.celular === celular) usuarioEncontrado = true;
            });
            if (usuarioEncontrado) {
                auth.sendPasswordResetEmail(email)
                    .then(() => { alert("✅ Datos Validados. Revisa tu correo."); toggleAuthView('login'); })
                    .catch((e) => alert("Error: " + e.message));
            } else { alert("❌ Los datos no coinciden."); }
        })
        .catch(error => alert("Error de conexión."));
}

function logoutUser(){ auth.signOut(); }

// --- LÓGICA DE TALLES DINÁMICOS ---
const tallesAdultos = ['Único', 'XS', 'S', 'M', 'L', 'XL', 'XXL'];
const tallesInfantiles = ['6', '8', '10', '12', '14', '16'];

function actualizarTalles(selectId, containerId, checkboxName, tallesSeleccionados = []) {
    const publico = document.getElementById(selectId).value;
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const talles = (publico === 'infantiles') ? tallesInfantiles : tallesAdultos;
    container.innerHTML = ""; // Limpiamos los anteriores
    
    talles.forEach(t => {
        const checked = tallesSeleccionados.includes(t) ? "checked" : "";
        container.innerHTML += `<div class="talle-checkbox"><label><input type="checkbox" name="${checkboxName}" value="${t}" ${checked}> ${t}</label></div>`;
    });
}

// Para que al cargar la página ya se vean los talles de "Adultos" en "Agregar Producto"
// Inicializar la vista de administrador y categorías al cargar la web
setTimeout(() => { 
    if(document.getElementById('nuevo-publico')) {
        actualizarTalles('nuevo-publico', 'talles-nuevo-container', 'nuevo-talle');
        actualizarCategoriasSelect('nuevo-publico', 'nueva-categoria');
    }
    renderCategoryNav();
}, 500);

// --- LÓGICA DE CATEGORÍAS DINÁMICAS ---
const categoriasBasicas = ['remeras', 'pantalones', 'vestidos'];
const categoriasAdultosSolo = ['camisas']; // Exclusivo de adultos (va después de vestidos)
const categoriasComunesResto = ['conjuntos', 'polleras', 'camperas', 'accesorios'];
const categoriasInfantilesSolo = ['mallas', 'disfraces'];

// Función centralizada para saber qué categorías mostrar
function getCategoriasSegunPublico(publico) {
    let cats = [...categoriasBasicas];
    
    // Si es Adultos o Todos, sumamos Camisas
    if (publico === 'adultos' || publico === 'todos') {
        cats = cats.concat(categoriasAdultosSolo);
    }
    
    // Sumamos las que comparten ambos
    cats = cats.concat(categoriasComunesResto);
    
    // Si es Infantiles o Todos, sumamos las de niños
    if (publico === 'infantiles' || publico === 'todos') {
        cats = cats.concat(categoriasInfantilesSolo);
    }
    
    return cats;
}

function renderCategoryNav() {
    const nav = document.getElementById('dynamic-category-nav');
    if(!nav) return;
    
    let cats = getCategoriasSegunPublico(currentAudience);

    let html = `<button class="cat-btn ${currentCategory === 'todos' ? 'active' : ''}" onclick="filterCategory('todos', this)">Todo</button>`;
    cats.forEach(cat => {
        const isActive = (currentCategory === cat) ? 'active' : '';
        const nombreCat = cat.charAt(0).toUpperCase() + cat.slice(1);
        html += `<button class="cat-btn ${isActive}" onclick="filterCategory('${cat}', this)">${nombreCat}</button>`;
    });
    nav.innerHTML = html;
}

function actualizarCategoriasSelect(selectPublicoId, selectCategoriaId, categoriaElegida = '') {
    const publico = document.getElementById(selectPublicoId).value;
    const selectCat = document.getElementById(selectCategoriaId);
    if (!selectCat) return;

    let opciones = getCategoriasSegunPublico(publico);

    selectCat.innerHTML = '';
    opciones.forEach(cat => {
        const selected = (cat === categoriaElegida) ? 'selected' : '';
        const nombreCat = cat.charAt(0).toUpperCase() + cat.slice(1);
        selectCat.innerHTML += `<option value="${cat}" ${selected}>${nombreCat}</option>`;
    });
}

// --- PRODUCTOS CRUD ---
function agregarProducto() {
    if(!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) return alert("Solo admin.");
    const n = document.getElementById('nuevo-nombre').value, p = parseFloat(document.getElementById('nuevo-precio').value), desc = document.getElementById('nuevo-desc').value;
    const talles = Array.from(document.querySelectorAll('input[name="nuevo-talle"]:checked')).map(cb => cb.value);
    const f1 = document.getElementById('foto1').value, f2 = document.getElementById('foto2').value, f3 = document.getElementById('foto3').value;
    let fotos = [f1]; if(f2) fotos.push(f2); if(f3) fotos.push(f3);
    const c = document.getElementById('nueva-categoria').value, pub = document.getElementById('nuevo-publico').value;
    if(!n || !p || !f1) return alert("Faltan datos");
    db.collection("productos").add({nombre: n, precio: p, descripcion: desc, talles: talles, foto: f1, fotos: fotos, categoria: c, publico: pub, fecha: new Date()}).then(() => alert("Publicado!")).catch(e => alert(e.message));
}

function abrirEditor(event, id) {
    event.stopPropagation();
    const p = allProducts.find(item => item.id === id); if (!p) return;
    document.getElementById('edit-id').value = p.id; 
    document.getElementById('edit-nombre').value = p.nombre; 
    document.getElementById('edit-precio').value = p.precio; 
    document.getElementById('edit-desc').value = p.descripcion || ''; 
    document.getElementById('edit-publico').value = p.publico; 
    
    // Inyectamos talles y categorías correspondientes antes de abrir
    actualizarTalles('edit-publico', 'talles-edit-container', 'edit-talle', p.talles || []);
    actualizarCategoriasSelect('edit-publico', 'edit-categoria', p.categoria);
    
    document.getElementById('edit-foto1').value = p.images[0] || ''; 
    document.getElementById('edit-foto2').value = p.images[1] || ''; 
    document.getElementById('edit-foto3').value = p.images[2] || '';

    document.getElementById('edit-modal').style.display = 'flex';
}

function guardarEdicion() {
    if(!auth.currentUser || auth.currentUser.email !== ADMIN_EMAIL) return alert("Sin permisos");
    const id = document.getElementById('edit-id').value, n = document.getElementById('edit-nombre').value, p = parseFloat(document.getElementById('edit-precio').value), desc = document.getElementById('edit-desc').value;
    const talles = Array.from(document.querySelectorAll('input[name="edit-talle"]:checked')).map(cb => cb.value);
    const f1 = document.getElementById('edit-foto1').value, f2 = document.getElementById('edit-foto2').value, f3 = document.getElementById('edit-foto3').value;
    let fotos = []; if(f1) fotos.push(f1); if(f2) fotos.push(f2); if(f3) fotos.push(f3);
    db.collection("productos").doc(id).update({nombre: n, precio: p, descripcion: desc, talles: talles, fotos: fotos, foto: fotos[0], publico: document.getElementById('edit-publico').value, categoria: document.getElementById('edit-categoria').value}).then(() => { alert("Actualizado"); closeModal('edit-modal'); });
}

function borrarProd(event, id) { event.stopPropagation(); if(confirm("¿Eliminar?")) db.collection("productos").doc(id).delete(); }

// --- CARRITO ---
function openProductModal(id) {
    const p = allProducts.find(x => x.id === id); if(!p) return;
    selectedSize = null;
    document.getElementById('modal-img-main').src = p.images[0];
    const gallery = document.getElementById('modal-gallery'); gallery.innerHTML = "";
    if (p.images.length > 1) p.images.forEach(url => gallery.innerHTML += `<img src="${url}" class="thumb" onclick="document.getElementById('modal-img-main').src='${url}'">`);
    document.getElementById('modal-title').innerText = p.nombre; document.getElementById('modal-price').innerText = "$ " + p.precio.toLocaleString('es-AR'); document.getElementById('modal-category').innerText = p.categoria; document.getElementById('modal-desc').innerText = p.descripcion || "Sin descripción.";
    const tallesContainer = document.getElementById('modal-talles'); tallesContainer.innerHTML = "";
    if(p.talles && p.talles.length > 0) p.talles.forEach(t => tallesContainer.innerHTML += `<button class="size-btn" onclick="selectSize(this, '${t}')">${t}</button>`);
    else { tallesContainer.innerHTML = "<span style='color:#999; font-size:0.9rem;'>Talle único</span>"; selectedSize = "Único"; }
    document.getElementById('modal-add-btn').onclick = function() { addToCart(p.id, p.nombre, p.precio, p.images[0], p.talles); };
    document.getElementById('product-modal').style.display = 'flex';
}
function selectSize(btn, talle) { document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('selected')); btn.classList.add('selected'); selectedSize = talle; }
function addToCart(id, n, p, f, tallesDisponibles) {
    if (!auth.currentUser) { alert("🔒 Ingresa para comprar"); openAuth(); return; }
    if (tallesDisponibles && tallesDisponibles.length > 0 && !selectedSize) return alert("⚠️ Selecciona un TALLE.");
    let talleFinal = selectedSize || "Único";
    let item = cart.find(i => i.id === id && i.size === talleFinal);
    if(item) item.qty++; else cart.push({id, n, p, f, qty: 1, size: talleFinal});
    saveCartToFirestore(cart);
    if(!document.getElementById('cart-sidebar').classList.contains('open')) toggleCart();
    closeModal('product-modal');
}
function saveCartToFirestore(newCart) { const user = auth.currentUser; if (user) db.collection('carts').doc(user.uid).set({ items: newCart }); }
function changeQty(id, size, delta) {
    let item = cart.find(i => i.id === id && i.size === size); if(!item) return;
    item.qty += delta; if(item.qty <= 0) cart = cart.filter(x => !(x.id === id && x.size === size));
    saveCartToFirestore(cart);
}
function removeFromCart(id, size){ cart = cart.filter(x => !(x.id === id && x.size === size)); saveCartToFirestore(cart); }
function renderCartUI() {
    let total = 0, count = 0; const list = document.getElementById('cart-items-list'); list.innerHTML = "";
    cart.forEach(i => {
        total += i.p * i.qty; count += i.qty;
        list.innerHTML += `<div class="cart-item"><img src="${i.f}"><div style="flex:1;"><div style="font-weight:bold; font-size:0.9rem;">${i.n}</div><div style="font-size:0.8rem; color:#666;">Talle: ${i.size}</div><div style="color:var(--accent); font-weight:bold;">$ ${(i.p * i.qty).toLocaleString('es-AR')}</div><div class="qty-controls"><button class="qty-btn" onclick="changeQty('${i.id}', '${i.size}', -1)">-</button><span style="font-weight:bold; min-width:20px; text-align:center; font-size:0.9rem;">${i.qty}</span><button class="qty-btn" onclick="changeQty('${i.id}', '${i.size}', 1)">+</button></div></div><button class="btn-remove-item" onclick="removeFromCart('${i.id}', '${i.size}')" style="border:none; background:white; font-size:1.2rem; cursor:pointer;">✕</button></div>`;
    });
    document.getElementById('cart-total').innerText = "$ " + total.toLocaleString('es-AR'); document.getElementById('cart-count').innerText = count;
}

// --- LOGICA ENVIO E INSTAGRAM ---
function setDeliveryOption(option) {
    deliveryOption = option;
    document.getElementById('opt-retiro').classList.remove('selected');
    document.getElementById('opt-envio').classList.remove('selected');
    document.getElementById('opt-' + option).classList.add('selected');
    const msgEnvio = document.getElementById('shipping-notice');
    msgEnvio.style.display = (option === 'envio') ? 'block' : 'none';
}

function finalizarCompraInstagram() {
    if(cart.length === 0) return alert("El carrito está vacío.");

    let total = 0;
    cart.forEach(i => total += i.p * i.qty);

    let msg = `Hola! Quiero realizar el siguiente pedido:\n\n`;
    cart.forEach(i=> {
        msg += `• (${i.qty}) ${i.n} [Talle: ${i.size}] - $${(i.p * i.qty).toLocaleString('es-AR')}\n`;
    });
    msg += `\n----------------\n`;
    msg += `Subtotal Productos: $${total.toLocaleString('es-AR')}\n`;
    msg += (deliveryOption === 'envio') ? `Modo de Entrega: ENVÍO A DOMICILIO 🚚\n(El costo del envío lo coordinamos por aquí)` : `Modo de Entrega: RETIRO EN LOCAL 🛍️\n`;

    // COPIAR Y ABRIR
    navigator.clipboard.writeText(msg).then(() => {
        // Alerta con instrucciones precisas para el usuario
        alert("✅ ¡PEDIDO COPIADO!\n\nSe abrirá el chat de Instagram.\n\n👉 Solo tenés que mantener presionado, PEGAR el pedido copiado y enviarlo!");
        
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        let url = "";

        if (isMobile) {
            // Intenta abrir la app directamente en el chat
            url = `instagram://direct_message?username=${INSTAGRAM_USER}`;
        } else {
            // Versión web
            url = `https://ig.me/m/${INSTAGRAM_USER}`;
        }
        window.open(url, '_blank');
    }).catch(err => {
        alert("No se pudo copiar el pedido automáticamente. Por favor hacé captura.");
        console.error('Error al copiar: ', err);
    });
}

// --- RENDERIZADO ---
db.collection("productos").onSnapshot((querySnapshot) => {
    allProducts = [];
    querySnapshot.forEach((doc) => {
        let d = doc.data(); d.id = doc.id;
        if(!d.publico) d.publico = 'adultos'; if(!d.categoria) d.categoria = 'todos'; if(!d.fotos) d.fotos = [d.foto || 'https://via.placeholder.com/300'];
        d.images = Array.isArray(d.fotos) ? d.fotos : [d.foto];
        allProducts.push(d);
    });
    if(document.getElementById('view-collection').classList.contains('active')) renderProducts();
});
function renderProducts() {
    const list = document.getElementById('product-list'); list.innerHTML = "";
    let filtered = allProducts;
    if(currentAudience !== 'todos') filtered = filtered.filter(p => p.publico === currentAudience);
    if(currentCategory !== 'todos') filtered = filtered.filter(p => p.categoria === currentCategory);
    const isAdmin = auth.currentUser && auth.currentUser.email === ADMIN_EMAIL;
    if(filtered.length===0) { list.innerHTML="<p>No hay productos.</p>"; return; }
    filtered.forEach(p => {
        let adminBtns = isAdmin ? `<div class="admin-actions"><button class="btn-round-action btn-edit" onclick="abrirEditor(event, '${p.id}')">✏️</button><button class="btn-round-action btn-delete" onclick="borrarProd(event, '${p.id}')">🗑️</button></div>` : '';
        list.innerHTML += `<div class="product-card">${adminBtns}<div class="card-img-container" onclick="openProductModal('${p.id}')"><img src="${p.images[0]}" class="product-image"><div class="zoom-hint">Ver Detalle</div></div><div class="product-info"><div><small style="color:#888;">${p.categoria.toUpperCase()}</small><h3 class="product-title">${p.nombre}</h3><div class="product-price">$${p.precio.toLocaleString('es-AR')}</div></div><button class="btn" style="align-self:flex-start; margin-top:10px; padding: 5px 15px; font-size:0.8rem;" onclick="openProductModal('${p.id}')">+ Agregar</button></div></div>`;
    });
}

function switchView(v, aud = null) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('nav a').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + v).classList.add('active'); document.getElementById('nav-' + v).classList.add('active');
    if(v === 'collection') { if (aud) switchAudience(aud); else renderProducts(); }
    window.scrollTo(0,0);
}
function switchAudience(aud) {
    currentAudience = aud; 
    document.querySelectorAll('.aud-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('btn-' + aud).classList.add('active');
    document.getElementById('collection-title').innerText = aud === 'todos' ? 'Colección Completa' : "Colección " + aud.charAt(0).toUpperCase() + aud.slice(1);
    
    // Reseteamos a 'todos' si la categoría actual no existe en el nuevo público seleccionado
    if (aud === 'adultos' && categoriasInfantilesSolo.includes(currentCategory)) {
        currentCategory = 'todos';
    } else if (aud === 'infantiles' && categoriasAdultosSolo.includes(currentCategory)) {
        currentCategory = 'todos';
    }
    
    renderCategoryNav(); // Recarga los botones de categoría
    renderProducts();
}
function filterCategory(cat, btn) {
    currentCategory = cat; document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    if(btn) btn.classList.add('active'); renderProducts();
}
function toggleCart(){ 
    const sidebar = document.getElementById('cart-sidebar');
    if (!sidebar.classList.contains('open') && !auth.currentUser) { openAuth(); return; }
    sidebar.classList.toggle('open'); 
}
function closeModal(id) { document.getElementById(id).style.display = 'none'; }
window.onclick = function(e) { if(e.target.classList.contains('modal-overlay')) e.target.style.display='none'; }