/*
 * Set API_URL to the deployed Google Apps Script web app URL ending in /exec.
 * This starter uses JSONP because GitHub Pages and Apps Script are on different origins.
 * Do not put passwords or answer keys in this public file.
 */
const API_URL = https://script.google.com/macros/s/AKfycbzUEgbQABgtnEcJF6NWs2U7yMbPpm6ZxQdieKKfKhZrhe-QqdNBQwSXT4bwdpGX_cO1/exec;
const $ = (id) => document.getElementById(id);
const views = ['welcomeView','quizView','resultView','teacherLoginView','dashboardView'];
let questions = [], answers = {}, currentIndex = 0, sessionId = '', studentName = '', lecturerToken = '';
let dashboardTimer = null, toastTimer = null;

function showView(id) { views.forEach(v => $(v).classList.toggle('hidden', v !== id)); window.scrollTo({top:0,behavior:'smooth'}); }
function toast(message) {
  $('toast').textContent = message; $('toast').classList.remove('hidden');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 3200);
}
function api(action, params={}) {
  return new Promise((resolve, reject) => {
    if (!API_URL.startsWith('https://script.google.com/')) return reject(new Error('Atur API_URL pada app.js terlebih dahulu.'));
    const callback = 'quizCallback_' + Date.now() + '_' + Math.floor(Math.random()*1e6);
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(new Error('Server tidak merespons. Periksa deployment Apps Script dan koneksi internet.')), 20000);
    function finish(err, data) {
      clearTimeout(timer); delete window[callback]; script.remove();
      err ? reject(err) : resolve(data);
    }
    window[callback] = data => finish(null, data);
    const query = new URLSearchParams({...params, action, callback});
    script.onerror = () => finish(new Error('Gagal menghubungi Apps Script. Periksa URL deployment.'));
    script.src = API_URL + '?' + query.toString();
    document.body.appendChild(script);
  });
}
function requireOk(data) { if (!data || !data.ok) throw new Error((data && data.error) || 'Permintaan gagal.'); return data; }

$('startForm').addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('studentName').value.trim();
  const button = e.submitter; button.disabled = true; button.textContent = 'Menyiapkan kuis…';
  try {
    const data = requireOk(await api('start', {name}));
    sessionId = data.sid; studentName = data.name; questions = data.questions; answers = {};
    currentIndex = 0;
    $('helloStudent').textContent = 'Halo, ' + studentName + '!';
    renderQuestion(); showView('quizView');
    toast('Kuis dimulai. Jawaban tersimpan otomatis.');
  } catch(err) { toast(err.message); }
  finally { button.disabled = false; button.innerHTML = 'Mulai kuis <span>→</span>'; }
});

