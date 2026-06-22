const STORAGE_KEY = "movipro-data-v1";
const today = new Date();
const seed = {
  students: [
    { id: crypto.randomUUID(), name: "Mariana Costa", email: "mariana@email.com", phone: "", goal: "Hipertrofia", createdAt: new Date().toISOString() },
    { id: crypto.randomUUID(), name: "Rafael Lima", email: "rafael@email.com", phone: "", goal: "Condicionamento", createdAt: new Date().toISOString() }
  ],
  workouts: [], assessments: [], appointments: [], payments: []
};
let data = loadData();
let timers = {};
const cloudConfig = window.MOVIPRO_SUPABASE || {};
const cloud = cloudConfig.url && cloudConfig.anonKey && window.supabase ? window.supabase.createClient(cloudConfig.url, cloudConfig.anonKey) : null;
let currentUser = null;
let cloudSaveTimer = null;

function normalizeData(value = {}) {
  return {
    students: Array.isArray(value.students) ? value.students : [],
    workouts: Array.isArray(value.workouts) ? value.workouts : [],
    assessments: Array.isArray(value.assessments) ? value.assessments : [],
    appointments: Array.isArray(value.appointments) ? value.appointments : [],
    payments: Array.isArray(value.payments) ? value.payments : []
  };
}

function loadData() {
  try {
    const saved = normalizeData(JSON.parse(localStorage.getItem(STORAGE_KEY)) || seed);
    saved.workouts.forEach(item => item.workoutGroup = String(item.workoutGroup || "A").trim().toUpperCase());
    return saved;
  }
  catch { return seed; }
}
function saveData(message) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  renderAll();
  queueCloudSave();
  if (message) toast(message);
}
function studentName(id) { return data.students.find(student => student.id === id)?.name || (id ? "Aluno removido" : "Sem aluno"); }
function initials(name) { return name.split(" ").slice(0, 2).map(part => part[0]).join("").toUpperCase(); }
function currency(value) { return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function localDate(value) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "-"; }
function empty(title, text) { return `<div class="empty"><strong>${title}</strong>${text}</div>`; }
function toast(message) {
  const element = document.querySelector("#toast");
  element.textContent = message; element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2200);
}

function setCloudState(state, text) {
  const dot = document.querySelector("#syncDot");
  const buttonText = document.querySelector("#authButtonText");
  dot.className = state;
  buttonText.textContent = text;
}

function queueCloudSave() {
  if (!cloud || !currentUser) return;
  clearTimeout(cloudSaveTimer);
  setCloudState("syncing", "Salvando...");
  cloudSaveTimer = setTimeout(persistCloudData, 500);
}

async function persistCloudData() {
  if (!cloud || !currentUser) return;
  const { error } = await cloud.from("user_app_data").upsert({ user_id: currentUser.id, payload: data, updated_at: new Date().toISOString() });
  if (error) { setCloudState("error", "Falha ao salvar"); console.error(error); return; }
  setCloudState("synced", "Nuvem sincronizada");
}

async function loadCloudData() {
  if (!cloud || !currentUser) return;
  setCloudState("syncing", "Sincronizando...");
  const { data: row, error } = await cloud.from("user_app_data").select("payload").eq("user_id", currentUser.id).maybeSingle();
  if (error) { setCloudState("error", "Falha na nuvem"); console.error(error); return; }
  if (row?.payload && Object.keys(row.payload).length) {
    data = normalizeData(row.payload);
    data.workouts.forEach(item => item.workoutGroup = String(item.workoutGroup || "A").trim().toUpperCase());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    renderAll();
    setCloudState("synced", "Nuvem sincronizada");
  } else {
    await persistCloudData();
  }
}

async function applyCloudSession(user) {
  currentUser = user || null;
  const authButton = document.querySelector("#authButton");
  if (currentUser) {
    authButton.title = currentUser.email || "Conta conectada";
    await loadCloudData();
  } else {
    authButton.title = "Entrar para sincronizar";
    setCloudState("local", cloud ? "Conectar nuvem" : "Somente neste aparelho");
  }
}

