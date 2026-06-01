const CONFIG_KEY = "daily-tasker-supabase";
const DEMO_KEY = "daily-tasker-demo-data";
const ROUTES = ["today", "tasks", "templates"];

const app = document.querySelector("#app");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsForm = document.querySelector("#settings-form");
const settingsLabel = document.querySelector("#settings-label");
const settingsButton = document.querySelector("#settings-button");
const toast = document.querySelector("#toast");

let store;
let state = {
  mainTasks: [],
  templates: [],
  dailyTasks: [],
};

const id = () => crypto.randomUUID();
const authRedirectUrl = () => {
  const url = new URL(window.location.href);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/index\.html$/, "");
  return url.toString();
};
const normalizeSupabaseUrl = (value) => {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("The project URL must start with https://.");
  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use the Supabase project URL only, without an extra path.");
  }
  return url.origin;
};
const today = () => {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const escapeHtml = (value = "") =>
  value.replace(/[&<>"']/g, (character) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[character];
  });

class DemoStore {
  constructor() {
    this.mode = "demo";
    const saved = localStorage.getItem(DEMO_KEY);
    this.data = saved ? JSON.parse(saved) : this.seed();
  }

  seed() {
    const projectId = id();
    const templateId = id();
    const data = {
      mainTasks: [
        {
          id: projectId,
          title: "Launch portfolio",
          description: "A small step each day until the site is live.",
          subtasks: [
            { id: id(), title: "Choose the best three projects", completed: false, stepItems: [] },
            { id: id(), title: "Write a short introduction", completed: false, stepItems: [] },
            { id: id(), title: "Pick a profile photo", completed: false, stepItems: [] },
          ],
        },
      ],
      templates: [
        {
          id: templateId,
          title: "Weekly home reset",
          description: "A quick checklist for a calmer space.",
          subtasks: [
            { id: id(), title: "Plan meals" },
            { id: id(), title: "Make a grocery list" },
            { id: id(), title: "Water plants" },
          ],
        },
      ],
      dailyTasks: [],
    };
    localStorage.setItem(DEMO_KEY, JSON.stringify(data));
    return data;
  }

  save() {
    localStorage.setItem(DEMO_KEY, JSON.stringify(this.data));
  }

  async load() {
    const data = structuredClone(this.data);
    data.mainTasks.forEach((mainTask) => mainTask.subtasks.forEach((subtask) => {
      subtask.stepItems ||= [];
    }));
    data.dailyTasks = data.dailyTasks.filter((item) => item.taskDate === today());
    return data;
  }

  async createMainTask(payload) {
    const task = { id: id(), title: payload.title, description: payload.description, subtasks: [] };
    if (payload.templateId) {
      const template = this.data.templates.find((item) => item.id === payload.templateId);
      task.subtasks = template.subtasks.map((item) => ({ id: id(), title: item.title, completed: false, stepItems: [] }));
    }
    this.data.mainTasks.push(task);
    this.save();
  }

  async createSubtask(mainTaskId, title) {
    const mainTask = this.data.mainTasks.find((item) => item.id === mainTaskId);
    mainTask.subtasks.push({ id: id(), title, completed: false, stepItems: [] });
    this.save();
  }

  async createStepItem(subtaskId, title) {
    const subtask = this.data.mainTasks.flatMap((item) => item.subtasks).find((item) => item.id === subtaskId);
    subtask.stepItems ||= [];
    subtask.stepItems.push({ id: id(), title, completed: false });
    this.save();
  }

  async toggleStepItem(stepItemId, completed) {
    const stepItem = this.data.mainTasks
      .flatMap((item) => item.subtasks)
      .flatMap((item) => item.stepItems || [])
      .find((item) => item.id === stepItemId);
    stepItem.completed = completed;
    this.save();
  }

  async toggleSubtask(subtaskId, completed) {
    const subtask = this.data.mainTasks.flatMap((item) => item.subtasks).find((item) => item.id === subtaskId);
    subtask.completed = completed;
    this.save();
  }

  async deleteMainTask(mainTaskId) {
    const subtaskIds = this.data.mainTasks.find((item) => item.id === mainTaskId).subtasks.map((item) => item.id);
    this.data.mainTasks = this.data.mainTasks.filter((item) => item.id !== mainTaskId);
    this.data.dailyTasks = this.data.dailyTasks.filter((item) => !subtaskIds.includes(item.subtaskId));
    this.save();
  }

  async createTemplate(payload) {
    this.data.templates.push({ id: id(), ...payload, subtasks: payload.subtasks.map((title) => ({ id: id(), title })) });
    this.save();
  }

  async deleteTemplate(templateId) {
    this.data.templates = this.data.templates.filter((item) => item.id !== templateId);
    this.save();
  }

  async addDailyTask(subtaskId) {
    if (!this.data.dailyTasks.some((item) => item.subtaskId === subtaskId && item.taskDate === today())) {
      this.data.dailyTasks.push({ id: id(), subtaskId, taskDate: today() });
      this.save();
    }
  }

  async removeDailyTask(dailyTaskId) {
    this.data.dailyTasks = this.data.dailyTasks.filter((item) => item.id !== dailyTaskId);
    this.save();
  }
}

class SupabaseStore {
  constructor(client) {
    this.client = client;
    this.mode = "cloud";
  }

  async userId() {
    const { data } = await this.client.auth.getUser();
    return data.user.id;
  }

  async load() {
    const [mainTasks, templates, dailyTasks] = await Promise.all([
      this.client.from("main_tasks").select("id,title,description,subtasks(id,title,completed,step_items(id,title,completed))").order("created_at"),
      this.client.from("task_templates").select("id,title,description,template_subtasks(id,title)").order("created_at"),
      this.client.from("daily_tasks").select("id,subtask_id,task_date").eq("task_date", today()),
    ]);
    [mainTasks, templates, dailyTasks].forEach(({ error }) => {
      if (error) throw error;
    });
    return {
      mainTasks: mainTasks.data.map((task) => ({
        ...task,
        subtasks: (task.subtasks || []).map((subtask) => ({ ...subtask, stepItems: subtask.step_items || [] })),
      })),
      templates: templates.data.map((template) => ({
        ...template,
        subtasks: template.template_subtasks || [],
      })),
      dailyTasks: dailyTasks.data.map((task) => ({
        id: task.id,
        subtaskId: task.subtask_id,
        taskDate: task.task_date,
      })),
    };
  }

  async createMainTask(payload) {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from("main_tasks")
      .insert({ user_id: userId, title: payload.title, description: payload.description })
      .select("id")
      .single();
    if (error) throw error;
    if (payload.templateId) {
      const template = state.templates.find((item) => item.id === payload.templateId);
      const subtasks = template.subtasks.map((item) => ({ user_id: userId, main_task_id: data.id, title: item.title }));
      if (subtasks.length) {
        const { error: subtasksError } = await this.client.from("subtasks").insert(subtasks);
        if (subtasksError) throw subtasksError;
      }
    }
  }

  async createSubtask(mainTaskId, title) {
    const { error } = await this.client.from("subtasks").insert({
      user_id: await this.userId(),
      main_task_id: mainTaskId,
      title,
    });
    if (error) throw error;
  }

  async toggleSubtask(subtaskId, completed) {
    const { error } = await this.client.from("subtasks").update({ completed }).eq("id", subtaskId);
    if (error) throw error;
  }

  async createStepItem(subtaskId, title) {
    const { error } = await this.client.from("step_items").insert({
      user_id: await this.userId(),
      subtask_id: subtaskId,
      title,
    });
    if (error) throw error;
  }

  async toggleStepItem(stepItemId, completed) {
    const { error } = await this.client.from("step_items").update({ completed }).eq("id", stepItemId);
    if (error) throw error;
  }

  async deleteMainTask(mainTaskId) {
    const { error } = await this.client.from("main_tasks").delete().eq("id", mainTaskId);
    if (error) throw error;
  }

  async createTemplate(payload) {
    const userId = await this.userId();
    const { data, error } = await this.client
      .from("task_templates")
      .insert({ user_id: userId, title: payload.title, description: payload.description })
      .select("id")
      .single();
    if (error) throw error;
    const subtasks = payload.subtasks.map((title) => ({ user_id: userId, template_id: data.id, title }));
    if (subtasks.length) {
      const { error: subtasksError } = await this.client.from("template_subtasks").insert(subtasks);
      if (subtasksError) throw subtasksError;
    }
  }

  async deleteTemplate(templateId) {
    const { error } = await this.client.from("task_templates").delete().eq("id", templateId);
    if (error) throw error;
  }

  async addDailyTask(subtaskId) {
    const { error } = await this.client.from("daily_tasks").upsert(
      { user_id: await this.userId(), subtask_id: subtaskId, task_date: today() },
      { onConflict: "user_id,subtask_id,task_date" },
    );
    if (error) throw error;
  }

  async removeDailyTask(dailyTaskId) {
    const { error } = await this.client.from("daily_tasks").delete().eq("id", dailyTaskId);
    if (error) throw error;
  }
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

function currentRoute() {
  const route = window.location.hash.replace("#", "");
  return ROUTES.includes(route) ? route : "today";
}

function findSubtask(subtaskId) {
  for (const mainTask of state.mainTasks) {
    const subtask = mainTask.subtasks.find((item) => item.id === subtaskId);
    if (subtask) return { subtask, mainTask };
  }
  return {};
}

function renderTaskRow(subtask, mainTask, options = {}) {
  const dailyTask = state.dailyTasks.find((item) => item.subtaskId === subtask.id);
  const stepItems = subtask.stepItems || [];
  const action = options.today
    ? `<button class="icon-button" type="button" data-action="remove-daily" data-id="${dailyTask.id}" aria-label="Remove ${escapeHtml(subtask.title)} from today">×</button>`
    : `<button class="button button-small ${dailyTask ? "button-quiet" : "button-primary"}" type="button" data-action="add-daily" data-id="${subtask.id}" ${dailyTask ? "disabled" : ""}>${dailyTask ? "Added" : "+ Today"}</button>`;
  return `
    <div class="task-group">
      <div class="task-row ${subtask.completed ? "completed" : ""}">
        <input type="checkbox" data-action="toggle-subtask" data-id="${subtask.id}" ${subtask.completed ? "checked" : ""} aria-label="Mark ${escapeHtml(subtask.title)} complete" />
        <div class="task-text">
          <div class="task-name">${escapeHtml(subtask.title)}</div>
          ${options.today ? `<div class="task-source">${escapeHtml(mainTask.title)}</div>` : ""}
        </div>
        ${action}
      </div>
      ${stepItems.length ? `<div class="step-item-list">${stepItems.map(renderStepItem).join("")}</div>` : ""}
      <button class="add-step-item" type="button" data-action="open-step-item-modal" data-id="${subtask.id}">+ Add subtask</button>
    </div>
  `;
}

function renderStepItem(stepItem) {
  return `
    <label class="step-item ${stepItem.completed ? "completed" : ""}">
      <input type="checkbox" data-action="toggle-step-item" data-id="${stepItem.id}" ${stepItem.completed ? "checked" : ""} />
      <span>${escapeHtml(stepItem.title)}</span>
    </label>
  `;
}

function renderToday() {
  const dailyItems = state.dailyTasks.map((dailyTask) => ({ dailyTask, ...findSubtask(dailyTask.subtaskId) })).filter((item) => item.subtask);
  const completed = dailyItems.filter(({ subtask }) => subtask.completed).length;
  const progress = dailyItems.length ? Math.round((completed / dailyItems.length) * 100) : 0;
  const date = new Date();
  app.innerHTML = `
    <section class="page-title-row">
      <div>
        <p class="eyebrow">Today's gentle focus</p>
        <h1>A little progress goes a long way.</h1>
        <p class="page-intro">Choose small, finishable steps from your bigger tasks. This is your list for today.</p>
      </div>
      <div class="date-card"><strong>${date.getDate()}</strong><span>${date.toLocaleDateString(undefined, { month: "short" })}</span></div>
    </section>
    <section class="section">
      <div class="section-heading">
        <div>
          <h2>Today's list</h2>
          <p>${completed} of ${dailyItems.length} small tasks complete</p>
        </div>
        <a class="button button-primary" href="#tasks">+ Choose tasks</a>
      </div>
      ${
        dailyItems.length
          ? `<div class="card">
              <div class="progress-line"><div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div><span>${progress}%</span></div>
              <div class="task-list">${dailyItems.map(({ subtask, mainTask }) => renderTaskRow(subtask, mainTask, { today: true })).join("")}</div>
            </div>`
          : `<div class="empty-state">
              <h2>Start with one small thing</h2>
              <p>Your daily list is empty. Pick a few subtasks from your main tasks and they will appear here.</p>
              <div class="empty-state-actions"><a class="button button-primary" href="#tasks">Choose from main tasks</a></div>
            </div>`
      }
    </section>
  `;
}

function renderTasks() {
  app.innerHTML = `
    <section class="page-title-row">
      <div>
        <p class="eyebrow">Your bigger picture</p>
        <h1>Main tasks</h1>
        <p class="page-intro">Break each goal into small steps, then choose only what belongs on today's list.</p>
      </div>
      <button class="button button-primary" type="button" data-action="open-main-task-modal">+ New main task</button>
    </section>
    ${
      state.mainTasks.length
        ? `<div class="grid">${state.mainTasks.map(renderMainTaskCard).join("")}</div>`
        : `<div class="empty-state"><h2>No main tasks yet</h2><p>Create a main task from scratch or use one of your templates.</p><div class="empty-state-actions"><button class="button button-primary" type="button" data-action="open-main-task-modal">Create a main task</button></div></div>`
    }
  `;
}

function renderMainTaskCard(mainTask) {
  const completed = mainTask.subtasks.filter((item) => item.completed).length;
  return `
    <article class="card">
      <header class="card-header">
        <h3>${escapeHtml(mainTask.title)}</h3>
        <p>${escapeHtml(mainTask.description || `${mainTask.subtasks.length} small steps`)}</p>
      </header>
      <div class="task-list">${mainTask.subtasks.map((subtask) => renderTaskRow(subtask, mainTask)).join("")}</div>
      <div class="card-actions">
        <span class="card-meta">${completed}/${mainTask.subtasks.length} done</span>
        <button class="button button-small button-quiet" type="button" data-action="open-subtask-modal" data-id="${mainTask.id}">+ Add step</button>
        <button class="button button-small button-quiet button-danger" type="button" data-action="delete-main-task" data-id="${mainTask.id}">Delete</button>
      </div>
    </article>
  `;
}

function renderTemplates() {
  app.innerHTML = `
    <section class="page-title-row">
      <div>
        <p class="eyebrow">Your reusable recipes</p>
        <h1>Templates</h1>
        <p class="page-intro">Save a set of default small tasks for goals that come around again and again.</p>
      </div>
      <button class="button button-primary" type="button" data-action="open-template-modal">+ New template</button>
    </section>
    ${
      state.templates.length
        ? `<div class="grid">${state.templates.map(renderTemplateCard).join("")}</div>`
        : `<div class="empty-state"><h2>No templates yet</h2><p>Create your first reusable checklist.</p><div class="empty-state-actions"><button class="button button-primary" type="button" data-action="open-template-modal">Create a template</button></div></div>`
    }
  `;
}

function renderTemplateCard(template) {
  return `
    <article class="card">
      <header class="card-header">
        <h3>${escapeHtml(template.title)}</h3>
        <p>${escapeHtml(template.description || `${template.subtasks.length} default steps`)}</p>
      </header>
      <div class="task-list">
        ${template.subtasks.map((subtask) => `<div class="task-row"><div class="task-text">${escapeHtml(subtask.title)}</div></div>`).join("")}
      </div>
      <div class="card-actions">
        <button class="button button-small button-primary" type="button" data-action="use-template" data-id="${template.id}">Use template</button>
        <button class="button button-small button-quiet button-danger" type="button" data-action="delete-template" data-id="${template.id}">Delete</button>
      </div>
    </article>
  `;
}

function render() {
  document.querySelectorAll(".main-nav a").forEach((link) => link.classList.toggle("active", link.dataset.route === currentRoute()));
  ({ today: renderToday, tasks: renderTasks, templates: renderTemplates })[currentRoute()]();
}

function showModal(content) {
  document.body.insertAdjacentHTML("beforeend", `<div class="modal-backdrop"><div class="modal-card">${content}</div></div>`);
}

function closeModal() {
  document.querySelector(".modal-backdrop")?.remove();
}

function showMainTaskModal(templateId = "") {
  showModal(`
    <form id="main-task-form">
      <div class="dialog-heading"><div><p class="eyebrow">New goal</p><h2>Create a main task</h2></div><button class="icon-button" type="button" data-action="close-modal" aria-label="Close">×</button></div>
      <label>Title<input name="title" required placeholder="e.g. Prepare for my trip" /></label>
      <label>Description<textarea name="description" placeholder="A short note to keep the goal clear"></textarea></label>
      <label>Start from a template<select name="templateId"><option value="">Blank main task</option>${state.templates.map((template) => `<option value="${template.id}" ${template.id === templateId ? "selected" : ""}>${escapeHtml(template.title)}</option>`).join("")}</select></label>
      <div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-modal">Cancel</button><button class="button button-primary">Create main task</button></div>
    </form>
  `);
}

function showSubtaskModal(mainTaskId) {
  const mainTask = state.mainTasks.find((item) => item.id === mainTaskId);
  showModal(`
    <form id="subtask-form" data-id="${mainTask.id}">
      <div class="dialog-heading"><div><p class="eyebrow">${escapeHtml(mainTask.title)}</p><h2>Add a small step</h2></div><button class="icon-button" type="button" data-action="close-modal" aria-label="Close">×</button></div>
      <label>Small task<input name="title" required autofocus placeholder="e.g. Book the train tickets" /></label>
      <div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-modal">Cancel</button><button class="button button-primary">Add step</button></div>
    </form>
  `);
}

function showStepItemModal(subtaskId) {
  const { subtask } = findSubtask(subtaskId);
  showModal(`
    <form id="step-item-form" data-id="${subtask.id}">
      <div class="dialog-heading"><div><p class="eyebrow">${escapeHtml(subtask.title)}</p><h2>Add a subtask</h2></div><button class="icon-button" type="button" data-action="close-modal" aria-label="Close">×</button></div>
      <label>Subtask<input name="title" required autofocus placeholder="e.g. Write the opening paragraph" /></label>
      <div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-modal">Cancel</button><button class="button button-primary">Add subtask</button></div>
    </form>
  `);
}

function showTemplateModal() {
  showModal(`
    <form id="template-form">
      <div class="dialog-heading"><div><p class="eyebrow">Reusable checklist</p><h2>Create a template</h2></div><button class="icon-button" type="button" data-action="close-modal" aria-label="Close">×</button></div>
      <label>Template title<input name="title" required placeholder="e.g. Pack for a weekend away" /></label>
      <label>Description<textarea name="description" placeholder="When this checklist is useful"></textarea></label>
      <label>Default small tasks<textarea name="subtasks" required placeholder="Add one task per line&#10;Pack a toothbrush&#10;Charge headphones"></textarea></label>
      <div class="dialog-actions"><button class="button button-quiet" type="button" data-action="close-modal">Cancel</button><button class="button button-primary">Save template</button></div>
    </form>
  `);
}

async function refresh(message) {
  state = await store.load();
  render();
  if (message) showToast(message);
}

async function run(action, successMessage) {
  try {
    await action();
    await refresh(successMessage);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Something went wrong.");
  }
}

async function initializeStore() {
  const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
  if (!config) {
    store = new DemoStore();
    settingsLabel.textContent = "Demo mode";
    return refresh();
  }
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const client = createClient(config.url, config.key);
  const { data } = await client.auth.getSession();
  if (!data.session) {
    renderAuth(client);
    return;
  }
  store = new SupabaseStore(client);
  document.body.classList.add("cloud-mode");
  settingsLabel.textContent = "Cloud sync";
  await refresh();
}

function renderAuth(client) {
  app.innerHTML = `
    <section class="auth-card">
      <p class="eyebrow">One quick step</p>
      <h2>Sign in to your task list</h2>
      <p>Enter your email and Supabase will send you a magic link. No password needed.</p>
      <p class="setup-note">In Supabase Auth URL Configuration, use this exact Site URL and Redirect URL:<br /><strong>${escapeHtml(authRedirectUrl())}</strong></p>
      <form id="auth-form">
        <label>Email address<input type="email" name="email" required placeholder="you@example.com" /></label>
        <div class="auth-actions"><button class="button button-primary">Send magic link</button><button class="button button-quiet" type="button" data-action="switch-demo">Back to demo</button></div>
      </form>
    </section>
  `;
  document.querySelector("#auth-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get("email");
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: authRedirectUrl() } });
    showToast(error ? `${error.message} Check your Supabase project URL and Auth redirect URL.` : "Magic link sent. Check your email.");
  });
}

