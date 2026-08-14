"use strict";

const MATCH9_KEYS = {
  gasUrl: "match9-gas-url-v1",
  publicCache: "match9-public-cache-v5",
  theme: "match9-theme-v1",
};

const state = {
  gasUrl: "",
  data: null,
  screen: "home",
  activeClassId: "",
  selectedMaterialId: "",
  selectedTopicId: "",
  lessonStep: 0,
  teacherPin: "",
  teacherAnswers: null,
  attendance: {},
  drawnStudentIds: new Set(),
  currentDraw: [],
  gamePhase: "ready",
  gameTimerId: null,
  gameRemaining: 180,
  gameElapsed: 0,
  gameResults: new Map(),
  gameQuestions: new Map(),
  practiceBatch: null,
  fieldTaskQuestion: null,
  assessmentData: null,
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  bindEvents();
  setToday();
  applyTheme(localStorage.getItem(MATCH9_KEYS.theme) || "langit");

  const configuredUrl = String(window.MATCH9_CONFIG?.GAS_URL || "").trim();
  state.gasUrl = localStorage.getItem(MATCH9_KEYS.gasUrl) || configuredUrl;
  elements.gasUrlInput.value = state.gasUrl;

  const cached = readCache();
  if (cached) {
    state.data = cached;
    prepareDataState();
  }
  renderAll();
  if (state.gasUrl) loadData({ quiet: Boolean(cached) });
}

function cacheElements() {
  [
    "appName", "schoolName", "academicLabel", "connectionButton", "connectionText",
    "refreshButton", "setupNotice", "defaultPinNotice", "materialList", "homeClassLabel",
    "homeStudentCount", "homeGradeCount", "lessonContent", "lessonBackButton", "todayLabel",
    "classSelect", "gradeClassSelect", "attendanceDate", "markAllPresentButton",
    "saveAttendanceButton", "classCountLabel", "studentList", "openGameButton", "gameBackButton",
    "gameArena", "gameTopicLabel", "gameMaterialLabel", "gameTimer", "gameStatus",
    "drawStudentsButton", "finishGameButton", "continueGameButton",
    "reviewScoresButton", "resetDrawButton", "drawResults", "weightStrip", "gradeTableBody", "saveGradesButton",
    "gasUrlInput", "saveUrlButton", "clearCacheButton", "teacherModeButton", "teacherState",
    "themePicker", "loadingOverlay", "loadingText", "toast", "brandButton", "mainMenu",
    "homeViewButton", "fullscreenButton", "teacherModal",
  ].forEach(function (id) { elements[id] = document.getElementById(id); });
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach(function (button) {
    button.addEventListener("click", function () { navigate(button.dataset.go); });
  });
  elements.brandButton.addEventListener("click", toggleMainMenu);
  elements.mainMenu.addEventListener("click", function () { closeMainMenu(); });
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".brand-wrap")) closeMainMenu();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    closeMainMenu();
    closeTeacherModal();
  });
  elements.homeViewButton.addEventListener("click", function () { navigate("home"); });
  elements.fullscreenButton.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  elements.connectionButton.addEventListener("click", function () {
    if (state.data && state.gasUrl) loadData({ force: true });
    else navigate("settings");
  });
  elements.refreshButton.addEventListener("click", function () { loadData({ force: true }); });
  elements.lessonBackButton.addEventListener("click", function () { navigate("home"); });
  elements.materialList.addEventListener("click", onMaterialClick);
  elements.lessonContent.addEventListener("click", onLessonClick);
  elements.studentList.addEventListener("change", onAttendanceChange);
  elements.classSelect.addEventListener("change", onClassChange);
  elements.gradeClassSelect.addEventListener("change", onClassChange);
  elements.markAllPresentButton.addEventListener("click", markAllPresent);
  elements.saveAttendanceButton.addEventListener("click", saveAttendance);
  elements.openGameButton.addEventListener("click", function () { renderGame(); navigate("game"); });
  elements.gameBackButton.addEventListener("click", function () { navigate("class"); });
  elements.drawStudentsButton.addEventListener("click", drawStudents);
  elements.finishGameButton.addEventListener("click", finishGame);
  elements.resetDrawButton.addEventListener("click", resetDrawRound);
  elements.reviewScoresButton.addEventListener("click", openDiagnosticReview);
  elements.continueGameButton.addEventListener("click", continueFromGame);
  elements.drawResults.addEventListener("click", onGameClick);
  elements.teacherModal.addEventListener("click", onTeacherModalClick);
  elements.teacherModal.addEventListener("input", onTeacherModalInput);
  elements.gradeTableBody.addEventListener("input", onGradeInput);
  elements.saveGradesButton.addEventListener("click", saveGrades);
  elements.saveUrlButton.addEventListener("click", saveGasUrl);
  elements.clearCacheButton.addEventListener("click", function () { loadData({ force: true }); });
  elements.teacherModeButton.addEventListener("click", openTeacherMode);
  elements.themePicker.addEventListener("click", onThemeChoice);
}

function setToday() {
  const now = new Date();
  elements.attendanceDate.value = localIsoDate(now);
  elements.todayLabel.textContent = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(now);
}

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function navigate(screen) {
  const valid = ["home", "class", "game", "grades", "settings", "lesson"];
  state.screen = valid.includes(screen) ? screen : "home";
  document.querySelectorAll(".screen").forEach(function (section) {
    section.classList.toggle("active", section.dataset.screen === state.screen);
  });
  closeMainMenu();
  if (state.screen === "class") renderClass();
  if (state.screen === "game") renderGame();
  if (state.screen === "grades") renderGrades();
  if (state.screen === "settings") renderSettings();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleMainMenu() {
  const willOpen = elements.mainMenu.classList.contains("hidden");
  elements.mainMenu.classList.toggle("hidden", !willOpen);
  elements.brandButton.setAttribute("aria-expanded", String(willOpen));
}

function closeMainMenu() {
  elements.mainMenu.classList.add("hidden");
  elements.brandButton.setAttribute("aria-expanded", "false");
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    showToast("Mode layar penuh belum diizinkan oleh peramban.");
  }
}

function updateFullscreenButton() {
  const active = Boolean(document.fullscreenElement);
  elements.fullscreenButton.textContent = active ? "⛶" : "⛶";
  elements.fullscreenButton.title = active ? "Keluar dari layar penuh" : "Layar penuh";
  elements.fullscreenButton.setAttribute("aria-label", elements.fullscreenButton.title);
}

async function loadData(options) {
  const quiet = Boolean(options?.quiet);
  const force = Boolean(options?.force);
  if (!state.gasUrl) {
    setConnection("draft", "Belum tersambung");
    elements.setupNotice.classList.remove("hidden");
    if (!quiet) showToast("Tempel URL Web App GAS melalui menu Atur.");
    return;
  }
  if (!quiet) showLoading("Mengambil materi dari Google Sheet…");
  try {
    let data;
    try { data = await apiGet("bootstrap", force); }
    catch (fetchError) { data = await jsonpGet("bootstrap", force); }
    if (!data?.ok) throw new Error(data?.error || "Data Google Sheet belum dapat dibaca.");
    state.data = data;
    localStorage.setItem(MATCH9_KEYS.publicCache, JSON.stringify(data));
    prepareDataState();
    renderAll();
    setConnection("connected", "Sheet tersambung");
    if (!quiet) showToast(force ? "Data terbaru berhasil dimuat dari Google Sheet." : "Materi, kelas, dan nilai berhasil dimuat.");
  } catch (error) {
    setConnection("error", "Koneksi gagal");
    if (!state.data) elements.setupNotice.classList.remove("hidden");
    showToast(error.message || "Belum dapat tersambung ke Google Sheet.");
  } finally { hideLoading(); }
}

function prepareDataState() {
  if (!state.data) return;
  const classes = activeClasses();
  const preferred = state.activeClassId || state.data.settings?.ID_KELAS_AKTIF;
  state.activeClassId = classes.some(function (item) { return item.ID_KELAS === preferred; })
    ? preferred
    : classes[0]?.ID_KELAS || preferred || "IX-4";

  activeStudents().forEach(function (student) {
    if (!state.attendance[student.ID_SISWA]) state.attendance[student.ID_SISWA] = "Hadir";
  });
  const firstMaterial = state.data.materials?.[0];
  if (!state.selectedMaterialId && firstMaterial) state.selectedMaterialId = firstMaterial.ID_MATERI;
  const material = selectedMaterial();
  if (material && !material.topics.some(function (topic) { return topic.ID_SUBMATERI === state.selectedTopicId; })) {
    state.selectedTopicId = material.topics?.[0]?.ID_SUBMATERI || "";
  }
  state.gameRemaining = gameLimit();
}

