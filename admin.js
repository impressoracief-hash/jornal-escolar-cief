import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Estado ───────────────────────────────────────────────────────────────
let noticias      = [];       // array local espelhando o Firestore
let editandoId    = null;     // ID do documento sendo editado (ou null)
let editandoImgURL = null;    // URL da imagem atual ao editar
let filtroAtual   = "todas";

// ─── Autenticação ─────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  const emailEl = document.getElementById("usuario-email");
  if (emailEl) emailEl.textContent = user.email;
  iniciar();
});

async function sair() {
  await signOut(auth);
  window.location.href = "login.html";
}
window.sair = sair;

// ─── Inicialização ────────────────────────────────────────────────────────
function iniciar() {
  configurarEventos();

  // Escuta em tempo real o Firestore
  const q = query(collection(db, "noticias"), orderBy("data", "desc"));
  onSnapshot(q,
    (snap) => {
      noticias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      atualizarStats();
      filtrar(filtroAtual);
    },
    (err) => {
      console.error("Erro ao conectar ao Firestore:", err);
      let msg = "Erro ao carregar notícias.";
      if (err.code === "permission-denied")
        msg = "❌ Sem permissão de leitura. Configure as Regras do Firestore.";
      else if (err.code === "failed-precondition")
        msg = "❌ Firestore precisa de um índice. Veja o console para o link.";
      mostrarToast(msg, "error");
    }
  );
}

// ─── Evento: seleção de imagem ────────────────────────────────────────────
function configurarEventos() {
  document.getElementById("imagem").addEventListener("change", (e) => {
    const file      = e.target.files[0];
    const controles = document.getElementById("controles-imagem");
    const label     = document.querySelector(".input-file-label");

    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        mostrarToast("Imagem muito grande! Máximo 5 MB", "error");
        e.target.value = "";
        restaurarLabelImagem(controles, label);
        return;
      }
      if (!file.type.startsWith("image/")) {
        mostrarToast("Apenas imagens são permitidas", "error");
        e.target.value = "";
        return;
      }
      const tempURL = URL.createObjectURL(file);
      controles.style.display = "block";
      label.innerHTML = `
        <img src="${tempURL}" alt="Nova imagem"
             style="height:48px;width:72px;object-fit:cover;border-radius:6px;flex-shrink:0;">
        <span>${file.name}</span>`;
    } else {
      restaurarLabelImagem(controles, label);
    }
  });
}

function restaurarLabelImagem(controles, label) {
  if (editandoId && editandoImgURL) {
    controles.style.display = "block";
    label.innerHTML = `
      <img src="${editandoImgURL}" alt="Imagem atual"
           style="height:48px;width:72px;object-fit:cover;border-radius:6px;flex-shrink:0;">
      <span>Imagem atual mantida — selecione outra para substituir</span>`;
  } else {
    controles.style.display = "none";
    label.innerHTML = "🖼️ Clique para selecionar uma imagem…";
  }
}