document.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  if (event.target.id === "main-task-form") {
    await run(() => store.createMainTask(data), "Main task created.");
    closeModal();
  }
  if (event.target.id === "subtask-form") {
    await run(() => store.createSubtask(event.target.dataset.id, data.title), "Small step added.");
    closeModal();
  }
  if (event.target.id === "step-item-form") {
    await run(() => store.createStepItem(event.target.dataset.id, data.title), "Subtask added.");
    closeModal();
  }
  if (event.target.id === "template-form") {
    data.subtasks = data.subtasks.split("\n").map((item) => item.trim()).filter(Boolean);
    await run(() => store.createTemplate(data), "Template saved.");
    closeModal();
  }
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const { action, id: targetId } = target.dataset;
  if (action === "open-main-task-modal") showMainTaskModal();
  if (action === "open-subtask-modal") showSubtaskModal(targetId);
  if (action === "open-step-item-modal") showStepItemModal(targetId);
  if (action === "open-template-modal") showTemplateModal();
  if (action === "close-modal") closeModal();
  if (action === "use-template") showMainTaskModal(targetId);
  if (action === "add-daily") await run(() => store.addDailyTask(targetId), "Added to today's list.");
  if (action === "remove-daily") await run(() => store.removeDailyTask(targetId), "Removed from today's list.");
  if (action === "delete-main-task" && confirm("Delete this main task and its small steps?")) await run(() => store.deleteMainTask(targetId), "Main task deleted.");
  if (action === "delete-template" && confirm("Delete this template?")) await run(() => store.deleteTemplate(targetId), "Template deleted.");
  if (action === "switch-demo") {
    localStorage.removeItem(CONFIG_KEY);
    window.location.reload();
  }
});