function renderAll() {
  renderHeader();
  renderClassSelectors();
  renderHome();
  renderClass();
  renderGrades();
  renderSettings();
  renderGame();
  if (state.selectedMaterialId) renderLesson();
}

function renderHeader() {
  const settings = state.data?.settings;
  elements.appName.textContent = settings?.NAMA_APLIKASI || "MATCH-9";
  elements.schoolName.textContent = settings?.NAMA_SEKOLAH || "SMPN 38 Maluku Tengah";
  elements.academicLabel.textContent = settings
    ? `${settings.TAHUN_AJARAN} · Semester ${settings.SEMESTER_AKTIF}`
    : "Materi dan nilai dalam satu layar.";
  elements.setupNotice.classList.toggle("hidden", Boolean(state.gasUrl));
  elements.defaultPinNotice.classList.toggle("hidden", !state.data?.pinIsDefault);
  if (!state.gasUrl) setConnection("draft", "Belum tersambung");
}

function renderClassSelectors() {
  const classes = activeClasses();
  const options = classes.length
    ? classes.map(function (item) {
        const selected = item.ID_KELAS === state.activeClassId ? " selected" : "";
        return `<option value="${escapeAttribute(item.ID_KELAS)}"${selected}>${escapeHtml(item.NAMA_KELAS || item.ID_KELAS)}</option>`;
      }).join("")
    : `<option value="IX-4">Kelas 9-4</option><option value="IX-2">Kelas 9-2</option>`;
  elements.classSelect.innerHTML = options;
  elements.gradeClassSelect.innerHTML = options;
  elements.classSelect.value = state.activeClassId || "IX-4";
  elements.gradeClassSelect.value = state.activeClassId || "IX-4";
}

function onClassChange(event) {
  state.activeClassId = event.target.value;
  state.attendance = {};
  state.drawnStudentIds.clear();
  state.practiceBatch = null;
  state.fieldTaskQuestion = null;
  resetGame(false);
  activeStudents().forEach(function (student) { state.attendance[student.ID_SISWA] = "Hadir"; });
  renderClassSelectors();
  renderHome();
  renderClass();
  renderGrades();
  renderGame();
  showToast(`${className()} dipilih.`);
}

function renderHome() {
  const materials = state.data?.materials || [];
  elements.materialList.innerHTML = materials.length
    ? materials.map(materialCard).join("")
    : emptyState("▦", "Materi akan tampil setelah Google Sheet tersambung.");

  const completed = currentGrades().filter(function (grade) {
    return [grade.NF, grade.NSLM, grade.NONTES, grade.STS, grade.SAS].every(hasScore);
  }).length;
  elements.homeClassLabel.textContent = className();
  elements.homeStudentCount.textContent = `${activeStudents().length} murid`;
  elements.homeGradeCount.textContent = completed ? `${completed} NR lengkap` : "Belum lengkap";
}

function materialCard(material) {
  const accent = ["indigo", "teal", "amber", "rose"].includes(material.WARNA) ? material.WARNA : "indigo";
  const symbol = material.ID_MATERI === "SPLDV" ? "x+y" : material.ID_MATERI === "BRSL" ? "πr²" : material.ID_MATERI === "PELUANG" ? "P(A)" : "(x,y)";
  return `<button class="material-card accent-${accent}" type="button" data-material-id="${escapeAttribute(material.ID_MATERI)}">
    <span class="material-symbol math-content" aria-hidden="true">${mathText(symbol)}</span>
    <span class="material-copy"><span class="eyebrow">${escapeHtml(material.KODE_LM || "Materi")}</span><strong>${escapeHtml(material.JUDUL)}</strong><small>Semester ${escapeHtml(material.SEMESTER)} · ${material.topics?.length || 0} submateri</small></span>
    <span class="arrow" aria-hidden="true">›</span></button>`;
}

function onMaterialClick(event) {
  const button = event.target.closest("[data-material-id]");
  if (!button) return;
  state.selectedMaterialId = button.dataset.materialId;
  state.selectedTopicId = selectedMaterial()?.topics?.[0]?.ID_SUBMATERI || "";
  state.lessonStep = 0;
  state.practiceBatch = null;
  state.fieldTaskQuestion = null;
  resetGame(false);
  renderLesson();
  navigate("lesson");
}

function renderLesson() {
  const material = selectedMaterial();
  const topic = selectedTopic() || material?.topics?.[0];
  if (!material || !topic) {
    elements.lessonContent.innerHTML = emptyState("▦", "Submateri belum tersedia pada Google Sheet.");
    return;
  }
  state.selectedTopicId = topic.ID_SUBMATERI;
  const teacher = state.teacherAnswers?.[`${material.ID_MATERI}::${topic.ID_SUBMATERI}`] || null;
  const stages = lessonStages(topic, teacher);
  state.lessonStep = Math.max(0, Math.min(state.lessonStep, stages.length - 1));
  const stage = stages[state.lessonStep];
  const progress = Math.round(((state.lessonStep + 1) / stages.length) * 100);

  elements.lessonContent.innerHTML = `
    <div class="lesson-hero accent-${escapeAttribute(material.WARNA || "indigo")}">
      <p class="eyebrow light">${escapeHtml(material.KODE_LM)} · Semester ${escapeHtml(material.SEMESTER)}</p>
      <h1>${escapeHtml(material.JUDUL)}</h1><p>${escapeHtml(material.RINGKASAN)}</p>
    </div>
    <div class="topic-tabs" role="tablist" aria-label="Submateri">
      ${material.topics.map(function (item) {
        return `<button class="topic-tab${item.ID_SUBMATERI === topic.ID_SUBMATERI ? " active" : ""}" type="button" role="tab" data-topic-id="${escapeAttribute(item.ID_SUBMATERI)}">${escapeHtml(item.JUDUL)}</button>`;
      }).join("")}
    </div>
    <div class="lesson-progress"><span style="width:${progress}%"></span></div>
    <section class="teaching-stage stage-${state.lessonStep % 6}">
      <div class="stage-meta"><span>${state.lessonStep + 1} / ${stages.length}</span><b>${escapeHtml(stage.kicker)}</b></div>
      <div class="stage-icon" aria-hidden="true">${escapeHtml(stage.icon)}</div>
      <h2>${escapeHtml(stage.title)}</h2>
      <div class="stage-body math-content">${stage.html}</div>
      ${stage.action || ""}
    </section>
    <div class="lesson-navigation">
      <button class="secondary-button" type="button" data-stage-prev${state.lessonStep === 0 ? " disabled" : ""}>← Kembali</button>
      ${state.lessonStep === stages.length - 1
        ? `<button class="primary-button" type="button" data-stage-finish>Selesai ✓</button>`
        : `<button class="primary-button" type="button" data-stage-next>Lanjut →</button>`}
    </div>`;
  typesetMath(elements.lessonContent);
}

