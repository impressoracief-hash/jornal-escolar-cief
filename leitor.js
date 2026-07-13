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
    renderizar(filtradas);
  });
});

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
  renderDestaque(lista);
  renderGrid(lista);
}

// ─── Destaque (primeira notícia) ──────────────────────────────────────────
function renderDestaque(lista) {
  const wrapper = document.getElementById("destaque-wrapper");
  const secao   = document.getElementById("secao-mais");
  if (!wrapper) return;

  if (lista.length === 0) {
    wrapper.innerHTML = "";
    if (secao) secao.style.display = "none";
    return;
  }

  const n    = lista[0];
  const data = n.data?.toDate ? formatarData(n.data.toDate()) : "";

  const mediaHTML = n.img
    ? `<img src="${n.img}" alt="${escapeHtml(n.titulo)}"
            style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0;">`
    : "";

  wrapper.innerHTML = `
    <article class="destaque" onclick="abrirModal('${n.id}')" role="article" tabindex="0"
             onkeydown="if(event.key==='Enter')abrirModal('${n.id}')">
      <div class="destaque-img">
        ${mediaHTML}
        ${!n.img ? "📰" : ""}
      </div>
      <div class="destaque-body">
        <span class="destaque-kicker">⭐ Destaque</span>
        <div class="categoria ${n.categoria}">${n.categoria}</div>
        <h2>${escapeHtml(n.titulo)}</h2>
        <p>${escapeHtml(n.texto).substring(0, 160)}${n.texto.length > 160 ? "…" : ""}</p>
        <div class="destaque-meta">
          ${data ? `<span>📅 ${data}</span>` : ""}
          <button class="btn-ler" onclick="event.stopPropagation();abrirModal('${n.id}')">
            Ler notícia →
          </button>
        </div>
      </div>
    </article>`;

  if (secao) secao.style.display = lista.length > 1 ? "block" : "none";
}

// ─── Grid de cards ────────────────────────────────────────────────────────
function renderGrid(lista) {
  const container = document.getElementById("lista");

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📰</div>
        <h3>Nenhuma notícia publicada ainda</h3>
        <p>Volte em breve para conferir as novidades!</p>
      </div>`;
    return;
  }

  // Remove o destaque do grid
  const itens = lista.length > 1 ? lista.slice(1) : [];
  if (itens.length === 0) { container.innerHTML = ""; return; }

  let html = "";
  itens.forEach((n) => {
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
            ${n.img ? img.antes : "📰"}
          </div>` : ""}
        <div class="txt">
          <span class="categoria ${n.categoria}">${n.categoria}</span>
          ${img.dentro}
          <h3>${escapeHtml(n.titulo)}</h3>
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
  const img  = montarImagemHTML(n, "modal");

  const modal = document.createElement("div");
  modal.className = "modal-preview";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>📰 Notícia completa</h3>
        <button class="modal-close" onclick="this.closest('.modal-preview').remove()" aria-label="Fechar">✕</button>
      </div>
      <div class="modal-body">
        ${img.antes}
        <span class="categoria ${n.categoria}">${n.categoria}</span>
        <h2>${escapeHtml(n.titulo)}</h2>
        ${img.dentro}
        <p>${escapeHtml(n.texto)}</p>
        ${img.depois}
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
};

// ─── Menu mobile ──────────────────────────────────────────────────────────
window.toggleMenu = function() {
  document.querySelector(".menu").classList.toggle("open");
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
function formatarData(d) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
