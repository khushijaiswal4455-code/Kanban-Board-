"use strict";

const TASKS_KEY = "taskflow-tasks";
const THEME_KEY = "taskflow-theme";
const STATUSES = ["todo", "in-progress", "done"];
const PRIORITIES = ["low", "medium", "high"];

const form = document.querySelector("#task-form");
const titleInput = document.querySelector("#title");
const descriptionInput = document.querySelector("#description");
const priorityInput = document.querySelector("#priority");
const dueDateInput = document.querySelector("#due-date");

const formTitle = document.querySelector("#form-title");
const submitButton = document.querySelector("#submit-button");
const cancelEditButton = document.querySelector("#cancel-edit");
const searchInput = document.querySelector("#search");
const priorityFilter = document.querySelector("#priority-filter");
const undoButton = document.querySelector("#undo-delete");
const themeToggle = document.querySelector("#theme-toggle");
const board = document.querySelector(".board");
const notice = document.querySelector("#notice");
const template = document.querySelector("#task-template");

const lists = {
  todo: document.querySelector("#todo-list"),
  "in-progress": document.querySelector("#in-progress-list"),
  done: document.querySelector("#done-list")
};

const counts = {
  todo: document.querySelector("#todo-count"),
  "in-progress": document.querySelector("#progress-count"),
  done: document.querySelector("#done-count")
};

let editingId = null;
let lastDeleted = null;
let noticeTimer;
let tasks = loadTasks();

initializeTheme();
render();

// ---------- Storage ----------

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10))
  );
}

function isValidTask(task) {
  return (
    task !== null &&
    typeof task === "object" &&
    typeof task.id === "string" &&
    typeof task.title === "string" &&
    task.title.trim().length > 0 &&
    typeof task.description === "string" &&
    PRIORITIES.includes(task.priority) &&
    STATUSES.includes(task.status) &&
    isValidDate(task.dueDate)
  );
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(TASKS_KEY);

    if (!saved) return [];

    const parsed = JSON.parse(saved);

    if (!Array.isArray(parsed)) {
      throw new Error("Invalid saved task data.");
    }

    const seen = new Set();

    return parsed.filter(task => {
      if (!isValidTask(task) || seen.has(task.id)) return false;
      seen.add(task.id);
      return true;
    });
  } catch (error) {
    console.error("Unable to load tasks:", error);
    showNotice("Saved tasks could not be loaded. Starting with an empty board.");
    return [];
  }
}

function saveTasks() {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Unable to save tasks:", error);
    showNotice("Storage is unavailable. Changes will last only for this session.");
  }
}

function commitChanges(message) {
  render();
  showNotice(message);
  saveTasks();
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ---------- Theme ----------

function initializeTheme() {
  let theme = window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

  try {
    const savedTheme = localStorage.getItem(THEME_KEY);

    if (savedTheme === "light" || savedTheme === "dark") {
      theme = savedTheme;
    }
  } catch (error) {
    console.warn("Theme preference could not be loaded:", error);
  }

  applyTheme(theme);
}

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.documentElement.dataset.theme = theme;
  themeToggle.textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

themeToggle.addEventListener("click", () => {
  const theme =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";

  applyTheme(theme);

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (error) {
    console.warn("Theme preference could not be saved:", error);
    showNotice("Theme changed, but the preference could not be saved.");
  }
});

// ---------- Form ----------

titleInput.addEventListener("input", () => {
  titleInput.setCustomValidity(
    titleInput.value.trim() ? "" : "Please enter a task title."
  );
});

form.addEventListener("submit", event => {
  event.preventDefault();

  const title = titleInput.value.trim();

  titleInput.setCustomValidity(
    title ? "" : "Please enter a task title."
  );

  dueDateInput.setCustomValidity(
    isValidDate(dueDateInput.value) ? "" : "Please enter a valid due date."
  );

  if (!form.reportValidity()) return;

  const taskData = {
    title,
    description: descriptionInput.value.trim(),
    priority: priorityInput.value,
    dueDate: dueDateInput.value
  };

  const wasEditing = editingId !== null;

  if (wasEditing) {
    tasks = tasks.map(task =>
      task.id === editingId ? { ...task, ...taskData } : task
    );
  } else {
    tasks.push({
      id: createId(),
      ...taskData,
      status: "todo"
    });
  }

  resetForm();
  commitChanges(wasEditing ? "Task updated." : "Task added to To Do.");
});

dueDateInput.addEventListener("input", () => {
  dueDateInput.setCustomValidity("");
});

cancelEditButton.addEventListener("click", resetForm);

function resetForm() {
  editingId = null;
  form.reset();
  titleInput.setCustomValidity("");
  dueDateInput.setCustomValidity("");

  formTitle.textContent = "Add a task";
  submitButton.textContent = "Add task";
  cancelEditButton.hidden = true;
}

function startEditing(task) {
  editingId = task.id;

  titleInput.value = task.title;
  descriptionInput.value = task.description;
  priorityInput.value = task.priority;
  dueDateInput.value = task.dueDate;

  titleInput.setCustomValidity("");
  dueDateInput.setCustomValidity("");

  formTitle.textContent = "Edit task";
  submitButton.textContent = "Save changes";
  cancelEditButton.hidden = false;

  form.scrollIntoView({ behavior: "smooth", block: "center" });
  titleInput.focus({ preventScroll: true });
}

// ---------- Rendering ----------

function getToday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const selectedPriority = priorityFilter.value;
  const today = getToday();

  const filteredTasks = tasks.filter(task => {
    const matchesTitle = task.title.toLowerCase().includes(query);
    const matchesPriority =
      selectedPriority === "all" || task.priority === selectedPriority;

    return matchesTitle && matchesPriority;
  });

  STATUSES.forEach(status => {
    const list = lists[status];
    const columnTasks = filteredTasks.filter(task => task.status === status);

    list.replaceChildren();
    counts[status].textContent = columnTasks.length;

    if (columnTasks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent =
        query || selectedPriority !== "all"
          ? "No matching tasks."
          : "No tasks here yet.";

      list.append(empty);
      return;
    }

    columnTasks.forEach(task => {
      list.append(createTaskCard(task, today));
    });
  });

  renderSummary();
  undoButton.disabled = lastDeleted === null;
}