async function initializeCloud() {
  if (!cloud) { setCloudState("local", "Somente neste aparelho"); return; }
  const { data: { session } } = await cloud.auth.getSession();
  await applyCloudSession(session?.user);
  cloud.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user?.id !== currentUser?.id) applyCloudSession(session.user);
    if (event === "SIGNED_OUT") applyCloudSession(null);
  });
}

function navigate(viewId) {
  document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === viewId));
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === viewId));
  const titles = { inicio: "Olá, profissional!", alunos: "Gestão de alunos", treinos: "Planilhas de treino", avaliacoes: "Avaliações físicas", agenda: "Agenda", financeiro: "Controle financeiro" };
  document.querySelector("#pageTitle").textContent = titles[viewId];
  document.querySelector(".sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStats() {
  const paid = data.payments.filter(payment => payment.status === "paid").reduce((total, payment) => total + Number(payment.amount), 0);
  const todayKey = today.toISOString().slice(0, 10);
  const stats = [
    [data.students.length, "Alunos ativos", "carteira atual"],
    [data.workouts.length, "Exercícios criados", "nas planilhas"],
    [data.appointments.filter(item => item.date === todayKey).length, "Sessões hoje", "na agenda"],
    [currency(paid), "Receita registrada", "pagamentos recebidos"]
  ];
  document.querySelector("#stats").innerHTML = stats.map(([value, label, note]) => `<div class="stat"><small>${label.toUpperCase()}</small><b>${value}</b><span class="trend">${note}</span></div>`).join("");
}

function renderStudents() {
  const query = document.querySelector("#studentSearch")?.value.toLowerCase() || "";
  const students = data.students.filter(student => `${student.name} ${student.goal}`.toLowerCase().includes(query));
  const exerciseRow = item => `<div class="student-exercise ${item.completedAt ? "completed" : ""}">
    <div><span class="exercise-group-badge">TREINO ${item.workoutGroup || "A"}</span><strong>${item.exercise || "Exercício sem nome"}</strong><small>${item.sets || "-"} séries · ${item.reps || "-"} repetições · ${item.load !== "" && item.load != null ? `${item.load} kg` : "sem carga"}</small></div>
    <div class="exercise-actions">
      <button class="exercise-action complete-button ${item.completedAt ? "is-complete" : ""}" data-toggle-complete="${item.id}"><span>${item.completedAt ? "✓" : "○"}</span>${item.completedAt ? "Feito" : "Concluir"}</button>
      <button class="exercise-action edit-button" data-edit-workout="${item.id}" title="Editar exercício"><span>✎</span>Editar</button>
      ${item.rest ? `<button class="exercise-action timer-action" data-timer="student-${item.id}" data-seconds="${item.rest}"><span>◷</span>${formatTime(item.rest)}</button>` : ""}
      <button class="exercise-action delete-action" data-delete-workout="${item.id}" title="Excluir exercício"><span>×</span></button>
    </div>
  </div>`;
  const card = student => {
    const workouts = data.workouts.filter(item => item.studentId === student.id);
    const groups = workouts.reduce((result, item) => {
      const group = item.workoutGroup || "A";
      (result[group] ||= []).push(item);
      return result;
    }, {});
    const groupedExercises = Object.keys(groups).sort().map(group => `<section class="training-group" data-group="${group}">
      <div class="training-group-head"><div><span class="training-letter">${group}</span><div><strong>Treino ${group}</strong><small>Ficha exclusiva do Treino ${group}</small></div></div><div class="training-head-actions"><span>${groups[group].filter(item => item.completedAt).length}/${groups[group].length} feitos</span><button class="add-to-training" data-add-exercise="${student.id}" data-workout-group="${group}"><span class="add-training-icon">+</span><span>Adicionar ao Treino ${group}</span></button></div></div>
      <div class="training-group-list">${groups[group].map(exerciseRow).join("")}</div>
    </section>`).join("");
    return `<article class="student-card student-detail">
      <header><div class="student-avatar">${initials(student.name)}</div><div class="grow"><h4>${student.name}</h4><p>${student.goal} · ${student.email || "E-mail não informado"}</p></div><button class="danger" data-delete-student="${student.id}" title="Excluir aluno">×</button></header>
      <div class="student-card-actions"><span class="status">${workouts.length} ${workouts.length === 1 ? "exercício" : "exercícios"}</span><button class="primary add-student-exercise" data-add-exercise="${student.id}">+ Adicionar exercício</button></div>
      <div class="student-exercises">${workouts.length ? groupedExercises : `<p class="student-empty">Nenhum exercício adicionado para este aluno.</p>`}</div>
    </article>`;
  };
  const compactCard = student => `<article class="student-card"><header><div class="student-avatar">${initials(student.name)}</div><div><h4>${student.name}</h4><p>${student.goal}</p></div></header><p>${student.email || "E-mail não informado"}</p><span class="status">${data.workouts.filter(item => item.studentId === student.id).length} exercícios</span></article>`;
  document.querySelector("#studentList").innerHTML = students.length ? students.map(card).join("") : empty("Nenhum aluno encontrado", "Adicione um aluno para começar.");
  document.querySelector("#recentStudents").innerHTML = data.students.length ? data.students.slice(-4).reverse().map(compactCard).join("") : empty("Nenhum aluno ainda", "Os cadastros recentes aparecerão aqui.");
  const options = `<option value="">Selecione um aluno</option>${data.students.map(student => `<option value="${student.id}">${student.name}</option>`).join("")}`;
  document.querySelectorAll(".student-select").forEach(select => select.innerHTML = options);
  const filter = document.querySelector("#workoutStudentFilter");
  const current = filter.value;
  filter.innerHTML = `<option value="">Todos os alunos</option>${data.students.map(student => `<option value="${student.id}">${student.name}</option>`).join("")}`;
  filter.value = current;
}

