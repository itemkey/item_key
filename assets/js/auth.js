// =========================
// ITEM-KEY AUTH SYSTEM
// =========================

const USERS_KEY = "itemkey.users";
const CURRENT_KEY = "itemkey.currentUser";

// utils
const load = key => JSON.parse(localStorage.getItem(key) || "null");
const save = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// элементы
const guestBox = document.getElementById("authGuest");
const profileBox = document.getElementById("authProfile");

// tabs
document.querySelectorAll(".auth-tab").forEach(tab => {
  tab.onclick = () => {
    document.querySelectorAll(".auth-tab").forEach(t => t.classList.remove("is-active"));
    tab.classList.add("is-active");

    document.getElementById("loginForm").classList.toggle("hidden", tab.dataset.tab !== "login");
    document.getElementById("registerForm").classList.toggle("hidden", tab.dataset.tab !== "register");
  };
});

// регистрация
document.getElementById("registerForm").onsubmit = e => {
  e.preventDefault();

  const name = regName.value.trim();
  const email = regEmail.value.trim();
  const pass = regPass.value;

  let users = load(USERS_KEY) || [];

  if (users.find(u => u.name === name)) {
    alert("логин уже существует");
    return;
  }
  if (users.find(u => String(u.email).toLowerCase() === email.toLowerCase())) {
  alert("почта уже используется");
  return;
}


  const user = { id: Date.now(), name, email, pass };
  users.push(user);

  save(USERS_KEY, users);
  save(CURRENT_KEY, user);

  location.reload();
};

// вход
document.getElementById("loginForm").onsubmit = e => {
  e.preventDefault();

  const login = loginName.value.trim().toLowerCase(); // тут может быть логин или почта
  const pass = loginPass.value;

  const users = load(USERS_KEY) || [];

  const user = users.find(u => {
    const uname = String(u.name || "").trim().toLowerCase();
    const uemail = String(u.email || "").trim().toLowerCase();

    const isMatchLogin = uname === login;
    const isMatchEmail = uemail === login;

    // вход разрешаем либо по логину, либо по почте
    return (isMatchLogin || isMatchEmail) && u.pass === pass;
  });

  if (!user) {
    alert("неверный логин/почта или пароль");
    return;
  }

  save(CURRENT_KEY, user);
  location.reload();
};


// выход
document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem(CURRENT_KEY);
  location.reload();
};

// автологин
const current = load(CURRENT_KEY);

if (current) {
  guestBox.classList.add("hidden");
  profileBox.classList.remove("hidden");
  pLogin.textContent = current.name;
  pEmail.textContent = current.email;
}