function lessonStages(topic, teacher) {
  const points = splitPoints(topic.POIN_PENTING);
  const practiceBatch = currentPracticeBatch();
  const fieldTask = currentFieldTaskQuestion();
  const imageUrl = safeImageUrl(topic.GAMBAR_URL);
  const contextImage = imageUrl
    ? `<figure class="context-image"><img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(topic.KETERANGAN_GAMBAR || "Ilustrasi hubungan materi dengan kehidupan sehari-hari")}" loading="eager" /><figcaption class="context-caption">${escapeHtml(topic.KETERANGAN_GAMBAR || "Perhatikan situasi pada gambar, lalu hubungkan dengan model matematika.")}</figcaption></figure>`
    : "";
  const stages = [
    {
      kicker: "Tujuan pembelajaran", icon: "◎", title: topic.JUDUL,
      html: `<p class="stage-lead">${mathText(topic.TUJUAN || "Tujuan pembelajaran belum diisi.")}</p>`,
    },
    {
      kicker: "Hubungan dengan kehidupan", icon: "⌂", title: "Ternyata matematika ada di sekitar kita",
      html: `<div class="context-layout${contextImage ? " has-image" : ""}"><p class="stage-lead">${mathText(topic.KONTEKS_SEHARI_HARI || "Contoh kehidupan sehari-hari belum diisi pada Google Sheet.")}</p>${contextImage}</div>`,
    },
    {
      kicker: "Penjelasan singkat", icon: "∑", title: "Inti materi",
      html: `<p class="stage-lead">${mathText(topic.RINGKASAN || "Ringkasan belum diisi.")}</p>${points.length ? `<ul class="large-key-list">${points.map(function (point) { return `<li>${mathText(point)}</li>`; }).join("")}</ul>` : ""}`,
    },
    {
      kicker: "Tes prasyarat", icon: "?", title: "Soal pengantar",
      html: `<div class="focus-question">${mathText(prerequisiteQuestions(topic)[0] || "Soal prasyarat belum diisi.")}</div>${answerControl("prerequisite-answer", teacher?.JAWABAN_PRASYARAT_1 || teacher?.JAWABAN_PRASYARAT || "", "Lihat jawaban")}`,
      action: `<button class="stage-action-button" type="button" data-start-game>Gunakan untuk game 4 murid</button>`,
    },
  ];

  [1, 2, 3].forEach(function (number) {
    if (!topic[`CONTOH_${number}`]) return;
    stages.push({
      kicker: `Contoh guru ${number}`, icon: "✎", title: `Contoh ${number}`,
      html: `<div class="focus-question">${mathText(topic[`CONTOH_${number}`])}</div>${answerControl("example-" + number, teacher?.[`CARA_CONTOH_${number}`] || "", "Tampilkan cara kerja")}`,
    });
  });
  stages.push({
    kicker: "Latihan bersama", icon: "∞", title: "Kita kuat karena banyak berlatih",
    html: practiceBatch
      ? `<div class="bank-question-list">${practiceBatch.items.map(function (item, index) {
          return `<article class="bank-question-card"><header><span>${index + 1}</span><small>${escapeHtml(item.questionId || "Soal bank")}</small></header><div class="focus-question">${mathText(item.question)}</div>${answerControl("practice-bank-" + index, item.answer || "", "Lihat jawaban")}</article>`;
        }).join("")}</div><p class="bank-remaining">Masih tersedia ${escapeHtml(practiceBatch.remaining)} soal yang belum pernah dipakai pada submateri ini.</p>`
      : `<div class="bank-empty"><strong>Bank berisi 100 soal latihan.</strong><p>Ambil lima soal untuk dikerjakan bersama. Set berikutnya tidak mengulang soal yang sudah pernah dibagikan.</p></div>`,
    action: `<button class="stage-action-button" type="button" data-load-practice>${practiceBatch ? "Ambil 5 soal berikutnya" : "Ambil 5 soal latihan"}</button>`,
  });
  [1, 2, 3].forEach(function (number) {
    if (!topic[`LATIHAN_${number}`]) return;
    stages.push({
      kicker: `Latihan siswa ${number}`, icon: "✓", title: `Kerjakan latihan ${number}`,
      html: `<div class="focus-question">${mathText(topic[`LATIHAN_${number}`])}</div>${answerControl("practice-" + number, teacher?.[`JAWABAN_${number}`] || "", "Lihat jawaban guru")}`,
    });
  });
  stages.push({
    kicker: "Tugas lapangan", icon: "⌖", title: `Tugas khusus ${className()}`,
    html: fieldTask
      ? `<div class="question-identity">${escapeHtml(fieldTask.questionId)} · khusus ${escapeHtml(className())}</div><div class="focus-question field-task">${mathText(fieldTask.question)}</div>${answerControl("homework-bank-answer", fieldTask.answer || "", "Lihat pedoman penilaian")}`
      : `<div class="bank-empty field-task-empty"><strong>Tugas belum dialokasikan untuk ${escapeHtml(className())}.</strong><p>Tekan tombol di bawah. Server akan memilih satu dari 100 variasi yang belum dipakai kelas lain.</p></div>`,
    action: `<div class="stage-action-row"><button class="stage-action-button" type="button" data-load-field-task>${fieldTask ? "Ganti variasi tugas" : "Siapkan tugas kelas"}</button><button class="stage-action-button field-score-button" type="button" data-open-field-scores>Input nilai tugas</button><span>Nilai kosong akan ditandai “Belum dinilai”.</span></div>`,
  });
  return stages;
}

function answerControl(id, answer, label) {
  if (!state.teacherAnswers) return `<button class="reveal-button" type="button" data-unlock-teacher>${escapeHtml(label)} · PIN guru</button>`;
  if (!answer) return `<p class="locked-answer">Jawaban belum diisi pada Google Sheet.</p>`;
  return `<button class="reveal-button" type="button" data-reveal="${escapeAttribute(id)}">${escapeHtml(label)}</button><div class="answer-box hidden math-content" id="${escapeAttribute(id)}">${mathText(answer)}</div>`;
}

async function onLessonClick(event) {
  const topicButton = event.target.closest("[data-topic-id]");
  if (topicButton) {
    state.selectedTopicId = topicButton.dataset.topicId;
    state.lessonStep = 0;
    state.practiceBatch = null;
    state.fieldTaskQuestion = null;
    resetGame(false);
    renderLesson();
    return;
  }
  if (event.target.closest("[data-stage-prev]")) { state.lessonStep -= 1; renderLesson(); scrollLessonTop(); return; }
  if (event.target.closest("[data-stage-next]")) { state.lessonStep += 1; renderLesson(); scrollLessonTop(); return; }
  if (event.target.closest("[data-stage-finish]")) { navigate("home"); showToast("Materi selesai. Silakan pilih materi berikutnya."); return; }
  if (event.target.closest("[data-unlock-teacher]")) { await openTeacherMode(); return; }
  if (event.target.closest("[data-load-practice]")) { await loadPracticeBatch(); return; }
  if (event.target.closest("[data-load-field-task]")) { await loadFieldTaskQuestion(Boolean(currentFieldTaskQuestion())); return; }
  const reveal = event.target.closest("[data-reveal]");
  if (reveal) {
    const answer = document.getElementById(reveal.dataset.reveal);
    if (answer) {
      const showing = answer.classList.contains("hidden");
      answer.classList.toggle("hidden", !showing);
      reveal.textContent = showing ? "Sembunyikan" : "Tampilkan kembali";
      if (showing) typesetMath(answer);
    }
    return;
  }
  if (event.target.closest("[data-open-field-scores]")) { await openFieldTaskScores(); return; }
  if (event.target.closest("[data-start-game]")) { renderGame(); navigate("game"); }
}

function scrollLessonTop() {
  const top = elements.lessonContent.getBoundingClientRect().top + window.scrollY - 78;
  window.scrollTo({ top, behavior: "smooth" });
}

async function requestBankQuestions(kind, options) {
  const material = selectedMaterial();
  const topic = selectedTopic();
  const response = await apiPost({
    action: "allocateQuestions",
    pin: state.teacherPin,
    classId: state.activeClassId,
    materialId: material?.ID_MATERI || "",
    topicId: topic?.ID_SUBMATERI || "",
    kind: kind,
    count: Number(options?.count || 1),
    students: options?.students || [],
    forceNew: Boolean(options?.forceNew),
  });
  if (!response?.ok) throw new Error(response?.error || "Soal belum dapat diambil dari bank.");
  return response;
}

async function loadPracticeBatch() {
  if (!(await ensureTeacher())) return false;
  showLoading("Mengambil lima soal yang belum pernah dipakai…");
  try {
    const response = await requestBankQuestions("LATIHAN_BERSAMA", { count: 5 });
    state.practiceBatch = {
      classId: state.activeClassId,
      materialId: selectedMaterial()?.ID_MATERI || "",
      topicId: selectedTopic()?.ID_SUBMATERI || "",
      remaining: response.remaining,
      items: response.items || [],
    };
    renderLesson();
    scrollLessonTop();
    showToast("Lima soal latihan baru siap dikerjakan bersama.");
    return true;
  } catch (error) {
    showToast(error.message || "Soal latihan belum dapat diambil.");
    return false;
  } finally { hideLoading(); }
}