function createTaskCard(task, today) {
  const card = template.content.firstElementChild.cloneNode(true);
  const statusIndex = STATUSES.indexOf(task.status);
  const overdue = task.status !== "done" && task.dueDate < today;

  card.dataset.id = task.id;
  card.classList.toggle("overdue", overdue);

  const badge = card.querySelector(".priority-badge");
  badge.textContent = task.priority;
  badge.classList.add(`priority-${task.priority}`);

  card.querySelector(".overdue-label").hidden = !overdue;
  card.querySelector(".task-title").textContent = task.title;

  const description = card.querySelector(".task-description");
  description.textContent = task.description;
  description.hidden = !task.description;

  card.querySelector(".task-date").textContent =
    `Due: ${formatDate(task.dueDate)}`;

  const previousButton = card.querySelector('[data-action="previous"]');
  const nextButton = card.querySelector('[data-action="next"]');

  previousButton.disabled = statusIndex === 0;
  nextButton.disabled = statusIndex === STATUSES.length - 1;

  card.querySelector('[data-action="edit"]').setAttribute(
    "aria-label",
    `Edit ${task.title}`
  );

  card.querySelector('[data-action="delete"]').setAttribute(
    "aria-label",
    `Delete ${task.title}`
  );

  return card;
}

function renderSummary() {
  const totals = tasks.reduce(
    (result, task) => {
      result[task.status] += 1;
      return result;
    },
    { todo: 0, "in-progress": 0, done: 0 }
  );

  const percentage =
    tasks.length === 0
      ? 0
      : Math.round((totals.done / tasks.length) * 100);

  document.querySelector("#summary-text").textContent =
    `${tasks.length} total · ${totals.todo} to do · ` +
    `${totals["in-progress"]} in progress · ${totals.done} done`;

  document.querySelector("#completion-label").textContent =
    `${percentage}% complete`;

  document.querySelector("#progress-fill").style.width = `${percentage}%`;
  document.querySelector("#progress").setAttribute(
    "aria-valuenow",
    String(percentage)
  );
}

// ---------- Search and filtering ----------

searchInput.addEventListener("input", render);
priorityFilter.addEventListener("change", render);

// ---------- Delegated card actions ----------

board.addEventListener("click", event => {
  const button = event.target.closest("button[data-action]");

  if (!button || button.disabled) return;

  const card = button.closest(".task-card");
  if (!card) return;

  const task = tasks.find(item => item.id === card.dataset.id);
  if (!task) return;

  switch (button.dataset.action) {
    case "edit":
      startEditing(task);
      break;

    case "delete":
      deleteTask(task);
      break;

    case "previous":
      moveTask(task, -1);
      break;

    case "next":
      moveTask(task, 1);
      break;
  }
});

function deleteTask(task) {
  const confirmed = window.confirm(`Delete "${task.title}"?`);

  if (!confirmed) return;

  lastDeleted = {
    task: { ...task },
    index: tasks.findIndex(item => item.id === task.id)
  };

  tasks = tasks.filter(item => item.id !== task.id);

  if (editingId === task.id) {
    resetForm();
  }

  commitChanges("Task deleted. Use Undo delete to restore it.");
}

function moveTask(task, direction) {
  const currentIndex = STATUSES.indexOf(task.status);
  const nextStatus = STATUSES[currentIndex + direction];

  if (!nextStatus) return;

  tasks = tasks.map(item =>
    item.id === task.id ? { ...item, status: nextStatus } : item
  );

  const statusNames = {
    todo: "To Do",
    "in-progress": "In Progress",
    done: "Done"
  };

  commitChanges(`Task moved to ${statusNames[nextStatus]}.`);
}

undoButton.addEventListener("click", () => {
  if (!lastDeleted) return;

  tasks.splice(lastDeleted.index, 0, lastDeleted.task);
  lastDeleted = null;

  commitChanges("Deleted task restored.");
});

// ---------- Notifications ----------

function showNotice(message) {
  clearTimeout(noticeTimer);
  notice.textContent = message;

  noticeTimer = setTimeout(() => {
    notice.textContent = "";
  }, 6000);
}

// Refresh overdue labels if the page remains open overnight.
setInterval(render, 60000);