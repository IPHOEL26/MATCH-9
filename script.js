"use strict";

const MATCH9_KEYS = {
  gasUrl: "match9-gas-url-v1",
  publicCache: "match9-public-cache-v2",
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
    "gameQuestionPanel", "gameQuestion", "drawStudentsButton", "finishGameButton",
    "resetDrawButton", "drawResults", "weightStrip", "gradeTableBody", "saveGradesButton",
    "gasUrlInput", "saveUrlButton", "clearCacheButton", "teacherModeButton", "teacherState",
    "themePicker", "loadingOverlay", "loadingText", "toast", "brandButton",
  ].forEach(function (id) { elements[id] = document.getElementById(id); });
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach(function (button) {
    button.addEventListener("click", function () { navigate(button.dataset.go); });
  });
  elements.brandButton.addEventListener("click", function () { navigate("home"); });
  elements.connectionButton.addEventListener("click", function () {
    if (state.data && state.gasUrl) loadData();
    else navigate("settings");
  });
  elements.refreshButton.addEventListener("click", function () { loadData(); });
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
  elements.drawResults.addEventListener("click", onGameClick);
  elements.gradeTableBody.addEventListener("input", onGradeInput);
  elements.saveGradesButton.addEventListener("click", saveGrades);
  elements.saveUrlButton.addEventListener("click", saveGasUrl);
  elements.clearCacheButton.addEventListener("click", function () { loadData(); });
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
  document.querySelectorAll(".bottom-nav [data-go]").forEach(function (button) {
    const homeActive = state.screen === "lesson" && button.dataset.go === "home";
    const classActive = state.screen === "game" && button.dataset.go === "class";
    button.classList.toggle("active", button.dataset.go === state.screen || homeActive || classActive);
  });
  if (state.screen === "class") renderClass();
  if (state.screen === "game") renderGame();
  if (state.screen === "grades") renderGrades();
  if (state.screen === "settings") renderSettings();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadData(options) {
  const quiet = Boolean(options?.quiet);
  if (!state.gasUrl) {
    setConnection("draft", "Belum tersambung");
    elements.setupNotice.classList.remove("hidden");
    if (!quiet) showToast("Tempel URL Web App GAS melalui menu Atur.");
    return;
  }
  if (!quiet) showLoading("Mengambil materi dari Google Sheet…");
  try {
    let data;
    try { data = await apiGet("bootstrap"); }
    catch (fetchError) { data = await jsonpGet("bootstrap"); }
    if (!data?.ok) throw new Error(data?.error || "Data Google Sheet belum dapat dibaca.");
    state.data = data;
    localStorage.setItem(MATCH9_KEYS.publicCache, JSON.stringify(data));
    prepareDataState();
    renderAll();
    setConnection("connected", "Sheet tersambung");
    if (!quiet) showToast("Materi, kelas, dan nilai berhasil dimuat.");
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
      <button class="primary-button" type="button" data-stage-next${state.lessonStep === stages.length - 1 ? " disabled" : ""}>Lanjut →</button>
    </div>`;
  typesetMath(elements.lessonContent);
}

function lessonStages(topic, teacher) {
  const points = splitPoints(topic.POIN_PENTING);
  const stages = [
    {
      kicker: "Tujuan pembelajaran", icon: "◎", title: topic.JUDUL,
      html: `<p class="stage-lead">${mathText(topic.TUJUAN || "Tujuan pembelajaran belum diisi.")}</p>`,
    },
    {
      kicker: "Hubungan dengan kehidupan", icon: "⌂", title: "Dari pengalaman nyata ke matematika",
      html: `<p class="stage-lead">${mathText(topic.KONTEKS_SEHARI_HARI || dailyFallback())}</p>`,
    },
    {
      kicker: "Penjelasan singkat", icon: "∑", title: "Inti materi",
      html: `<p class="stage-lead">${mathText(topic.RINGKASAN || "Ringkasan belum diisi.")}</p>${points.length ? `<ul class="large-key-list">${points.map(function (point) { return `<li>${mathText(point)}</li>`; }).join("")}</ul>` : ""}`,
    },
    {
      kicker: "Tes prasyarat", icon: "?", title: "Soal pengantar",
      html: `<div class="focus-question">${mathText(topic.SOAL_PRASYARAT || "Soal prasyarat belum diisi.")}</div>${answerControl("prerequisite-answer", teacher?.JAWABAN_PRASYARAT || "", "Lihat jawaban")}`,
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
  [1, 2, 3].forEach(function (number) {
    if (!topic[`LATIHAN_${number}`]) return;
    stages.push({
      kicker: `Latihan siswa ${number}`, icon: "✓", title: `Kerjakan latihan ${number}`,
      html: `<div class="focus-question">${mathText(topic[`LATIHAN_${number}`])}</div>${answerControl("practice-" + number, teacher?.[`JAWABAN_${number}`] || "", "Lihat jawaban guru")}`,
    });
  });
  stages.push({
    kicker: "Tugas lapangan", icon: "⌖", title: "Matematika di sekitar kita",
    html: `<div class="focus-question field-task">${mathText(topic.PR || "Tugas lapangan belum diisi.")}</div>${answerControl("homework-answer", teacher?.JAWABAN_PR || "", "Lihat pedoman penilaian")}`,
  });
  return stages;
}

function dailyFallback() {
  return "Cari benda, kegiatan, atau persoalan di sekitar rumah dan sekolah yang dapat dijelaskan menggunakan ide pada materi ini.";
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
    resetGame(false);
    renderLesson();
    return;
  }
  if (event.target.closest("[data-stage-prev]")) { state.lessonStep -= 1; renderLesson(); scrollLessonTop(); return; }
  if (event.target.closest("[data-stage-next]")) { state.lessonStep += 1; renderLesson(); scrollLessonTop(); return; }
  if (event.target.closest("[data-unlock-teacher]")) { await openTeacherMode(); return; }
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
  if (event.target.closest("[data-start-game]")) { renderGame(); navigate("game"); }
}

function scrollLessonTop() {
  const top = elements.lessonContent.getBoundingClientRect().top + window.scrollY - 78;
  window.scrollTo({ top, behavior: "smooth" });
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
  elements.gameTopicLabel.textContent = topic?.JUDUL || "Pilih materi dahulu";
  elements.gameMaterialLabel.textContent = material ? `${material.JUDUL} · ${className()}` : `Game prasyarat · ${className()}`;
  elements.gameTimer.textContent = formatTime(state.gameRemaining);
  elements.gameArena.classList.toggle("time-up", state.gamePhase === "scoring");
  elements.gameQuestionPanel.classList.toggle("hidden", state.gamePhase !== "active");
  elements.drawStudentsButton.classList.toggle("hidden", !["ready", "saved"].includes(state.gamePhase));
  elements.drawStudentsButton.disabled = state.gamePhase === "drawing";
  elements.drawStudentsButton.textContent = state.gamePhase === "saved" ? "Acak 4 murid berikutnya" : "Acak 4 murid";
  elements.finishGameButton.classList.toggle("hidden", state.gamePhase !== "active");

  if (state.gamePhase === "ready") elements.gameStatus.textContent = "Siap mengacak nama";
  if (state.gamePhase === "drawing") elements.gameStatus.textContent = "Nama sedang diacak…";
  if (state.gamePhase === "active") elements.gameStatus.textContent = "Waktu berjalan · murid mengerjakan di depan kelas";
  if (state.gamePhase === "scoring") elements.gameStatus.textContent = "Waktu selesai · soal dikunci · masukkan nilai 50–100";
  if (state.gamePhase === "saved") elements.gameStatus.textContent = "Hasil tersimpan · lanjutkan ke empat murid berikutnya";

  elements.gameQuestion.innerHTML = mathText(topic?.SOAL_PRASYARAT || "Soal prasyarat belum tersedia.");
  if (["ready", "saved"].includes(state.gamePhase) && !state.currentDraw.length) {
    elements.drawResults.innerHTML = "";
  } else if (state.gamePhase === "drawing" || state.gamePhase === "active") {
    elements.drawResults.innerHTML = state.currentDraw.map(function (student, index) {
      return `<div class="draw-name-card"><span>${index + 1}</span><strong>${escapeHtml(student.NAMA_SISWA)}</strong></div>`;
    }).join("");
  } else if (state.gamePhase === "scoring") {
    elements.drawResults.innerHTML = `${state.currentDraw.map(function (student, index) {
      return `<div class="draw-score-card" data-draw-student="${escapeAttribute(student.ID_SISWA)}"><div><span>${index + 1}</span><strong>${escapeHtml(student.NAMA_SISWA)}</strong></div><label>Nilai<select data-score="diagnostic">${[50, 60, 70, 80, 90, 100].map(function (score) { return `<option value="${score}"${score === 80 ? " selected" : ""}>${score}</option>`; }).join("")}</select></label></div>`;
    }).join("")}<button class="light-button save-game-button" type="button" data-save-game>Simpan 4 nilai ke Google Sheet</button>`;
  }
  typesetMath(elements.gameArena);
}

function drawStudents() {
  const available = activeStudents().filter(function (student) {
    return (state.attendance[student.ID_SISWA] || "Hadir") === "Hadir" && !state.drawnStudentIds.has(student.ID_SISWA);
  });
  if (!selectedTopic()) { showToast("Pilih materi dan submateri terlebih dahulu."); return; }
  if (available.length < 4) { showToast(available.length ? "Murid tersisa kurang dari empat. Tekan Putaran baru." : "Semua murid hadir sudah mendapat giliran."); return; }
  resetGame(false);
  state.gamePhase = "drawing";
  let turns = 0;
  const rolling = window.setInterval(function () {
    state.currentDraw = shuffle(available).slice(0, 4);
    renderGame();
    turns += 1;
    if (turns >= 12) {
      window.clearInterval(rolling);
      state.currentDraw = shuffle(available).slice(0, 4);
      state.gamePhase = "active";
      startCountdown();
      renderGame();
    }
  }, 90);
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

function finishGame() {
  if (state.gamePhase !== "active") return;
  stopGameTimer();
  state.gamePhase = "scoring";
  state.gameRemaining = 0;
  renderGame();
  showToast("Waktu selesai. Soal sudah dikunci.");
}

function resetDrawRound() {
  state.drawnStudentIds.clear();
  resetGame(false);
  showToast("Putaran baru dimulai. Semua murid hadir dapat terpilih kembali.");
}

function resetGame(render) {
  stopGameTimer();
  state.currentDraw = [];
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
  if (!event.target.closest("[data-save-game]")) return;
  if (!(await ensureTeacher())) return;
  const material = selectedMaterial();
  const topic = selectedTopic();
  const records = state.currentDraw.map(function (student) {
    const card = elements.drawResults.querySelector(`[data-draw-student="${cssEscape(student.ID_SISWA)}"]`);
    return {
      id: makeId("DIAG"), date: elements.attendanceDate.value || localIsoDate(new Date()),
      classId: state.activeClassId, studentId: student.ID_SISWA, studentName: student.NAMA_SISWA,
      materialId: material?.ID_MATERI || "", topicId: topic?.ID_SUBMATERI || "",
      question: topic?.SOAL_PRASYARAT || "", durationSeconds: state.gameElapsed,
      accuracy: 0, process: 0, timePoints: 0,
      score: Number(card?.querySelector('[data-score="diagnostic"]')?.value || 50),
    };
  });
  const saved = await performSave({ action: "saveDiagnostics", pin: state.teacherPin, records }, "Empat nilai diagnostik berhasil disimpan sebagai referensi.");
  if (saved) {
    state.currentDraw.forEach(function (student) { state.drawnStudentIds.add(student.ID_SISWA); });
    state.currentDraw = [];
    state.gamePhase = "saved";
    state.gameRemaining = gameLimit();
    renderGame();
  }
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

async function apiGet(action) {
  const url = new URL(state.gasUrl);
  url.searchParams.set("action", action);
  url.searchParams.set("t", String(Date.now()));
  const response = await fetch(url.toString(), { method: "GET", cache: "no-store", redirect: "follow" });
  if (!response.ok) throw new Error(`Koneksi GAS gagal (${response.status}).`);
  return response.json();
}

function jsonpGet(action) {
  return new Promise(function (resolve, reject) {
    const callback = `__match9_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const url = new URL(state.gasUrl);
    url.searchParams.set("action", action);
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