function renderWorkouts() {
  const filter = document.querySelector("#workoutStudentFilter").value;
  const workouts = data.workouts.filter(item => !filter || item.studentId === filter);
  document.querySelector("#workoutList").innerHTML = workouts.length ? workouts.map(item => `
    <article class="workout-card">
      <div><small>${studentName(item.studentId).toUpperCase()} · TREINO ${item.workoutGroup || "A"}</small><h3>${item.exercise || "Exercício sem nome"}</h3><p>${item.notes || "Sem observações"}</p></div>
      <div class="metric"><small>SÉRIES</small><b>${item.sets || "-"}</b></div><div class="metric"><small>REPETIÇÕES</small><b>${item.reps || "-"}</b></div>
      <div class="metric"><small>CARGA</small><b><input data-load="${item.id}" type="number" min="0" step="0.5" value="${item.load ?? ""}" placeholder="-" style="width:75px;padding:6px"></b></div>
      <div class="metric"><small>DESCANSO</small><b>${item.rest ? `${item.rest}s` : "-"}</b></div>
      <div><button class="exercise-action edit-button" data-edit-workout="${item.id}"><span>✎</span>Editar</button> ${item.rest ? `<button class="secondary mini-timer" data-timer="${item.id}" data-seconds="${item.rest}">▶ ${formatTime(item.rest)}</button>` : ""} <button class="danger" data-delete-workout="${item.id}" title="Excluir">×</button></div>
    </article>`).join("") : empty("Nenhum exercício criado", "Monte a primeira planilha digital de treino.");
}

function renderAssessments() {
  document.querySelector("#assessmentList").innerHTML = data.assessments.length ? data.assessments.slice().reverse().map(item => {
    const height = Number(item.height) / 100;
    const bmi = height ? (Number(item.weight) / (height * height)).toFixed(1) : "-";
    return `<article class="data-card"><small>${new Date(item.createdAt).toLocaleDateString("pt-BR")}</small><h3>${studentName(item.studentId)}</h3><p>Peso: <b>${item.weight} kg</b> · IMC: <b>${bmi}</b></p><p>Gordura: ${item.fat || "-"}% · Cintura: ${item.waist || "-"} cm</p></article>`;
  }).join("") : empty("Nenhuma avaliação registrada", "Registre medidas para acompanhar a evolução.");
}

