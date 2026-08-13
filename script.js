"use strict";

const MATCH9_KEYS = {
  gasUrl: "match9-gas-url-v1",
  publicCache: "match9-public-cache-v1",
};

const state = {
  gasUrl: "",
  data: null,
  screen: "home",
  selectedMaterialId: "",
  selectedTopicId: "",
  teacherPin: "",
  teacherAnswers: null,
  attendance: {},
  drawnStudentIds: new Set(),
  currentDraw: [],
  timerId: null,
  timerStartedAt: 0,
  gameDuration: 0,
};

const elements = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  bindEvents();
  setToday();

  const configuredUrl = String(window.MATCH9_CONFIG?.GAS_URL || "").trim();
  state.gasUrl = localStorage.getItem(MATCH9_KEYS.gasUrl) || configuredUrl;
  elements.gasUrlInput.value = state.gasUrl;

  const cached = readCache();
  if (cached) {
    state.data = cached;
    prepareDataState();
    renderAll();
  } else {
    renderAll();
  }

  if (state.gasUrl) loadData({ quiet: Boolean(cached) });
}

function cacheElements() {
  [
    "appName",
    "schoolName",
    "academicLabel",
    "connectionButton",
    "connectionText",
    "refreshButton",
    "setupNotice",
    "defaultPinNotice",
    "materialList",
    "homeStudentCount",
    "homeGradeCount",
    "lessonContent",
    "lessonBackButton",
    "todayLabel",
    "attendanceDate",
    "markAllPresentButton",
    "saveAttendanceButton",
    "classCountLabel",
    "studentList",
    "gameTimer",
    "drawStudentsButton",
    "resetDrawButton",
    "drawResults",
    "weightStrip",
    "gradeTableBody",
    "saveGradesButton",
    "gasUrlInput",
    "saveUrlButton",
    "clearCacheButton",
    "teacherModeButton",
    "teacherState",
    "loadingOverlay",
    "loadingText",
    "toast",
    "brandButton",
  ].forEach(function (id) {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  document.querySelectorAll("[data-go]").forEach(function (button) {
    button.addEventListener("click", function () {
      navigate(button.dataset.go);
    });
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
  elements.markAllPresentButton.addEventListener("click", markAllPresent);
  elements.saveAttendanceButton.addEventListener("click", saveAttendance);
  elements.drawStudentsButton.addEventListener("click", drawStudents);
  elements.resetDrawButton.addEventListener("click", resetDrawRound);
  elements.drawResults.addEventListener("click", onGameClick);
  elements.gradeTableBody.addEventListener("input", onGradeInput);
  elements.saveGradesButton.addEventListener("click", saveGrades);
  elements.saveUrlButton.addEventListener("click", saveGasUrl);
  elements.clearCacheButton.addEventListener("click", function () { loadData(); });
  elements.teacherModeButton.addEventListener("click", openTeacherMode);
}

function setToday() {
  const now = new Date();
  const iso = localIsoDate(now);
  elements.attendanceDate.value = iso;
  elements.todayLabel.textContent = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);
}

function localIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function navigate(screen) {
  const validScreen = ["home", "class", "grades", "settings", "lesson"].includes(screen)
    ? screen
    : "home";
  state.screen = validScreen;
  document.querySelectorAll(".screen").forEach(function (section) {
    section.classList.toggle("active", section.dataset.screen === validScreen);
  });
  document.querySelectorAll(".bottom-nav [data-go]").forEach(function (button) {
    const active = button.dataset.go === validScreen || (validScreen === "lesson" && button.dataset.go === "home");
    button.classList.toggle("active", active);
  });
  if (validScreen === "class") renderClass();
  if (validScreen === "grades") renderGrades();
  if (validScreen === "settings") renderSettings();
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
    try {
      data = await apiGet("bootstrap");
    } catch (fetchError) {
      data = await jsonpGet("bootstrap");
    }
    if (!data?.ok) throw new Error(data?.error || "Data Google Sheet belum dapat dibaca.");
    state.data = data;
    localStorage.setItem(MATCH9_KEYS.publicCache, JSON.stringify(data));
    prepareDataState();
    renderAll();
    setConnection("connected", "Sheet tersambung");
    if (!quiet) showToast("Materi dan data kelas berhasil dimuat.");
  } catch (error) {
    setConnection("error", "Koneksi gagal");
    if (!state.data) elements.setupNotice.classList.remove("hidden");
    showToast(error.message || "Belum dapat tersambung ke Google Sheet.");
  } finally {
    hideLoading();
  }
}

function prepareDataState() {
  if (!state.data) return;
  const students = activeStudents();
  students.forEach(function (student) {
    if (!state.attendance[student.ID_SISWA]) state.attendance[student.ID_SISWA] = "Hadir";
  });
  const firstMaterial = state.data.materials?.[0];
  if (!state.selectedMaterialId && firstMaterial) state.selectedMaterialId = firstMaterial.ID_MATERI;
  const material = selectedMaterial();
  if (material && !material.topics.some(function (topic) { return topic.ID_SUBMATERI === state.selectedTopicId; })) {
    state.selectedTopicId = material.topics?.[0]?.ID_SUBMATERI || "";
  }
}

function renderAll() {
  renderHeader();
  renderHome();
  renderClass();
  renderGrades();
  renderSettings();
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

function renderHome() {
  const materials = state.data?.materials || [];
  if (!materials.length) {
    elements.materialList.innerHTML = emptyState("▦", "Materi akan tampil setelah Google Sheet tersambung.");
  } else {
    elements.materialList.innerHTML = materials
      .map(function (material) {
        const accent = ["indigo", "teal", "amber", "rose"].includes(material.WARNA)
          ? material.WARNA
          : "indigo";
        const symbol = material.ID_MATERI === "SPLDV" ? "x+y" : material.ID_MATERI === "BRSL" ? "πr²" : material.ID_MATERI === "PELUANG" ? "P(A)" : "(x,y)";
        return `
          <button class="material-card accent-${accent}" type="button" data-material-id="${escapeAttribute(material.ID_MATERI)}">
            <span class="material-symbol" aria-hidden="true">${escapeHtml(symbol)}</span>
            <span class="material-copy">
              <span class="eyebrow">${escapeHtml(material.KODE_LM || "Materi")}</span>
              <strong>${escapeHtml(material.JUDUL)}</strong>
              <small>Semester ${escapeHtml(material.SEMESTER)} · ${material.topics?.length || 0} submateri</small>
            </span>
            <span class="arrow" aria-hidden="true">›</span>
          </button>`;
      })
      .join("");
  }

  const students = activeStudents();
  const completed = currentGrades().filter(function (grade) {
    return [grade.NF, grade.NSLM, grade.NONTES, grade.STS, grade.SAS].every(hasScore);
  }).length;
  elements.homeStudentCount.textContent = `${students.length} murid`;
  elements.homeGradeCount.textContent = completed ? `${completed} NR lengkap` : "Belum lengkap";
}

function onMaterialClick(event) {
  const button = event.target.closest("[data-material-id]");
  if (!button) return;
  state.selectedMaterialId = button.dataset.materialId;
  const material = selectedMaterial();
  state.selectedTopicId = material?.topics?.[0]?.ID_SUBMATERI || "";
  renderLesson();
  navigate("lesson");
}

function renderLesson() {
  const material = selectedMaterial();
  if (!material) {
    elements.lessonContent.innerHTML = emptyState("▦", "Materi belum tersedia.");
    return;
  }
  const topic = selectedTopic() || material.topics?.[0];
  if (!topic) {
    elements.lessonContent.innerHTML = `
      <div class="lesson-hero"><p class="eyebrow light">${escapeHtml(material.KODE_LM)}</p><h1>${escapeHtml(material.JUDUL)}</h1><p>${escapeHtml(material.RINGKASAN)}</p></div>
      ${emptyState("+", "Tambahkan baris submateri pada sheet " + material.NAMA_SHEET + ".")}`;
    return;
  }
  state.selectedTopicId = topic.ID_SUBMATERI;
  const teacher = state.teacherAnswers?.[`${material.ID_MATERI}::${topic.ID_SUBMATERI}`] || null;
  const points = splitPoints(topic.POIN_PENTING);
  const examples = [1, 2, 3]
    .map(function (number) {
      return { number, question: topic[`CONTOH_${number}`], answer: teacher?.[`CARA_CONTOH_${number}`] || "" };
    })
    .filter(function (item) { return item.question; });
  const practices = [1, 2, 3]
    .map(function (number) {
      return { number, question: topic[`LATIHAN_${number}`], answer: teacher?.[`JAWABAN_${number}`] || "" };
    })
    .filter(function (item) { return item.question; });

  elements.lessonContent.innerHTML = `
    <div class="lesson-hero">
      <p class="eyebrow light">${escapeHtml(material.KODE_LM)} · Semester ${escapeHtml(material.SEMESTER)}</p>
      <h1>${escapeHtml(material.JUDUL)}</h1>
      <p>${escapeHtml(material.RINGKASAN)}</p>
    </div>
    <div class="topic-tabs" role="tablist" aria-label="Submateri">
      ${material.topics.map(function (item) {
        const active = item.ID_SUBMATERI === topic.ID_SUBMATERI ? " active" : "";
        return `<button class="topic-tab${active}" type="button" role="tab" data-topic-id="${escapeAttribute(item.ID_SUBMATERI)}">${escapeHtml(item.JUDUL)}</button>`;
      }).join("")}
    </div>
    <section class="content-card">
      <p class="eyebrow">Tujuan pembelajaran</p>
      <h2>${escapeHtml(topic.JUDUL)}</h2>
      <p>${escapeHtml(topic.TUJUAN)}</p>
    </section>
    <section class="content-card">
      <p class="eyebrow">Penjelasan singkat</p>
      <h3>Inti materi</h3>
      <p>${escapeHtml(topic.RINGKASAN)}</p>
      ${points.length ? `<ul class="key-list">${points.map(function (point) { return `<li>${escapeHtml(point)}</li>`; }).join("")}</ul>` : ""}
    </section>
    <section class="content-card">
      <p class="eyebrow">Tes prasyarat</p>
      <h3>Soal pengantar</h3>
      <div class="question-box"><p>${escapeHtml(topic.SOAL_PRASYARAT || "Tambahkan soal prasyarat pada Google Sheet.")}</p></div>
      ${teacherAnswerControl("prerequisite-answer", teacher?.JAWABAN_PRASYARAT || "", "Lihat jawaban")}
      <button class="primary-button" type="button" data-start-game style="margin-top:14px">Gunakan untuk game kelas</button>
    </section>
    <section class="content-card">
      <p class="eyebrow">Contoh guru</p>
      <h3>Contoh dan cara kerja</h3>
      ${examples.length ? `<div class="example-list">${examples.map(function (item) {
        return `<div class="example-item"><strong>Contoh ${item.number}</strong><p>${escapeHtml(item.question)}</p>${teacherAnswerControl("example-" + item.number, item.answer, "Tampilkan cara kerja")}</div>`;
      }).join("")}</div>` : `<p>Tambahkan contoh soal melalui sheet ${escapeHtml(material.NAMA_SHEET)}.</p>`}
    </section>
    <section class="content-card">
      <p class="eyebrow">Latihan siswa</p>
      <h3>Kerjakan di kelas</h3>
      ${practices.length ? `<div class="practice-list">${practices.map(function (item) {
        return `<div class="practice-item"><strong>Latihan ${item.number}</strong><p>${escapeHtml(item.question)}</p>${teacherAnswerControl("practice-" + item.number, item.answer, "Lihat jawaban guru")}</div>`;
      }).join("")}</div>` : `<p>Tambahkan latihan melalui sheet ${escapeHtml(material.NAMA_SHEET)}.</p>`}
    </section>
    <section class="content-card">
      <p class="eyebrow">Pekerjaan rumah</p>
      <h3>Tantangan mandiri</h3>
      <div class="question-box"><p>${escapeHtml(topic.PR || "PR belum ditambahkan pada Google Sheet.")}</p></div>
      ${teacherAnswerControl("homework-answer", teacher?.JAWABAN_PR || "", "Lihat pedoman jawaban")}
    </section>`;
}

function teacherAnswerControl(id, answer, label) {
  if (!state.teacherAnswers) {
    return `<button class="reveal-button" type="button" data-unlock-teacher>${escapeHtml(label)} · PIN guru</button>`;
  }
  if (!answer) return `<p class="locked-answer">Jawaban belum diisi pada Google Sheet.</p>`;
  return `<button class="reveal-button" type="button" data-reveal="${escapeAttribute(id)}">${escapeHtml(label)}</button><div class="answer-box hidden" id="${escapeAttribute(id)}">${formatMultiline(answer)}</div>`;
}

async function onLessonClick(event) {
  const topicButton = event.target.closest("[data-topic-id]");
  if (topicButton) {
    state.selectedTopicId = topicButton.dataset.topicId;
    renderLesson();
    return;
  }
  if (event.target.closest("[data-unlock-teacher]")) {
    await openTeacherMode();
    return;
  }
  const revealButton = event.target.closest("[data-reveal]");
  if (revealButton) {
    const answer = document.getElementById(revealButton.dataset.reveal);
    if (answer) {
      const willShow = answer.classList.contains("hidden");
      answer.classList.toggle("hidden", !willShow);
      revealButton.textContent = willShow ? "Sembunyikan" : "Tampilkan kembali";
    }
    return;
  }
  if (event.target.closest("[data-start-game]")) navigate("class");
}

function renderClass() {
  const students = activeStudents();
  elements.classCountLabel.textContent = `${students.length} murid`;
  if (!students.length) {
    elements.studentList.innerHTML = emptyState("人", "Tambahkan murid pada sheet SISWA.");
    elements.drawResults.innerHTML = "";
    return;
  }
  elements.studentList.innerHTML = students.map(function (student, index) {
    const status = state.attendance[student.ID_SISWA] || "Hadir";
    return `
      <div class="student-row">
        <span class="student-number">${escapeHtml(student.NOMOR_URUT || index + 1)}</span>
        <span class="student-name" title="${escapeAttribute(student.NAMA_SISWA)}">${escapeHtml(student.NAMA_SISWA)}</span>
        <select data-attendance-id="${escapeAttribute(student.ID_SISWA)}" aria-label="Kehadiran ${escapeAttribute(student.NAMA_SISWA)}">
          ${["Hadir", "Sakit", "Izin", "Alpa", "Dispensasi"].map(function (item) {
            return `<option value="${item}"${status === item ? " selected" : ""}>${item}</option>`;
          }).join("")}
        </select>
      </div>`;
  }).join("");
}

function onAttendanceChange(event) {
  const select = event.target.closest("[data-attendance-id]");
  if (!select) return;
  state.attendance[select.dataset.attendanceId] = select.value;
}

function markAllPresent() {
  activeStudents().forEach(function (student) { state.attendance[student.ID_SISWA] = "Hadir"; });
  renderClass();
  showToast("Semua murid ditandai hadir.");
}

async function saveAttendance() {
  if (!(await ensureTeacher())) return;
  const records = activeStudents().map(function (student) {
    return {
      studentId: student.ID_SISWA,
      studentName: student.NAMA_SISWA,
      status: state.attendance[student.ID_SISWA] || "Hadir",
      note: "",
    };
  });
  await performSave(
    {
      action: "saveAttendance",
      pin: state.teacherPin,
      date: elements.attendanceDate.value || localIsoDate(new Date()),
      classId: activeClassId(),
      materialId: state.selectedMaterialId,
      records,
    },
    `${records.length} data absensi berhasil disimpan.`,
  );
}

function drawStudents() {
  const available = activeStudents().filter(function (student) {
    return (state.attendance[student.ID_SISWA] || "Hadir") === "Hadir" && !state.drawnStudentIds.has(student.ID_SISWA);
  });
  if (available.length < 3) {
    showToast(available.length ? "Murid tersisa kurang dari tiga. Mulai putaran baru agar dapat mengacak lagi." : "Semua murid hadir sudah mendapat giliran.");
    return;
  }
  state.currentDraw = shuffle(available).slice(0, 3);
  startTimer();
  renderDrawResults();
}

function renderDrawResults() {
  if (!state.currentDraw.length) {
    elements.drawResults.innerHTML = "";
    return;
  }
  const topic = selectedTopic();
  const question = topic?.SOAL_PRASYARAT || "Gunakan satu soal prasyarat dari materi yang sedang dipelajari.";
  elements.drawResults.innerHTML = `
    <div class="question-box"><p>${escapeHtml(question)}</p></div>
    ${state.currentDraw.map(function (student, index) {
      return `
        <div class="draw-card" data-draw-student="${escapeAttribute(student.ID_SISWA)}">
          <strong>${index + 1}. ${escapeHtml(student.NAMA_SISWA)}</strong>
          <div class="score-controls">
            <label>Ketepatan
              <select data-score="accuracy">
                <option value="0">Belum benar · 0</option>
                <option value="35">Sebagian · 35</option>
                <option value="70">Benar · 70</option>
              </select>
            </label>
            <label>Proses
              <select data-score="process">
                <option value="0">Belum tampak · 0</option>
                <option value="10">Cukup · 10</option>
                <option value="20">Jelas · 20</option>
              </select>
            </label>
          </div>
        </div>`;
    }).join("")}
    <button class="light-button save-game-button" type="button" data-save-game>Simpan nilai ketiga murid</button>`;
}

function startTimer() {
  stopTimer();
  state.timerStartedAt = Date.now();
  state.gameDuration = 0;
  elements.gameTimer.textContent = "00:00";
  state.timerId = window.setInterval(function () {
    state.gameDuration = Math.floor((Date.now() - state.timerStartedAt) / 1000);
    elements.gameTimer.textContent = formatTime(state.gameDuration);
  }, 1000);
}

function stopTimer() {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
}

function resetDrawRound() {
  stopTimer();
  state.drawnStudentIds.clear();
  state.currentDraw = [];
  state.gameDuration = 0;
  elements.gameTimer.textContent = "00:00";
  renderDrawResults();
  showToast("Putaran pengacakan baru dimulai.");
}

async function onGameClick(event) {
  if (!event.target.closest("[data-save-game]")) return;
  if (!(await ensureTeacher())) return;
  const material = selectedMaterial();
  const topic = selectedTopic();
  const timePoints = Math.max(0, 10 - Math.floor(state.gameDuration / 30));
  const records = state.currentDraw.map(function (student) {
    const card = elements.drawResults.querySelector(`[data-draw-student="${cssEscape(student.ID_SISWA)}"]`);
    const accuracy = Number(card?.querySelector('[data-score="accuracy"]')?.value || 0);
    const process = Number(card?.querySelector('[data-score="process"]')?.value || 0);
    return {
      id: makeId("DIAG"),
      date: elements.attendanceDate.value || localIsoDate(new Date()),
      classId: activeClassId(),
      studentId: student.ID_SISWA,
      studentName: student.NAMA_SISWA,
      materialId: material?.ID_MATERI || "",
      topicId: topic?.ID_SUBMATERI || "",
      question: topic?.SOAL_PRASYARAT || "",
      durationSeconds: state.gameDuration,
      accuracy,
      process,
      timePoints,
      score: accuracy + process + timePoints,
    };
  });
  const saved = await performSave(
    { action: "saveDiagnostics", pin: state.teacherPin, records },
    "Nilai diagnostik ketiga murid berhasil disimpan.",
  );
  if (saved) {
    state.currentDraw.forEach(function (student) { state.drawnStudentIds.add(student.ID_SISWA); });
    stopTimer();
  }
}

function renderGrades() {
  const weights = state.data?.weights || { NF: 15, NSLM: 35, NONTES: 15, STS: 15, SAS: 20 };
  elements.weightStrip.innerHTML = Object.entries(weights).map(function (entry) {
    return `<span class="weight-item"><b>${escapeHtml(entry[0])}</b> ${escapeHtml(entry[1])}%</span>`;
  }).join("");

  const students = activeStudents();
  const gradesByStudent = new Map(currentGrades().map(function (grade) { return [grade.ID_SISWA, grade]; }));
  if (!students.length) {
    elements.gradeTableBody.innerHTML = `<tr><td colspan="7">Belum ada murid pada sheet SISWA.</td></tr>`;
    return;
  }
  elements.gradeTableBody.innerHTML = students.map(function (student) {
    const grade = gradesByStudent.get(student.ID_SISWA) || {};
    const values = {
      NF: scoreValue(grade.NF),
      NSLM: scoreValue(grade.NSLM),
      NONTES: scoreValue(grade.NONTES),
      STS: scoreValue(grade.STS),
      SAS: scoreValue(grade.SAS),
    };
    const report = calculateReport(values, weights);
    return `
      <tr data-grade-student="${escapeAttribute(student.ID_SISWA)}">
        <td><strong>${escapeHtml(student.NAMA_SISWA)}</strong><small>${escapeHtml(student.ID_SISWA)}</small></td>
        ${["NF", "NSLM", "NONTES", "STS", "SAS"].map(function (field) {
          return `<td><input class="grade-input" type="number" min="0" max="100" inputmode="decimal" data-grade-field="${field}" value="${escapeAttribute(values[field])}" aria-label="${field} ${escapeAttribute(student.NAMA_SISWA)}" /></td>`;
        }).join("")}
        <td><span class="report-score" data-report-score>${report === null ? "—" : report}</span></td>
      </tr>`;
  }).join("");
}

function onGradeInput(event) {
  const input = event.target.closest("[data-grade-field]");
  if (!input) return;
  if (input.value !== "") input.value = String(Math.max(0, Math.min(100, Number(input.value))));
  const row = input.closest("[data-grade-student]");
  updateReportCell(row);
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
    const item = {
      studentId: student.ID_SISWA,
      studentName: student.NAMA_SISWA,
      classId: activeClassId(),
      semester: Number(state.data?.settings?.SEMESTER_AKTIF || 1),
      note: "",
    };
    row.querySelectorAll("[data-grade-field]").forEach(function (input) { item[input.dataset.gradeField] = input.value; });
    return item;
  });
  const saved = await performSave(
    { action: "saveGrades", pin: state.teacherPin, records },
    `${records.length} data nilai berhasil disimpan.`,
  );
  if (saved) await loadData({ quiet: true });
}

function renderSettings() {
  elements.gasUrlInput.value = state.gasUrl;
  const unlocked = Boolean(state.teacherAnswers && state.teacherPin);
  elements.teacherState.textContent = unlocked ? "Mode guru terbuka selama halaman ini aktif" : "Mode guru terkunci";
  elements.teacherState.classList.toggle("unlocked", unlocked);
  elements.teacherModeButton.textContent = unlocked ? "Perbarui akses guru" : "Buka mode guru";
}

function saveGasUrl() {
  const url = String(elements.gasUrlInput.value || "").trim();
  if (!isValidGasUrl(url)) {
    showToast("Gunakan URL Web App GAS yang valid dan berakhiran /exec.");
    return;
  }
  state.gasUrl = url;
  localStorage.setItem(MATCH9_KEYS.gasUrl, url);
  state.teacherPin = "";
  state.teacherAnswers = null;
  loadData();
}

async function openTeacherMode() {
  if (!state.gasUrl) {
    showToast("Sambungkan Google Sheet terlebih dahulu.");
    navigate("settings");
    return false;
  }
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
  } finally {
    hideLoading();
  }
}

