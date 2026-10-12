(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.QuizCore = api;
})(typeof self !== "undefined" ? self : this, function () {
  function shuffle(items) {
    const list = items.slice();
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const current = list[i];
      list[i] = list[j];
      list[j] = current;
    }
    return list;
  }

  function fresh() {
    return {
      phase: "home",
      mode: "full",
      round: 1,
      order: "shuffle",
      queue: [],
      cursor: 0,
      roundKnown: [],
      roundUnknown: [],
      reviewIds: [],
      revealed: false
    };
  }

  function idList(list) {
    return list.filter(function (id) {
      return Number.isInteger(id);
    });
  }

  function startFull(state, ids, order) {
    const list = idList(ids);
    state.phase = "quiz";
    state.mode = "full";
    state.round = 1;
    state.order = order === "list" ? "list" : "shuffle";
    state.queue = state.order === "list" ? list.slice() : shuffle(list);
    state.cursor = 0;
    state.roundKnown = [];
    state.roundUnknown = [];
    state.reviewIds = [];
    state.revealed = false;
    return state;
  }

  function answer(state, known) {
    if (state.phase !== "quiz") return state;
    if (state.cursor < 0 || state.cursor >= state.queue.length) return state;
    const id = state.queue[state.cursor];
    if (known) state.roundKnown.push(id);
    else state.roundUnknown.push(id);
    state.cursor += 1;
    state.revealed = false;
    if (state.cursor >= state.queue.length) {
      state.phase = "summary";
      state.reviewIds = state.roundUnknown.slice();
    }
    return state;
  }

  function undo(state) {
    const fromSummary = state.phase === "summary";
    if (fromSummary) {
      if (state.cursor <= 0) return state;
      state.phase = "quiz";
    } else if (state.phase !== "quiz" || state.cursor <= 0) {
      return state;
    }
    state.cursor -= 1;
    const id = state.queue[state.cursor];
    if (state.roundKnown[state.roundKnown.length - 1] === id) state.roundKnown.pop();
    else if (state.roundUnknown[state.roundUnknown.length - 1] === id) state.roundUnknown.pop();
    state.revealed = false;
    if (fromSummary) state.reviewIds = state.roundUnknown.slice();
    return state;
  }

  function startReview(state) {
    if (!state.reviewIds.length) return state;
    state.phase = "quiz";
    state.mode = "review";
    state.round += 1;
    const ids = state.reviewIds.slice();
    state.queue = state.order === "list" ? ids.sort(function (a, b) { return a - b; }) : shuffle(ids);
    state.cursor = 0;
    state.roundKnown = [];
    state.roundUnknown = [];
    state.revealed = false;
    return state;
  }

  function asIds(list, total) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (id) {
      return Number.isInteger(id) && id >= 0 && id < total;
    });
  }

  function normalize(raw, total) {
    const state = fresh();
    if (!raw || typeof raw !== "object") return state;
    if (raw.phase !== "home" && raw.phase !== "quiz" && raw.phase !== "summary") return state;
    if (raw.mode !== "full" && raw.mode !== "review") return state;
    const queue = asIds(raw.queue, total);
    const cursor = Number.isInteger(raw.cursor) ? raw.cursor : -1;
    if (cursor < 0 || cursor > queue.length) return state;
    if ((raw.phase === "quiz" || raw.phase === "summary") && queue.length === 0) return state;
    if (raw.phase === "quiz" && cursor === queue.length) return state;
    if (raw.phase === "summary" && cursor !== queue.length) return state;
    state.phase = raw.phase;
    state.mode = raw.mode;
    state.order = raw.order === "list" ? "list" : "shuffle";
    state.round = Number.isInteger(raw.round) && raw.round > 0 ? raw.round : 1;
    state.queue = queue;
    state.cursor = cursor;
    state.roundKnown = asIds(raw.roundKnown, total);
    state.roundUnknown = asIds(raw.roundUnknown, total);
    state.reviewIds = asIds(raw.reviewIds, total);
    state.revealed = Boolean(raw.revealed);
    return state;
  }

  return {
    shuffle: shuffle,
    fresh: fresh,
    startFull: startFull,
    answer: answer,
    undo: undo,
    startReview: startReview,
    normalize: normalize
  };
});
