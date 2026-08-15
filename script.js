"use strict";

const MATCH9_KEYS = {
  gasUrl: "match9-gas-url-v1",
  publicCache: "match9-public-cache-v7",
  theme: "match9-theme-v1",
  queue: "match9-offline-queue-v7",
  studentSession: "match9-student-session-v7",
  presentation: "match9-presentation-v7",
};

const state = {
  gasUrl: "",
  data: null,
  publicData: null,
  teacherData: null,
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
  teacherTab: "overview",
  teacherReturnScreen: "",
  studentSession: null,
  studentPayload: null,
  installPrompt: null,
  serviceWorkerRegistration: null,
  presentationSlides: [],
  presentationIndex: 0,
  presentationStarted: false,
  practice: null,
  practiceIndex: 0,
  practiceAnswers: [],
  practiceStartedAt: 0,
  practiceMode: "GUEST",
  practiceReturnScreen: "guest",
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  bindEvents();
  setToday();
  applyTheme(localStorage.getItem(MATCH9_KEYS.theme) || "langit");
  restoreLocalSessions();
  registerServiceWorker();
  updateNetworkState();
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", updateNetworkState);
  window.addEventListener("beforeinstallprompt", handleInstallPrompt);

  const configuredUrl = String(window.MATCH9_CONFIG?.GAS_URL || "").trim();
  state.gasUrl = localStorage.getItem(MATCH9_KEYS.gasUrl) || configuredUrl;
  elements.gasUrlInput.value = state.gasUrl;

  const cached = readCache();
  if (cached) {
    state.publicData = cached;
    state.data = cached;
    prepareDataState();
  }
  renderAll();
  if (state.gasUrl) loadData({ quiet: Boolean(cached) });
  const requestedMode = new URLSearchParams(location.search).get("mode");
  if (requestedMode === "presentasi") navigate("presentation");
  if (requestedMode === "murid") navigate("student");
}

function cacheElements() {
  document.querySelectorAll("[id]").forEach(function (node) { elements[node.id] = node; });
}

function bindEvents() {
  const on = function (id, eventName, handler) {
    if (elements[id]) elements[id].addEventListener(eventName, handler);
  };
  document.querySelectorAll("[data-go]").forEach(function (button) {
    button.addEventListener("click", function () { navigate(button.dataset.go); });
  });
  on("brandButton", "click", toggleMainMenu);
  on("mainMenu", "click", closeMainMenu);
  document.addEventListener("click", function (event) {
    if (!event.target.closest(".brand-wrap")) closeMainMenu();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    closeMainMenu();
    closeTeacherModal();
  });
  on("quickPresentationButton", "click", function () { navigate("presentation"); });
  on("quickTeacherButton", "click", function () { navigate("teacher"); });
  on("menuRefreshButton", "click", function () { loadData({ force: true }); });
  on("menuUpdateButton", "click", updateApplication);
  on("installAppButton", "click", installApplication);
  on("openSummativeFromGradesButton", "click", openSummativeScores);
  on("refreshPrintFormatButton", "click", refreshPrintFormats);
  on("presentationFullscreenButton", "click", toggleFullscreen);
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  on("connectionButton", "click", function () {
    if (state.data && state.gasUrl) loadData({ force: true });
    else navigate("settings");
  });
  on("refreshButton", "click", function () { loadData({ force: true }); });
  on("lessonBackButton", "click", function () { navigate("home"); });
  on("materialList", "click", onMaterialClick);
  on("lessonContent", "click", onLessonClick);
  on("studentList", "change", onAttendanceChange);
  on("classSelect", "change", onClassChange);
  on("gradeClassSelect", "change", onClassChange);
  on("markAllPresentButton", "click", markAllPresent);
  on("saveAttendanceButton", "click", saveAttendance);
  on("openGameButton", "click", function () { renderGame(); navigate("game"); });
  on("gameBackButton", "click", function () { navigate("class"); });
  on("drawStudentsButton", "click", drawStudents);
  on("finishGameButton", "click", finishGame);
  on("resetDrawButton", "click", resetDrawRound);
  on("reviewScoresButton", "click", openDiagnosticReview);
  on("continueGameButton", "click", continueFromGame);
  on("drawResults", "click", onGameClick);
  on("teacherModal", "click", onTeacherModalClick);
  on("teacherModal", "input", onTeacherModalInput);
  on("saveUrlButton", "click", saveGasUrl);
  on("clearCacheButton", "click", function () { loadData({ force: true }); });
  on("themePicker", "click", onThemeChoice);
  on("teacherLoginForm", "submit", loginTeacher);
  on("teacherToPresentationButton", "click", function () { navigate("presentation"); });
  on("teacherRefreshButton", "click", refreshTeacherData);
  on("teacherTabs", "click", onTeacherTabClick);
  on("teacherWorkspace", "click", onTeacherWorkspaceClick);
  on("teacherWorkspace", "submit", onTeacherWorkspaceSubmit);
  on("teacherWorkspace", "change", onTeacherWorkspaceChange);
  on("presentationClassSelect", "change", onPresentationSelection);
  on("presentationMaterialSelect", "change", onPresentationSelection);
  on("presentationTopicSelect", "change", onPresentationSelection);
  on("startPresentationButton", "click", startPresentation);
  on("presentationPrevButton", "click", function () { movePresentation(-1); });
  on("presentationNextButton", "click", function () { movePresentation(1); });
  on("presentationTeacherButton", "click", function () { navigate("teacher"); });
  on("studentLoginForm", "submit", loginStudent);
  on("studentLogoutButton", "click", logoutStudent);
  on("studentTaskList", "click", onStudentTaskClick);
  on("guestMaterialSelect", "change", renderGuestTopics);
  on("guestTopicSelect", "change", renderGuestSummary);
  on("startGuestButton", "click", startGuestPractice);
  on("practiceChoices", "click", choosePracticeAnswer);
  on("practiceNextButton", "click", nextPracticeQuestion);
  on("practiceBackButton", "click", leavePractice);
  on("settingsInstallButton", "click", installApplication);
  on("settingsUpdateButton", "click", updateApplication);
  on("syncNowButton", "click", syncOfflineQueue);
}

