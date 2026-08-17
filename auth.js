const app = document.getElementById('app');

function renderAuth(){
  app.innerHTML = topbarHtml() + `
    <div class="auth-wrap">
      <div class="auth-card">
        ${regMarksHtml()}
        <div class="auth-brand">
          <div class="brand-mark"><span>Р</span></div>
          <div class="brand-text">
            <div class="t1 mono">РЕЕСТР ОТЧЁТОВ</div>
            <div class="t2" style="font-size:16px;">Вход в систему</div>
          </div>
        </div>
        <div class="auth-tabs">
          <button type="button" class="auth-tab active" data-tab="login">Вход</button>
          <button type="button" class="auth-tab" data-tab="register">Регистрация</button>
        </div>
        <div class="field">
          <label>Логин</label>
          <input type="text" id="auth-username" autocomplete="username" placeholder="Ваш логин">
        </div>
        <div class="field" style="margin-bottom:6px;">
          <label>Пароль</label>
          <input type="password" id="auth-password" autocomplete="current-password" placeholder="Пароль">
        </div>
        <button class="btn solid auth-submit" id="auth-submit-btn">Войти</button>
        <div class="auth-err" id="auth-err"></div>
        <div class="auth-hint" id="auth-hint">Нет аккаунта? Переключитесь на «Регистрация» выше.</div>
      </div>
    </div>
  `;
  bindTopbarLogout();

  let mode = 'login';
  const tabs = app.querySelectorAll('.auth-tab');
  const submitBtn = app.querySelector('#auth-submit-btn');
  const hint = app.querySelector('#auth-hint');
  const errEl = app.querySelector('#auth-err');
  const userInp = app.querySelector('#auth-username');
  const passInp = app.querySelector('#auth-password');

  function setMode(m){
    mode = m;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === m));
    submitBtn.textContent = m === 'login' ? 'Войти' : 'Зарегистрироваться';
    hint.textContent = m === 'login' ? 'Нет аккаунта? Переключитесь на «Регистрация» выше.' : 'Уже есть аккаунт? Переключитесь на «Вход» выше.';
    errEl.style.display = 'none';
  }
  tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.tab)));

  async function doSubmit(){
    const username = userInp.value.trim();
    const password = passInp.value;
    errEl.style.display = 'none';
    if(!username || !password){
      errEl.textContent = 'Введите логин и пароль';
      errEl.style.display = 'block';
      return;
    }
    submitBtn.disabled = true;
    const prevText = submitBtn.textContent;
    submitBtn.textContent = 'Подождите…';
    try{
      const path = mode === 'login' ? '/api/login' : '/api/register';
      const data = await api(path, {method:'POST', body: JSON.stringify({username, password})});
      setAuth(data.token, data.username);
      showToast(mode === 'login' ? 'Добро пожаловать!' : 'Аккаунт создан');
      location.href = 'list.html';
    }catch(e){
      errEl.textContent = e.message || 'Ошибка входа';
      errEl.style.display = 'block';
    }finally{
      submitBtn.disabled = false;
      submitBtn.textContent = prevText;
    }
  }
  submitBtn.addEventListener('click', doSubmit);
  [userInp, passInp].forEach(inp => inp.addEventListener('keydown', e => { if(e.key === 'Enter') doSubmit(); }));
  setMode('login');
  userInp.focus();
}

// Если уже залогинены — сразу в реестр отчётов
if(getToken()){
  location.href = 'list.html';
} else {
  renderAuth();
}