function renderAppointments() {
  const sorted = data.appointments.slice().sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const appointment = item => `<div class="timeline-item"><strong>${localDate(item.date)}<br>${item.time}</strong><div><h3>${studentName(item.studentId)}</h3><p>${item.type}</p></div><button class="danger" data-delete-appointment="${item.id}">×</button></div>`;
  document.querySelector("#appointmentList").innerHTML = sorted.length ? sorted.map(appointment).join("") : empty("Agenda livre", "Adicione seu próximo atendimento.");
  document.querySelector("#nextAppointments").innerHTML = sorted.length ? sorted.slice(0, 4).map(item => `<div class="list-item"><div class="time-block">${item.time}</div><div class="grow"><strong>${studentName(item.studentId)}</strong><p>${item.type} · ${localDate(item.date)}</p></div><span class="status">AGENDADO</span></div>`).join("") : empty("Sem atendimentos", "Sua agenda aparecerá aqui.");
}

function renderPayments() {
  const paid = data.payments.filter(item => item.status === "paid").reduce((sum, item) => sum + Number(item.amount), 0);
  const pending = data.payments.filter(item => item.status === "pending").reduce((sum, item) => sum + Number(item.amount), 0);
  document.querySelector("#financeSummary").innerHTML = `<div class="stat"><small>RECEBIDO</small><b>${currency(paid)}</b><span class="trend">total registrado</span></div><div class="stat"><small>PENDENTE</small><b>${currency(pending)}</b><span class="trend">a receber</span></div>`;
  document.querySelector("#paymentList").innerHTML = data.payments.length ? `<table class="data-table"><thead><tr><th>ALUNO</th><th>VENCIMENTO</th><th>VALOR</th><th>STATUS</th><th></th></tr></thead><tbody>${data.payments.map(item => `<tr><td>${studentName(item.studentId)}</td><td>${localDate(item.dueDate)}</td><td>${currency(item.amount)}</td><td><span class="status ${item.status}">${item.status === "paid" ? "PAGO" : "PENDENTE"}</span></td><td><button class="danger" data-delete-payment="${item.id}">×</button></td></tr>`).join("")}</tbody></table>` : empty("Nenhum lançamento", "Registre mensalidades e pagamentos.");
}

function renderAll() { renderStats(); renderStudents(); renderWorkouts(); renderAssessments(); renderAppointments(); renderPayments(); }

function bindForm(formId, collection, transform, message) {
  document.querySelector(formId).addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    data[collection].push({ id: crypto.randomUUID(), ...transform(values), createdAt: new Date().toISOString() });
    event.currentTarget.reset(); event.currentTarget.closest("dialog").close(); saveData(message);
  });
}