function renderQuestion() {
  const q = questions[currentIndex]; if (!q) return;
  $('questionCount').textContent = `Soal ${currentIndex+1} dari ${questions.length}`;
  $('answeredCount').textContent = `${Object.keys(answers).length} dijawab`;
  $('progressBar').style.width = `${Object.keys(answers).length / questions.length * 100}%`;
  $('questionText').textContent = q.question;
  $('options').innerHTML = '';
  q.options.forEach((label, i) => {
    const value = ['A','B','C','D'][i];
    const wrapper = document.createElement('label'); wrapper.className = 'option' + (answers[q.id] === value ? ' selected' : '');
    const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'answer'; radio.value = value; radio.checked = answers[q.id] === value;
    radio.addEventListener('change', () => chooseAnswer(q.id, value));
    const letter = document.createElement('span'); letter.className = 'option-letter'; letter.textContent = value + '.';
    const text = document.createElement('span'); text.textContent = label;
    wrapper.append(radio, letter, text); $('options').appendChild(wrapper);
  });
  $('prevButton').disabled = currentIndex === 0;
  $('nextButton').textContent = currentIndex === questions.length-1 ? 'Kembali ke awal ↑' : 'Berikutnya →';
  const grid = $('questionGrid'); grid.innerHTML = '';
  questions.forEach((item, i) => {
    const b = document.createElement('button'); b.type='button'; b.className='question-number' + (answers[item.id] ? ' answered' : '') + (i===currentIndex ? ' current' : '');
    b.textContent = i+1; b.title = 'Buka soal ' + (i+1); b.addEventListener('click', () => { currentIndex=i; renderQuestion(); }); grid.appendChild(b);
  });
  $('saveStatus').textContent = 'Jawaban tersimpan otomatis';
}
async function chooseAnswer(qid, value) {
  answers[qid] = value; renderQuestion(); $('saveStatus').textContent = 'Menyimpan…';
  try { requireOk(await api('answer', {sid:sessionId, qid, answer:value})); $('saveStatus').textContent = 'Tersimpan'; }
  catch(err) { $('saveStatus').textContent = 'Belum tersimpan'; toast(err.message); }
}
$('prevButton').addEventListener('click', () => { if(currentIndex>0){currentIndex--;renderQuestion();} });
$('nextButton').addEventListener('click', () => { currentIndex = currentIndex === questions.length-1 ? 0 : currentIndex+1; renderQuestion(); });
$('submitButton').addEventListener('click', async () => {
  const unanswered = questions.length - Object.keys(answers).length;
  if (unanswered && !confirm(`Masih ada ${unanswered} soal yang belum dijawab. Kirim kuis sekarang? Soal kosong akan dihitung salah.`)) return;
  if (!confirm('Kirim jawaban dan akhiri kuis? Jawaban tidak dapat diubah setelah dikirim.')) return;
  $('submitButton').disabled = true; $('submitButton').textContent = 'Mengirim…';
  try {
    const data = requireOk(await api('submit', {sid:sessionId}));
    if (data.review) questions = data.review;
    renderResult(data.result); showView('resultView');
  }
  catch(err) { toast(err.message); }
  finally { $('submitButton').disabled=false; $('submitButton').textContent='Kirim jawaban'; }
});
function renderResult(result) {
  $('resultName').textContent = result.name;
  $('resultScore').textContent = result.score;
  $('resultCorrect').textContent = result.correct;
  $('resultIncorrect').textContent = result.incorrect;
  $('resultWrongNumbers').textContent = result.wrongNumbers.length ? result.wrongNumbers.join(', ') : 'Tidak ada';
  $('reviewList').innerHTML = '';
  questions.forEach((q, i) => {
    const selected = answers[q.id] || 'Kosong';
    const correct = selected === q.key;
    const item = document.createElement('article'); item.className = 'review-item ' + (correct ? 'correct':'incorrect');
    const title = document.createElement('h3'); title.textContent = `${i+1}. ${q.question}`;
    const response = document.createElement('p'); response.textContent = `Jawabanmu: ${selected}${selected!=='Kosong' ? '. '+q.options[['A','B','C','D'].indexOf(selected)] : ''}`;
    const key = document.createElement('p'); key.textContent = `Kunci: ${q.key}. ${q.options[['A','B','C','D'].indexOf(q.key)]}`;
    const expl = document.createElement('p'); expl.className='explanation'; expl.textContent = q.explanation || '';
    item.append(title,response,key,expl); $('reviewList').appendChild(item);
  });
}
$('teacherOpen').addEventListener('click', () => showView('teacherLoginView'));
$('teacherBack').addEventListener('click', () => showView('welcomeView'));
$('teacherLoginForm').addEventListener('submit', async e => {
  e.preventDefault(); $('loginError').textContent='';
  try {
    const data = requireOk(await api('login', {password:$('teacherPassword').value}));
    lecturerToken=data.token; $('teacherPassword').value=''; showView('dashboardView');
    await refreshDashboard(); await loadAnswerKey();
    clearInterval(dashboardTimer); dashboardTimer=setInterval(refreshDashboard,10000);
  } catch(err) { $('loginError').textContent=err.message; }
});
$('logoutButton').addEventListener('click', () => { lecturerToken=''; clearInterval(dashboardTimer); showView('welcomeView'); toast('Kamu sudah keluar dari dashboard.'); });
$('refreshButton').addEventListener('click', refreshDashboard);
$('searchStudents').addEventListener('input', renderDashboardTable);
$('exportButton').addEventListener('click', async () => {
  $('exportButton').disabled=true; $('exportButton').textContent='Menyiapkan Excel…';
  try {
    const data=requireOk(await api('export',{token:lecturerToken}));
    const bytes=Uint8Array.from(atob(data.base64), c=>c.charCodeAt(0));
    const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=data.filename; a.click(); URL.revokeObjectURL(url);
    toast('File Excel berhasil disiapkan.');
  } catch(err) { toast(err.message); }
  finally { $('exportButton').disabled=false; $('exportButton').textContent='Unduh Excel (.xlsx)'; }
});
$('keyButton').addEventListener('click', () => $('answerKeyPanel').classList.toggle('hidden'));
let dashboardStudents=[];
async function refreshDashboard() {
  try {
    const data=requireOk(await api('dashboard',{token:lecturerToken}));
    dashboardStudents=data.students;
    $('totalParticipants').textContent=data.totals.participants;
    $('activeParticipants').textContent=data.totals.active;
    $('completedParticipants').textContent=data.totals.completed;
    $('averageScore').textContent=data.totals.averageScore;
    $('dashboardUpdated').textContent='Terakhir diperbarui: '+new Date(data.updatedAt).toLocaleTimeString('id-ID');
    renderDashboardTable();
  } catch(err) { if(err.message.includes('Sesi dosen')) { clearInterval(dashboardTimer); showView('teacherLoginView'); } else toast(err.message); }
}
function renderDashboardTable() {
  const search=$('searchStudents').value.toLowerCase();
  const rows=dashboardStudents.filter(s=>s.name.toLowerCase().includes(search));
  $('studentRows').innerHTML=''; $('emptyDashboard').classList.toggle('hidden',rows.length>0);
  rows.forEach(s=>{
    const tr=document.createElement('tr');
    const values=[s.name,s.status,`${s.answered}/${s.total}`,s.correct,s.incorrect,s.wrongNumbers.length?s.wrongNumbers.join(', '): (s.status==='Selesai'?'Tidak ada':'—'),s.status==='Selesai'?s.score:'—',s.lastActive?new Date(s.lastActive).toLocaleTimeString('id-ID'):'—'];
    values.forEach((value,i)=>{const td=document.createElement('td'); if(i===1){const pill=document.createElement('span');pill.className='status-pill '+(s.status==='Selesai'?'done':s.status==='Sedang mengerjakan'?'live':'');pill.textContent=value;td.appendChild(pill);}else td.textContent=value;tr.appendChild(td);});
    $('studentRows').appendChild(tr);
  });
}
async function loadAnswerKey() {
  try {
    const data=requireOk(await api('answerKey',{token:lecturerToken}));
    $('answerKeyList').innerHTML='';
    data.questions.forEach(q=>{const div=document.createElement('div');div.className='key-item';const strong=document.createElement('strong');strong.textContent=`${q.id}. ${q.key} — `;const span=document.createElement('span');span.textContent=q.question+' ';const p=document.createElement('p');p.className='muted';p.textContent=q.explanation;div.append(strong,span,p);$('answerKeyList').appendChild(div);});
  } catch(err) { toast(err.message); }
}
