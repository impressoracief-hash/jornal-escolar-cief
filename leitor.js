import { db } from "./firebase.js";
import {
  collection, onSnapshot, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ─── Estado ───────────────────────────────────────────────────────────────
let noticias    = [];
let filtroAtual = "todas";

// ─── Inicialização ────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  atualizarDatas();

  const q = query(collection(db, "noticias"), orderBy("data", "desc"));
  onSnapshot(q, (snap) => {
    noticias = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const filtradas = filtroAtual === "todas"
      ? noticias
      : noticias.filter(n => n.categoria === filtroAtual);
    atualizarStats();
    renderizar(filtradas);
  });
});

// ─── Estatísticas dos badges do menu ─────────────────────────────────────
function atualizarStats() {
  const categorias = [
    "total","ficcao","aventura","romance","terror","comedia","misterio",
    "fantasia","ficcaocientifica","suspense","historico","biografia",
    "drama","autoajuda","mitologia","poesia","teatro","mangas"
  ];
  categorias.forEach(cat => {
    const el = document.getElementById(`stat-${cat}`);
    if (!el) return;
    const count = cat === "total"
      ? noticias.length
      : noticias.filter(n => n.categoria === cat).length;
    el.textContent = count;
    // Destaca visualmente se tiver publicações
    el.classList.toggle("vazio", count === 0);
  });
}