function formatTime(seconds) { const value = Math.max(0, Number(seconds)); return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`; }
function runButtonTimer(button, total) {
  const id = button.dataset.timer || "quick";
  if (timers[id]?.interval) { clearInterval(timers[id].interval); delete timers[id]; button.textContent = `▶ ${formatTime(total)}`; return; }
  let remaining = Number(total); button.textContent = `❚❚ ${formatTime(remaining)}`;
  const interval = setInterval(() => {
    remaining -= 1; button.textContent = `❚❚ ${formatTime(remaining)}`;
    if (remaining <= 0) { clearInterval(interval); delete timers[id]; button.textContent = `▶ ${formatTime(total)}`; toast("Descanso concluído. Próxima série!"); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
  }, 1000);
  timers[id] = { interval };
}

function openWorkoutModal(item = null, studentId = "", workoutGroup = "A") {
  const modal = document.querySelector("#workoutModal");
  const form = document.querySelector("#workoutForm");
  form.reset();
  form.dataset.editId = item?.id || "";
  modal.querySelector(".modal-head h2").textContent = item ? "Editar exercício" : "Novo exercício";
  modal.querySelector(".modal-actions .primary").textContent = item ? "Salvar alterações" : "Adicionar exercício";
  if (item) {
    ["studentId", "workoutGroup", "exercise", "sets", "reps", "load", "rest", "notes"].forEach(name => {
      form.elements[name].value = item[name] ?? (name === "workoutGroup" ? "A" : "");
    });
  } else {
    form.elements.studentId.value = studentId;
    form.elements.workoutGroup.value = workoutGroup;
  }
  modal.showModal();
}

document.querySelectorAll(".nav-item").forEach(button => button.addEventListener("click", () => navigate(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.go)));
document.querySelectorAll("[data-open]").forEach(button => button.addEventListener("click", () => {
  if (!data.students.length && !["studentModal", "workoutModal"].includes(button.dataset.open)) { toast("Cadastre um aluno primeiro."); return; }
  if (button.dataset.open === "workoutModal") { openWorkoutModal(); return; }
  document.querySelector(`#${button.dataset.open}`).showModal();
}));
document.querySelector("#menuButton").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
document.querySelector("#studentSearch").addEventListener("input", renderStudents);
document.querySelector("#workoutStudentFilter").addEventListener("change", renderWorkouts);

bindForm("#studentForm", "students", values => values, "Aluno adicionado com sucesso.");
document.querySelector("#workoutForm").addEventListener("submit", event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (event.submitter?.value === "cancel") {
    form.reset(); form.dataset.editId = ""; form.closest("dialog").close();
    return;
  }
  const values = Object.fromEntries(new FormData(form));
  const normalized = { ...values, workoutGroup: String(values.workoutGroup || "A").trim().toUpperCase(), sets: values.sets ? Number(values.sets) : "", load: values.load ? Number(values.load) : "", rest: values.rest ? Number(values.rest) : "" };
  const existing = data.workouts.find(item => item.id === form.dataset.editId);
  if (existing) Object.assign(existing, normalized, { updatedAt: new Date().toISOString() });
  else data.workouts.push({ id: crypto.randomUUID(), ...normalized, createdAt: new Date().toISOString() });
  form.reset(); form.dataset.editId = ""; form.closest("dialog").close();
  saveData(existing ? "Exercício atualizado com sucesso." : "Exercício adicionado à planilha.");
});
bindForm("#assessmentForm", "assessments", values => values, "Avaliação física registrada.");
bindForm("#appointmentForm", "appointments", values => values, "Atendimento agendado.");
bindForm("#paymentForm", "payments", values => ({ ...values, amount: Number(values.amount) }), "Lançamento salvo.");

document.addEventListener("click", event => {
  const addExerciseButton = event.target.closest("[data-add-exercise]");
  if (addExerciseButton) {
    openWorkoutModal(null, addExerciseButton.dataset.addExercise, addExerciseButton.dataset.workoutGroup || "A");
  }
  const editWorkoutButton = event.target.closest("[data-edit-workout]");
  if (editWorkoutButton) {
    const item = data.workouts.find(workout => workout.id === editWorkoutButton.dataset.editWorkout);
    if (item) openWorkoutModal(item);
  }
  const completeButton = event.target.closest("[data-toggle-complete]");
  if (completeButton) {
    const item = data.workouts.find(workout => workout.id === completeButton.dataset.toggleComplete);
    if (item) {
      item.completedAt = item.completedAt ? null : new Date().toISOString();
      saveData(item.completedAt ? "Exercício marcado como feito!" : "Conclusão desmarcada.");
    }
  }
  const timerButton = event.target.closest("[data-timer]");
  if (timerButton) runButtonTimer(timerButton, timerButton.dataset.seconds);
  const deletions = [["deleteWorkout", "workouts"], ["deleteAppointment", "appointments"], ["deletePayment", "payments"]];
  for (const [key, collection] of deletions) if (event.target.dataset[key]) { data[collection] = data[collection].filter(item => item.id !== event.target.dataset[key]); saveData("Registro excluído."); }
  if (event.target.dataset.deleteStudent && confirm("Excluir este aluno e todos os registros relacionados?")) {
    const id = event.target.dataset.deleteStudent; data.students = data.students.filter(item => item.id !== id);
    ["workouts", "assessments", "appointments", "payments"].forEach(collection => data[collection] = data[collection].filter(item => item.studentId !== id)); saveData("Aluno excluído.");
  }
});
document.addEventListener("change", event => {
  if (event.target.dataset.load) { const item = data.workouts.find(workout => workout.id === event.target.dataset.load); if (item) { item.load = event.target.value ? Number(event.target.value) : ""; saveData("Carga atualizada."); } }
});