async function loadFieldTaskQuestion(forceNew) {
  if (!(await ensureTeacher())) return false;
  if (forceNew) {
    const confirmed = window.confirm(`Ganti tugas lapangan untuk ${className()}? Tugas lama tetap tercatat dalam riwayat soal.`);
    if (!confirmed) return false;
  }
  showLoading(forceNew ? "Memilih variasi tugas yang baru…" : "Menyiapkan tugas khusus kelas…");
  try {
    const response = await requestBankQuestions("TUGAS_LAPANGAN", { count: 1, forceNew: forceNew });
    const item = response.items?.[0];
    if (!item) throw new Error("Bank tugas belum memberikan soal.");
    state.fieldTaskQuestion = {
      classId: state.activeClassId,
      materialId: selectedMaterial()?.ID_MATERI || "",
      topicId: selectedTopic()?.ID_SUBMATERI || "",
      remaining: response.remaining,
      questionId: item.questionId,
      question: item.question,
      answer: item.answer || "",
    };
    renderLesson();
    scrollLessonTop();
    showToast(response.reused ? `Tugas ${className()} ditampilkan kembali.` : `Tugas baru untuk ${className()} sudah siap.`);
    return true;
  } catch (error) {
    showToast(error.message || "Tugas kelas belum dapat disiapkan.");
    return false;
  } finally { hideLoading(); }
}

function renderClass() {
  const students = activeStudents();
  elements.classCountLabel.textContent = `${className()} · ${students.length} murid`;
  elements.studentList.innerHTML = students.length ? students.map(function (student, index) {
    const status = state.attendance[student.ID_SISWA] || "Hadir";
    return `<div class="student-row"><span class="student-number">${escapeHtml(student.NOMOR_URUT || index + 1)}</span><span class="student-name" title="${escapeAttribute(student.NAMA_SISWA)}">${escapeHtml(student.NAMA_SISWA)}</span><select data-attendance-id="${escapeAttribute(student.ID_SISWA)}" aria-label="Kehadiran ${escapeAttribute(student.NAMA_SISWA)}">${["Hadir", "Sakit", "Izin", "Alpa", "Dispensasi"].map(function (item) { return `<option value="${item}"${status === item ? " selected" : ""}>${item}</option>`; }).join("")}</select></div>`;
  }).join("") : emptyState("人", "Nama resmi belum tersedia. Jalankan kembali Code.gs untuk membuat daftar sementara kelas 9-4 dan 9-2.");
}

function onAttendanceChange(event) {
  const select = event.target.closest("[data-attendance-id]");
  if (select) state.attendance[select.dataset.attendanceId] = select.value;
}

function markAllPresent() {
  activeStudents().forEach(function (student) { state.attendance[student.ID_SISWA] = "Hadir"; });
  renderClass();
  showToast("Semua murid ditandai hadir.");
}

async function saveAttendance() {
  if (!(await ensureTeacher())) return;
  const records = activeStudents().map(function (student) {
    return { studentId: student.ID_SISWA, studentName: student.NAMA_SISWA, status: state.attendance[student.ID_SISWA] || "Hadir", note: "" };
  });
  await performSave({ action: "saveAttendance", pin: state.teacherPin, date: elements.attendanceDate.value || localIsoDate(new Date()), classId: state.activeClassId, materialId: state.selectedMaterialId, records }, `${records.length} data absensi ${className()} disimpan.`);
}

function renderGame() {
  const material = selectedMaterial();
  const topic = selectedTopic();
  const questions = prerequisiteQuestions(topic);
  const allSaved = state.currentDraw.length > 0 && state.currentDraw.every(function (student) {
    return state.gameResults.get(student.ID_SISWA)?.status === "saved";
  });

  elements.gameTopicLabel.textContent = topic?.JUDUL || "Pilih materi dahulu";
  elements.gameMaterialLabel.textContent = material ? `${material.JUDUL} · ${className()}` : `Game prasyarat · ${className()}`;
  elements.gameTimer.textContent = formatTime(Math.max(0, state.gameRemaining));
  elements.gameArena.classList.toggle("time-up", ["completing", "completed"].includes(state.gamePhase));
  elements.drawStudentsButton.classList.toggle("hidden", state.gamePhase !== "ready" && !(state.gamePhase === "completed" && allSaved));
  elements.drawStudentsButton.disabled = state.gamePhase === "drawing";
  elements.drawStudentsButton.textContent = state.gamePhase === "completed" ? "Acak murid berikutnya" : "Acak 4 murid";
  elements.finishGameButton.classList.toggle("hidden", state.gamePhase !== "active");
  elements.reviewScoresButton.classList.toggle("hidden", state.gamePhase !== "completed" || !allSaved);
  elements.continueGameButton.classList.toggle("hidden", state.gamePhase !== "completed" || !allSaved);

  const statuses = {
    ready: "Siap mengacak nama",
    drawing: "Nama dan soal baru sedang disiapkan…",
    active: "Waktu berjalan · tekan tombol saat setiap murid selesai",
    completing: "Waktu selesai · nilai akhir sedang disimpan",
    completed: allSaved ? "Semua nilai sudah masuk ke Google Sheet" : "Ada nilai yang belum tersimpan · tekan Coba lagi",
  };
  elements.gameStatus.textContent = statuses[state.gamePhase] || statuses.ready;

  elements.drawResults.innerHTML = state.currentDraw.map(function (student, index) {
    const bankQuestion = state.gameQuestions.get(student.ID_SISWA);
    const question = bankQuestion?.question || (state.gamePhase === "drawing"
      ? "Soal baru sedang disiapkan dari bank…"
      : questions[index] || questions[0] || "Soal prasyarat belum tersedia.");
    const result = state.gameResults.get(student.ID_SISWA);
    let footer;
    if (result?.status === "saving") {
      footer = `<div class="student-result saving">Menyimpan nilai ${result.score}…</div>`;
    } else if (result?.status === "saved") {
      footer = `<div class="student-result"><span>Tersimpan</span><strong class="student-score">${result.score}</strong></div>`;
    } else if (result?.status === "failed") {
      footer = `<div class="student-result failed">Gagal tersimpan</div><button class="secondary-button" type="button" data-retry-student="${escapeAttribute(student.ID_SISWA)}">Coba lagi</button>`;
    } else if (state.gamePhase === "active") {
      footer = `<div class="student-finish-actions"><button type="button" data-finish-student="${escapeAttribute(student.ID_SISWA)}" data-correct="true">Selesai & benar</button><button type="button" data-finish-student="${escapeAttribute(student.ID_SISWA)}" data-correct="false">Belum benar</button></div>`;
    } else {
      footer = `<div class="student-result saving">${state.gamePhase === "drawing" ? "Mengacak…" : "Menunggu…"}</div>`;
    }
    return `<article class="draw-question-card" data-draw-student="${escapeAttribute(student.ID_SISWA)}"><header><span>${index + 1}</span><strong title="${escapeAttribute(student.NAMA_SISWA)}">${escapeHtml(student.NAMA_SISWA)}</strong></header>${bankQuestion?.questionId ? `<small class="question-code">${escapeHtml(bankQuestion.questionId)}</small>` : ""}<div class="student-question math-content">${mathText(question)}</div>${footer}</article>`;
  }).join("");
  typesetMath(elements.gameArena);
}

async function drawStudents() {
  if (!selectedTopic()) { showToast("Pilih materi dan submateri terlebih dahulu."); return; }
  if (!(await ensureTeacher())) return;
  const available = activeStudents().filter(function (student) {
    return (state.attendance[student.ID_SISWA] || "Hadir") === "Hadir" && !state.drawnStudentIds.has(student.ID_SISWA);
  });
  if (!available.length) { showToast("Semua murid hadir sudah mendapat giliran. Tekan Putaran baru untuk mengulang."); return; }
  resetGame(false);
  state.gamePhase = "drawing";
  const count = Math.min(4, available.length);
  let turns = 0;
  const rolling = window.setInterval(function () {
    state.currentDraw = shuffle(available).slice(0, count);
    renderGame();
    turns += 1;
    if (turns >= 12) {
      window.clearInterval(rolling);
      state.currentDraw = shuffle(available).slice(0, count);
      state.gamePhase = "drawing";
      renderGame();
      prepareGameQuestions();
    }
  }, 90);
}

