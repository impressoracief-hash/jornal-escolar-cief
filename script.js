let noticias = JSON.parse(localStorage.getItem("noticias") || "[]");
let editandoIndex = null;
let filtroAtual = "todas";

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
  mostrar(noticias);
  configurarEventos();
});

function configurarEventos() {
  // Validação de imagem
  document.getElementById("imagem").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        mostrarToast("Imagem muito grande! Máximo 5MB", "error");
        e.target.value = "";
      }
      if (!file.type.startsWith("image/")) {
        mostrarToast("Apenas imagens são permitidas", "error");
        e.target.value = "";
      }
    }
  });
}

function salvar() {
  localStorage.setItem("noticias", JSON.stringify(noticias));
}

function publicar() {
  const titulo = document.getElementById("titulo").value.trim();
  const texto = document.getElementById("texto").value.trim();
  const categoria = document.getElementById("categoria").value;
  const file = document.getElementById("imagem").files[0];

  if (!titulo || !texto) {
    mostrarToast("Preencha título e texto", "error");
    return;
  }

  const processarNoticia = (img = "") => {
    const noticia = { titulo, texto, categoria, img, data: new Date().toISOString() };
    
    if (editandoIndex !== null) {
      noticias[editandoIndex] = noticia;
      editandoIndex = null;
      mostrarToast("Notícia atualizada!");
    } else {
      noticias.unshift(noticia);
      mostrarToast("Notícia publicada!");
    }
    
    salvar();
    limparFormulario();
    filtrar(filtroAtual);
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => processarNoticia(e.target.result);
    reader.readAsDataURL(file);
  } else {
    processarNoticia();
  }
}

function editar(i) {
  const n = noticias[i];
  document.getElementById("titulo").value = n.titulo;
  document.getElementById("texto").value = n.texto;
  document.getElementById("categoria").value = n.categoria;
  
  editandoIndex = i;
  document.querySelector(".form h3").textContent = "Editar notícia";
  document.querySelector(".form .btn").textContent = "Atualizar";
  
  // Adicionar botão cancelar se não existir
  if (!document.querySelector(".btn-cancelar")) {
    const btnCancelar = document.createElement("button");
    btnCancelar.className = "btn btn-cancelar";
    btnCancelar.textContent = "Cancelar";
    btnCancelar.onclick = cancelarEdicao;
    document.querySelector(".form .btn").after(btnCancelar);
  }
  
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelarEdicao() {
  editandoIndex = null;
  limparFormulario();
  document.querySelector(".form h3").textContent = "Nova notícia";
  document.querySelector(".form .btn").textContent = "Publicar";
  document.querySelector(".btn-cancelar")?.remove();
}

function limparFormulario() {
  document.getElementById("titulo").value = "";
  document.getElementById("texto").value = "";
  document.getElementById("categoria").value = "eventos";
  document.getElementById("imagem").value = "";
}

function mostrar(lista) {
  const container = document.getElementById("lista");
  
  if (lista.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>📰</h3>
        <p>Nenhuma notícia encontrada</p>
      </div>
    `;
    return;
  }

  let html = "";
  lista.forEach((n, i) => {
    const indiceReal = noticias.indexOf(n);
    html += `
      <div class="card">
        ${n.img ? `<img src="${n.img}" alt="${escapeHtml(n.titulo)}">` : ""}
        <div class="txt">
          <div class="categoria ${n.categoria}">${n.categoria}</div>
          <h3>${escapeHtml(n.titulo)}</h3>
          <p>${escapeHtml(n.texto)}</p>
          <div class="card-actions">
            <button class="btn-editar" onclick="editar(${indiceReal})">✏️ Editar</button>
            <button class="btn-excluir" onclick="confirmarExclusao(${indiceReal})">🗑️ Excluir</button>
          </div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function confirmarExclusao(i) {
  if (confirm("Deseja realmente excluir esta notícia?")) {
    excluir(i);
  }
}

function excluir(i) {
  noticias.splice(i, 1);
  salvar();
  filtrar(filtroAtual);
  mostrarToast("Notícia excluída");
}

function filtrar(cat) {
  filtroAtual = cat;
  
  // Atualizar botões ativos
  document.querySelectorAll(".menu button").forEach(btn => {
    btn.classList.remove("active");
  });
  event?.target?.classList.add("active");
  
  if (cat === "todas") {
    mostrar(noticias);
  } else {
    mostrar(noticias.filter((n) => n.categoria === cat));
  }
}

function toggleMenu() {
  document.querySelector(".menu").classList.toggle("open");
}

function mostrarToast(msg, tipo = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