// ─── Publicar / Atualizar ─────────────────────────────────────────────────
async function publicar() {
  const titulo    = document.getElementById("titulo").value.trim();
  const texto     = document.getElementById("texto").value.trim();
  const categoria = document.getElementById("categoria").value;
  const file      = document.getElementById("imagem").files[0];

  if (!titulo || !texto) {
    mostrarToast("Preencha o título e o conteúdo", "error");
    return;
  }

  const btn = document.getElementById("btn-publicar");
  btn.disabled = true;
  btn.innerHTML = "⏳ Salvando…";

  try {
    const largura = parseInt(document.getElementById("largura").value) || 300;
    const altura  = parseInt(document.getElementById("altura").value)  || 200;
    const posicao = document.getElementById("posicao").value;
    const imgConfig = { largura, altura, posicao };

    let imgURL = editandoId ? (editandoImgURL || "") : "";

    if (file) {
      // Faz upload para o Firebase Storage
      imgURL = await uploadImagem(file);
    }

    const payload = {
      titulo, texto, categoria,
      img: imgURL,
      imgConfig,
      data: editandoId
        ? (noticias.find(n => n.id === editandoId)?.data ?? serverTimestamp())
        : serverTimestamp()
    };

    if (editandoId) {
      await updateDoc(doc(db, "noticias", editandoId), payload);
      mostrarToast("✅ Notícia atualizada!");
    } else {
      // Para nova notícia a data precisa ser serverTimestamp
      payload.data = serverTimestamp();
      await addDoc(collection(db, "noticias"), payload);
      mostrarToast("🚀 Notícia publicada!");
    }

    cancelarEdicao();
  } catch (err) {
    console.error("Erro ao salvar notícia:", err);

    // Mensagens de erro específicas para facilitar diagnóstico
    let msg = "Erro ao salvar. Tente novamente.";
    if (err.code === "permission-denied")
      msg = "❌ Sem permissão. Verifique as regras do Firestore no Console Firebase.";
    else if (err.code === "unavailable")
      msg = "❌ Firestore indisponível. Verifique se o banco foi criado no Console Firebase.";
    else if (err.code === "unauthenticated")
      msg = "❌ Sessão expirada. Faça login novamente.";
    else if (err.message)
      msg = "❌ " + err.message;

    mostrarToast(msg, "error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "🚀 Publicar notícia";
  }
}
window.publicar = publicar;

// ─── Upload de imagem — converte para base64 (sem Storage, sem CORS) ─────
function uploadImagem(file) {
  return new Promise((resolve, reject) => {
    const wrapper = document.getElementById("progresso-wrapper");
    const barra   = document.getElementById("progresso-barra");
    if (wrapper) wrapper.style.display = "block";
    if (barra)   barra.style.width = "50%";

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let w = img.naturalWidth;
        let h = img.naturalHeight;

        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }

        const canvas = document.createElement("canvas");
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);

        if (barra)   barra.style.width = "100%";
        if (wrapper) setTimeout(() => { wrapper.style.display = "none"; barra.style.width = "0%"; }, 400);

        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Editar ───────────────────────────────────────────────────────────────
function editar(id) {
  const n = noticias.find(x => x.id === id);
  if (!n) return;

  document.getElementById("titulo").value    = n.titulo;
  document.getElementById("texto").value     = n.texto;
  document.getElementById("categoria").value = n.categoria;

  const controles = document.getElementById("controles-imagem");
  const label     = document.querySelector(".input-file-label");

  if (n.imgConfig) {
    document.getElementById("largura").value = n.imgConfig.largura;
    document.getElementById("altura").value  = n.imgConfig.altura;
    document.getElementById("posicao").value = n.imgConfig.posicao;
  }

  editandoId     = id;
  editandoImgURL = n.img || null;

  if (n.img) {
    controles.style.display = "block";
    label.innerHTML = `
      <img src="${n.img}" alt="Imagem atual"
           style="height:48px;width:72px;object-fit:cover;border-radius:6px;flex-shrink:0;">
      <span>Imagem atual mantida — selecione outra para substituir</span>`;
  } else {
    controles.style.display = "none";
    label.innerHTML = "🖼️ Clique para selecionar uma imagem…";
  }

  document.getElementById("form-titulo-texto").textContent = "Editar notícia";
  document.getElementById("btn-publicar").innerHTML        = "💾 Atualizar notícia";

  const formBtns = document.querySelector(".form-btns");
  if (formBtns && !formBtns.querySelector(".btn-cancelar")) {
    const btnCancelar = document.createElement("button");
    btnCancelar.className = "btn btn-cancelar";
    btnCancelar.innerHTML = "✕ Cancelar";
    btnCancelar.onclick   = cancelarEdicao;
    formBtns.appendChild(btnCancelar);
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.editar = editar;

function cancelarEdicao() {
  editandoId     = null;
  editandoImgURL = null;
  limparFormulario();
  document.getElementById("form-titulo-texto").textContent = "Nova notícia";
  document.getElementById("btn-publicar").innerHTML        = "🚀 Publicar notícia";
  document.querySelector(".btn-cancelar")?.remove();
}
window.cancelarEdicao = cancelarEdicao;

function limparFormulario() {
  document.getElementById("titulo").value    = "";
  document.getElementById("texto").value     = "";
  document.getElementById("categoria").value = "eventos";
  document.getElementById("imagem").value    = "";
  document.getElementById("largura").value   = "300";
  document.getElementById("altura").value    = "200";
  document.getElementById("posicao").value   = "topo";
  document.getElementById("controles-imagem").style.display = "none";
  const label = document.querySelector(".input-file-label");
  if (label) label.innerHTML = "🖼️ Clique para selecionar uma imagem…";
}

// ─── Excluir ──────────────────────────────────────────────────────────────
function confirmarExclusao(id) {
  if (confirm("Deseja realmente excluir esta notícia?")) excluir(id);
}
window.confirmarExclusao = confirmarExclusao;

async function excluir(id) {
  try {
    await deleteDoc(doc(db, "noticias", id));
    mostrarToast("🗑️ Notícia excluída");
  } catch (err) {
    console.error(err);
    mostrarToast("Erro ao excluir.", "error");
  }
}

// ─── Renderização de cards ────────────────────────────────────────────────
function mostrar(lista) {
  const container = document.getElementById("lista");
  const contagem  = document.getElementById("contagem-noticias");
  if (contagem) contagem.textContent = `${lista.length} notícia${lista.length !== 1 ? "s" : ""}`;

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📰</div>
        <h3>Nenhuma notícia encontrada</h3>
        <p>Crie a primeira notícia usando o formulário ao lado.</p>
      </div>`;
    return;
  }

  let html = "";
  lista.forEach((n) => {
    const cfg = n.imgConfig || { largura: 300, altura: 200, posicao: "topo" };
    const pos = cfg.posicao || "topo";
    const img = montarImagemHTML(n, "card");
    const temCardMedia = !n.img || pos === "topo" || pos === "abaixo";

    html += `
      <div class="card">
        ${temCardMedia ? `
          <div class="card-media">
            ${n.img ? img.antes : "📰"}
          </div>` : ""}
        <div class="txt">
          <div class="categoria ${n.categoria}">${n.categoria}</div>
          ${img.dentro}
          <h3>${escapeHtml(n.titulo)}</h3>
          <p>${escapeHtml(n.texto)}</p>
          ${img.depois}
          <div class="card-actions" style="clear:both;">
            <button class="btn-visualizar-noticia" onclick="visualizarNoticia('${n.id}')">👁️</button>
            <button class="btn-editar"             onclick="editar('${n.id}')">✏️ Editar</button>
            <button class="btn-excluir"            onclick="confirmarExclusao('${n.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
  });
  container.innerHTML = html;
}

// ─── Filtro ───────────────────────────────────────────────────────────────
function filtrar(cat) {
  filtroAtual = cat;

  document.querySelectorAll(".menu nav button").forEach(btn => {
    btn.classList.remove("active");
    const t = btn.textContent.toLowerCase();
    if ((cat === "todas" && t.includes("todas")) ||
        (cat === "eventos"  && t.includes("eventos"))  ||
        (cat === "projetos" && t.includes("projetos")) ||
        (cat === "esportes" && t.includes("esportes"))) {
      btn.classList.add("active");
    }
  });

  const nomes = { todas: "Todas as categorias", eventos: "Eventos", projetos: "Projetos", esportes: "Esportes" };
  const badge = document.getElementById("badge-filtro");
  if (badge) badge.textContent = `📋 ${nomes[cat] || cat}`;

  const filtradas = cat === "todas" ? noticias : noticias.filter(n => n.categoria === cat);
  mostrar(filtradas);
}
window.filtrar = filtrar;

// ─── Estatísticas ─────────────────────────────────────────────────────────
function atualizarStats() {
  document.getElementById("stat-total").textContent    = noticias.length;
  document.getElementById("stat-eventos").textContent  = noticias.filter(n => n.categoria === "eventos").length;
  document.getElementById("stat-esportes").textContent = noticias.filter(n => n.categoria === "esportes").length;
  document.getElementById("stat-projetos").textContent = noticias.filter(n => n.categoria === "projetos").length;
}

// ─── Modal de visualização ────────────────────────────────────────────────
function visualizarNoticia(id) {
  const n   = noticias.find(x => x.id === id);
  if (!n) return;
  const img = montarImagemHTML(n, "modal");

  const modal = document.createElement("div");
  modal.className = "modal-preview";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>👁️ Visualização da notícia</h3>
        <button class="modal-close" onclick="this.closest('.modal-preview').remove()">✕</button>
      </div>
      <div class="modal-body">
        ${img.antes}
        <span class="categoria ${n.categoria}">${n.categoria}</span>
        <h2>${escapeHtml(n.titulo)}</h2>
        ${img.dentro}
        <p>${escapeHtml(n.texto)}</p>
        ${img.depois}
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { modal.remove(); document.removeEventListener("keydown", esc); }
  });
}
window.visualizarNoticia = visualizarNoticia;