async function prepareGameQuestions() {
  try {
    const response = await requestBankQuestions("PRASYARAT", {
      students: state.currentDraw.map(function (student) {
        return { studentId: student.ID_SISWA, studentName: student.NAMA_SISWA };
      }),
    });
    state.gameQuestions = new Map((response.items || []).map(function (item) {
      return [item.studentId, item];
    }));
    if (state.gameQuestions.size !== state.currentDraw.length) throw new Error("Jumlah soal dari bank belum lengkap.");
    state.gamePhase = "active";
    startCountdown();
    renderGame();
    showToast(`Soal unik dibagikan. Masih ada ${response.remaining} soal yang belum pernah dipakai.`);
  } catch (error) {
    state.gamePhase = "ready";
    state.currentDraw = [];
    state.gameQuestions = new Map();
    renderGame();
    showToast(error.message || "Soal prasyarat belum dapat diambil dari bank.");
  }
}

function startCountdown() {
  stopGameTimer();
  state.gameRemaining = gameLimit();
  state.gameElapsed = 0;
  state.gameTimerId = window.setInterval(function () {
    state.gameRemaining -= 1;
    state.gameElapsed += 1;
    elements.gameTimer.textContent = formatTime(Math.max(0, state.gameRemaining));
    if (state.gameRemaining <= 0) finishGame();
  }, 1000);
}

async function finishGame() {
  if (state.gamePhase !== "active") return;
  stopGameTimer();
  state.gameRemaining = 0;
  state.gamePhase = "completing";
  const pending = state.currentDraw.filter(function (student) { return !state.gameResults.has(student.ID_SISWA); });
  renderGame();
  await Promise.all(pending.map(function (student) { return finishStudent(student.ID_SISWA, false, true); }));
  completeGameIfReady();
  showToast("Waktu selesai. Murid yang belum selesai mendapat nilai 50.");
}

function resetDrawRound() {
  state.drawnStudentIds.clear();
  resetGame(false);
  renderGame();
  showToast("Putaran baru dimulai. Semua murid hadir dapat terpilih kembali.");
}

function resetGame(render) {
  stopGameTimer();
  state.currentDraw = [];
  state.gameResults = new Map();
  state.gameQuestions = new Map();
  state.gamePhase = "ready";
  state.gameRemaining = gameLimit();
  state.gameElapsed = 0;
  if (render !== false) renderGame();
}

function stopGameTimer() {
  if (state.gameTimerId) window.clearInterval(state.gameTimerId);
  state.gameTimerId = null;
}

async function onGameClick(event) {
  const finishButton = event.target.closest("[data-finish-student]");
  if (finishButton) {
    await finishStudent(finishButton.dataset.finishStudent, finishButton.dataset.correct === "true", false);
    return;
  }
  const retryButton = event.target.closest("[data-retry-student]");
  if (retryButton) await retryDiagnostic(retryButton.dataset.retryStudent);
}

async function finishStudent(studentId, correct, fromTimeout) {
  if (state.gameResults.has(studentId)) return;
  const student = state.currentDraw.find(function (item) { return item.ID_SISWA === studentId; });
  if (!student) return;
  const score = correct ? diagnosticScoreFromTime() : 50;
  const result = { score: score, correct: correct, duration: fromTimeout ? gameLimit() : state.gameElapsed, status: "saving" };
  state.gameResults.set(studentId, result);
  renderGame();
  await saveDiagnosticResult(student, result);
  completeGameIfReady();
}

async function saveDiagnosticResult(student, result) {
  const material = selectedMaterial();
  const topic = selectedTopic();
  const index = state.currentDraw.findIndex(function (item) { return item.ID_SISWA === student.ID_SISWA; });
  const assignedQuestion = state.gameQuestions.get(student.ID_SISWA);
  const question = assignedQuestion?.question || prerequisiteQuestions(topic)[Math.max(0, index)] || "";
  try {
    const response = await apiPost({
      action: "saveDiagnostics",
      pin: state.teacherPin,
      records: [{
        id: makeId("DIAG"), date: elements.attendanceDate.value || localIsoDate(new Date()),
        classId: state.activeClassId, studentId: student.ID_SISWA, studentName: student.NAMA_SISWA,
        materialId: material?.ID_MATERI || "", topicId: topic?.ID_SUBMATERI || "",
        question: question, durationSeconds: result.duration,
        accuracy: result.correct ? 1 : 0, process: 0, timePoints: result.score,
        score: result.score,
      }],
    });
    if (!response?.ok) throw new Error(response?.error || "Nilai belum tersimpan.");
    result.status = "saved";
  } catch (error) {
    result.status = "failed";
    result.error = error.message;
  }
  state.gameResults.set(student.ID_SISWA, result);
  renderGame();
}

async function retryDiagnostic(studentId) {
  const student = state.currentDraw.find(function (item) { return item.ID_SISWA === studentId; });
  const result = state.gameResults.get(studentId);
  if (!student || !result) return;
  result.status = "saving";
  renderGame();
  await saveDiagnosticResult(student, result);
  completeGameIfReady();
}

function completeGameIfReady() {
  if (!state.currentDraw.length) return;
  const finished = state.currentDraw.every(function (student) {
    return ["saved", "failed"].includes(state.gameResults.get(student.ID_SISWA)?.status);
  });
  if (!finished) return;
  stopGameTimer();
  state.currentDraw.forEach(function (student) { state.drawnStudentIds.add(student.ID_SISWA); });
  state.gamePhase = "completed";
  renderGame();
}

function diagnosticScoreFromTime() {
  const ratio = Math.max(0, Math.min(1, state.gameRemaining / gameLimit()));
  return Math.max(50, Math.min(100, Math.round((50 + ratio * 50) / 5) * 5));
}

function continueFromGame() {
  const allSaved = state.currentDraw.length && state.currentDraw.every(function (student) { return state.gameResults.get(student.ID_SISWA)?.status === "saved"; });
  if (!allSaved) { showToast("Pastikan semua nilai sudah tersimpan terlebih dahulu."); return; }
  state.lessonStep = Math.max(state.lessonStep, 4);
  renderLesson();
  navigate("lesson");
}

async function loadAssessmentData() {
  const material = selectedMaterial();
  const topic = selectedTopic();
  const response = await apiPost({
    action: "getAssessmentData",
    pin: state.teacherPin,
    classId: state.activeClassId,
    materialId: material?.ID_MATERI || "",
    topicId: topic?.ID_SUBMATERI || "",
    semester: Number(state.data?.settings?.SEMESTER_AKTIF || 1),
  });
  if (!response?.ok) throw new Error(response?.error || "Data penilaian belum dapat dibaca.");
  state.assessmentData = {
    diagnostics: response.diagnostics || [],
    fieldTaskScores: response.fieldTaskScores || [],
  };
  return state.assessmentData;
}

async function openDiagnosticReview() {
  if (!(await ensureTeacher())) return;
  showLoading("Mengambil rekap nilai prasyarat…");
  try {
    const data = await loadAssessmentData();
    renderDiagnosticModal(data.diagnostics);
  } catch (error) {
    showToast(error.message || "Rekap nilai belum dapat dibuka.");
  } finally { hideLoading(); }
}

function bestDiagnosticsByStudent(records) {
  const best = new Map();
  (records || []).forEach(function (record) {
    const studentId = String(record.ID_SISWA || "");
    const score = Number(record.NILAI_DIAGNOSTIK);
    if (!studentId || !Number.isFinite(score)) return;
    const current = best.get(studentId);
    if (!current) {
      best.set(studentId, { score: score, attempts: 1, record: record });
      return;
    }
    current.attempts += 1;
    if (score >= current.score) {
      current.score = score;
      current.record = record;
    }
  });
  return best;
}

function diagnosticCategory(score) {
  if (Number(score) >= 85) return "jago";
  if (Number(score) >= 70) return "standar";
  return "cemen";
}