document.addEventListener("change", async (event) => {
  if (event.target.dataset.action === "toggle-subtask") {
    await run(() => store.toggleSubtask(event.target.dataset.id, event.target.checked), event.target.checked ? "Nice work. One step done." : "Step reopened.");
  }
  if (event.target.dataset.action === "toggle-step-item") {
    await run(() => store.toggleStepItem(event.target.dataset.id, event.target.checked), event.target.checked ? "Subtask complete." : "Subtask reopened.");
  }
});

window.addEventListener("hashchange", render);
settingsButton.addEventListener("click", () => {
  const config = JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
  document.querySelector("#supabase-url").value = config?.url || "";
  document.querySelector("#supabase-key").value = config?.key || "";
  settingsDialog.showModal();
});
settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const urlInput = document.querySelector("#supabase-url").value.trim();
  const key = document.querySelector("#supabase-key").value.trim();
  if (!urlInput || !key) {
    document.querySelector("#settings-message").textContent = "Add both values to connect your project.";
    return;
  }
  let url;
  try {
    url = normalizeSupabaseUrl(urlInput);
  } catch (error) {
    document.querySelector("#settings-message").textContent = error.message;
    return;
  }
  localStorage.setItem(CONFIG_KEY, JSON.stringify({ url, key }));
  window.location.reload();
});
document.querySelector("#use-demo-button").addEventListener("click", () => {
  localStorage.removeItem(CONFIG_KEY);
  window.location.reload();
});

initializeStore().catch((error) => {
  console.error(error);
  document.querySelector("#settings-message").textContent = error.message;
  settingsDialog.showModal();
});