// ─── Imagem HTML ──────────────────────────────────────────────────────────
function montarImagemHTML(n, contexto) {
  if (!n.img) return { antes: "", dentro: "", depois: "" };

  const cfg = n.imgConfig || { largura: 300, altura: 200, posicao: "topo" };
  const pos = cfg.posicao || "topo";
  const w   = parseInt(cfg.largura) || 300;
  const h   = parseInt(cfg.altura)  || 200;

  let style = "";
  if (contexto === "card" && (pos === "topo" || pos === "abaixo")) {
    style = "width:100%;height:100%;object-fit:cover;position:absolute;inset:0;";
  } else if (pos === "esquerda") {
    style = `width:${w}px;height:${h}px;object-fit:cover;float:left;margin:0 16px 10px 0;border-radius:6px;`;
  } else if (pos === "direita") {
    style = `width:${w}px;height:${h}px;object-fit:cover;float:right;margin:0 0 10px 16px;border-radius:6px;`;
  } else {
    style = `width:${w}px;max-width:100%;height:${h}px;object-fit:cover;border-radius:8px;display:block;margin-bottom:12px;`;
  }

  const tag = `<img src="${n.img}" alt="${escapeHtml(n.titulo)}" style="${style}">`;
  if (pos === "topo")   return { antes: tag, dentro: "", depois: "" };
  if (pos === "abaixo") return { antes: "", dentro: "", depois: tag };
  return { antes: "", dentro: tag, depois: '<div style="clear:both;"></div>' };
}

// ─── Utilitários ──────────────────────────────────────────────────────────
function toggleMenu() {
  document.querySelector(".menu").classList.toggle("open");
}
window.toggleMenu = toggleMenu;

function mostrarToast(msg, tipo = "success") {
  const t = document.createElement("div");
  t.className = `toast ${tipo}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

function escapeHtml(text) {
  const d = document.createElement("div");
  d.textContent = text;
  return d.innerHTML;
}