document.querySelector("#authButton").addEventListener("click", async () => {
  if (!cloud) { toast("A nuvem ainda não foi configurada."); return; }
  if (currentUser) {
    if (confirm("Deseja sair da conta? Os dados deste aparelho continuarão disponíveis.")) await cloud.auth.signOut();
    return;
  }
  document.querySelector("#authMessage").textContent = "";
  document.querySelector("#authModal").showModal();
});

document.querySelector("#authForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  if (event.submitter?.value === "cancel") { form.closest("dialog").close(); return; }
  const message = document.querySelector("#authMessage");
  const values = Object.fromEntries(new FormData(form));
  message.textContent = "Entrando...";
  const { data: authData, error } = await cloud.auth.signInWithPassword({ email: values.email, password: values.password });
  if (error) { message.textContent = error.message; return; }
  form.reset(); form.closest("dialog").close();
  await applyCloudSession(authData.user);
  toast("Conta conectada. Dados sincronizados!");
});

document.querySelector("#signUpButton").addEventListener("click", async () => {
  const form = document.querySelector("#authForm");
  if (!form.reportValidity()) return;
  const message = document.querySelector("#authMessage");
  const values = Object.fromEntries(new FormData(form));
  message.textContent = "Criando conta...";
  const { data: authData, error } = await cloud.auth.signUp({ email: values.email, password: values.password });
  if (error) { message.textContent = error.message; return; }
  if (authData.session) {
    form.reset(); form.closest("dialog").close();
    await applyCloudSession(authData.user);
    toast("Conta criada e conectada!");
  } else {
    message.textContent = "Conta criada. Confira seu e-mail para confirmar o acesso.";
  }
});

const quickInput = document.querySelector("#quickTimerInput");
const quickDisplay = document.querySelector("#quickTimer");
let quickInterval;
function resetQuickTimer() { clearInterval(quickInterval); quickInterval = null; quickDisplay.textContent = formatTime(quickInput.value); document.querySelector("#quickTimerStart").textContent = "Iniciar"; }
quickInput.addEventListener("input", resetQuickTimer);
document.querySelector("#quickTimerReset").addEventListener("click", resetQuickTimer);
document.querySelector("#quickTimerStart").addEventListener("click", event => {
  if (quickInterval) { clearInterval(quickInterval); quickInterval = null; event.target.textContent = "Continuar"; return; }
  let remaining = quickDisplay.textContent.split(":").reduce((minutes, part) => minutes * 60 + Number(part));
  event.target.textContent = "Pausar"; quickInterval = setInterval(() => { remaining--; quickDisplay.textContent = formatTime(remaining); if (remaining <= 0) { clearInterval(quickInterval); quickInterval = null; event.target.textContent = "Iniciar"; toast("Tempo de descanso concluído!"); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } }, 1000);
});
document.querySelector("#exportButton").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `movipro-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href); toast("Backup exportado.");
});

document.querySelector("#eyebrow").textContent = today.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase();
document.querySelector("#heroDay").textContent = today.getDate();
document.querySelector("#heroMonth").textContent = today.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();
document.querySelector("#appointmentForm [name=date]").value = today.toISOString().slice(0, 10);
renderAll(); resetQuickTimer();
initializeCloud();
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
