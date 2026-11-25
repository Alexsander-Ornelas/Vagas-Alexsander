/* Comportamentos compartilhados: menu no celular, filtros pela URL, animações (mesma linguagem do portfólio) */
(function () {
  const reduz = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---------- Filtros pela URL (ex.: status.html?status=Em andamento) ----------
  // Lê os parâmetros da URL e aplica nos campos com o mesmo id; depois mantém a URL em dia conforme o usuário filtra.
  window.filtrosDaURL = function (ids) {
    const p = new URLSearchParams(location.search);
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el || !p.has(id)) return;
      const v = p.get(id);
      if (el.tagName === "SELECT" && ![...el.options].some(o => o.value === v)) return;
      el.value = v;
    });
    const salvar = () => {
      const q = new URLSearchParams();
      ids.forEach(id => { const el = document.getElementById(id); if (el && el.value && el.value !== "*") q.set(id, el.value); });
      history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : ""));
    };
    ids.forEach(id => document.getElementById(id)?.addEventListener("input", salvar));
    return salvar;
  };

  // Muda filtros por código (usado pelos números clicáveis do topo) e avisa a página
  window.definirFiltros = function (valores, ids) {
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = id in valores ? valores[id] : (el.id === "dia" ? "*" : ""); });
    document.getElementById(ids[0])?.dispatchEvent(new Event("input"));
    document.querySelector(".toolbar")?.scrollIntoView({ behavior: reduz ? "auto" : "smooth", block: "start" });
  };

  document.addEventListener("DOMContentLoaded", () => {
    // ---------- Menu do celular ----------
    const bar = document.querySelector("header .bar"), nav = bar?.querySelector("nav.tabs");
    if (bar && nav) {
      const b = document.createElement("button");
      b.className = "menu-btn"; b.type = "button"; b.setAttribute("aria-label", "Abrir menu"); b.setAttribute("aria-expanded", "false");
      b.innerHTML = "<span></span><span></span><span></span>";
      bar.appendChild(b);
      const alternar = abrir => {
        document.body.classList.toggle("menu-aberto", abrir);
        b.setAttribute("aria-expanded", String(abrir));
        b.setAttribute("aria-label", abrir ? "Fechar menu" : "Abrir menu");
      };
      b.addEventListener("click", () => alternar(!document.body.classList.contains("menu-aberto")));
      nav.addEventListener("click", e => { if (e.target.closest("a")) alternar(false); });
      document.addEventListener("keydown", e => { if (e.key === "Escape") alternar(false); });
      window.addEventListener("resize", () => { if (innerWidth > 800) alternar(false); });
    }

    // ---------- Cabeçalho ganha fundo ao rolar ----------
    const header = document.querySelector("header");
    const rolou = () => header?.classList.toggle("rolado", scrollY > 12);
    rolou(); addEventListener("scroll", rolou, { passive: true });

    // ---------- Fundo de rede com leve paralaxe ----------
    const redes = document.querySelectorAll(".network");
    if (redes.length && !reduz) addEventListener("scroll", () => redes.forEach(n => n.style.setProperty("--scroll-shift", scrollY * 0.18 + "px")), { passive: true });

    // ---------- Números contam do zero ----------
    document.querySelectorAll("[data-conta]").forEach(el => {
      const alvo = parseInt(el.textContent, 10);
      if (!alvo || reduz) return;
      const t0 = performance.now(), dur = 900;
      const passo = t => {
        const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
        el.textContent = Math.round(alvo * e);
        if (k < 1) requestAnimationFrame(passo);
      };
      el.textContent = "0"; requestAnimationFrame(passo);
    });

    // ---------- Texto digitando (home) ----------
    const dig = document.querySelector("[data-digita]");
    if (dig) {
      const frases = JSON.parse(dig.dataset.digita); let i = 0, j = 0, apagando = false;
      const alvo = dig.querySelector("b");
      const tick = () => {
        const f = frases[i];
        alvo.textContent = f.slice(0, j);
        if (!apagando && j === f.length) { apagando = true; return setTimeout(tick, 1800); }
        if (apagando && j === 0) { apagando = false; i = (i + 1) % frases.length; }
        j += apagando ? -1 : 1;
        setTimeout(tick, apagando ? 35 : 70);
      };
      if (reduz) alvo.textContent = frases[0]; else tick();
    }

    // ---------- Cartões aparecem ao rolar ----------
    if (reduz || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add("visivel"); io.unobserve(e.target);
    }), { rootMargin: "0px 0px -6% 0px" });
    const observar = raiz => {
      let n = 0;
      raiz.querySelectorAll(".reveal:not(.visivel), .vaga:not(.visivel)").forEach(el => {
        el.classList.add("reveal");
        el.style.transitionDelay = (n++ % 6) * 60 + "ms";
        el.addEventListener("transitionend", () => { el.style.transitionDelay = ""; }, { once: true });
        io.observe(el);
      });
    };
    observar(document);
    document.querySelectorAll("#lista").forEach(l => new MutationObserver(() => observar(l)).observe(l, { childList: true }));
  });

  // ---------- Alerta: limite de resultados negativos nas candidaturas automáticas ----------
  // Pedido do Alexsander: se 20 candidaturas feitas pela automação (botão Candidatar) forem recusadas
  // ou ficarem mais de 40 dias sem resposta, avisar que é hora de mudar a forma de mandar as candidaturas.
  const LIMITE = 20, DIAS = 40;
  function alertaNegativos() {
    const C = (window.STATUS_DADOS || {}).candidaturas || [];
    const auto = C.filter(c => c.automatica || /pela automa[cç][aã]o/i.test(c.etapa || ""));
    const dias = c => {
      const d = c.data_aprox || ((c.candidatura || "").match(/(\d{2})\/(\d{2})\/(\d{4})/) || []).slice(1).reverse().join("-");
      return d ? (Date.now() - new Date(d + "T12:00:00-03:00")) / 864e5 : 0;
    };
    const neg = auto.filter(c => c.status === "Não avançou" ||
      (["Aguardando retorno", "Encerrada sem retorno"].includes(c.status) && dias(c) > DIAS));
    if (neg.length < LIMITE) return;
    try { if (sessionStorage.getItem("alertaNegativos") === String(neg.length)) return; } catch (e) {}
    const m = document.createElement("div");
    m.className = "modal"; m.setAttribute("role", "dialog"); m.setAttribute("aria-modal", "true");
    m.innerHTML = `<div class="caixa">
      <button type="button" class="fechar" aria-label="Fechar">×</button>
      <span class="rotulo">Alerta das candidaturas automáticas</span>
      <h3>Limite de resultados negativos atingido</h3>
      <p>${neg.length} das ${auto.length} candidaturas enviadas pela automação foram recusadas ou estão há mais de ${DIAS} dias sem resposta.
      Precisamos mudar a forma de mandar as candidaturas antes de continuar.</p>
      <a class="btn primary" href="status.html">Ver candidaturas</a></div>`;
    const fechar = () => { m.remove(); try { sessionStorage.setItem("alertaNegativos", String(neg.length)); } catch (e) {} };
    m.addEventListener("click", e => { if (e.target === m || e.target.closest(".fechar")) fechar(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") fechar(); }, { once: true });
    document.body.appendChild(m);
  }
  document.addEventListener("DOMContentLoaded", () => {
    if (window.STATUS_DADOS) return alertaNegativos();
    const s = document.createElement("script");
    s.src = "dados/status.js?v=" + Date.now(); s.onload = alertaNegativos;
    document.head.appendChild(s);
  });
})();