function renderDiagnosticModal(records) {
  const best = bestDiagnosticsByStudent(records);
  const groups = { jago: [], standar: [], cemen: [] };
  activeStudents().forEach(function (student) {
    const result = best.get(student.ID_SISWA);
    if (result) groups[diagnosticCategory(result.score)].push({ student: student, result: result });
  });
  Object.keys(groups).forEach(function (key) {
    groups[key].sort(function (a, b) { return b.result.score - a.result.score || Number(a.student.NOMOR_URUT) - Number(b.student.NOMOR_URUT); });
  });
  const testedIds = new Set(Array.from(best.keys()));
  const notTested = activeStudents().filter(function (student) { return !testedIds.has(student.ID_SISWA); });
  const categoryMeta = {
    jago: { label: "Jago", range: "85–100", icon: "★" },
    standar: { label: "Standar", range: "70–84", icon: "✓" },
    cemen: { label: "Cemen", range: "50–69 · perlu perbaikan", icon: "↻" },
  };
  const columns = ["jago", "standar", "cemen"].map(function (key) {
    const meta = categoryMeta[key];
    const people = groups[key];
    return `<section class="score-category category-${key}">
      <header><span>${meta.icon}</span><div><h3>${meta.label}</h3><small>${meta.range} · ${people.length} murid</small></div></header>
      <div class="score-category-list">${people.length ? people.map(function (item) {
        const remedial = key === "cemen"
          ? `<button class="mini-action-button" type="button" data-remedial-student="${escapeAttribute(item.student.ID_SISWA)}">Ulangi / Perbaiki</button>`
          : "";
        return `<article class="score-person"><div><strong>${escapeHtml(item.student.NAMA_SISWA)}</strong><small>${item.result.attempts} kali mencoba</small></div><b>${item.result.score}</b>${remedial}</article>`;
      }).join("") : `<p class="category-empty">Belum ada murid.</p>`}</div>
    </section>`;
  }).join("");

  openTeacherModal(`<div class="modal-panel modal-panel-wide">
    <header class="modal-heading"><div><p class="eyebrow">Rekap tes prasyarat</p><h2 id="teacherModalTitle">Periksa nilai · ${escapeHtml(className())}</h2><p>${escapeHtml(selectedTopic()?.JUDUL || "Submateri")}</p></div><button class="modal-close" type="button" data-close-modal aria-label="Tutup">×</button></header>
    <div class="privacy-note">Tampilan kategori ini khusus Kak Iphoel. Gunakan secara pribadi agar murid tetap percaya diri.</div>
    <div class="score-category-grid">${columns}</div>
    <details class="pending-details"><summary>Belum mengikuti tes: ${notTested.length} murid</summary><p>${notTested.length ? notTested.map(function (student) { return escapeHtml(student.NAMA_SISWA); }).join(" · ") : "Semua murid sudah memiliki nilai."}</p></details>
    <footer class="modal-actions"><button class="danger-button" type="button" data-reset-diagnostics>Reset nilai kelas & submateri ini</button><button class="primary-button" type="button" data-close-modal>Tutup</button></footer>
  </div>`);
}

async function resetDiagnosticsForCurrentTopic() {
  const topic = selectedTopic();
  const material = selectedMaterial();
  if (!topic || !material) return;
  const confirmed = window.confirm(`Hapus SEMUA nilai tes prasyarat ${className()} untuk submateri “${topic.JUDUL}”?\n\nData akan dihapus dari sheet HASIL_DIAGNOSTIK dan tidak dapat dikembalikan dari aplikasi.`);
  if (!confirmed) return;
  showLoading("Menghapus nilai demo dari Google Sheet…");
  try {
    const response = await apiPost({
      action: "deleteDiagnostics",
      pin: state.teacherPin,
      classId: state.activeClassId,
      materialId: material.ID_MATERI,
      topicId: topic.ID_SUBMATERI,
    });
    if (!response?.ok) throw new Error(response?.error || "Nilai belum dapat dihapus.");
    state.drawnStudentIds.clear();
    resetGame(false);
    renderGame();
    state.assessmentData = { diagnostics: [], fieldTaskScores: state.assessmentData?.fieldTaskScores || [] };
    renderDiagnosticModal([]);
    showToast(`${response.deleted || 0} nilai dan ${response.releasedQuestions || 0} riwayat soal berhasil dihapus.`);
  } catch (error) {
    showToast(error.message || "Nilai belum dapat dihapus.");
  } finally { hideLoading(); }
}

async function startRemedial(studentId) {
  const student = activeStudents().find(function (item) { return item.ID_SISWA === studentId; });
  if (!student) { showToast("Data murid tidak ditemukan."); return; }
  closeTeacherModal();
  resetGame(false);
  state.currentDraw = [student];
  state.gamePhase = "drawing";
  renderGame();
  navigate("game");
  showLoading("Menyiapkan soal perbaikan yang berbeda…");
  try {
    const response = await requestBankQuestions("PRASYARAT", {
      students: [{ studentId: student.ID_SISWA, studentName: student.NAMA_SISWA }],
    });
    const item = response.items?.[0];
    if (!item) throw new Error("Soal perbaikan belum tersedia.");
    state.gameQuestions = new Map([[student.ID_SISWA, item]]);
    state.gamePhase = "active";
    startCountdown();
    renderGame();
    showToast(`${student.NAMA_SISWA} mendapat soal baru untuk perbaikan.`);
  } catch (error) {
    resetGame(false);
    renderGame();
    showToast(error.message || "Soal perbaikan belum dapat disiapkan.");
  } finally { hideLoading(); }
}

async function openFieldTaskScores() {
  if (!(await ensureTeacher())) return;
  if (!currentFieldTaskQuestion() && !(await loadFieldTaskQuestion(false))) return;
  showLoading("Mengambil nilai tugas lapangan…");
  try {
    const data = await loadAssessmentData();
    renderFieldTaskModal(data.fieldTaskScores);
  } catch (error) {
    showToast(error.message || "Daftar nilai tugas belum dapat dibuka.");
  } finally { hideLoading(); }
}

function renderFieldTaskModal(records) {
  const scores = new Map((records || []).map(function (record) { return [String(record.ID_SISWA), record]; }));
  const students = activeStudents();
  const rows = students.map(function (student, index) {
    const record = scores.get(student.ID_SISWA) || {};
    const value = hasScore(record.NILAI) ? String(record.NILAI) : "";
    return `<label class="field-score-row"><span class="student-number">${escapeHtml(student.NOMOR_URUT || index + 1)}</span><strong>${escapeHtml(student.NAMA_SISWA)}</strong><input type="number" min="0" max="100" inputmode="decimal" value="${escapeAttribute(value)}" data-field-score="${escapeAttribute(student.ID_SISWA)}" aria-label="Nilai tugas ${escapeAttribute(student.NAMA_SISWA)}" /><em data-field-status>${value === "" ? "Belum dinilai" : "Sudah dinilai"}</em></label>`;
  }).join("");
  openTeacherModal(`<div class="modal-panel modal-panel-wide">
    <header class="modal-heading"><div><p class="eyebrow">Tugas lapangan</p><h2 id="teacherModalTitle">Input nilai · ${escapeHtml(className())}</h2><p>${escapeHtml(selectedTopic()?.JUDUL || "Submateri")}</p></div><button class="modal-close" type="button" data-close-modal aria-label="Tutup">×</button></header>
    <div class="task-score-summary"><strong data-field-summary>0 dinilai · ${students.length} belum dinilai</strong><span>Rata-rata seluruh tugas lapangan semester ini otomatis menjadi nilai Nontes.</span></div>
    <div class="field-score-list">${rows || emptyState("✓", "Belum ada murid pada kelas ini.")}</div>
    <footer class="modal-actions"><button class="secondary-button" type="button" data-close-modal>Batal</button><button class="primary-button" type="button" data-save-field-scores>Simpan nilai tugas</button></footer>
  </div>`);
  updateFieldScoreSummary();
}

function updateFieldScoreSummary() {
  if (elements.teacherModal.classList.contains("hidden")) return;
  const inputs = Array.from(elements.teacherModal.querySelectorAll("[data-field-score]"));
  let assessed = 0;
  inputs.forEach(function (input) {
    const filled = input.value !== "";
    if (filled) assessed += 1;
    const status = input.closest(".field-score-row")?.querySelector("[data-field-status]");
    if (status) status.textContent = filled ? "Sudah dinilai" : "Belum dinilai";
  });
  const summary = elements.teacherModal.querySelector("[data-field-summary]");
  if (summary) summary.textContent = `${assessed} dinilai · ${inputs.length - assessed} belum dinilai`;
}

