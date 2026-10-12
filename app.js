(function () {
  const KEY = "kelime-karti-v2";
  const app = document.getElementById("app");
  let state = load();
  let pendingRestart = false;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return QuizCore.fresh();
      return QuizCore.normalize(JSON.parse(raw), WORDS.length);
    } catch (error) {
      return QuizCore.fresh();
    }
  }

  function persist() {
    try {
      if (state.phase === "home") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, JSON.stringify(state));
    } catch (error) {
      return;
    }
  }

  function commit() {
    pendingRestart = false;
    persist();
    render();
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function word(id) {
    return WORDS[id];
  }

  function folderName() {
    if (state.mode === "review") return "Bilmediklerim";
    return state.order === "list" ? "Sıralı" : "Karışık";
  }

  function sortedUnknown() {
    return state.reviewIds
      .map(word)
      .slice()
      .sort(function (a, b) {
        return a.en.localeCompare(b.en, "en");
      });
  }

  function render() {
    if (state.phase === "home") app.innerHTML = homeView();
    else if (state.phase === "quiz") app.innerHTML = quizView();
    else app.innerHTML = summaryView();
  }

  function homeView() {
    return (
      '<div class="screen">' +
      '<p class="eyebrow">Ezber</p>' +
      "<h1>Kelime kartları</h1>" +
      '<p class="lead">' + WORDS.length + " kelime gelir. İngilizceyi görürsün. Anlamını biliyorsan işaretle. Bilmiyorsan önce anlama bak, sonra bilmiyorum de. Tur bitince bilmediklerin ayrı klasörde, seçtiğin sırayla tekrar sorulur.</p>" +
      '<div class="stack stack-top"><button class="btn btn-primary btn-block" data-action="start">Karışık sor</button><button class="btn btn-secondary btn-block" data-action="start-ordered">Kelime sırasıyla sor</button></div>' +
      "</div>"
    );
  }

  function quizView() {
    const current = word(state.queue[state.cursor]);
    const total = state.queue.length;
    const done = state.cursor;
    const width = total === 0 ? 0 : Math.round((done / total) * 100);
    const meaning = state.revealed
      ? '<p class="meaning-label">Türkçe</p><p class="meaning">' + esc(current.tr) + '</p><button class="text-btn" data-action="reveal">Anlamı gizle</button>'
      : '<button class="text-btn" data-action="reveal">Anlamına bak</button>';

    return (
      '<div class="screen quiz">' +
      '<div class="head"><p class="eyebrow">Tur ' + state.round + " · " + esc(folderName()) + "</p>" +
      '<p class="meta">' + (done + 1) + " / " + total + "</p></div>" +
      '<p class="tally">Bildiğin ' + state.roundKnown.length + " · Bilmediğin " + state.roundUnknown.length + "</p>" +
      '<div class="bar" aria-hidden="true"><div class="bar-fill" style="width:' + width + '%"></div></div>' +
      '<section class="card"><p class="lang">İngilizce</p><h1 class="word">' + esc(current.en) + "</h1>" +
      '<div class="reveal-zone">' + meaning + "</div></section>" +
      '<div class="actions quiz-actions"><button class="btn btn-primary" data-action="know">Biliyorum</button>' +
      '<button class="btn btn-secondary" data-action="miss">Bilmiyorum</button></div>' +
      '<div class="footer-row"><p class="hint">A anlam · B biliyorum · N bilmiyorum</p>' + footerControls() + "</div></div>"
    );
  }

  function footerControls() {
    if (pendingRestart) {
      return '<div class="confirm"><p>İlerleme silinsin mi?</p><button class="text-btn" data-action="restart">Evet</button><button class="text-btn" data-action="cancel-restart">Vazgeç</button></div>';
    }
    const undo = state.cursor > 0 ? '<button class="text-btn" data-action="undo">Son cevabı geri al</button>' : "";
    return '<div class="tools">' + undo + '<button class="text-btn" data-action="ask-restart">Baştan başla</button></div>';
  }

  function summaryView() {
    const known = state.roundKnown.length;
    const unknown = state.reviewIds.length;
    const cleared = state.mode === "review" ? state.queue.length - unknown : 0;
    let copy = state.order === "list"
      ? "Bildiklerin klasörden çıkar. Kalanlar liste sırasıyla tekrar sorulur."
      : "Bildiklerin klasörden çıkar. Kalanlar yeniden karışık sorulur.";
    if (unknown === 0 && state.mode === "full") copy = "İlk turda hepsini bildin.";
    if (unknown === 0 && state.mode === "review") copy = "Bilmediklerin kalmadı. Klasör boş.";
    const reviewButton = unknown
      ? '<button class="btn btn-primary btn-block" data-action="review">Bu klasörü sor</button>'
      : '<button class="btn btn-primary btn-block" data-action="start">Karışık sor</button><button class="btn btn-secondary btn-block" data-action="start-ordered">Kelime sırasıyla sor</button>';
    const clearedLine = state.mode === "review" && cleared > 0
      ? '<p class="summary-copy">Bu turda ' + cleared + " kelime klasörden çıktı.</p>"
      : "";

    return (
      '<div class="screen">' +
      '<p class="eyebrow">Tur ' + state.round + " bitti</p>" +
      "<h1>" + (unknown === 0 ? "Hepsi tamam" : "Bilmediklerim") + "</h1>" +
      '<div class="stats stack-top"><div class="stat"><strong>' + known + '</strong><span>Biliyorum</span></div>' +
      '<div class="stat"><strong>' + unknown + "</strong><span>Bilmiyorum</span></div></div>" +
      '<div class="stack stack-top">' + clearedLine + '<p class="summary-copy">' + copy + "</p>" +
      reviewButton +
      '<button class="text-btn" data-action="undo">Son cevabı geri al</button>' +
      folderBlock(unknown) + restartRow() + "</div></div>"
    );
  }

  function folderBlock(unknown) {
    if (!unknown) return "";
    const items = sortedUnknown().map(function (entry) {
      return "<li>" + esc(entry.en) + "</li>";
    }).join("");
    return (
      '<section class="folder"><div class="folder-head"><strong>Klasör · Bilmediklerim</strong><span class="meta">' + unknown + ' kelime</span></div>' +
      '<p class="folder-note">Anlamlar sorularda gizli kalır.</p><ul>' + items + "</ul></section>"
    );
  }

  function restartRow() {
    if (pendingRestart) {
      return '<div class="confirm"><p>Tüm ilerleme silinsin mi?</p><button class="text-btn" data-action="restart">Evet</button><button class="text-btn" data-action="cancel-restart">Vazgeç</button></div>';
    }
    return '<button class="text-btn" data-action="ask-restart">Baştan başla</button>';
  }

  function allIds() {
    return WORDS.map(function (_, index) { return index; });
  }

  app.addEventListener("click", function (event) {
    const target = event.target.closest("[data-action]");
    if (!target || !app.contains(target)) return;
    const action = target.dataset.action;

    if (action === "start" || action === "start-ordered") {
      if (state.phase === "quiz") return;
      QuizCore.startFull(state, allIds(), action === "start-ordered" ? "list" : "shuffle");
      commit();
      return;
    }
    if (action === "know") {
      if (state.phase !== "quiz") return;
      QuizCore.answer(state, true);
      commit();
      return;
    }
    if (action === "miss") {
      if (state.phase !== "quiz") return;
      QuizCore.answer(state, false);
      commit();
      return;
    }
    if (action === "reveal") {
      if (state.phase !== "quiz") return;
      state.revealed = !state.revealed;
      commit();
      return;
    }
    if (action === "undo") {
      if (state.phase !== "quiz" && state.phase !== "summary") return;
      QuizCore.undo(state);
      commit();
      return;
    }
    if (action === "review") {
      if (state.phase !== "summary" || !state.reviewIds.length) return;
      QuizCore.startReview(state);
      commit();
      return;
    }
    if (action === "ask-restart") {
      pendingRestart = true;
      render();
      return;
    }
    if (action === "cancel-restart") {
      pendingRestart = false;
      render();
      return;
    }
    if (action === "restart") {
      state = QuizCore.fresh();
      pendingRestart = false;
      persist();
      render();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (state.phase !== "quiz") return;
    if (event.target.closest("button")) return;
    const key = event.key.toLowerCase();
    if (key === "a" || key === " ") {
      event.preventDefault();
      state.revealed = !state.revealed;
      commit();
      return;
    }
    if (key === "b" || key === "1") {
      QuizCore.answer(state, true);
      commit();
      return;
    }
    if (key === "n" || key === "2") {
      QuizCore.answer(state, false);
      commit();
      return;
    }
    if (key === "backspace") {
      event.preventDefault();
      QuizCore.undo(state);
      commit();
    }
  });

  render();
})();