async function ensureTeacher() {
  if (state.teacherPin && state.teacherAnswers) return true;
  return openTeacherMode();
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
  } finally {
    hideLoading();
  }
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
    const timeout = window.setTimeout(function () {
      cleanup();
      reject(new Error("Waktu koneksi Google Sheet habis."));
    }, 15000);
    function cleanup() {
      window.clearTimeout(timeout);
      script.remove();
      try { delete window[callback]; } catch (ignored) { window[callback] = undefined; }
    }
    window[callback] = function (data) {
      cleanup();
      resolve(data);
    };
    script.onerror = function () {
      cleanup();
      reject(new Error("Google Sheet belum dapat dibaca."));
    };
    script.src = url.toString();
    document.head.appendChild(script);
  });
}

async function apiPost(payload) {
  const response = await fetch(state.gasUrl, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Penyimpanan GAS gagal (${response.status}).`);
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error("Jawaban GAS tidak dapat dibaca. Pastikan deployment memakai versi terbaru.");
  }
}

function selectedMaterial() {
  return state.data?.materials?.find(function (material) { return material.ID_MATERI === state.selectedMaterialId; }) || null;
}

function selectedTopic() {
  const material = selectedMaterial();
  return material?.topics?.find(function (topic) { return topic.ID_SUBMATERI === state.selectedTopicId; }) || null;
}

function activeStudents() {
  const classId = activeClassId();
  return (state.data?.students || [])
    .filter(function (student) {
      return (!classId || student.ID_KELAS === classId) && String(student.AKTIF).toUpperCase() !== "FALSE";
    })
    .sort(function (a, b) { return Number(a.NOMOR_URUT || 0) - Number(b.NOMOR_URUT || 0); });
}

function activeClassId() {
  return state.data?.settings?.ID_KELAS_AKTIF || "IX-A";
}

function currentGrades() {
  const semester = String(state.data?.settings?.SEMESTER_AKTIF || 1);
  return (state.data?.grades || []).filter(function (grade) { return String(grade.SEMESTER) === semester; });
}

function calculateReport(values, weights) {
  const fields = ["NF", "NSLM", "NONTES", "STS", "SAS"];
  if (fields.some(function (field) { return !hasScore(values[field]); })) return null;
  const result = fields.reduce(function (sum, field) {
    return sum + Number(values[field]) * Number(weights[field] || 0) / 100;
  }, 0);
  return Math.round(result);
}

function hasScore(value) {
  return value !== "" && value !== null && typeof value !== "undefined" && Number.isFinite(Number(value));
}

function scoreValue(value) {
  return hasScore(value) ? String(value) : "";
}

function splitPoints(value) {
  return String(value || "").split(/\||\n/).map(function (item) { return item.trim(); }).filter(Boolean);
}

function shuffle(items) {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    const temporary = result[index];
    result[index] = result[randomIndex];
    result[randomIndex] = temporary;
  }
  return result;
}

function makeId(prefix) {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function setConnection(mode, text) {
  elements.connectionButton.classList.remove("draft", "connected", "error");
  elements.connectionButton.classList.add(mode);
  elements.connectionText.textContent = text;
}

function showLoading(text) {
  elements.loadingText.textContent = text || "Memuat…";
  elements.loadingOverlay.classList.remove("hidden");
}

function hideLoading() {
  elements.loadingOverlay.classList.add("hidden");
}

let toastTimer = null;
function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(function () { elements.toast.classList.remove("show"); }, 3800);
}

function readCache() {
  try {
    const raw = localStorage.getItem(MATCH9_KEYS.publicCache);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.ok ? parsed : null;
  } catch (error) {
    return null;
  }
}

function isValidGasUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /script\.google\.com$/i.test(url.hostname) && /\/exec\/?$/i.test(url.pathname);
  } catch (error) {
    return false;
  }
}

function emptyState(icon, text) {
  return `<div class="empty-state compact"><span aria-hidden="true">${escapeHtml(icon)}</span><p>${escapeHtml(text)}</p></div>`;
}

function formatMultiline(value) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function cssEscape(value) {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}