async function saveFieldTaskScores() {
  const material = selectedMaterial();
  const topic = selectedTopic();
  const fieldTask = currentFieldTaskQuestion();
  const students = new Map(activeStudents().map(function (student) { return [student.ID_SISWA, student]; }));
  const records = Array.from(elements.teacherModal.querySelectorAll("[data-field-score]")).filter(function (input) {
    return input.value !== "";
  }).map(function (input) {
    const student = students.get(input.dataset.fieldScore);
    return {
      date: elements.attendanceDate.value || localIsoDate(new Date()),
      classId: state.activeClassId,
      studentId: student.ID_SISWA,
      studentName: student.NAMA_SISWA,
      semester: Number(state.data?.settings?.SEMESTER_AKTIF || 1),
      materialId: material?.ID_MATERI || "",
      topicId: topic?.ID_SUBMATERI || "",
      score: input.value,
      note: "Tugas lapangan",
      questionId: fieldTask?.questionId || "",
      question: fieldTask?.question || "",
    };
  });
  if (!records.length) { showToast("Isi minimal satu nilai sebelum menyimpan."); return; }
  showLoading("Menyimpan nilai tugas dan memperbarui Nontes…");
  try {
    const response = await apiPost({
      action: "saveFieldTaskScores",
      pin: state.teacherPin,
      classId: state.activeClassId,
      semester: Number(state.data?.settings?.SEMESTER_AKTIF || 1),
      records: records,
    });
    if (!response?.ok) throw new Error(response?.error || "Nilai tugas belum dapat disimpan.");
    closeTeacherModal();
    await loadData({ quiet: true, force: true });
    showToast(`${response.saved || records.length} nilai tugas tersimpan; Nontes sudah diperbarui.`);
  } catch (error) {
    showToast(error.message || "Nilai tugas belum dapat disimpan.");
  } finally { hideLoading(); }
}

function openTeacherModal(content) {
  elements.teacherModal.innerHTML = content;
  elements.teacherModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  window.setTimeout(function () { elements.teacherModal.querySelector("[data-close-modal]")?.focus(); }, 0);
}

function closeTeacherModal() {
  if (!elements.teacherModal) return;
  elements.teacherModal.classList.add("hidden");
  elements.teacherModal.innerHTML = "";
  document.body.classList.remove("modal-open");
}

async function onTeacherModalClick(event) {
  if (event.target === elements.teacherModal || event.target.closest("[data-close-modal]")) { closeTeacherModal(); return; }
  const remedial = event.target.closest("[data-remedial-student]");
  if (remedial) { await startRemedial(remedial.dataset.remedialStudent); return; }
  if (event.target.closest("[data-reset-diagnostics]")) { await resetDiagnosticsForCurrentTopic(); return; }
  if (event.target.closest("[data-save-field-scores]")) await saveFieldTaskScores();
}

function onTeacherModalInput(event) {
  const input = event.target.closest("[data-field-score]");
  if (!input) return;
  if (input.value !== "") input.value = String(Math.max(0, Math.min(100, Number(input.value))));
  updateFieldScoreSummary();
}

function renderGrades() {
  const weights = state.data?.weights || { NF: 15, NSLM: 35, NONTES: 15, STS: 15, SAS: 20 };
  elements.weightStrip.innerHTML = Object.entries(weights).map(function (entry) { return `<span class="weight-item"><b>${escapeHtml(entry[0])}</b> ${escapeHtml(entry[1])}%</span>`; }).join("");
  const students = activeStudents();
  const gradesByStudent = new Map(currentGrades().map(function (grade) { return [grade.ID_SISWA, grade]; }));
  elements.gradeTableBody.innerHTML = students.length ? students.map(function (student) {
    const grade = gradesByStudent.get(student.ID_SISWA) || {};
    const values = { NF: scoreValue(grade.NF), NSLM: scoreValue(grade.NSLM), NONTES: scoreValue(grade.NONTES), STS: scoreValue(grade.STS), SAS: scoreValue(grade.SAS) };
    const report = calculateReport(values, weights);
    return `<tr data-grade-student="${escapeAttribute(student.ID_SISWA)}"><td><strong>${escapeHtml(student.NAMA_SISWA)}</strong><small>${escapeHtml(student.ID_SISWA)}</small></td>${["NF", "NSLM", "NONTES", "STS", "SAS"].map(function (field) { return `<td><input class="grade-input" type="number" min="0" max="100" inputmode="decimal" data-grade-field="${field}" value="${escapeAttribute(values[field])}" aria-label="${field} ${escapeAttribute(student.NAMA_SISWA)}" /></td>`; }).join("")}<td><span class="report-score" data-report-score>${report === null ? "—" : report}</span></td></tr>`;
  }).join("") : `<tr><td colspan="7">Belum ada murid pada ${escapeHtml(className())}.</td></tr>`;
}

function onGradeInput(event) {
  const input = event.target.closest("[data-grade-field]");
  if (!input) return;
  if (input.value !== "") input.value = String(Math.max(0, Math.min(100, Number(input.value))));
  updateReportCell(input.closest("[data-grade-student]"));
}

function updateReportCell(row) {
  const values = {};
  row.querySelectorAll("[data-grade-field]").forEach(function (input) { values[input.dataset.gradeField] = input.value; });
  const report = calculateReport(values, state.data?.weights || {});
  row.querySelector("[data-report-score]").textContent = report === null ? "—" : report;
}

async function saveGrades() {
  if (!(await ensureTeacher())) return;
  const studentsById = new Map(activeStudents().map(function (student) { return [student.ID_SISWA, student]; }));
  const records = Array.from(elements.gradeTableBody.querySelectorAll("[data-grade-student]")).map(function (row) {
    const student = studentsById.get(row.dataset.gradeStudent);
    const item = { studentId: student.ID_SISWA, studentName: student.NAMA_SISWA, classId: state.activeClassId, semester: Number(state.data?.settings?.SEMESTER_AKTIF || 1), note: "" };
    row.querySelectorAll("[data-grade-field]").forEach(function (input) { item[input.dataset.gradeField] = input.value; });
    return item;
  });
  const saved = await performSave({ action: "saveGrades", pin: state.teacherPin, records }, `${records.length} data nilai ${className()} disimpan.`);
  if (saved) await loadData({ quiet: true });
}

function renderSettings() {
  elements.gasUrlInput.value = state.gasUrl;
  const unlocked = Boolean(state.teacherAnswers && state.teacherPin);
  elements.teacherState.textContent = unlocked ? "Mode guru terbuka selama halaman ini aktif" : "Mode guru terkunci";
  elements.teacherState.classList.toggle("unlocked", unlocked);
  elements.teacherModeButton.textContent = unlocked ? "Perbarui akses guru" : "Buka mode guru";
  const theme = document.body.dataset.theme;
  elements.themePicker.querySelectorAll("[data-theme-choice]").forEach(function (button) { button.classList.toggle("active", button.dataset.themeChoice === theme); });
}

function onThemeChoice(event) {
  const button = event.target.closest("[data-theme-choice]");
  if (!button) return;
  applyTheme(button.dataset.themeChoice);
  renderSettings();
}

function applyTheme(theme) {
  const allowed = ["langit", "mint", "matahari", "peach", "lavender", "rose"];
  const selected = allowed.includes(theme) ? theme : "langit";
  document.body.dataset.theme = selected;
  localStorage.setItem(MATCH9_KEYS.theme, selected);
}

function saveGasUrl() {
  const url = String(elements.gasUrlInput.value || "").trim();
  if (!isValidGasUrl(url)) { showToast("Gunakan URL Web App GAS yang valid dan berakhiran /exec."); return; }
  state.gasUrl = url;
  localStorage.setItem(MATCH9_KEYS.gasUrl, url);
  state.teacherPin = "";
  state.teacherAnswers = null;
  loadData();
}

async function openTeacherMode() {
  if (!state.gasUrl) { showToast("Sambungkan Google Sheet terlebih dahulu."); navigate("settings"); return false; }
  const pin = window.prompt("Masukkan PIN guru:");
  if (!pin) return false;
  showLoading("Memeriksa PIN guru…");
  try {
    const response = await apiPost({ action: "getTeacherData", pin: String(pin) });
    if (!response?.ok) throw new Error(response?.error || "PIN guru salah.");
    state.teacherPin = String(pin);
    state.teacherAnswers = response.answers || {};
    renderSettings();
    if (state.selectedMaterialId) renderLesson();
    showToast("Mode guru berhasil dibuka.");
    return true;
  } catch (error) {
    state.teacherPin = "";
    state.teacherAnswers = null;
    showToast(error.message || "Mode guru belum dapat dibuka.");
    return false;
  } finally { hideLoading(); }
}

async function ensureTeacher() {
  return state.teacherPin && state.teacherAnswers ? true : openTeacherMode();
}