function setToday() {
  const now = new Date();
  if (elements.attendanceDate) elements.attendanceDate.value = localIsoDate(now);
  if (elements.todayLabel) elements.todayLabel.textContent = new Intl.DateTimeFormat("id-ID", {
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
  const valid = ["home", "presentation", "teacher-login", "teacher", "student", "guest", "practice", "class", "game", "grades", "settings", "lesson"];
  if (screen === "teacher" && !state.teacherData) screen = "teacher-login";
  state.screen = valid.includes(screen) ? screen : "home";
  document.querySelectorAll(".screen").forEach(function (section) {
    section.classList.toggle("active", section.dataset.screen === state.screen);
  });
  closeMainMenu();
  if (state.screen === "class") renderClass();
  if (state.screen === "game") renderGame();
  if (state.screen === "grades") renderGrades();
  if (state.screen === "settings") renderSettings();
  if (state.screen === "presentation") renderPresentation();
  if (state.screen === "teacher") renderTeacherDashboard();
  if (state.screen === "student") {
    renderStudent();
    if (state.studentSession?.token && navigator.onLine) void refreshStudentSession(true);
  }
  if (state.screen === "guest") renderGuest();
  updateQuickActions();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleMainMenu() {
  if (!elements.mainMenu || !elements.brandButton) return;
  const willOpen = elements.mainMenu.classList.contains("hidden");
  elements.mainMenu.classList.toggle("hidden", !willOpen);
  elements.brandButton.setAttribute("aria-expanded", String(willOpen));
}

function closeMainMenu() {
  if (!elements.mainMenu || !elements.brandButton) return;
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
  if (!elements.presentationFullscreenButton) return;
  elements.presentationFullscreenButton.textContent = active ? "Keluar layar penuh" : "Layar penuh";
  elements.presentationFullscreenButton.title = active ? "Keluar dari layar penuh" : "Layar penuh";
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
    state.publicData = data;
    state.data = state.teacherData ? mergeTeacherData() : data;
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
  renderPresentationSelectors();
  renderPresentation();
  renderStudent();
  renderGuest();
  renderTeacherDashboard();
  updateQuickActions();
  if (state.selectedMaterialId) renderLesson();
}

function renderHeader() {
  const settings = state.publicData?.settings || state.data?.settings;
  elements.appName.textContent = settings?.NAMA_APLIKASI || "MATCH-9";
  elements.schoolName.textContent = settings?.NAMA_SEKOLAH || "SMPN 38 Maluku Tengah";
  elements.academicLabel.textContent = settings
    ? `${settings.TAHUN_AJARAN} · Semester ${settings.SEMESTER_AKTIF}`
    : "Materi dan nilai dalam satu layar.";
  elements.setupNotice.classList.toggle("hidden", Boolean(state.gasUrl));
  elements.defaultPinNotice.classList.toggle("hidden", !state.teacherData?.pinIsDefault);
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
  if (elements.presentationClassSelect) {
    elements.presentationClassSelect.innerHTML = options;
    elements.presentationClassSelect.value = state.activeClassId || "IX-4";
  }
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
  }).join("") : emptyState("Orang", "Nama resmi kelas ini belum tersedia. Tambahkan nama asli pada sheet SISWA; MATCH-9 tidak membuat nama contoh.");
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
    return `<div class="field-score-row field-score-v7"><span class="student-number">${escapeHtml(student.NOMOR_URUT || index + 1)}</span><strong>${escapeHtml(student.NAMA_SISWA)}</strong><input type="number" min="0" max="120" inputmode="decimal" value="${escapeAttribute(value)}" data-field-score="${escapeAttribute(student.ID_SISWA)}" aria-label="Nilai tugas ${escapeAttribute(student.NAMA_SISWA)}" /><select data-field-rubric="${escapeAttribute(student.ID_SISWA)}" aria-label="Rubrik ${escapeAttribute(student.NAMA_SISWA)}"><option value="">Rubrik</option>${["Butuh bimbingan","Cukup","Baik","Sangat baik"].map(function (label) { return `<option${String(record.RUBRIK || "") === label ? " selected" : ""}>${label}</option>`; }).join("")}</select><label class="evidence-picker">Bukti foto<input type="file" accept="image/jpeg,image/png,image/webp" data-field-evidence="${escapeAttribute(student.ID_SISWA)}" /></label><em data-field-status>${value === "" ? "Belum dinilai" : "Sudah dinilai"}${record.BUKTI_URL ? " · ada bukti" : ""}</em></div>`;
  }).join("");
  openTeacherModal(`<div class="modal-panel modal-panel-wide">
    <header class="modal-heading"><div><p class="eyebrow">Tugas lapangan</p><h2 id="teacherModalTitle">Input nilai · ${escapeHtml(className())}</h2><p>${escapeHtml(selectedTopic()?.JUDUL || "Submateri")}</p></div><button class="modal-close" type="button" data-close-modal aria-label="Tutup">×</button></header>
    <div class="task-score-summary"><strong data-field-summary>0 dinilai · ${students.length} belum dinilai</strong><span>Nilai tugas menjadi bukti utama TP. Nilai 101–120 tetap tersimpan sebagai bukti unggul, tetapi perhitungan akademik dibatasi 100.</span></div>
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
  const previous = new Map((state.teacherData?.fieldTaskScores || []).filter(function (item) {
    return item.ID_KELAS === state.activeClassId && item.ID_SUBMATERI === topic?.ID_SUBMATERI;
  }).map(function (item) { return [item.ID_SISWA, item]; }));
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
      evidenceUrl: previous.get(student.ID_SISWA)?.BUKTI_URL || "",
      rubric: elements.teacherModal.querySelector(`[data-field-rubric="${cssEscape(student.ID_SISWA)}"]`)?.value || "",
    };
  });
  if (!records.length) { showToast("Isi minimal satu nilai sebelum menyimpan."); return; }
  showLoading("Menyimpan nilai tugas dan memperbarui TP…");
  try {
    const files = Array.from(elements.teacherModal.querySelectorAll("[data-field-evidence]")).filter(function (input) { return input.files?.[0]; });
    for (const input of files) {
      const record = records.find(function (item) { return item.studentId === input.dataset.fieldEvidence; });
      if (!record) continue;
      const file = input.files[0];
      const dataUrl = await compressEvidenceImage(file);
      const upload = await apiPost({ action: "saveFieldEvidence", pin: state.teacherPin, studentId: record.studentId, topicId: record.topicId, fileName: file.name, dataUrl: dataUrl });
      if (!upload?.ok) throw new Error(upload?.error || `Bukti ${record.studentName} belum dapat disimpan.`);
      record.evidenceUrl = upload.url || "";
    }
    const response = await apiPost({
      action: "saveFieldTaskScores",
      pin: state.teacherPin,
      classId: state.activeClassId,
      semester: Number(state.data?.settings?.SEMESTER_AKTIF || 1),
      records: records,
    });
    if (!response?.ok) throw new Error(response?.error || "Nilai tugas belum dapat disimpan.");
    closeTeacherModal();
    await refreshTeacherData();
    showToast(`${response.saved || records.length} nilai tugas tersimpan; TP, LM, dan rekap sudah diperbarui.`);
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
  if (event.target.closest("[data-save-field-scores]")) { await saveFieldTaskScores(); return; }
  if (event.target.closest("[data-save-nontes]")) { await saveQuickNontes(); return; }
  if (event.target.closest("[data-save-summative]")) await saveSummativeScores();
}

function onTeacherModalInput(event) {
  const input = event.target.closest("[data-field-score]");
  if (input) {
    if (input.value !== "") input.value = String(Math.max(0, Math.min(120, Number(input.value))));
    updateFieldScoreSummary();
    return;
  }
  const extended = event.target.closest("[data-nontes-score]");
  if (extended && extended.value !== "") extended.value = String(Math.max(0, Math.min(120, Number(extended.value))));
  const summative = event.target.closest("[data-summative-field]");
  if (summative && summative.value !== "") summative.value = String(Math.max(0, Math.min(100, Number(summative.value))));
}

function renderGrades() {
  const weights = state.data?.weights || { NF: 15, NSLM: 35, NONTES: 15, STS: 15, SAS: 20 };
  elements.weightStrip.innerHTML = Object.entries(weights).map(function (entry) { return `<span class="weight-item"><b>${escapeHtml(entry[0])}</b> ${escapeHtml(entry[1])}%</span>`; }).join("");
  const students = activeStudents();
  const gradesByStudent = new Map(currentGrades().map(function (grade) { return [grade.ID_SISWA, grade]; }));
  elements.gradeTableBody.innerHTML = students.length ? students.map(function (student) {
    const grade = gradesByStudent.get(student.ID_SISWA) || {};
    const complete = grade.STATUS_KELENGKAPAN === "Lengkap";
    return `<tr class="${complete ? "grade-complete" : "grade-incomplete"}" data-grade-student="${escapeAttribute(student.ID_SISWA)}">
      <td><strong>${escapeHtml(student.NAMA_SISWA)}</strong><small>${escapeHtml(student.ID_SISWA)}</small></td>
      <td><span class="progress-pill">${escapeHtml(grade.PROGRES_TP || "0/0")}</span></td>
      ${["NF", "NSLM", "NONTES", "STS", "SAS"].map(function (field) { return `<td><span class="grade-value">${scoreOrDash(grade[field])}</span></td>`; }).join("")}
      <td><span class="grade-value">${scoreOrDash(grade.BONUS_NONTES)}</span></td>
      <td><span class="report-score">${scoreOrDash(grade.NR)}</span></td>
      <td><span class="original-score">${scoreOrDash(grade.NILAI_ASLI)}</span></td>
      <td><span class="completion-status ${complete ? "complete" : "missing"}">${escapeHtml(grade.STATUS_KELENGKAPAN || "Belum dihitung")}</span>${Number(grade.BUKTI_UNGGUL || 0) ? `<small>${escapeHtml(grade.BUKTI_UNGGUL)} bukti unggul</small>` : ""}</td>
    </tr>`;
  }).join("") : `<tr><td colspan="11">Belum ada murid pada ${escapeHtml(className())}.</td></tr>`;
}

function scoreOrDash(value) {
  return hasScore(value) ? escapeHtml(value) : "—";
}

async function openQuickNontes() {
  if (!(await ensureTeacher())) return;
  const students = activeStudents();
  const material = selectedMaterial();
  const topic = selectedTopic();
  if (!students.length) { showToast(`Belum ada murid aktif pada ${className()}.`); return; }
  const options = students.map(function (student) {
    return `<option value="${escapeAttribute(student.ID_SISWA)}">${escapeHtml(student.NOMOR_URUT)} · ${escapeHtml(student.NAMA_SISWA)}</option>`;
  }).join("");
  openTeacherModal(`<div class="modal-panel compact-score-modal">
    <header class="modal-heading"><div><p class="eyebrow">Catatan cepat</p><h2 id="teacherModalTitle">Nilai Nontes · ${escapeHtml(className())}</h2><p>${escapeHtml(topic?.JUDUL || material?.JUDUL || "Kegiatan kelas")}</p></div><button class="modal-close" type="button" data-close-modal aria-label="Tutup">×</button></header>
    <div class="quick-score-form">
      <label><span>Nama murid</span><select data-nontes-student>${options}</select></label>
      <label><span>Jenis bukti</span><select data-nontes-kind><option>Jawab lisan</option><option>Dikte</option><option>Keaktifan</option><option>Menjelaskan cara</option></select></label>
      <label><span>Nilai 0–120</span><input type="number" min="0" max="120" inputmode="decimal" data-nontes-score placeholder="Contoh: 85" /></label>
      <label><span>Catatan singkat</span><input type="text" data-nontes-note placeholder="Opsional" /></label>
    </div>
    <p class="modal-helper">Nilai 101–120 menjadi tanda bukti unggul. Nilai akademik yang dihitung tetap maksimal 100.</p>
    <footer class="modal-actions"><button class="secondary-button" type="button" data-close-modal>Batal</button><button class="primary-button" type="button" data-save-nontes>Simpan Nontes</button></footer>
  </div>`);
}

async function saveQuickNontes() {
  const studentId = elements.teacherModal.querySelector("[data-nontes-student]")?.value || "";
  const student = activeStudents().find(function (item) { return item.ID_SISWA === studentId; });
  const score = elements.teacherModal.querySelector("[data-nontes-score]")?.value || "";
  if (!student || score === "") { showToast("Pilih murid dan isi nilai terlebih dahulu."); return; }
  const kind = elements.teacherModal.querySelector("[data-nontes-kind]")?.value || "Jawab lisan";
  const note = elements.teacherModal.querySelector("[data-nontes-note]")?.value || "";
  showLoading("Menyimpan bukti jawaban murid…");
  try {
    const response = await apiPost({
      action: "saveNontes",
      pin: state.teacherPin,
      records: [{
        date: elements.attendanceDate.value || localIsoDate(new Date()),
        classId: state.activeClassId,
        studentId: student.ID_SISWA,
        studentName: student.NAMA_SISWA,
        semester: Number(state.data?.settings?.SEMESTER_AKTIF || 1),
        materialId: selectedMaterial()?.ID_MATERI || "",
        topicId: selectedTopic()?.ID_SUBMATERI || "",
        kind: kind,
        score: score,
        note: note,
      }],
    });
    if (!response?.ok) throw new Error(response?.error || "Nilai Nontes belum dapat disimpan.");
    closeTeacherModal();
    await refreshTeacherData();
    showToast(`Nilai ${kind.toLowerCase()} ${student.NAMA_SISWA} tersimpan.`);
  } catch (error) {
    showToast(error.message || "Nilai Nontes belum dapat disimpan.");
  } finally { hideLoading(); }
}

async function openSummativeScores() {
  closeMainMenu();
  if (!(await ensureTeacher())) return;
  const grades = new Map(currentGrades().map(function (grade) { return [grade.ID_SISWA, grade]; }));
  const students = activeStudents();
  const rows = students.map(function (student, index) {
    const grade = grades.get(student.ID_SISWA) || {};
    return `<div class="summative-score-row" data-summative-student="${escapeAttribute(student.ID_SISWA)}">
      <span class="student-number">${escapeHtml(student.NOMOR_URUT || index + 1)}</span>
      <strong>${escapeHtml(student.NAMA_SISWA)}</strong>
      <label><span>STS</span><input type="number" min="0" max="100" inputmode="decimal" data-summative-field="STS" value="${escapeAttribute(scoreValue(grade.STS))}" /></label>
      <label><span>SAS</span><input type="number" min="0" max="100" inputmode="decimal" data-summative-field="SAS" value="${escapeAttribute(scoreValue(grade.SAS))}" /></label>
    </div>`;
  }).join("");
  openTeacherModal(`<div class="modal-panel modal-panel-wide">
    <header class="modal-heading"><div><p class="eyebrow">Nilai Sumatif</p><h2 id="teacherModalTitle">Input STS dan SAS · ${escapeHtml(className())}</h2><p>Semester ${escapeHtml(state.data?.settings?.SEMESTER_AKTIF || 1)}</p></div><button class="modal-close" type="button" data-close-modal aria-label="Tutup">×</button></header>
    <div class="summative-score-list">${rows || emptyState("Σ", "Belum ada murid pada kelas ini.")}</div>
    <footer class="modal-actions"><button class="secondary-button" type="button" data-close-modal>Batal</button><button class="primary-button" type="button" data-save-summative>Simpan STS/SAS</button></footer>
  </div>`);
}

async function saveSummativeScores() {
  const students = new Map(activeStudents().map(function (student) { return [student.ID_SISWA, student]; }));
  const records = Array.from(elements.teacherModal.querySelectorAll("[data-summative-student]")).map(function (row) {
    const student = students.get(row.dataset.summativeStudent);
    const item = {
      studentId: student.ID_SISWA,
      studentName: student.NAMA_SISWA,
      classId: state.activeClassId,
      semester: Number(state.data?.settings?.SEMESTER_AKTIF || 1),
      note: "Input melalui MATCH-9",
    };
    row.querySelectorAll("[data-summative-field]").forEach(function (input) { item[input.dataset.summativeField] = input.value; });
    return item;
  });
  showLoading("Menyimpan STS/SAS dan menghitung ulang nilai…");
  try {
    const response = await apiPost({ action: "saveSummativeScores", pin: state.teacherPin, records: records });
    if (!response?.ok) throw new Error(response?.error || "Nilai STS/SAS belum dapat disimpan.");
    closeTeacherModal();
    await refreshTeacherData();
    navigate("grades");
    showToast(`${records.length} data STS/SAS ${className()} tersimpan.`);
  } catch (error) {
    showToast(error.message || "Nilai STS/SAS belum dapat disimpan.");
  } finally { hideLoading(); }
}

async function refreshPrintFormats() {
  if (!(await ensureTeacher())) return;
  showLoading("Menyiapkan format nilai untuk IX-2 dan IX-4…");
  try {
    const response = await apiPost({ action: "refreshPrintFormats", pin: state.teacherPin });
    if (!response?.ok) throw new Error(response?.error || "Format cetak belum dapat disiapkan.");
    await refreshTeacherData();
    showToast(`${response.count || 0} format nilai siap di Google Sheet. Pilih A4 dan lanskap saat mencetak.`);
  } catch (error) {
    showToast(error.message || "Format cetak belum dapat disiapkan.");
  } finally { hideLoading(); }
}

function renderSettings() {
  elements.gasUrlInput.value = state.gasUrl;
  const theme = document.body.dataset.theme;
  elements.themePicker.querySelectorAll("[data-theme-choice]").forEach(function (button) { button.classList.toggle("active", button.dataset.themeChoice === theme); });
  updateQueueStatus();
  if (elements.pwaStatus) elements.pwaStatus.textContent = window.matchMedia("(display-mode: standalone)").matches
    ? "MATCH-9 sudah terpasang"
    : "Dapat dipasang dari peramban yang mendukung";
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
  state.teacherData = null;
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
    state.teacherData = response;
    state.publicData = response.publicData || state.publicData;
    state.data = mergeTeacherData();
    prepareDataState();
    renderAll();
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
  return state.teacherPin && state.teacherData ? true : openTeacherMode();
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

function mergeTeacherData() {
  const publicData = state.publicData || state.teacherData?.publicData || {};
  const teacher = state.teacherData || {};
  return Object.assign({}, publicData, {
    settings: Object.assign({}, publicData.settings || {}, teacher.settings || {}),
    classes: (teacher.classes || publicData.classes || []).filter(function (item) { return String(item.AKTIF).toUpperCase() !== "FALSE"; }),
    students: teacher.students || [],
    grades: teacher.grades || [],
    tpScores: teacher.tpScores || [],
    assignments: teacher.assignments || [],
    attendance: teacher.attendance || [],
    diagnostics: teacher.diagnostics || [],
    gameResults: teacher.gameResults || [],
    fieldTaskScores: teacher.fieldTaskScores || [],
    nontes: teacher.nontes || [],
    classroomState: teacher.classroomState || [],
    pinIsDefault: Boolean(teacher.pinIsDefault),
  });
}

function updateQuickActions() {
  const inPresentation = state.screen === "presentation" || state.presentationStarted;
  if (elements.quickPresentationButton) elements.quickPresentationButton.classList.toggle("hidden", !state.presentationStarted || state.screen === "presentation");
  if (elements.quickTeacherButton) elements.quickTeacherButton.classList.toggle("hidden", !inPresentation || state.screen === "teacher");
  if (elements.installAppButton) elements.installAppButton.classList.toggle("hidden", !state.installPrompt);
}

function restoreLocalSessions() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(MATCH9_KEYS.studentSession) || "null");
    if (saved?.token && saved?.payload?.student?.ID_SISWA) {
      state.studentSession = { token: saved.token };
      state.studentPayload = saved.payload;
    }
    const presentation = JSON.parse(sessionStorage.getItem(MATCH9_KEYS.presentation) || "null");
    if (presentation) {
      state.activeClassId = presentation.classId || state.activeClassId;
      state.selectedMaterialId = presentation.materialId || state.selectedMaterialId;
      state.selectedTopicId = presentation.topicId || state.selectedTopicId;
      state.presentationIndex = Math.max(0, Number(presentation.index || 0));
      state.presentationStarted = Boolean(presentation.started);
    }
  } catch (ignored) {
    sessionStorage.removeItem(MATCH9_KEYS.studentSession);
  }
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    state.serviceWorkerRegistration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    state.serviceWorkerRegistration.addEventListener("updatefound", function () {
      const worker = state.serviceWorkerRegistration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", function () {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showToast("Versi baru MATCH-9 siap dipasang.");
      });
    });
  } catch (ignored) {
    if (elements.pwaStatus) elements.pwaStatus.textContent = "Pemasangan PWA belum didukung pada alamat ini";
  }
}

function handleInstallPrompt(event) {
  event.preventDefault();
  state.installPrompt = event;
  updateQuickActions();
  renderSettings();
}

async function installApplication() {
  if (!state.installPrompt) {
    showToast("Gunakan menu peramban 'Tambahkan ke layar utama' jika tombol pemasangan belum muncul.");
    return;
  }
  state.installPrompt.prompt();
  await state.installPrompt.userChoice;
  state.installPrompt = null;
  updateQuickActions();
  renderSettings();
}

async function updateApplication() {
  showLoading("Memeriksa pembaruan MATCH-9...");
  try {
    if (state.serviceWorkerRegistration) await state.serviceWorkerRegistration.update();
    const waiting = state.serviceWorkerRegistration?.waiting;
    if (waiting) waiting.postMessage({ type: "SKIP_WAITING" });
    await loadData({ quiet: true, force: true });
    showToast("MATCH-9 dan data Google Sheet sudah diperbarui.");
  } catch (error) {
    showToast(error.message || "Pembaruan belum dapat diperiksa.");
  } finally { hideLoading(); }
}

function updateNetworkState() {
  const offline = !navigator.onLine;
  if (elements.offlineBanner) elements.offlineBanner.classList.toggle("hidden", !offline);
  if (offline) setConnection("draft", "Mode offline");
  else if (state.publicData) setConnection("connected", "Sheet tersambung");
  updateQueueStatus();
}

async function handleOnline() {
  updateNetworkState();
  if (offlineQueue().length && state.studentSession?.token) await syncOfflineQueue();
}

function offlineQueue() {
  try { return JSON.parse(localStorage.getItem(MATCH9_KEYS.queue) || "[]"); }
  catch (ignored) { return []; }
}

function saveOfflineQueue(items) {
  localStorage.setItem(MATCH9_KEYS.queue, JSON.stringify(items.slice(-50)));
  updateQueueStatus();
}

function enqueueOfflineSubmission(payload) {
  const safePayload = Object.assign({}, payload);
  delete safePayload.token;
  const queue = offlineQueue();
  if (!queue.some(function (item) { return item.clientId === safePayload.clientId; })) queue.push(safePayload);
  saveOfflineQueue(queue);
}

function updateQueueStatus() {
  const count = offlineQueue().length;
  if (elements.queueStatus) elements.queueStatus.textContent = `${count} kiriman menunggu`;
  if (elements.syncBanner) {
    elements.syncBanner.textContent = count ? `${count} hasil tersimpan aman di perangkat dan menunggu sinkronisasi.` : "";
    elements.syncBanner.classList.toggle("hidden", !count);
  }
}

async function syncOfflineQueue() {
  const queue = offlineQueue();
  if (!queue.length) { showToast("Tidak ada kiriman yang menunggu."); return; }
  if (!navigator.onLine) { showToast("Koneksi belum tersedia. Kiriman tetap aman di perangkat."); return; }
  if (!state.studentSession?.token) { showToast("Masuk kembali sebagai murid untuk menyinkronkan kiriman."); navigate("student"); return; }
  showLoading(`Menyinkronkan ${queue.length} kiriman...`);
  try {
    const response = await apiPost({ action: "syncQueue", token: state.studentSession.token, items: queue });
    if (!response?.ok) throw new Error(response?.error || "Sinkronisasi belum berhasil.");
    const successful = new Set((response.results || []).filter(function (item) { return item.ok; }).map(function (item) { return item.clientId; }));
    saveOfflineQueue(queue.filter(function (item) { return !successful.has(item.clientId); }));
    showToast(`${successful.size} kiriman berhasil disinkronkan.`);
    if (!offlineQueue().length) await refreshStudentSession();
  } catch (error) {
    showToast(error.message || "Kiriman tetap tersimpan dan akan dicoba lagi.");
  } finally { hideLoading(); }
}

function renderPresentationSelectors() {
  if (!elements.presentationMaterialSelect) return;
  const materials = state.publicData?.materials || state.data?.materials || [];
  elements.presentationMaterialSelect.innerHTML = materials.map(function (item) {
    return `<option value="${escapeAttribute(item.ID_MATERI)}">${escapeHtml(item.KODE_LM || "Materi")} - ${escapeHtml(item.JUDUL)}</option>`;
  }).join("");
  if (materials.some(function (item) { return item.ID_MATERI === state.selectedMaterialId; })) elements.presentationMaterialSelect.value = state.selectedMaterialId;
  else if (materials[0]) state.selectedMaterialId = materials[0].ID_MATERI;
  const material = materials.find(function (item) { return item.ID_MATERI === state.selectedMaterialId; }) || materials[0];
  elements.presentationTopicSelect.innerHTML = (material?.topics || []).map(function (item) {
    return `<option value="${escapeAttribute(item.ID_SUBMATERI)}">${escapeHtml(item.JUDUL)}</option>`;
  }).join("");
  if (material?.topics?.some(function (item) { return item.ID_SUBMATERI === state.selectedTopicId; })) elements.presentationTopicSelect.value = state.selectedTopicId;
  else if (material?.topics?.[0]) state.selectedTopicId = material.topics[0].ID_SUBMATERI;
}

function onPresentationSelection(event) {
  if (event.target === elements.presentationClassSelect) state.activeClassId = event.target.value;
  if (event.target === elements.presentationMaterialSelect) {
    state.selectedMaterialId = event.target.value;
    state.selectedTopicId = "";
  }
  if (event.target === elements.presentationTopicSelect) state.selectedTopicId = event.target.value;
  prepareDataState();
  renderClassSelectors();
  renderPresentationSelectors();
  state.presentationStarted = false;
  state.presentationSlides = [];
  renderPresentation();
}

async function startPresentation() {
  if (!state.teacherData) {
    state.teacherReturnScreen = "presentation";
    navigate("teacher-login");
    showToast("Masukkan PIN guru untuk membuka Bekal Cepat Guru.");
    return;
  }
  state.presentationSlides = buildPresentationSlides();
  if (!state.presentationSlides.length) { showToast("Isi TP ini belum tersedia pada Google Sheet."); return; }
  state.presentationStarted = true;
  state.presentationIndex = Math.min(state.presentationIndex, state.presentationSlides.length - 1);
  savePresentationState();
  renderPresentation();
  try {
    await apiPost({ action: "setClassroomState", pin: state.teacherPin, classId: state.activeClassId, materialId: state.selectedMaterialId, topicId: state.selectedTopicId, mode: "PRESENTASI" });
  } catch (ignored) { /* Presentasi tetap berjalan jika pencatatan status gagal. */ }
}

function buildPresentationSlides() {
  const material = selectedMaterial();
  const topic = selectedTopic();
  if (!material || !topic) return [];
  const teacher = state.teacherAnswers?.[`${material.ID_MATERI}::${topic.ID_SUBMATERI}`] || {};
  const points = splitPoints(topic.POIN_PENTING);
  const keywords = splitPoints(topic.KATA_KUNCI);
  const examples = [1, 2, 3].filter(function (number) { return topic[`CONTOH_${number}`]; }).map(function (number) {
    return `<article class="presentation-example"><strong>Contoh ${number}</strong><div>${mathText(topic[`CONTOH_${number}`])}</div><details><summary>Cara kerja guru</summary><div>${mathText(teacher[`CARA_CONTOH_${number}`] || "Belum diisi pada Sheet.")}</div></details></article>`;
  }).join("");
  const image = safeImageUrl(topic.GAMBAR_URL);
  const bekalRows = [
    ["Tujuan", teacher.BEKAL_TUJUAN || topic.TUJUAN],
    ["Makna paling sederhana", teacher.BEKAL_ARTI_KONSEP || topic.DEFINISI_KONSEP || topic.RINGKASAN],
    ["Cara menjelaskan", teacher.BEKAL_CARA_MENJELASKAN || topic.KONTEKS_SEHARI_HARI],
    ["Urutan penyelesaian", teacher.BEKAL_URUTAN_PENYELESAIAN || teacher.CARA_CONTOH_1],
    ["Contoh singkat", teacher.BEKAL_CONTOH_SINGKAT || topic.CONTOH_1],
    ["Pertanyaan cek cepat", teacher.BEKAL_CEK_AWAL || topic.SOAL_PRASYARAT_1],
    ["Kata kunci", teacher.BEKAL_KATA_KUNCI || topic.KATA_KUNCI],
    ["Kesalahan yang diwaspadai", teacher.BEKAL_KESALAHAN_UMUM || topic.KESALAHAN_UMUM],
  ].filter(function (item) { return item[1]; });
  return [
    { kicker: "Bekal Cepat Guru", title: topic.JUDUL, tone: "teacher", html: `<div class="teacher-brief">${bekalRows.map(function (item) { return `<section><small>${escapeHtml(item[0])}</small><p>${mathText(item[1])}</p></section>`; }).join("")}</div>` },
    { kicker: "Tujuan pembelajaran", title: "Hari ini kita akan...", tone: "goal", html: `<p class="presentation-lead">${mathText(topic.TUJUAN || "Tujuan belum diisi pada Sheet.")}</p>` },
    { kicker: "Jembatan kehidupan", title: "Matematika ternyata dekat", tone: "context", html: `<div class="presentation-context"><p>${mathText(topic.KONTEKS_SEHARI_HARI || "Konteks sehari-hari belum diisi pada Sheet.")}</p>${image ? `<img src="${escapeAttribute(image)}" alt="${escapeAttribute(topic.KETERANGAN_GAMBAR || "Ilustrasi konteks matematika")}" />` : ""}</div>` },
    { kicker: "Inti konsep", title: topic.DEFINISI_KONSEP || "Apa yang perlu dipahami?", tone: "core", html: `<p class="presentation-lead">${mathText(topic.RINGKASAN || "Ringkasan belum diisi.")}</p>${points.length ? `<ul>${points.map(function (item) { return `<li>${mathText(item)}</li>`; }).join("")}</ul>` : ""}` },
    { kicker: "Rumus dan simbol", title: topic.RUMUS_PENTING || "Bahasa matematika", tone: "formula", html: `<div class="formula-panel">${mathText(topic.RUMUS_PENTING || "Rumus penting belum diisi pada Sheet.")}</div><p>${mathText(topic.ARTI_SIMBOL || "Arti simbol perlu dijelaskan dengan bahasa murid.")}</p>${keywords.length ? `<div class="keyword-row">${keywords.map(function (item) { return `<span>${mathText(item)}</span>`; }).join("")}</div>` : ""}` },
    { kicker: "Contoh bersama", title: "Lihat, tanyakan, lalu coba", tone: "example", html: examples || `<p class="presentation-lead">Contoh belum diisi pada Sheet.</p>` },
    { kicker: "Cek pemahaman", title: "Siap mencoba?", tone: "check", html: `<div class="presentation-question">${mathText(topic.LATIHAN_1 || topic.SOAL_PRASYARAT_1 || "Soal cek pemahaman belum diisi.")}</div>` },
    { kicker: "Refleksi", title: "Apa yang kita pahami?", tone: "reflect", html: `<p class="presentation-lead">${mathText(topic.REFLEKSI || "Jelaskan kembali ide utama dengan kalimatmu sendiri dan sebutkan satu penerapannya dalam kehidupan.")}</p>` },
  ];
}

function renderPresentation() {
  if (!elements.presentationStage) return;
  if (state.presentationStarted && !state.presentationSlides.length && state.teacherData) state.presentationSlides = buildPresentationSlides();
  const active = state.presentationStarted && state.presentationSlides.length;
  elements.presentationEmpty.classList.toggle("hidden", Boolean(active));
  elements.presentationStage.classList.toggle("hidden", !active);
  if (!active) return;
  const slide = state.presentationSlides[state.presentationIndex] || state.presentationSlides[0];
  elements.presentationKicker.textContent = slide.kicker;
  elements.presentationTitle.textContent = `${selectedMaterial()?.KODE_LM || "Materi"} - ${selectedTopic()?.JUDUL || "MATCH-9"}`;
  elements.presentationProgress.textContent = `${state.presentationIndex + 1} / ${state.presentationSlides.length}`;
  elements.presentationSlide.className = `math-content presentation-tone-${slide.tone || "core"}`;
  elements.presentationSlide.innerHTML = `<h1>${escapeHtml(slide.title)}</h1>${slide.html}`;
  elements.presentationPrevButton.disabled = state.presentationIndex === 0;
  elements.presentationNextButton.textContent = state.presentationIndex === state.presentationSlides.length - 1 ? "Selesai" : "Berikutnya";
  elements.presentationDots.innerHTML = state.presentationSlides.map(function (_, index) { return `<span class="${index === state.presentationIndex ? "active" : ""}"></span>`; }).join("");
  typesetMath(elements.presentationSlide);
  savePresentationState();
}

function movePresentation(delta) {
  if (!state.presentationSlides.length) return;
  if (delta > 0 && state.presentationIndex === state.presentationSlides.length - 1) {
    state.presentationStarted = false;
    state.presentationIndex = 0;
    savePresentationState();
    renderPresentation();
    showToast("Presentasi selesai. Posisi materi tetap tersimpan.");
    return;
  }
  state.presentationIndex = Math.max(0, Math.min(state.presentationSlides.length - 1, state.presentationIndex + delta));
  renderPresentation();
}

function savePresentationState() {
  sessionStorage.setItem(MATCH9_KEYS.presentation, JSON.stringify({
    classId: state.activeClassId, materialId: state.selectedMaterialId, topicId: state.selectedTopicId,
    index: state.presentationIndex, started: state.presentationStarted,
  }));
  updateQuickActions();
}

async function loginTeacher(event) {
  event.preventDefault();
  const pin = String(elements.teacherPinInput.value || "").trim();
  if (!pin) return;
  if (await authenticateTeacher(pin)) {
    elements.teacherPinInput.value = "";
    const target = state.teacherReturnScreen || "teacher";
    state.teacherReturnScreen = "";
    navigate(target);
    if (target === "presentation") await startPresentation();
  }
}

async function authenticateTeacher(pin) {
  if (!state.gasUrl) { showToast("Sambungkan Google Sheet terlebih dahulu."); navigate("settings"); return false; }
  showLoading("Membuka Ruang Guru...");
  try {
    const response = await apiPost({ action: "getTeacherData", pin: String(pin) });
    if (!response?.ok) throw new Error(response?.error || "PIN guru salah.");
    state.teacherPin = String(pin);
    state.teacherData = response;
    state.teacherAnswers = response.answers || {};
    state.publicData = response.publicData || state.publicData;
    state.data = mergeTeacherData();
    prepareDataState();
    renderAll();
    showToast("Ruang Guru berhasil dibuka.");
    return true;
  } catch (error) {
    state.teacherPin = "";
    state.teacherData = null;
    state.teacherAnswers = null;
    showToast(error.message || "PIN guru belum dapat diperiksa.");
    return false;
  } finally { hideLoading(); }
}

async function refreshTeacherData() {
  if (!state.teacherPin) { navigate("teacher-login"); return; }
  await authenticateTeacher(state.teacherPin);
}

function onTeacherTabClick(event) {
  const button = event.target.closest("[data-teacher-tab]");
  if (!button) return;
  state.teacherTab = button.dataset.teacherTab;
  renderTeacherDashboard();
}

function renderTeacherDashboard() {
  if (!elements.teacherWorkspace || !state.teacherData) return;
  const students = (state.teacherData.students || []).filter(function (item) { return String(item.AKTIF).toUpperCase() !== "FALSE"; });
  const assignments = (state.teacherData.assignments || []).filter(function (item) { return String(item.AKTIF).toUpperCase() !== "FALSE"; });
  const pendingGrades = (state.teacherData.grades || []).filter(function (item) { return String(item.STATUS_KELENGKAPAN || "").toUpperCase() !== "LENGKAP"; }).length;
  elements.teacherSubtitle.textContent = `${students.length} murid aktif di ${activeClasses().length} kelas. Data pribadi hanya tampil pada sesi ini.`;
  elements.teacherStats.innerHTML = [
    ["Murid aktif", students.length, "indigo"], ["Tugas aktif", assignments.length, "teal"],
    ["Hasil permainan", (state.teacherData.gameResults || []).length, "amber"], ["Nilai belum lengkap", pendingGrades, "rose"],
  ].map(function (item) { return `<div class="teacher-stat ${item[2]}"><strong>${escapeHtml(item[1])}</strong><span>${escapeHtml(item[0])}</span></div>`; }).join("");
  elements.teacherTabs.querySelectorAll("[data-teacher-tab]").forEach(function (button) { button.classList.toggle("active", button.dataset.teacherTab === state.teacherTab); });
  const renderers = {
    overview: renderTeacherOverview, attendance: renderTeacherAttendance, tasks: renderTeacherTasks,
    progress: renderTeacherProgress, field: renderTeacherField, nontes: renderTeacherNontes,
    summative: renderTeacherSummative, grades: renderTeacherGrades, access: renderTeacherAccess,
  };
  elements.teacherWorkspace.innerHTML = (renderers[state.teacherTab] || renderTeacherOverview)();
  typesetMath(elements.teacherWorkspace);
}

function renderTeacherOverview() {
  const current = (state.teacherData.classroomState || []).find(function (item) { return item.ID_KELAS === state.activeClassId; });
  return `<div class="teacher-panel-heading"><div><p class="eyebrow">Kendali harian</p><h2>${escapeHtml(className())}</h2></div></div>
    ${current ? `<div class="notice-card"><span class="notice-icon">Aktif</span><div><strong>Materi kelas terakhir: ${escapeHtml(current.ID_SUBMATERI || "-")}</strong><p>Diperbarui ${escapeHtml(formatDateTime(current.DIPERBARUI))}</p></div></div>` : ""}
    <div class="teacher-action-grid">
      <button type="button" data-open-screen="presentation"><span>Presentasi</span><strong>Mulai mengajar</strong></button>
      <button type="button" data-open-screen="class"><span>Absensi</span><strong>Catat kehadiran</strong></button>
      <button type="button" data-open-teacher-tab="tasks"><span>Tugas</span><strong>Buka permainan</strong></button>
      <button type="button" data-open-teacher-tab="progress"><span>Pantau</span><strong>Lihat perkembangan</strong></button>
      <button type="button" data-open-teacher-tab="nontes"><span>Nontes</span><strong>Catat jawaban lisan</strong></button>
      <button type="button" data-open-screen="grades"><span>Nilai</span><strong>Periksa rekap</strong></button>
    </div>`;
}

function teacherClassSelect(name) {
  return `<select name="${escapeAttribute(name)}">${activeClasses().map(function (item) { return `<option value="${escapeAttribute(item.ID_KELAS)}"${item.ID_KELAS === state.activeClassId ? " selected" : ""}>${escapeHtml(item.NAMA_KELAS || item.ID_KELAS)}</option>`; }).join("")}</select>`;
}

function renderTeacherAttendance() {
  const recent = (state.teacherData.attendance || []).filter(function (item) { return item.ID_KELAS === state.activeClassId; }).slice(-8).reverse();
  return `<div class="teacher-panel-heading"><div><p class="eyebrow">Kehadiran</p><h2>Absensi ${escapeHtml(className())}</h2></div><button class="primary-button" type="button" data-open-screen="class">Buka daftar kelas</button></div>
    <div class="compact-list">${recent.length ? recent.map(function (item) { return `<div><strong>${escapeHtml(item.NAMA_SISWA)}</strong><span>${escapeHtml(item.STATUS)} - ${escapeHtml(item.TANGGAL)}</span></div>`; }).join("") : `<p>Belum ada catatan absensi.</p>`}</div>`;
}

function topicOptions(selectedMaterialId, selectedTopicId) {
  return (state.publicData?.materials || []).map(function (material) {
    return `<optgroup label="${escapeAttribute(material.JUDUL)}">${(material.topics || []).map(function (topic) {
      const value = `${material.ID_MATERI}::${topic.ID_SUBMATERI}`;
      return `<option value="${escapeAttribute(value)}"${material.ID_MATERI === selectedMaterialId && topic.ID_SUBMATERI === selectedTopicId ? " selected" : ""}>${escapeHtml(topic.JUDUL)}</option>`;
    }).join("")}</optgroup>`;
  }).join("");
}

function renderTeacherTasks() {
  const assignments = (state.teacherData.assignments || []).slice().reverse();
  return `<div class="teacher-panel-heading"><div><p class="eyebrow">Bank permainan</p><h2>Buat dan buka tugas</h2></div></div>
    <form class="teacher-form" data-assignment-form>
      <label><span>Kelas</span>${teacherClassSelect("classId")}</label>
      <label class="wide"><span>Materi/TP</span><select name="topicKey" required>${topicOptions(state.selectedMaterialId, state.selectedTopicId)}</select></label>
      <label class="wide"><span>Nama tugas</span><input name="name" value="Latihan MATCH-9" maxlength="120" required /></label>
      <label><span>Jenis</span><select name="kind"><option value="PRASYARAT">Prasyarat</option><option value="LATIHAN">Latihan</option><option value="TUGAS_RUMAH">Tugas rumah</option></select></label>
      <label><span>Jumlah soal</span><input name="questionCount" type="number" min="1" max="10" value="10" /></label>
      <label><span>Maks. percobaan</span><input name="maxAttempts" type="number" min="0" max="20" value="2" /></label>
      <label><span>Batas waktu</span><input name="deadline" type="datetime-local" /></label>
      <label class="check-field"><input name="countsForTp" type="checkbox" checked /><span>Masuk sebagai bukti nilai TP</span></label>
      <button class="primary-button" type="submit">Simpan dan buka tugas</button>
    </form>
    <div class="assignment-list">${assignments.length ? assignments.map(function (item) {
      const active = String(item.AKTIF).toUpperCase() !== "FALSE" && String(item.PUBLIK).toUpperCase() !== "FALSE";
      return `<article><div><small>${escapeHtml(item.ID_KELAS)} - ${escapeHtml(item.KODE_TUGAS)}</small><strong>${escapeHtml(item.NAMA_TUGAS)}</strong><span>${escapeHtml(item.ID_SUBMATERI)} - ${escapeHtml(item.JENIS_TUGAS)} - ${escapeHtml(item.JUMLAH_SOAL)} soal</span></div><button class="${active ? "danger-button" : "secondary-button"}" type="button" data-assignment-status="${escapeAttribute(item.ID_TUGAS)}" data-active="${active ? "false" : "true"}">${active ? "Tutup" : "Buka"}</button></article>`;
    }).join("") : `<p class="empty-copy">Belum ada tugas yang dibuat.</p>`}</div>`;
}

function renderTeacherProgress() {
  const rows = (state.teacherData.gameResults || []).filter(function (item) { return !state.activeClassId || item.ID_KELAS === state.activeClassId; });
  const grouped = {};
  rows.forEach(function (item) {
    const key = `${item.ID_SISWA}::${item.ID_PERCOBAAN || item.ID_KIRIMAN_KLIEN}`;
    if (!grouped[key]) grouped[key] = { name: item.NAMA_SISWA, topic: item.ID_SUBMATERI, date: item.TANGGAL, scores: [] };
    grouped[key].scores.push(Number(item.NILAI || 0));
  });
  const attempts = Object.values(grouped).slice(-100).reverse();
  return `<div class="teacher-panel-heading"><div><p class="eyebrow">Jejak yang dapat dilacak</p><h2>Hasil permainan ${escapeHtml(className())}</h2></div></div>
    <div class="table-wrap"><table class="mini-table"><thead><tr><th>Murid</th><th>TP</th><th>Nilai</th><th>Waktu</th></tr></thead><tbody>${attempts.length ? attempts.map(function (item) { return `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.topic)}</td><td><strong>${Math.round(item.scores.reduce(function (sum, score) { return sum + score; }, 0) / item.scores.length)}</strong></td><td>${escapeHtml(formatDateTime(item.date))}</td></tr>`; }).join("") : `<tr><td colspan="4">Belum ada hasil permainan.</td></tr>`}</tbody></table></div>`;
}

function renderTeacherField() {
  const rows = (state.teacherData.fieldTaskScores || []).filter(function (item) { return item.ID_KELAS === state.activeClassId; });
  return `<div class="teacher-panel-heading"><div><p class="eyebrow">Bukti dunia nyata</p><h2>Tugas lapangan</h2><p>${rows.length} catatan penilaian tersimpan untuk ${escapeHtml(className())}.</p></div><button class="primary-button" type="button" data-field-open>Input nilai tugas lapangan</button></div><p class="helper-text">Foto bukti dibatasi 1,5 MB dan hanya disimpan di folder privat Google Drive guru.</p>`;
}

function renderTeacherNontes() {
  const rows = (state.teacherData.nontes || []).filter(function (item) { return item.ID_KELAS === state.activeClassId; });
  return `<div class="teacher-panel-heading"><div><p class="eyebrow">Jawaban spontan dan proses</p><h2>Nilai nontes</h2><p>${rows.length} bukti tersimpan untuk ${escapeHtml(className())}.</p></div><button class="primary-button" type="button" data-nontes-open>Catat jawaban murid</button></div><div class="notice-card"><span class="notice-icon">+1</span><div><strong>Bonus unggul hanya satu kali</strong><p>Bonus satu poin dihitung otomatis kepada murid dengan bukti nontes terbaik sesuai batas pada Sheet, tanpa penjumlahan ganda.</p></div></div>`;
}

function renderTeacherSummative() {
  return `<div class="teacher-panel-heading"><div><p class="eyebrow">Nilai ujian</p><h2>STS dan SAS</h2><p>Masukkan hasil ujian manual; rekap dan Nilai Rapor dihitung kembali otomatis.</p></div><button class="primary-button" type="button" data-summative-open>Input STS/SAS</button></div>`;
}

function renderTeacherGrades() {
  return `<div class="teacher-panel-heading"><div><p class="eyebrow">Format kurikulum</p><h2>Rekap dan cetak nilai</h2><p>NF, NSLM, Nontes, STS, SAS, bonus, Nilai Asli, dan NR tetap dapat ditelusuri.</p></div><div class="button-row"><button class="secondary-button" type="button" data-print-refresh>Siapkan format cetak</button><button class="primary-button" type="button" data-open-screen="grades">Buka rekap</button></div></div>`;
}

function renderTeacherAccess() {
  const students = activeStudents();
  return `<div class="teacher-panel-heading"><div><p class="eyebrow">Rahasia per murid</p><h2>Kode akses ${escapeHtml(className())}</h2><p>Bagikan hanya kepada pemiliknya. Kode baru langsung menggantikan kode lama.</p></div></div><div class="access-list">${students.length ? students.map(function (item) { return `<div><span><strong>${escapeHtml(item.NAMA_SISWA)}</strong><small>${escapeHtml(item.ID_SISWA)}</small></span><code>${escapeHtml(item.KODE_AKSES || "Belum dibuat")}</code><button class="secondary-button small" type="button" data-regenerate-code="${escapeAttribute(item.ID_SISWA)}">Ganti kode</button></div>`; }).join("") : `<p>Nama murid belum tersedia.</p>`}</div>`;
}

async function onTeacherWorkspaceClick(event) {
  const screenButton = event.target.closest("[data-open-screen]");
  if (screenButton) { navigate(screenButton.dataset.openScreen); return; }
  const tabButton = event.target.closest("[data-open-teacher-tab]");
  if (tabButton) { state.teacherTab = tabButton.dataset.openTeacherTab; renderTeacherDashboard(); return; }
  if (event.target.closest("[data-field-open]")) { await openFieldTaskScores(); return; }
  if (event.target.closest("[data-nontes-open]")) { await openQuickNontes(); return; }
  if (event.target.closest("[data-summative-open]")) { await openSummativeScores(); return; }
  if (event.target.closest("[data-print-refresh]")) { await refreshPrintFormats(); return; }
  const status = event.target.closest("[data-assignment-status]");
  if (status) {
    await teacherPost({ action: "setAssignmentStatus", assignmentId: status.dataset.assignmentStatus, active: status.dataset.active === "true", published: status.dataset.active === "true" }, "Status tugas diperbarui.");
    return;
  }
  const regenerate = event.target.closest("[data-regenerate-code]");
  if (regenerate) {
    if (!window.confirm("Ganti kode akses murid ini? Kode lama langsung tidak berlaku.")) return;
    const response = await teacherPost({ action: "regenerateAccessCode", studentId: regenerate.dataset.regenerateCode }, "Kode akses baru dibuat.");
    if (response?.ok) showToast(`Kode baru: ${response.accessCode}`);
  }
}

function onTeacherWorkspaceChange(event) {
  const classSelect = event.target.closest("select[name='classId']");
  if (classSelect) {
    state.activeClassId = classSelect.value;
    renderClassSelectors();
  }
}

async function onTeacherWorkspaceSubmit(event) {
  const form = event.target.closest("[data-assignment-form]");
  if (!form) return;
  event.preventDefault();
  const data = new FormData(form);
  const parts = String(data.get("topicKey") || "").split("::");
  const payload = {
    action: "saveAssignment", classId: data.get("classId"), materialId: parts[0], topicId: parts[1],
    name: data.get("name"), kind: data.get("kind"), questionCount: Number(data.get("questionCount") || 10),
    maxAttempts: Number(data.get("maxAttempts") || 0), deadline: data.get("deadline") ? new Date(String(data.get("deadline"))).toISOString() : "",
    countsForTp: data.get("countsForTp") === "on", published: true, active: true,
  };
  await teacherPost(payload, "Tugas berhasil dibuka untuk murid.");
}

async function teacherPost(payload, message) {
  showLoading("Menyimpan perubahan...");
  try {
    const response = await apiPost(Object.assign({}, payload, { pin: state.teacherPin }));
    if (!response?.ok) throw new Error(response?.error || "Perubahan belum dapat disimpan.");
    await refreshTeacherData();
    state.teacherTab = payload.action === "saveAssignment" || payload.action === "setAssignmentStatus" ? "tasks" : state.teacherTab;
    renderTeacherDashboard();
    if (message) showToast(message);
    return response;
  } catch (error) {
    showToast(error.message || "Perubahan belum dapat disimpan.");
    return null;
  } finally { hideLoading(); }
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

async function loginStudent(event) {
  event.preventDefault();
  if (!state.gasUrl) { showToast("Sambungkan MATCH-9 ke Google Sheet dahulu."); navigate("settings"); return; }
  const studentId = String(elements.studentIdInput.value || "").trim().toUpperCase();
  const accessCode = String(elements.studentCodeInput.value || "").trim().toUpperCase();
  showLoading("Memeriksa ID dan kode akses...");
  try {
    const response = await apiPost({ action: "studentLogin", studentId: studentId, accessCode: accessCode });
    if (!response?.ok) throw new Error(response?.error || "ID atau kode akses tidak sesuai.");
    state.studentSession = { token: response.token };
    state.studentPayload = response;
    sessionStorage.setItem(MATCH9_KEYS.studentSession, JSON.stringify({ token: response.token, payload: response }));
    elements.studentCodeInput.value = "";
    renderStudent();
    showToast(`Selamat datang, ${response.student.NAMA_SISWA}.`);
    if (offlineQueue().length && navigator.onLine) await syncOfflineQueue();
  } catch (error) {
    showToast(error.message || "Ruang murid belum dapat dibuka.");
  } finally { hideLoading(); }
}

function logoutStudent() {
  state.studentSession = null;
  state.studentPayload = null;
  sessionStorage.removeItem(MATCH9_KEYS.studentSession);
  renderStudent();
  showToast("Sesi murid pada perangkat ini sudah ditutup.");
}

function renderStudent() {
  if (!elements.studentPanel) return;
  const loggedIn = Boolean(state.studentSession?.token && state.studentPayload?.student);
  elements.studentLoginForm.classList.toggle("hidden", loggedIn);
  elements.studentPanel.classList.toggle("hidden", !loggedIn);
  if (!loggedIn) return;
  const payload = state.studentPayload;
  elements.studentName.textContent = payload.student.NAMA_SISWA;
  elements.studentClass.textContent = `${payload.student.ID_KELAS} - ID ${payload.student.ID_SISWA}`;
  const classroom = payload.classroom || {};
  const topic = findTopic(classroom.ID_MATERI, classroom.ID_SUBMATERI);
  elements.studentActiveMaterial.innerHTML = `${topic ? `<div class="student-current"><span>Materi kelas saat ini</span><strong>${escapeHtml(topic.JUDUL)}</strong><small>${escapeHtml(classroom.MODE_AKTIF || "Belajar")}</small></div>` : ""}<div class="group-role-guide"><strong>Satu HP boleh dipakai bergiliran</strong><span><b>1</b> Operator</span><span><b>2</b> Pembaca soal</span><span><b>3</b> Penghitung</span><span><b>4</b> Pemeriksa</span></div>`;
  const tasks = payload.assignments || [];
  elements.studentTaskList.innerHTML = tasks.length ? tasks.map(function (item) {
    const taskTopic = findTopic(item.ID_MATERI, item.ID_SUBMATERI);
    return `<article class="student-task-card"><div><small>${escapeHtml(item.JENIS_TUGAS)} - ${escapeHtml(item.KODE_TUGAS)}</small><strong>${escapeHtml(item.NAMA_TUGAS)}</strong><p>${escapeHtml(taskTopic?.JUDUL || item.ID_SUBMATERI)} - ${escapeHtml(item.JUMLAH_SOAL)} soal</p><span>${item.BATAS_WAKTU ? `Batas ${escapeHtml(formatDateTime(item.BATAS_WAKTU))}` : "Tanpa batas waktu"} - Maks. ${Number(item.MAKS_PERCOBAAN || 0) || "bebas"} percobaan</span></div><button class="primary-button" type="button" data-student-task="${escapeAttribute(item.ID_TUGAS)}">Mulai</button></article>`;
  }).join("") : `<div class="empty-state compact"><span>Siap</span><p>Belum ada tugas yang dibuka guru untuk kelasmu.</p></div>`;
  const results = (payload.results || []).slice().reverse();
  const grade = (payload.grades || []).slice(-1)[0];
  elements.studentResults.innerHTML = `${grade ? `<div class="private-grade"><span>Progres TP ${escapeHtml(grade.PROGRES_TP || "-")}</span><strong>${hasScore(grade.NR) ? `NR ${escapeHtml(grade.NR)}` : "Nilai rapor belum lengkap"}</strong><small>${escapeHtml(grade.STATUS_KELENGKAPAN || "")}</small></div>` : ""}<div class="result-chip-list">${results.length ? results.slice(0, 12).map(function (item) { return `<div><strong>${escapeHtml(item.score)}</strong><span>${escapeHtml(item.topicId || "Latihan")}</span><small>${escapeHtml(formatDateTime(item.date))}</small></div>`; }).join("") : `<p>Belum ada hasil permainan.</p>`}</div>`;
}

async function refreshStudentSession(quiet) {
  if (!state.studentSession?.token || !navigator.onLine) { renderStudent(); return; }
  try {
    const response = await apiPost({ action: "studentRefresh", token: state.studentSession.token });
    if (!response?.ok) throw new Error(response?.error || "Sesi murid belum dapat diperbarui.");
    state.studentPayload = response;
    sessionStorage.setItem(MATCH9_KEYS.studentSession, JSON.stringify({ token: state.studentSession.token, payload: response }));
    renderStudent();
  } catch (error) {
    if (!quiet) showToast(error.message || "Perkembangan belum dapat diperbarui.");
    if (/sesi|tidak sah|berakhir/i.test(String(error.message || ""))) logoutStudent();
  }
}

function findTopic(materialId, topicId) {
  const material = (state.publicData?.materials || []).find(function (item) { return item.ID_MATERI === materialId; });
  return material?.topics?.find(function (item) { return item.ID_SUBMATERI === topicId; }) || null;
}

async function onStudentTaskClick(event) {
  const button = event.target.closest("[data-student-task]");
  if (!button) return;
  const assignment = (state.studentPayload?.assignments || []).find(function (item) { return item.ID_TUGAS === button.dataset.studentTask; });
  if (!assignment) return;
  await startPractice({ mode: "STUDENT", assignmentId: assignment.ID_TUGAS, title: assignment.NAMA_TUGAS, returnScreen: "student" });
}

function renderGuest() {
  if (!elements.guestMaterialSelect) return;
  const materials = state.publicData?.materials || [];
  if (!elements.guestMaterialSelect.options.length || elements.guestMaterialSelect.options.length !== materials.length) {
    elements.guestMaterialSelect.innerHTML = materials.map(function (item) { return `<option value="${escapeAttribute(item.ID_MATERI)}">${escapeHtml(item.JUDUL)}</option>`; }).join("");
  }
  if (materials.some(function (item) { return item.ID_MATERI === state.selectedMaterialId; })) elements.guestMaterialSelect.value = state.selectedMaterialId;
  renderGuestTopics();
}

function renderGuestTopics() {
  if (!elements.guestMaterialSelect) return;
  const material = (state.publicData?.materials || []).find(function (item) { return item.ID_MATERI === elements.guestMaterialSelect.value; });
  const previous = elements.guestTopicSelect.value;
  elements.guestTopicSelect.innerHTML = (material?.topics || []).map(function (item) { return `<option value="${escapeAttribute(item.ID_SUBMATERI)}">${escapeHtml(item.JUDUL)}</option>`; }).join("");
  if (material?.topics?.some(function (item) { return item.ID_SUBMATERI === previous; })) elements.guestTopicSelect.value = previous;
  renderGuestSummary();
}

function renderGuestSummary() {
  if (!elements.guestMaterialSummary) return;
  const materialId = elements.guestMaterialSelect.value;
  const topicId = elements.guestTopicSelect.value;
  const topic = findTopic(materialId, topicId);
  const available = Number(state.publicData?.gameAvailability?.[topicId] || 0);
  elements.guestMaterialSummary.innerHTML = topic ? `<div class="guest-summary"><span>${available} soal permainan tersedia</span><h2>${escapeHtml(topic.JUDUL)}</h2><p>${escapeHtml(topic.RINGKASAN || topic.TUJUAN || "")}</p><small>Mode tamu tidak menyimpan nama maupun nilai.</small></div>` : emptyState("Soal", "Pilih materi untuk berlatih.");
}

async function startGuestPractice() {
  await startPractice({ mode: "GUEST", materialId: elements.guestMaterialSelect.value, topicId: elements.guestTopicSelect.value, title: findTopic(elements.guestMaterialSelect.value, elements.guestTopicSelect.value)?.JUDUL || "Latihan MATCH-9", returnScreen: "guest" });
}

async function startPractice(options) {
  if (!state.gasUrl || !navigator.onLine) { showToast("Koneksi diperlukan untuk mengambil set soal baru. Materi yang tersimpan tetap dapat dibaca offline."); return; }
  showLoading("Mengacak 10 soal yang aman...");
  try {
    const payload = {
      action: "requestPractice", mode: options.mode, token: options.mode === "STUDENT" ? state.studentSession?.token : "",
      assignmentId: options.assignmentId || "", materialId: options.materialId || "", topicId: options.topicId || "", count: 10,
    };
    const response = await apiPost(payload);
    if (!response?.ok) throw new Error(response?.error || "Soal belum dapat disiapkan.");
    state.practice = response;
    state.practiceMode = options.mode;
    state.practiceReturnScreen = options.returnScreen || (options.mode === "STUDENT" ? "student" : "guest");
    state.practiceIndex = 0;
    state.practiceAnswers = [];
    state.practiceStartedAt = Date.now();
    state.practiceSubmitted = false;
    state.practiceTitle = options.title || response.assignment?.NAMA_TUGAS || "Permainan MATCH-9";
    renderPractice();
    navigate("practice");
  } catch (error) {
    showToast(error.message || "Latihan belum dapat dimulai.");
  } finally { hideLoading(); }
}

function renderPractice() {
  if (!state.practice?.items?.length) return;
  const item = state.practice.items[state.practiceIndex];
  elements.practiceModeLabel.textContent = state.practiceMode === "GUEST" ? "Latihan tamu - tidak disimpan" : `Percobaan ${state.practice.attemptNumber || 1}`;
  elements.practiceTitle.textContent = state.practiceTitle;
  elements.practiceProgress.textContent = `${state.practiceIndex + 1} / ${state.practice.items.length}`;
  elements.practiceQuestionCode.textContent = `${item.level || "Mudah"} - ${item.questionId}`;
  elements.practiceQuestion.innerHTML = mathText(item.question);
  elements.practiceGameSkin.className = `game-skin skin-${String(item.gameType || "PILIHAN_GANDA").toLowerCase()}`;
  elements.practiceGameSkin.innerHTML = gameSkinContent(item.gameType, state.practiceIndex);
  const selected = state.practiceAnswers[state.practiceIndex]?.answer;
  elements.practiceChoices.innerHTML = (item.choices || []).map(function (choice, index) {
    return `<button type="button" class="choice-button${String(choice) === String(selected) ? " selected" : ""}" data-practice-choice="${escapeAttribute(choice)}"><span>${String.fromCharCode(65 + index)}</span><b>${mathText(choice)}</b></button>`;
  }).join("");
  elements.practiceFeedback.classList.add("hidden");
  elements.practiceFeedback.innerHTML = "";
  elements.practiceNextButton.classList.toggle("hidden", typeof selected === "undefined");
  elements.practiceNextButton.textContent = state.practiceIndex === state.practice.items.length - 1 ? "Kirim jawaban" : "Soal berikutnya";
  typesetMath(elements.practiceCard);
}

function gameSkinContent(type, index) {
  const labels = {
    NELAYAN: ["Perahu menuju jawaban", "Pilih hasil tangkapan yang benar"],
    RINTANGAN: ["Lewati rintangan", "Jawaban benar membuka jalan"],
    TARGET: ["Bidik sasaran", "Pilih target jawaban yang tepat"],
    URUTAN: ["Susun langkah", "Temukan urutan yang paling tepat"],
    MENCOCOKKAN: ["Pasangkan ide", "Cari pasangan matematika yang sesuai"],
    BENAR_SALAH: ["Uji pernyataan", "Tentukan benar atau salah"],
    PILIHAN_GANDA: ["Misi matematika", "Pilih satu jawaban terbaik"],
  };
  const item = labels[String(type || "").toUpperCase()] || labels.PILIHAN_GANDA;
  return `<span>${index + 1}</span><div><strong>${escapeHtml(item[0])}</strong><small>${escapeHtml(item[1])}</small></div>`;
}

function choosePracticeAnswer(event) {
  if (state.practiceSubmitted) return;
  const button = event.target.closest("[data-practice-choice]");
  if (!button) return;
  const item = state.practice.items[state.practiceIndex];
  state.practiceAnswers[state.practiceIndex] = { questionId: item.questionId, answer: button.dataset.practiceChoice };
  renderPractice();
}

async function nextPracticeQuestion() {
  if (state.practiceSubmitted) { leavePractice(); return; }
  if (!state.practiceAnswers[state.practiceIndex]) return;
  if (state.practiceIndex < state.practice.items.length - 1) {
    state.practiceIndex += 1;
    renderPractice();
    return;
  }
  await submitPracticeAnswers();
}

async function submitPracticeAnswers() {
  const payload = {
    action: "submitPractice", mode: state.practiceMode, token: state.practiceMode === "STUDENT" ? state.studentSession?.token : "",
    clientId: makeId("M9KIRIM"), attemptId: state.practice.attemptId, attemptTicket: state.practice.attemptTicket, attemptNumber: state.practice.attemptNumber || 1,
    assignmentId: state.practice.assignment?.ID_TUGAS || "", materialId: state.practice.materialId, topicId: state.practice.topicId,
    semester: Number(state.publicData?.settings?.SEMESTER_AKTIF || 1), activityKind: state.practice.assignment?.JENIS_TUGAS || "LATIHAN",
    durationSeconds: Math.max(1, Math.round((Date.now() - state.practiceStartedAt) / 1000)), answers: state.practiceAnswers,
  };
  showLoading("Memeriksa jawaban...");
  try {
    if (!navigator.onLine && state.practiceMode === "STUDENT") throw new Error("OFFLINE_QUEUE");
    const response = await apiPost(payload);
    if (!response?.ok) throw new Error(response?.error || "Jawaban belum dapat diperiksa.");
    showPracticeResult(response);
  } catch (error) {
    if (state.practiceMode === "STUDENT") {
      enqueueOfflineSubmission(payload);
      showQueuedPracticeResult();
    } else {
      showToast("Mode tamu perlu koneksi untuk memeriksa jawaban.");
    }
  } finally { hideLoading(); }
}

function showPracticeResult(response) {
  state.practiceSubmitted = true;
  const feedback = response.feedback || [];
  elements.practiceQuestionCode.textContent = response.saved ? "Tersimpan di Google Sheet" : "Mode latihan/tamu";
  elements.practiceQuestion.innerHTML = `<span class="score-orb">${escapeHtml(response.score)}</span><br />Nilai permainanmu`;
  elements.practiceGameSkin.innerHTML = `<span>✓</span><div><strong>${response.score >= 80 ? "Hebat, teruskan!" : "Bagus, mari perbaiki lagi."}</strong><small>${feedback.filter(function (item) { return item.correct; }).length} dari ${feedback.length} jawaban benar</small></div>`;
  elements.practiceChoices.innerHTML = `<div class="feedback-list">${feedback.map(function (item, index) { return `<details class="${item.correct ? "correct" : "wrong"}"><summary>Soal ${index + 1} - ${item.correct ? "Benar" : "Perlu diperbaiki"}</summary><p>Jawaban benar: ${mathText(item.correctAnswer)}</p><p>${mathText(item.explanation)}</p></details>`; }).join("")}</div>`;
  elements.practiceFeedback.classList.add("hidden");
  elements.practiceNextButton.classList.remove("hidden");
  elements.practiceNextButton.textContent = "Selesai";
  if (state.practiceMode === "STUDENT") {
    const result = { attemptId: state.practice.attemptId, taskId: state.practice.assignment?.ID_TUGAS || "", topicId: state.practice.topicId, date: new Date().toISOString(), score: response.score };
    state.studentPayload.results = (state.studentPayload.results || []).concat([result]);
    sessionStorage.setItem(MATCH9_KEYS.studentSession, JSON.stringify({ token: state.studentSession.token, payload: state.studentPayload }));
  }
  typesetMath(elements.practiceCard);
}

function showQueuedPracticeResult() {
  state.practiceSubmitted = true;
  elements.practiceQuestionCode.textContent = "Menunggu sinkronisasi";
  elements.practiceQuestion.textContent = "Jawaban sudah aman di perangkat ini";
  elements.practiceChoices.innerHTML = `<div class="notice-card"><span class="notice-icon">Offline</span><div><strong>Jangan khawatir</strong><p>Nilai akan dihitung oleh server saat internet kembali. ID pengiriman unik mencegah nilai tercatat dua kali.</p></div></div>`;
  elements.practiceNextButton.classList.remove("hidden");
  elements.practiceNextButton.textContent = "Selesai";
}

function leavePractice() {
  const target = state.practiceReturnScreen || "home";
  state.practice = null;
  navigate(target);
  if (target === "student") renderStudent();
}

function compressEvidenceImage(file) {
  return new Promise(function (resolve, reject) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type || "")) { reject(new Error("Bukti harus berupa JPG, PNG, atau WebP.")); return; }
    const reader = new FileReader();
    reader.onerror = function () { reject(new Error("Bukti foto belum dapat dibaca.")); };
    reader.onload = function () {
      const source = String(reader.result || "");
      if (file.size <= 1150000) { resolve(source); return; }
      const image = new Image();
      image.onerror = function () { reject(new Error("Bukti foto tidak dapat diproses.")); };
      image.onload = function () {
        const limit = 1500;
        const scale = Math.min(1, limit / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .76));
      };
      image.src = source;
    };
    reader.readAsDataURL(file);
  });
}