// ─── Datas ────────────────────────────────────────────────────────────────
function atualizarDatas() {
  const agora = new Date();
  const el1 = document.getElementById("data-topo");
  const el2 = document.getElementById("data-hoje");
  if (el1) el1.textContent = agora.toLocaleDateString("pt-BR",
    { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
  if (el2) el2.textContent = agora.toLocaleDateString("pt-BR",
    { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Renderização completa ────────────────────────────────────────────────
function renderizar(lista) {
  const totalEl = document.getElementById("total-noticias");
  if (totalEl) totalEl.textContent = lista.length;
  // Limpa o destaque e a seção "mais" — não usados
  const wrapper = document.getElementById("destaque-wrapper");
  const secao   = document.getElementById("secao-mais");
  if (wrapper) wrapper.innerHTML = "";
  if (secao)   secao.style.display = "none";
  renderGrid(lista);
}

// ─── Grid de cards (todas as publicações, sem destaque) ───────────────────
function renderGrid(lista) {
  const container = document.getElementById("lista");

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <h3>Nenhuma história publicada ainda</h3>
        <p>Volte em breve para conferir as novidades!</p>
      </div>`;
    return;
  }

  let html = "";
  lista.forEach((n) => {
    const cfg = n.imgConfig || { largura: 300, altura: 200, posicao: "topo" };
    const pos = cfg.posicao || "topo";
    const data = n.data?.toDate ? formatarData(n.data.toDate()) : "";
    const img  = montarImagemHTML(n, "card");
    const temCardMedia = !n.img || pos === "topo" || pos === "abaixo";

    html += `
      <article class="card" onclick="abrirModal('${n.id}')" role="article"
               tabindex="0" onkeydown="if(event.key==='Enter')abrirModal('${n.id}')">
        ${temCardMedia ? `
          <div class="card-media">
            ${n.img ? img.antes : "📚"}
          </div>` : ""}
        <div class="txt">
          <span class="categoria ${n.categoria}">${n.categoria}</span>
          ${img.dentro}
          <h3>${escapeHtml(n.titulo)}</h3>
          ${n.autor ? `<p class="card-autor">✍️ ${escapeHtml(n.autor)}</p>` : ""}
          <p>${escapeHtml(n.texto)}</p>
          ${img.depois}
          ${data ? `<div class="data" style="clear:both;">📅 ${data}</div>` : ""}
        </div>
      </article>`;
  });
  container.innerHTML = html;
}

// ─── Modal de leitura ─────────────────────────────────────────────────────
window.abrirModal = function(id) {
  const n = noticias.find(x => x.id === id);
  if (!n) return;
  const data = n.data?.toDate ? formatarData(n.data.toDate()) : "";

  // Imagem maior no modal — ocupa largura total
  const imgHTML = n.img
    ? `<div class="modal-img-wrapper">
         <img src="${n.img}" alt="${escapeHtml(n.titulo)}" class="modal-img-grande"
              onclick="abrirLightbox('${n.id}')" title="Clique para ampliar 🔍">
         <span class="modal-img-dica">🔍 Clique na imagem para ampliar</span>
       </div>`
    : "";

  const modal = document.createElement("div");
  modal.className = "modal-preview";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>📖 História completa</h3>
        <button class="modal-close" onclick="this.closest('.modal-preview').remove()" aria-label="Fechar">✕</button>
      </div>
      <div class="modal-body">
        ${imgHTML}
        <span class="categoria ${n.categoria}">${n.categoria}</span>
        <p class="modal-autor">✍️ ${escapeHtml(n.titulo)}</p>
        <p>${escapeHtml(n.texto)}</p>
        ${data ? `<p style="font-size:13px;color:#94a3b8;margin-top:20px;clear:both;">📅 ${data}</p>` : ""}
      </div>
    </div>`;

  document.body.appendChild(modal);
  modal.addEventListener("click", e => { if (e.target === modal) modal.remove(); });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { modal.remove(); document.removeEventListener("keydown", esc); }
  });
};

// ─── Filtro ───────────────────────────────────────────────────────────────
window.filtrar = function(cat) {
  filtroAtual = cat;
  document.querySelectorAll(".menu-nav button").forEach(btn => btn.classList.remove("active"));
  if (event?.target) event.target.classList.add("active");

  const filtradas = cat === "todas" ? noticias : noticias.filter(n => n.categoria === cat);
  renderizar(filtradas);

  // No mobile: fecha o menu e rola para o topo para mostrar o conteúdo
  const menu    = document.querySelector(".menu");
  const overlay = document.getElementById("menu-overlay");
  if (menu && menu.classList.contains("open")) {
    menu.classList.remove("open");
    if (overlay) overlay.classList.remove("visible");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ─── Menu mobile ──────────────────────────────────────────────────────────
window.toggleMenu = function() {
  const menu    = document.querySelector(".menu");
  const overlay = document.getElementById("menu-overlay");
  menu.classList.toggle("open");
  if (overlay) overlay.classList.toggle("visible");
};

// ─── Imagem HTML ──────────────────────────────────────────────────────────
function montarImagemHTML(n, contexto) {
  if (!n.img) return { antes: "", dentro: "", depois: "" };

  const cfg = n.imgConfig || { largura: 300, altura: 200, posicao: "topo" };
  const pos = cfg.posicao || "topo";
  const w   = parseInt(cfg.largura) || 300;
  const h   = parseInt(cfg.altura)  || 200;

  let style = "";
  if (contexto === "card" && (pos === "topo" || pos === "abaixo")) {
    // Card: imagem preenche o card-media fixo, dimensões configuradas não se aplicam
    style = "width:100%;height:100%;object-fit:cover;position:absolute;inset:0;";
  } else if (contexto === "modal") {
    // Modal: respeita dimensões mas protege contra distorção
    if (pos === "topo" || pos === "abaixo") {
      style = `width:${w}px;max-width:100%;height:auto;max-height:${h}px;object-fit:cover;border-radius:8px;display:block;margin-bottom:12px;`;
    } else if (pos === "esquerda") {
      style = `width:${w}px;max-width:45%;height:${h}px;object-fit:cover;float:left;margin:0 16px 10px 0;border-radius:6px;`;
    } else {
      style = `width:${w}px;max-width:45%;height:${h}px;object-fit:cover;float:right;margin:0 0 10px 16px;border-radius:6px;`;
    }
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

// ─── Lightbox (imagem em tela cheia) ─────────────────────────────────────
window.abrirLightbox = function(id) {
  const n = noticias.find(x => x.id === id);
  if (!n || !n.img) return;

  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.innerHTML = `
    <button class="lightbox-close" aria-label="Fechar">✕</button>
    <img src="${n.img}" alt="${escapeHtml(n.titulo)}" class="lightbox-img">
    <p class="lightbox-legenda">${escapeHtml(n.titulo)}</p>`;

  document.body.appendChild(lb);
  // Fecha ao clicar fora da imagem ou no botão
  lb.addEventListener("click", e => {
    if (e.target === lb || e.target.classList.contains("lightbox-close")) lb.remove();
  });
  document.addEventListener("keydown", function esc(e) {
    if (e.key === "Escape") { lb.remove(); document.removeEventListener("keydown", esc); }
  });
};

// ─── Utilitários ──────────────────────────────────────────────────────────
function formatarData(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