async function performSave(payload, successMessage) {
  showLoading("Menyimpan ke Google Sheet…");
  try {
    const result = await apiPost(payload);
    if (!result?.ok) throw new Error(result?.error || "Data belum dapat disimpan.");
    showToast(successMessage);
    return true;
  } catch (error) {
    showToast(error.message || "Data belum dapat disimpan ke Google Sheet.");
    return false;
  } finally { hideLoading(); }
}

async function apiGet(action, force) {
  const url = new URL(state.gasUrl);
  url.searchParams.set("action", action);
  if (force) url.searchParams.set("refresh", "1");
  url.searchParams.set("t", String(Date.now()));
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`Koneksi GAS gagal (${response.status}).`);
  return response.json();
}

function jsonpGet(action, force) {
  return new Promise(function (resolve, reject) {
    const callback = `__match9_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const url = new URL(state.gasUrl);
    url.searchParams.set("action", action);
    if (force) url.searchParams.set("refresh", "1");
    url.searchParams.set("callback", callback);
    url.searchParams.set("t", String(Date.now()));
    const script = document.createElement("script");
    const timeout = window.setTimeout(function () { cleanup(); reject(new Error("Waktu koneksi Google Sheet habis.")); }, 15000);
    function cleanup() { window.clearTimeout(timeout); script.remove(); try { delete window[callback]; } catch (ignored) { window[callback] = undefined; } }
    window[callback] = function (data) { cleanup(); resolve(data); };
    script.onerror = function () { cleanup(); reject(new Error("Google Sheet belum dapat dibaca.")); };
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

async function apiPost(payload) {
  const response = await fetch(state.gasUrl, { method: "POST", redirect: "follow", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Penyimpanan GAS gagal (${response.status}).`);
  const text = await response.text();
  try { return JSON.parse(text); }
  catch (error) { throw new Error("Jawaban GAS tidak dapat dibaca. Deploy kembali Code.gs versi terbaru."); }
}

function activeClasses() {
  if (state.data?.classes?.length) return state.data.classes;
  const ids = Array.from(new Set((state.data?.students || []).map(function (student) { return student.ID_KELAS; }).filter(Boolean)));
  return ids.map(function (id) { return { ID_KELAS: id, NAMA_KELAS: id }; });
}

function className() {
  return activeClasses().find(function (item) { return item.ID_KELAS === state.activeClassId; })?.NAMA_KELAS || state.activeClassId || "Kelas 9-4";
}

function selectedMaterial() { return state.data?.materials?.find(function (material) { return material.ID_MATERI === state.selectedMaterialId; }) || null; }
function selectedTopic() { return selectedMaterial()?.topics?.find(function (topic) { return topic.ID_SUBMATERI === state.selectedTopicId; }) || null; }
function currentPracticeBatch() {
  const batch = state.practiceBatch;
  return batch && batch.classId === state.activeClassId && batch.materialId === state.selectedMaterialId && batch.topicId === state.selectedTopicId ? batch : null;
}
function currentFieldTaskQuestion() {
  const task = state.fieldTaskQuestion;
  return task && task.classId === state.activeClassId && task.materialId === state.selectedMaterialId && task.topicId === state.selectedTopicId ? task : null;
}
function activeStudents() { return (state.data?.students || []).filter(function (student) { return student.ID_KELAS === state.activeClassId && String(student.AKTIF).toUpperCase() !== "FALSE"; }).sort(function (a, b) { return Number(a.NOMOR_URUT || 0) - Number(b.NOMOR_URUT || 0); }); }
function currentGrades() { const semester = String(state.data?.settings?.SEMESTER_AKTIF || 1); return (state.data?.grades || []).filter(function (grade) { return grade.ID_KELAS === state.activeClassId && String(grade.SEMESTER) === semester; }); }
function gameLimit() { return Math.max(30, Number(state.data?.settings?.DURASI_GAME_DETIK || 180)); }

function calculateReport(values, weights) {
  const fields = ["NF", "NSLM", "NONTES", "STS", "SAS"];
  if (fields.some(function (field) { return !hasScore(values[field]); })) return null;
  return Math.round(fields.reduce(function (sum, field) { return sum + Number(values[field]) * Number(weights[field] || 0) / 100; }, 0));
}
function hasScore(value) { return value !== "" && value !== null && typeof value !== "undefined" && Number.isFinite(Number(value)); }
function scoreValue(value) { return hasScore(value) ? String(value) : ""; }
function splitPoints(value) { return String(value || "").split(/\||\n/).map(function (item) { return item.trim(); }).filter(Boolean); }

function prerequisiteQuestions(topic) {
  if (!topic) return [];
  const questions = [1, 2, 3, 4].map(function (number) {
    return String(topic[`SOAL_PRASYARAT_${number}`] || "").trim();
  }).filter(Boolean);
  if (questions.length) return questions;
  const legacy = String(topic.SOAL_PRASYARAT || "").trim();
  return legacy ? [legacy, legacy, legacy, legacy] : [];
}

function safeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^(\.\/|\/|https:\/\/)/i.test(url)) return url;
  return "";
}

function shuffle(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temp = result[index]; result[index] = result[randomIndex]; result[randomIndex] = temp;
  }
  return result;
}

function makeId(prefix) { return window.crypto?.randomUUID ? `${prefix}-${window.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`; }
function formatTime(seconds) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

function mathText(value) {
  const text = String(value ?? "");
  const token = /(\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\(-?\d+(?:[.,]\d+)?\s*,\s*-?\d+(?:[.,]\d+)?\)|(?:-?\d+(?:[.,]\d+)?[a-zA-Zπ]?[²³]?|[a-zA-Zπ][a-zA-Z0-9π]*[²³]?)(?:\s*[+\-−×÷=\/]\s*(?:-?\d+(?:[.,]\d+)?[a-zA-Zπ]?[²³]?|[a-zA-Zπ][a-zA-Z0-9π]*[²³]?)){1,})/g;
  let output = "";
  let last = 0;
  text.replace(token, function (match, _group, offset) {
    output += escapeHtml(text.slice(last, offset));
    if (match.startsWith("\\(") || match.startsWith("\\[")) output += escapeHtml(match);
    else output += `\\(${escapeHtml(toTex(match))}\\)`;
    last = offset + match.length;
    return match;
  });
  output += escapeHtml(text.slice(last));
  return output.replace(/\n/g, "<br>");
}

function toTex(value) {
  return String(value).replace(/π/g, "\\pi ").replace(/×/g, "\\times ").replace(/÷/g, "\\div ").replace(/−/g, "-").replace(/²/g, "^{2}").replace(/³/g, "^{3}");
}

function typesetMath(root, attempt) {
  const tries = Number(attempt || 0);
  if (!root) return;
  if (!window.MathJax?.startup?.promise || !window.MathJax?.typesetPromise) {
    if (tries < 25) window.setTimeout(function () { typesetMath(root, tries + 1); }, 160);
    return;
  }
  window.MathJax.startup.promise.then(function () {
    if (window.MathJax.typesetClear) window.MathJax.typesetClear([root]);
    return window.MathJax.typesetPromise([root]);
  }).catch(function () { /* teks biasa tetap dapat dibaca jika CDN sedang bermasalah */ });
}

function setConnection(mode, text) { elements.connectionButton.classList.remove("draft", "connected", "error"); elements.connectionButton.classList.add(mode); elements.connectionText.textContent = text; }
function showLoading(text) { elements.loadingText.textContent = text || "Memuat…"; elements.loadingOverlay.classList.remove("hidden"); }
function hideLoading() { elements.loadingOverlay.classList.add("hidden"); }
let toastTimer = null;
function showToast(message) { window.clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.classList.add("show"); toastTimer = window.setTimeout(function () { elements.toast.classList.remove("show"); }, 3800); }

function readCache() { try { const parsed = JSON.parse(localStorage.getItem(MATCH9_KEYS.publicCache) || "null"); return parsed?.ok ? parsed : null; } catch (error) { return null; } }
function isValidGasUrl(value) { try { const url = new URL(value); return url.protocol === "https:" && /script\.google\.com$/i.test(url.hostname) && /\/exec\/?$/i.test(url.pathname); } catch (error) { return false; } }
function emptyState(icon, text) { return `<div class="empty-state compact"><span aria-hidden="true">${escapeHtml(icon)}</span><p>${escapeHtml(text)}</p></div>`; }
function escapeHtml(value) { return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
function escapeAttribute(value) { return escapeHtml(value).replace(/`/g, "&#096;"); }
function cssEscape(value) { return window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
