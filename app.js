import {
  auth, registerAuth, loginAuth, logoutAuth, onAuthStateChanged,
  createUserProfile, getUserProfile, updateUserDevice, getAllUsers,
  createCourse, getCourses, updateCourse, updateUserGrades, createQuiz, getQuizzes, uploadFile,
  deleteCourse, deleteQuiz, deleteUserProfile, updateUserRole, resetUserDevice,
  createNotification, getNotifications, listenToUserProfile, updateUserField
} from './firebase.js';

// --- UI Helpers ---
const toast = (msg, type = 'info') => {
  const container = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i> ${msg}`;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

const showLoading = (msg = '') => {
  document.getElementById('loading-overlay').style.display = 'flex';
  const txt = document.getElementById('loading-text');
  if(txt) txt.textContent = msg || 'جاري التحميل...';
};
const updateLoadingText = (msg) => {
  const txt = document.getElementById('loading-text');
  if(txt) txt.textContent = msg;
};
const hideLoading = () => document.getElementById('loading-overlay').style.display = 'none';

// --- Performance Helpers ---
const debounce = (func, wait = 300) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// --- State ---
let currentUserData = null;
let allCourses = [];
let allStudents = [];
let allExams = [];
let currentViewingCourse = null;
let currentSolvingExam = null;
let currentDeviceID = 'temp-device';
try {
  currentDeviceID = localStorage.getItem('deviceId');
  if (!currentDeviceID) {
    currentDeviceID = Math.random().toString(36).substring(2, 15);
    localStorage.setItem('deviceId', currentDeviceID);
  }
} catch (err) {
  console.warn('LocalStorage is disabled, using temporary device ID');
}

// --- Auth Tabs ---
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => {
      f.style.display = 'none';
      f.classList.remove('active-form');
    });
    const target = document.getElementById(e.target.dataset.target);
    target.style.display = 'block';
    target.classList.add('active-form');
  });
});

// --- Register ---
document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fn1 = document.getElementById('reg-fn1').value.trim();
  const fn2 = document.getElementById('reg-fn2').value.trim();
  const fn3 = document.getElementById('reg-fn3').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const parentPhone = document.getElementById('reg-parent-phone').value.trim();
  const grade = document.getElementById('reg-grade').value;
  const password = document.getElementById('reg-password').value;

  const fullName = `${fn1} ${fn2} ${fn3}`;
  const dummyEmail = `${phone}@mensa.com`;

  showLoading();
  try {
    const cred = await registerAuth(dummyEmail, password);
    await createUserProfile(cred.user.uid, {
      fullName, phone, parentPhone, grade, role: 'student', deviceId: currentDeviceID, grades: {}
    });
    toast('تم إنشاء الحساب بنجاح', 'success');
  } catch (error) {
    console.error('Registration Error:', error);
    if (error.code === 'auth/email-already-in-use') {
      try {
        // Recover orphaned auth account
        const loginCred = await loginAuth(dummyEmail, password);
        await createUserProfile(loginCred.user.uid, {
          fullName, phone, parentPhone, grade, role: 'student', deviceId: currentDeviceID, grades: {}
        });
        toast('تم تحديث وإنشاء الحساب بنجاح', 'success');
      } catch(recoveryErr) {
        toast('رقم الهاتف مستخدم مسبقاً لحساب آخر', 'error');
      }
    }
    else if (error.code === 'auth/operation-not-allowed') toast('يرجى تفعيل (Email/Password) من إعدادات فايربيس', 'error');
    else if (error.code === 'auth/weak-password') toast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
    else toast('خطأ: ' + error.message, 'error');
  } finally {
    hideLoading();
  }
});

// --- Login ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const phone = document.getElementById('login-phone').value.trim();
  const password = document.getElementById('login-password').value;

  showLoading();
  try {
    // Admin Hardcoded Check
    if (phone === '01007073446' && password === '12345678') {
      try { await loginAuth('admin@mensa.com', password); } 
      catch (err) {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          const cred = await registerAuth('admin@mensa.com', password);
          await createUserProfile(cred.user.uid, {
            fullName: 'أ. خالد عبد الواحد', role: 'admin', phone
          });
        }
      }
      return; 
    }

    const dummyEmail = `${phone}@mensa.com`;
    await loginAuth(dummyEmail, password);
    toast('تم تسجيل الدخول', 'success');
  } catch (error) {
    console.error('Login Error:', error);
    if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
      toast('بيانات الدخول غير صحيحة', 'error');
    } else if (error.code === 'auth/operation-not-allowed') {
      toast('يرجى تفعيل (Email/Password) من إعدادات فايربيس', 'error');
    } else {
      toast('خطأ: ' + error.message, 'error');
    }
  } finally {
    hideLoading();
  }
});

let profileUnsubscribe = null;

// --- Auth State & Boot ---
onAuthStateChanged(auth, async (user) => {
  showLoading();
  
  if (profileUnsubscribe) {
    profileUnsubscribe();
    profileUnsubscribe = null;
  }

  if (user) {
    try {
      let data = await getUserProfile(user.uid);
      if (!data) {
        // Wait and retry in case of registration race condition
        await new Promise(resolve => setTimeout(resolve, 2000));
        data = await getUserProfile(user.uid);
      }
      
      if (!data) {
        toast('عذراً، هذا الحساب موجود ولكن بدون ملف شخصي. ربما تم مسحه من قاعدة البيانات.', 'error');
        await logoutAuth();
        hideLoading();
        return;
      }
      
      if (data.role !== 'admin') {
        if (data.deviceId !== currentDeviceID) {
          // Overwrite old device with new device
          await updateUserDevice(user.uid, currentDeviceID);
          data.deviceId = currentDeviceID;
        }

        // Listen for device changes (if someone else logs into this account)
        profileUnsubscribe = listenToUserProfile(user.uid, (updatedData) => {
          if (updatedData && updatedData.deviceId && updatedData.deviceId !== currentDeviceID) {
            toast('تم تسجيل الدخول إلى حسابك من جهاز آخر. سيتم تسجيل الخروج الآن.', 'error');
            logoutAuth();
          }
        });
      }

      currentUserData = data;
      await bootApp();
    } catch (err) {
      console.error('Boot Crash:', err);
      toast('حدث خطأ أثناء تحميل البيانات: ' + err.message, 'error');
      await logoutAuth();
    }
  } else {
    currentUserData = null;
    document.getElementById('auth-section').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    if(ytPlayer) { ytPlayer.destroy(); ytPlayer = null; }
  }
  hideLoading();
});

document.getElementById('logout-btn').addEventListener('click', () => {
  logoutAuth();
});

// --- Navigation ---
const switchView = (viewId) => {
  const targetView = document.getElementById(viewId);
  if (!targetView) {
    console.warn(`View with ID "${viewId}" not found.`);
    return;
  }
  
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
  targetView.classList.add('active-view');
  
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector(`.nav-item[data-target="${viewId}"]`);
  if (activeNav) activeNav.classList.add('active');
  
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('open');
};
window.switchView = switchView;

// Global event delegation for buttons that need window-scope access
document.addEventListener('click', (e) => {
  // Back to courses button (admin)
  if (e.target.closest('#btn-back-to-courses')) {
    switchView('admin-courses');
    renderAdminCourses();
  }
  // Back to exams button (student)
  if (e.target.closest('#btn-back-exams')) {
    switchView('student-exams');
    renderStudentExams();
  }
  // Back to course dashboard button (student course player)
  if (e.target.closest('#btn-back-courses')) {
    switchView('student-dashboard');
    renderStudentDashboard();
    if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
  }
});

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    const target = item.dataset.target;
    if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo(); // pause video on nav
    
    if (target === 'admin-students') {
      loadStudentsOnce();
    }
    
    switchView(target);
    if (target === 'admin-dashboard') renderAdminDashboard();
    if (target === 'admin-courses') renderAdminCourses();
    if (target === 'admin-exams') renderAdminExams();
    if (target === 'admin-students') renderAdminStudents();
    if (target === 'student-dashboard') renderStudentDashboard();
    if (target === 'student-my-courses') renderStudentMyCourses();
    if (target === 'student-exams') renderStudentExams();
    if (target === 'student-profile') renderStudentProfile();
  });
});

document.getElementById('mobile-menu-toggle').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('open');
});

// --- Notifications UI ---
const btnNotif = document.getElementById('btn-notifications');
const notifDropdown = document.getElementById('notif-dropdown');
if(btnNotif) {
  btnNotif.addEventListener('click', () => {
    notifDropdown.style.display = notifDropdown.style.display === 'none' ? 'block' : 'none';
    if (notifDropdown.style.display === 'block' && currentUserData) {
      localStorage.setItem(`notif_${currentUserData.uid}`, Date.now());
      const badge = document.getElementById('notif-badge');
      if (badge) badge.style.display = 'none';
    }
  });
}

// --- App Boot Logic ---
async function bootApp() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('topbar-name').textContent = currentUserData.fullName;

  await loadData();

  if (currentUserData.role === 'admin') {
    document.getElementById('admin-nav').style.display = 'block';
    document.getElementById('student-nav').style.display = 'none';
    switchView('admin-dashboard');
    renderAdminDashboard();
  } else {
    document.getElementById('admin-nav').style.display = 'none';
    document.getElementById('student-nav').style.display = 'block';
    document.getElementById('student-welcome-name').textContent = currentUserData.fullName;
    document.getElementById('student-grade-badge').textContent = currentUserData.grade;
    switchView('student-dashboard');
    renderStudentDashboard();
    
    // Render Notifications
    const myNotifs = allNotifications.filter(n => n.grade === currentUserData.grade || n.grade === 'عام').sort((a,b)=>b.createdAt - a.createdAt);
    const badge = document.getElementById('notif-badge');
    const list = document.getElementById('notif-list');
    
    let lastReadTime = localStorage.getItem(`notif_${currentUserData.uid}`) || 0;
    const newNotifsCount = myNotifs.filter(n => n.createdAt > lastReadTime).length;
    
    if(newNotifsCount > 0) {
      badge.style.display = 'flex';
      badge.textContent = newNotifsCount;
    } else {
      badge.style.display = 'none';
    }

    if(myNotifs.length > 0) {
      list.innerHTML = myNotifs.map(n => `
        <div style="padding:0.5rem; border-bottom:1px solid var(--glass-border); ${n.createdAt > lastReadTime ? 'background: rgba(99,102,241,0.1);' : ''}">
          <strong style="color:var(--primary)">${n.title}</strong>
          <p style="margin:0; font-size:0.8rem;">${n.message}</p>
          <small class="text-muted">${new Date(n.createdAt).toLocaleDateString('ar-EG')}</small>
        </div>
      `).join('');
    } else {
      list.innerHTML = '<p class="text-muted text-center">لا توجد إشعارات</p>';
    }
  }
  
  document.getElementById('main-app').style.display = 'flex';
}

let allNotifications = [];
async function loadData() {
  const [courses, exams, notifs] = await Promise.all([getCourses(), getQuizzes(), getNotifications()]);
  allCourses = courses;
  allExams = exams;
  allNotifications = notifs;
}

let isStudentsLoaded = false;
async function loadStudentsOnce() {
  if (isStudentsLoaded) return;
  showLoading();
  try {
    const all = await getAllUsers();
    allStudents = all.filter(u => u.role === 'student');
    isStudentsLoaded = true;
    renderAdminDashboard();
    renderAdminStudents();
  } catch(err) {
    toast('خطأ في تحميل بيانات الطلاب', 'error');
  } finally {
    hideLoading();
  }
}

// ================= ADMIN LOGIC =================
function renderAdminDashboard() {
  document.getElementById('stat-students').textContent = isStudentsLoaded ? allStudents.length : '...';
  document.getElementById('stat-courses').textContent = allCourses.length;
  document.getElementById('stat-exams').textContent = allExams.length;
}
window.renderAdminDashboard = renderAdminDashboard;

function renderAdminCourses() {
  const container = document.getElementById('admin-courses-list');
  container.innerHTML = '';
  if (allCourses.length === 0) {
    container.innerHTML = '<p class="text-muted">لا توجد كورسات مضافة بعد.</p>';
    return;
  }
  container.innerHTML = allCourses.map(c => `
      <div class="course-card glass-card">
        ${c.imgUrl ? `<img src="${c.imgUrl}" loading="lazy" style="width:100%; height:150px; object-fit:cover; border-radius:12px 12px 0 0;" />` : ''}
        <div class="course-card-content">
          <span class="course-badge">${c.grade}</span>
          <span class="course-badge" style="background: rgba(99,102,241,0.2); color:var(--primary);">${c.month || 'عام'}</span>
          <h3 class="course-title">${c.title}</h3>
          <p class="course-desc">${c.desc}</p>
          <div class="course-meta">
            <span>${c.lessons ? c.lessons.length : 0} محتوى</span>
            <span>${new Date(c.createdAt).toLocaleDateString('ar-EG')}</span>
          </div>
          <button class="btn btn-primary btn-sm mt-1" style="width:100%" onclick="openAdminCourseDetail('${c.id}')"><i class="fa-solid fa-list-check"></i> إدارة الكورس</button>
          <button class="btn btn-danger btn-sm mt-1" style="width:100%" onclick="deleteCourseItem('${c.id}')"><i class="fa-solid fa-trash"></i> مسح مجموعة الكورس</button>
        </div>
      </div>
    `).join('');
}

window.openAdminCourseDetail = (courseId) => {
  const course = allCourses.find(c => c.id === courseId);
  if(!course) return;
  switchView('admin-course-detail');
  
  document.getElementById('admin-cd-title').textContent = course.title;
  document.getElementById('admin-cd-desc').textContent = course.desc;
  
  const imgEl = document.getElementById('admin-cd-img');
  if(course.imgUrl) {
    imgEl.src = course.imgUrl;
    imgEl.style.display = 'block';
  } else {
    imgEl.style.display = 'none';
  }
  
  document.getElementById('btn-add-content-inside').onclick = () => {
    openAddLessonModal(courseId);
  };
  
  const list = document.getElementById('admin-cd-lessons-list');
  list.innerHTML = '';
  if(!course.lessons || course.lessons.length === 0) {
    list.innerHTML = '<p class="text-muted text-center" style="padding:1rem;">لا يوجد محتوى في هذا الكورس بعد.</p>';
    return;
  }
  
  course.lessons.forEach((l, idx) => {
    list.innerHTML += `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border-bottom:1px solid var(--glass-border);">
        <div style="display:flex; align-items:center; gap:1rem;">
          <div style="width:40px; height:40px; border-radius:50%; background:rgba(99,102,241,0.1); color:var(--primary); display:flex; align-items:center; justify-content:center; font-weight:bold;">${idx+1}</div>
          <div>
            <h4 style="margin:0;">${l.title}</h4>
            <span style="font-size:0.8rem; color:var(--text-muted); background:rgba(255,255,255,0.5); padding:2px 8px; border-radius:12px;">${l.type}</span>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deleteLessonItem('${course.id}', ${idx})"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
  });
};

window.deleteLessonItem = async (courseId, lessonIdx) => {
  if(!confirm('هل أنت متأكد من مسح هذا المحتوى؟')) return;
  const course = allCourses.find(c => c.id === courseId);
  if(!course) return;
  
  const newLessons = [...course.lessons];
  newLessons.splice(lessonIdx, 1);
  
  showLoading();
  try {
    await updateCourse(courseId, { lessons: newLessons });
    toast('تم المسح بنجاح', 'success');
    // Update local state for performance
    const cIdx = allCourses.findIndex(c => c.id === courseId);
    if(cIdx !== -1) allCourses[cIdx].lessons = newLessons;
    openAdminCourseDetail(courseId);
  } catch(err) {
    toast('حدث خطأ أثناء المسح', 'error');
  } finally { hideLoading(); }
};

function renderAdminExams() {
  const container = document.getElementById('admin-exams-list');
  container.innerHTML = '';
  if (allExams.length === 0) {
    container.innerHTML = '<p class="text-muted">لا توجد امتحانات مضافة بعد.</p>';
    return;
  }
  container.innerHTML = allExams.map(e => `
      <div class="course-card glass-card">
        <div class="course-card-content">
          <span class="course-badge" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);">${e.grade}</span>
          <h3 class="course-title">${e.title}</h3>
          <div class="course-meta mt-1">
            <span>${e.questions ? e.questions.length : 0} أسئلة</span>
            <span>المدة: ${e.timeLimit ? e.timeLimit + ' دقيقة' : 'مفتوح'}</span>
          </div>
          <button class="btn btn-primary btn-sm mt-1" style="width:100%" onclick="showTopStudents('${e.id}')"><i class="fa-solid fa-trophy"></i> عرض الأوائل</button>
          <button class="btn btn-danger btn-sm mt-1" style="width:100%" onclick="deleteExamItem('${e.id}')"><i class="fa-solid fa-trash"></i> مسح الامتحان</button>
        </div>
      </div>
    `).join('');
}

function renderAdminStudents() {
  const tbody = document.getElementById('admin-students-table');
  const searchQuery = document.getElementById('filter-student-search') ? document.getElementById('filter-student-search').value.trim().toLowerCase() : '';
  const gradeFilter = document.getElementById('filter-student-grade') ? document.getElementById('filter-student-grade').value : 'all';

  let filteredStudents = allStudents;

  if (gradeFilter !== 'all') {
    filteredStudents = filteredStudents.filter(s => s.grade === gradeFilter);
  }

  if (searchQuery) {
    filteredStudents = filteredStudents.filter(s => 
      s.fullName.toLowerCase().includes(searchQuery) || 
      (s.phone && s.phone.includes(searchQuery))
    );
  }

  tbody.innerHTML = '';
  tbody.innerHTML = filteredStudents.map(s => {
    let gradesHtml = '';
    if (s.grades && Object.keys(s.grades).length > 0) {
      gradesHtml = Object.entries(s.grades).map(([q, g]) => {
        const val = typeof g === 'object' ? g.score : g;
        return `<span class="course-badge" style="margin:2px; font-size: 0.7rem; white-space:nowrap;">${q}: ${val}</span>`;
      }).join(' ');
    } else {
      gradesHtml = '<span class="text-muted">لا يوجد تقييمات</span>';
    }

    return `
      <tr>
        <td><strong>${s.fullName}</strong></td>
        <td>${s.grade}</td>
        <td>${s.phone}</td>
        <td>${s.parentPhone}</td>
        <td><div style="display:flex; flex-wrap:wrap; gap:5px; justify-content:flex-end;">${gradesHtml}</div></td>
        <td>
          <div style="display:flex; gap:0.5rem; justify-content:center;">
            <button class="btn btn-ghost btn-sm" title="إعادة تعيين الجهاز" onclick="resetDeviceItem('${s.uid}')"><i class="fa-solid fa-mobile-screen" style="color:var(--primary)"></i></button>
            <button class="btn btn-ghost btn-sm" title="ترقية لآدمن" onclick="makeAdminItem('${s.uid}')"><i class="fa-solid fa-user-shield" style="color:var(--success)"></i></button>
            <button class="btn btn-ghost btn-sm" title="مسح الطالب" onclick="deleteStudentItem('${s.uid}')"><i class="fa-solid fa-trash" style="color:var(--danger)"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

const sSearch = document.getElementById('filter-student-search');
const sGrade = document.getElementById('filter-student-grade');
if(sSearch) sSearch.addEventListener('input', debounce(renderAdminStudents, 300));
if(sGrade) sGrade.addEventListener('change', renderAdminStudents);

window.showTopStudents = (examId) => {
  const exam = allExams.find(e => e.id === examId);
  if(!exam) return;
  
  document.getElementById('top-modal-exam-title').textContent = exam.title;
  const list = document.getElementById('top-students-list');
  
  // Find students who took this exam
  let results = [];
  allStudents.forEach(s => {
    if(s.grades && s.grades[exam.title]) {
      const g = s.grades[exam.title]; // Object: { score: '10/10', percentage: 100, timeTaken: '10:00' } or string fallback
      let percentage = 0;
      let timeTakenSec = 999999;
      let displayTime = '';
      let displayScore = '';
      
      if(typeof g === 'object') {
        percentage = g.percentage;
        displayScore = g.score;
        displayTime = g.timeTaken;
        const parts = displayTime.split(':');
        if(parts.length === 2) timeTakenSec = parseInt(parts[0])*60 + parseInt(parts[1]);
      } else {
        // Fallback for old string format "X/Y (Z%)"
        const m = g.match(/\((\d+)%\)/);
        if(m) percentage = parseInt(m[1]);
        displayScore = g;
        displayTime = 'غير محدد';
      }
      
      results.push({
        name: s.fullName,
        grade: s.grade,
        percentage,
        displayScore,
        displayTime,
        timeTakenSec
      });
    }
  });
  
  // Sort by percentage DESC, then timeTakenSec ASC
  results.sort((a,b) => {
    if(b.percentage !== a.percentage) return b.percentage - a.percentage;
    return a.timeTakenSec - b.timeTakenSec;
  });
  
  // Get top 5
  results = results.slice(0, 5);
  
  list.innerHTML = '';
  if(results.length === 0) {
    list.innerHTML = '<p class="text-center text-muted">لم يقم أحد بحل الامتحان بعد.</p>';
  } else {
    results.forEach((r, idx) => {
      list.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:1rem; border-bottom:1px solid var(--glass-border); background: ${idx === 0 ? 'rgba(255,215,0,0.1)' : 'transparent'}; border-radius:8px;">
          <div>
            <strong style="font-size:1.1rem;">${idx+1}. ${r.name}</strong> <span class="course-badge">${r.grade}</span>
          </div>
          <div style="text-align:left;">
            <div style="color:var(--success); font-weight:bold;">${r.displayScore}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${r.displayTime}</div>
          </div>
        </div>
      `;
    });
  }
  
  document.getElementById('top-students-modal').classList.add('open');
};

document.getElementById('top-modal-close').addEventListener('click', () => {
  document.getElementById('top-students-modal').classList.remove('open');
});

window.deleteCourseItem = async (id) => {
  if(!confirm('هل أنت متأكد من مسح هذا الكورس؟')) return;
  showLoading();
  try {
    await deleteCourse(id);
    allCourses = allCourses.filter(c => c.id !== id);
    renderAdminCourses();
    toast('تم مسح الكورس', 'success');
  } catch (err) {
    toast('حدث خطأ أثناء المسح', 'error');
  } finally {
    hideLoading();
  }
};

window.deleteExamItem = async (id) => {
  if(!confirm('هل أنت متأكد من مسح هذا الامتحان؟')) return;
  showLoading();
  try {
    await deleteQuiz(id);
    allExams = allExams.filter(e => e.id !== id);
    renderAdminExams();
    toast('تم مسح الامتحان', 'success');
  } catch (err) {
    toast('حدث خطأ أثناء المسح', 'error');
  } finally {
    hideLoading();
  }
};

window.makeAdminItem = async (uid) => {
  if(!confirm("هل أنت متأكد من ترقية هذا الطالب إلى أدمن؟")) return;
  showLoading();
  try {
    await updateUserRole(uid, 'admin');
    const s = allStudents.find(u => u.uid === uid);
    if(s) s.role = 'admin';
    allStudents = allStudents.filter(u => u.uid !== uid);
    renderAdminStudents();
    toast('تمت الترقية بنجاح', 'success');
  } catch(err) {
    toast('حدث خطأ أثناء الترقية', 'error');
  } finally { hideLoading(); }
};

window.deleteStudentItem = async (uid) => {
  if(!confirm("هل أنت متأكد من مسح هذا الطالب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.")) return;
  showLoading();
  try {
    await deleteUserProfile(uid);
    allStudents = allStudents.filter(u => u.uid !== uid);
    renderAdminStudents();
    toast('تم مسح الطالب بنجاح', 'success');
  } catch(err) {
    toast('حدث خطأ أثناء المسح', 'error');
  } finally { hideLoading(); }
};

window.resetDeviceItem = async (uid) => {
  if(!confirm("هل تريد السماح للطالب بتسجيل الدخول من جهاز جديد؟")) return;
  showLoading();
  try {
    await resetUserDevice(uid);
    const s = allStudents.find(u => u.uid === uid);
    if(s) s.deviceId = null;
    renderAdminStudents();
    toast('تم إعادة تعيين الجهاز بنجاح', 'success');
  } catch(err) {
    toast('حدث خطأ', 'error');
  } finally { hideLoading(); }
};

// -- Back to courses button (handled by event delegation above) --
window.goBackToCourses = () => {
  switchView('admin-courses');
  renderAdminCourses();
};

// -- Course Builder Modal --
document.getElementById('btn-create-course').addEventListener('click', () => {
  document.getElementById('course-modal').classList.add('open');
});
document.getElementById('course-modal-close').addEventListener('click', () => {
  document.getElementById('course-modal').classList.remove('open');
});

document.getElementById('course-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('course-title').value.trim();
  const month = document.getElementById('course-month').value;
  const grade = document.getElementById('course-grade').value;
  const desc = document.getElementById('course-desc').value.trim();
  const imgFile = document.getElementById('course-img').files[0];

  showLoading('جاري الرفع...');
  try {
    let imgUrl = null;
    if(imgFile) imgUrl = await uploadFile(imgFile, 'course_covers', (p) => updateLoadingText(`جاري رفع الصورة... ${p}%`));
    
    const newCourseData = { title, grade, month, desc, imgUrl, lessons: [], createdAt: Date.now() };
    const ref = await createCourse(newCourseData);
    await createNotification({ title: 'مجموعة كورس جديدة', message: `تم إضافة كورس جديد: ${title}`, grade });
    
    // Update local state
    allCourses.push({ id: ref.id, ...newCourseData });
    
    toast('تم إضافة مجموعة الكورس بنجاح', 'success');
    document.getElementById('course-modal').classList.remove('open');
    document.getElementById('course-form').reset();
    renderAdminCourses();
  } catch (err) {
    console.error('Course add error:', err);
    toast(err.message || 'حدث خطأ أثناء الحفظ', 'error');
  } finally {
    hideLoading();
  }
});

// -- Add Lesson Modal Logic --
window.openAddLessonModal = (courseId) => {
  document.getElementById('target-course-id').value = courseId;
  document.getElementById('add-lesson-modal').classList.add('open');
};

document.getElementById('add-lesson-modal-close').addEventListener('click', () => {
  document.getElementById('add-lesson-modal').classList.remove('open');
});

document.getElementById('btn-add-lesson-quiz-q').addEventListener('click', () => {
  const container = document.getElementById('lesson-quiz-questions');
  const div = document.createElement('div');
  const uid = Math.random().toString(36).substr(2, 9);
  div.className = 'lesson-builder-item exam-question-item';
  div.innerHTML = `
    <button type="button" class="btn-remove-lesson" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>
    <div class="form-group"><textarea placeholder="نص السؤال أو القطعة" class="q-text form-control" rows="3"></textarea></div>
    <div class="form-group">
      <label style="font-size:0.8rem; color:var(--text-muted);">إرفاق صورة للسؤال (اختياري)</label>
      <input type="file" class="q-img" accept="image/*">
    </div>
    <div class="name-grid">
      <div class="form-group flex items-center">
        <input type="text" placeholder="الخيار الأول" class="q-o1">
        <input type="radio" name="correct_${uid}" value="1" class="correct-answer-radio">
      </div>
      <div class="form-group flex items-center">
        <input type="text" placeholder="الخيار الثاني" class="q-o2">
        <input type="radio" name="correct_${uid}" value="2" class="correct-answer-radio">
      </div>
      <div class="form-group flex items-center">
        <input type="text" placeholder="الخيار الثالث" class="q-o3">
        <input type="radio" name="correct_${uid}" value="3" class="correct-answer-radio">
      </div>
      <div class="form-group flex items-center">
        <input type="text" placeholder="الخيار الرابع" class="q-o4">
        <input type="radio" name="correct_${uid}" value="4" class="correct-answer-radio">
      </div>
    </div>
  `;
  container.appendChild(div);
});

document.getElementById('add-lesson-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const courseId = document.getElementById('target-course-id').value;
  const lType = document.getElementById('lesson-type').value;
  const lTitle = document.getElementById('lesson-title').value.trim();
  const lUrl = document.getElementById('lesson-url').value.trim();
  const fileInput = document.getElementById('lesson-file');
  
  const course = allCourses.find(c => c.id === courseId);
  if(!course) return toast('الكورس غير موجود', 'error');
  
  if(lType !== 'ملف PDF' && !lUrl) {
    return toast('رابط اليوتيوب مطلوب لهذا النوع من المحتوى', 'warning');
  }

  let quiz = null;
  const qEls = document.querySelectorAll('#lesson-quiz-questions .exam-question-item');
  if(qEls.length > 0) {
    const qTime = document.getElementById('lesson-quiz-time').value;
    const questions = [];
    for (let el of qEls) {
      const qText = el.querySelector('.q-text').value;
      const qImgFile = el.querySelector('.q-img').files[0];
      const o1 = el.querySelector('.q-o1').value;
      const o2 = el.querySelector('.q-o2').value;
      const o3 = el.querySelector('.q-o3').value;
      const o4 = el.querySelector('.q-o4').value;
      const radio = el.querySelector('input[type="radio"]:checked');
      if(!radio) return toast('يرجى تحديد الإجابة الصحيحة للكويز', 'warning');
      
      let correctAns = "";
      if(radio.value === "1") correctAns = o1;
      if(radio.value === "2") correctAns = o2;
      if(radio.value === "3") correctAns = o3;
      if(radio.value === "4") correctAns = o4;

      let qImgUrl = null;
      if (qImgFile) qImgUrl = await uploadFile(qImgFile, 'quiz_images', (p) => updateLoadingText(`جاري رفع صورة السؤال... ${p}%`));

      questions.push({ question: qText, imgUrl: qImgUrl, options: [o1, o2, o3, o4].filter(Boolean), correctAnswer: correctAns });
    }
    quiz = { timeLimit: qTime ? parseInt(qTime) : null, questions };
  }

  showLoading('جاري الرفع...');
  try {
    let fileUrl = document.getElementById('lesson-file-url').value.trim() || null;
    let fileName = fileUrl ? 'مذكرة الدرس (رابط خارجي)' : null;

    const newLesson = { type: lType, title: lTitle, url: lUrl, quiz, fileUrl, fileName };
    const updatedLessons = [...(course.lessons || []), newLesson];
    
    await updateCourse(courseId, { lessons: updatedLessons });
    await createNotification({ title: 'محتوى جديد', message: `تم إضافة ${lType} جديد: ${lTitle}`, grade: course.grade });
    
    // Update local state
    const cIdx = allCourses.findIndex(c => c.id === courseId);
    if(cIdx !== -1) allCourses[cIdx].lessons = updatedLessons;

    toast('تمت الإضافة بنجاح', 'success');
    document.getElementById('add-lesson-modal').classList.remove('open');
    document.getElementById('add-lesson-form').reset();
    document.getElementById('lesson-quiz-questions').innerHTML = '';
    renderAdminCourses();
    
    if(document.getElementById('admin-course-detail').classList.contains('active-view')) {
      openAdminCourseDetail(courseId);
    }
  } catch(err) {
    console.error(err);
    toast('حدث خطأ أثناء الحفظ', 'error');
  } finally {
    hideLoading();
  }
});


// -- Exam Builder Modal --
document.getElementById('btn-create-exam').addEventListener('click', () => {
  document.getElementById('exam-modal').classList.add('open');
});
document.getElementById('exam-modal-close').addEventListener('click', () => {
  document.getElementById('exam-modal').classList.remove('open');
});

document.getElementById('btn-add-exam-question').addEventListener('click', () => {
  const container = document.getElementById('exam-questions-builder');
  const div = document.createElement('div');
  const uid = Math.random().toString(36).substr(2, 9);
  div.className = 'exam-question-item';
  div.innerHTML = `
    <button type="button" class="btn-remove-lesson" onclick="this.parentElement.remove()" style="position:absolute; left:1rem; top:1rem;"><i class="fa-solid fa-trash"></i></button>
    <div class="form-group mt-1"><textarea placeholder="السؤال أو القطعة" class="q-text form-control" rows="3" required></textarea></div>
    <div class="form-group">
      <label style="font-size:0.8rem; color:var(--text-muted);">إرفاق صورة للسؤال (اختياري)</label>
      <input type="file" class="q-img" accept="image/*">
    </div>
    <div class="name-grid mt-1">
      <div class="form-group flex items-center">
        <input type="text" placeholder="الخيار الأول" class="q-o1" required>
        <input type="radio" name="ex_correct_${uid}" value="1" class="correct-answer-radio">
      </div>
      <div class="form-group flex items-center">
        <input type="text" placeholder="الخيار الثاني" class="q-o2" required>
        <input type="radio" name="ex_correct_${uid}" value="2" class="correct-answer-radio">
      </div>
      <div class="form-group flex items-center">
        <input type="text" placeholder="الخيار الثالث" class="q-o3" required>
        <input type="radio" name="ex_correct_${uid}" value="3" class="correct-answer-radio">
      </div>
      <div class="form-group flex items-center">
        <input type="text" placeholder="الخيار الرابع" class="q-o4" required>
        <input type="radio" name="ex_correct_${uid}" value="4" class="correct-answer-radio">
      </div>
    </div>
  `;
  container.appendChild(div);
});

document.getElementById('exam-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const title = document.getElementById('exam-title').value.trim();
  const timeLimit = document.getElementById('exam-time-limit').value.trim();
  const grade = document.getElementById('exam-grade').value;
  const month = document.getElementById('exam-month').value;

  const qEls = document.querySelectorAll('#exam-questions-builder .exam-question-item');
  if(qEls.length === 0) return toast('أضف سؤالاً واحداً على الأقل', 'warning');
  
  showLoading();
  const questions = [];
  for (let el of qEls) {
    const qText = el.querySelector('.q-text').value;
    const qImgFile = el.querySelector('.q-img').files[0];
    const o1 = el.querySelector('.q-o1').value;
    const o2 = el.querySelector('.q-o2').value;
    const o3 = el.querySelector('.q-o3').value;
    const o4 = el.querySelector('.q-o4').value;
    
    const radio = el.querySelector('input[type="radio"]:checked');
    if(!radio) { hideLoading(); return toast('يرجى تحديد الإجابة الصحيحة لكل سؤال', 'warning'); }
    
    let correctAns = "";
    if(radio.value === "1") correctAns = o1;
    if(radio.value === "2") correctAns = o2;
    if(radio.value === "3") correctAns = o3;
    if(radio.value === "4") correctAns = o4;

    let imgUrl = null;
    if (qImgFile) {
      imgUrl = await uploadFile(qImgFile, 'exam_images', (p) => updateLoadingText(`جاري رفع صورة السؤال... ${p}%`));
    }

    questions.push({
      question: qText,
      imgUrl,
      options: [o1, o2, o3, o4].filter(Boolean),
      correctAnswer: correctAns
    });
  }

  try {
    const newExamData = { title, grade, month, timeLimit: timeLimit ? parseInt(timeLimit) : null, questions, createdAt: Date.now() };
    const ref = await createQuiz(newExamData);
    await createNotification({ title: 'امتحان شامل جديد', message: `تم إضافة امتحان جديد: ${title}`, grade });
    
    // Update local state
    allExams.push({ id: ref.id, ...newExamData });

    toast('تم إضافة الامتحان بنجاح', 'success');
    document.getElementById('exam-modal').classList.remove('open');
    document.getElementById('exam-form').reset();
    document.getElementById('exam-questions-builder').innerHTML = '';
    renderAdminExams();
  } catch (err) {
    toast('حدث خطأ أثناء الحفظ', 'error');
  } finally {
    hideLoading();
  }
});

// ================= STUDENT LOGIC =================
function renderStudentDashboard() {
  const container = document.getElementById('student-available-courses');
  container.innerHTML = '';
  const available = allCourses.filter(c => c.grade === currentUserData.grade || c.grade === 'عام');
  
  if (available.length === 0) {
    container.innerHTML = '<p class="text-muted">لا توجد كورسات متاحة لصفك الدراسي حالياً.</p>';
    return;
  }

  available.forEach(c => {
    container.innerHTML += `
      <div class="course-card glass-card" onclick="openCoursePlayer('${c.id}')">
        ${c.imgUrl ? `<img src="${c.imgUrl}" style="width:100%; height:150px; object-fit:cover; border-radius:12px 12px 0 0;" />` : ''}
        <div class="course-card-content">
          <span class="course-badge">${c.grade}</span>
          <span class="course-badge" style="background: rgba(99,102,241,0.2); color:var(--primary);">${c.month || 'عام'}</span>
          <h3 class="course-title">${c.title}</h3>
          <p class="course-desc">${c.desc}</p>
          <div class="course-meta">
            <span>${c.lessons ? c.lessons.length : 0} محتوى</span>
            <span style="color: var(--success); font-weight: bold;">تصفح الكورس <i class="fa-solid fa-arrow-left"></i></span>
          </div>
        </div>
      </div>
    `;
  });
}

function renderStudentMyCourses() {
  const container = document.getElementById('student-enrolled-courses');
  container.innerHTML = '';
  const available = allCourses.filter(c => c.grade === currentUserData.grade || c.grade === 'عام');

  if (available.length === 0) {
    container.innerHTML = '<p class="text-muted">لا توجد كورسات متاحة لصفك الدراسي حالياً.</p>';
    return;
  }

  container.innerHTML = available.map(c => `
      <div class="course-card glass-card" onclick="openCoursePlayer('${c.id}')">
        ${c.imgUrl ? `<img src="${c.imgUrl}" loading="lazy" style="width:100%; height:150px; object-fit:cover; border-radius:12px 12px 0 0;" />` : ''}
        <div class="course-card-content">
          <span class="course-badge">${c.grade}</span>
          <span class="course-badge" style="background: rgba(99,102,241,0.2); color:var(--primary);">${c.month || 'عام'}</span>
          <h3 class="course-title">${c.title}</h3>
          <p class="course-desc">${c.desc}</p>
          <div class="course-meta">
            <span>${c.lessons ? c.lessons.length : 0} محتوى</span>
            <span style="color: var(--success); font-weight: bold;">تصفح الكورس <i class="fa-solid fa-arrow-left"></i></span>
          </div>
        </div>
      </div>
    `).join('');
}

function renderStudentExams() {
  const container = document.getElementById('student-available-exams');
  container.innerHTML = '';
  const available = allExams.filter(e => e.grade === currentUserData.grade || e.grade === 'عام');
  
  if (available.length === 0) {
    container.innerHTML = '<p class="text-muted">لا توجد امتحانات متاحة حالياً.</p>';
    return;
  }

  container.innerHTML = available.map(e => {
    const hasTaken = currentUserData.grades && currentUserData.grades[e.title];
    let gradeStr = '';
    if(hasTaken) {
      gradeStr = typeof currentUserData.grades[e.title] === 'object' ? currentUserData.grades[e.title].score : currentUserData.grades[e.title];
    }
    const statusHtml = hasTaken 
      ? `<span style="color:var(--success);"><i class="fa-solid fa-check"></i> تم الحل (${gradeStr})</span>`
      : `<span style="color:var(--warning);"><i class="fa-solid fa-pen"></i> ابدأ الامتحان</span>`;

    return `
      <div class="course-card glass-card" onclick="openStandaloneExam('${e.id}')">
        <div class="course-card-content">
          <span class="course-badge" style="background: rgba(245, 158, 11, 0.2); color: var(--warning);">${e.grade}</span>
          <h3 class="course-title">${e.title}</h3>
          <div class="course-meta mt-1">
            <span>${e.questions ? e.questions.length : 0} أسئلة</span>
            ${statusHtml}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderStudentProfile() {
  const list = document.getElementById('student-profile-list');
  list.innerHTML = `
    <li><strong>الاسم:</strong> ${currentUserData.fullName}</li>
    <li><strong>رقم الطالب:</strong> ${currentUserData.phone}</li>
    <li><strong>رقم ولي الأمر:</strong> ${currentUserData.parentPhone}</li>
    <li><strong>الصف الدراسي:</strong> ${currentUserData.grade}</li>
  `;

  const gradesContainer = document.getElementById('student-grades-list');
  gradesContainer.innerHTML = '';
  if (currentUserData.grades && Object.keys(currentUserData.grades).length > 0) {
    Object.entries(currentUserData.grades).forEach(([quizName, g]) => {
      let displayHtml = '';
      if(typeof g === 'object') {
        displayHtml = `
          <div style="text-align:left;">
            <span class="course-badge" style="margin:0; background: rgba(16, 185, 129, 0.2); color: var(--success);">${g.score}</span>
            <div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px;"><i class="fa-regular fa-clock"></i> المستغرق: ${g.timeTaken}</div>
          </div>
        `;
      } else {
        displayHtml = `<span class="course-badge" style="margin:0; background: rgba(16, 185, 129, 0.2); color: var(--success);">${g}</span>`;
      }
      
      gradesContainer.innerHTML += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 1rem; border-bottom: 1px solid var(--glass-border);">
          <span>${quizName}</span>
          ${displayHtml}
        </div>
      `;
    });
  } else {
    gradesContainer.innerHTML = '<p class="text-muted">لم يتم حل أي تقييمات بعد.</p>';
  }
}

// -- Standalone Exam Solver (back button handled by event delegation above) --

let currentExamTimer = null;
let currentExamTimeTakenSec = 0;

window.openStandaloneExam = (examId) => {
  currentSolvingExam = allExams.find(e => e.id === examId);
  if(!currentSolvingExam) return;

  if(currentExamTimer) clearInterval(currentExamTimer);
  currentExamTimeTakenSec = 0;
  window.isExamTimeOut = false;

  switchView('standalone-exam-view');
  document.getElementById('exam-title-display').textContent = currentSolvingExam.title;
  const container = document.getElementById('exam-questions-container');
  const btnSubmit = document.getElementById('btn-submit-exam');
  const resultDisplay = document.getElementById('exam-result-display');
  const btnReview = document.getElementById('btn-review-exam');
  const reviewContainer = document.getElementById('exam-review-container');
  const timerDisplay = document.getElementById('exam-timer-display');
  const timerText = document.getElementById('exam-timer-text');
  
  resultDisplay.style.display = 'none';
  btnReview.style.display = 'none';
  reviewContainer.style.display = 'none';
  reviewContainer.innerHTML = '';
  timerDisplay.style.display = 'none';
  
  // Check if already taken
  if (currentUserData.grades && currentUserData.grades[currentSolvingExam.title]) {
    container.innerHTML = '';
    btnSubmit.style.display = 'none';
    resultDisplay.style.display = 'block';
    
    const g = currentUserData.grades[currentSolvingExam.title];
    let displayHtml = '';
    if (typeof g === 'object') {
      displayHtml = `لقد قمت بحل هذا الامتحان مسبقاً.<br> النتيجة: <span style="color:var(--success)">${g.score}</span><br><span style="font-size:1rem;" class="text-muted">الوقت المستغرق: ${g.timeTaken}</span>`;
    } else {
      displayHtml = `لقد قمت بحل هذا الامتحان مسبقاً.<br> النتيجة: <span style="color:var(--success)">${g}</span>`;
    }
    
    resultDisplay.innerHTML = displayHtml;
    
    // Add review data if saved
    if(currentUserData.examReviews && currentUserData.examReviews[currentSolvingExam.title]) {
      btnReview.style.display = 'block';
      reviewContainer.innerHTML = currentUserData.examReviews[currentSolvingExam.title];
    }
    return;
  }

  btnSubmit.style.display = 'block';
  container.innerHTML = '';
  
  let timeRemainingSec = currentSolvingExam.timeLimit ? currentSolvingExam.timeLimit * 60 : null;
  
  if (timeRemainingSec !== null) {
    timerDisplay.style.display = 'inline-block';
    const updateTimer = () => {
      if(timeRemainingSec <= 0) {
        clearInterval(currentExamTimer);
        window.isExamTimeOut = true;
        toast('انتهى الوقت! سيتم تسليم الامتحان تلقائياً.', 'error');
        document.getElementById('btn-submit-exam').click();
        return;
      }
      currentExamTimeTakenSec++;
      timeRemainingSec--;
      const m = Math.floor(timeRemainingSec / 60).toString().padStart(2, '0');
      const s = (timeRemainingSec % 60).toString().padStart(2, '0');
      timerText.textContent = `${m}:${s}`;
    };
    updateTimer();
    currentExamTimer = setInterval(updateTimer, 1000);
  } else {
    // If no limit, just track time taken
    currentExamTimer = setInterval(() => {
      currentExamTimeTakenSec++;
    }, 1000);
  }

  currentSolvingExam.questions.forEach((q, idx) => {
    const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
    const imgHtml = q.imgUrl ? `<img src="${q.imgUrl}" style="max-width:100%; border-radius:8px; margin-bottom:1rem; box-shadow:0 4px 6px rgba(0,0,0,0.1);">` : '';
    container.innerHTML += `
      <div class="exam-question-item" style="background:rgba(255,255,255,0.7); padding:1.5rem; border-radius:12px; margin-bottom:1.5rem; border:1px solid var(--glass-border);">
        <h4 class="quiz-q" style="font-size:1.3rem; margin-bottom:1rem;">${idx + 1}. ${q.question}</h4>
        ${imgHtml}
        <div class="quiz-options" style="display:flex; flex-direction:column; gap:0.5rem;">
          ${shuffledOptions.map((opt) => `
            <label class="quiz-option" style="font-size:1.1rem; padding:0.8rem; background:rgba(0,0,0,0.03); border-radius:8px; cursor:pointer; transition:0.2s;">
              <input type="radio" name="ans_${idx}" value="${opt}" style="transform:scale(1.2); margin-left:0.5rem;">
              ${opt}
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });
};

document.getElementById('btn-review-exam').addEventListener('click', () => {
  const c = document.getElementById('exam-review-container');
  c.style.display = c.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-submit-exam').addEventListener('click', async () => {
  if(!currentSolvingExam) return;
  
  let score = 0;
  const total = currentSolvingExam.questions.length;
  let allAnswered = true;

  currentSolvingExam.questions.forEach((q, idx) => {
    const selected = document.querySelector(`input[name="ans_${idx}"]:checked`);
    if(!selected) allAnswered = false;
    else if(selected.value === q.correctAnswer) score++;
  });

  if(!allAnswered && !window.isExamTimeOut) {
    return toast('يرجى الإجابة على جميع الأسئلة', 'warning');
  }

  if(currentExamTimer) clearInterval(currentExamTimer);
  document.getElementById('exam-timer-display').style.display = 'none';

  const percentage = Math.round((score / total) * 100);
  const mm = Math.floor(currentExamTimeTakenSec / 60).toString().padStart(2,'0');
  const ss = (currentExamTimeTakenSec % 60).toString().padStart(2,'0');
  const timeTakenStr = `${mm}:${ss}`;

  const gradeObj = {
    score: `${score}/${total}`,
    percentage: percentage,
    timeTaken: timeTakenStr
  };

  // Build review HTML
  let reviewHtml = '';
  currentSolvingExam.questions.forEach((q, idx) => {
    const selectedInput = document.querySelector(`input[name="ans_${idx}"]:checked`);
    const selected = selectedInput ? selectedInput.value : 'لم يتم الإجابة';
    const isCorrect = selected === q.correctAnswer;
    const imgHtml = q.imgUrl ? `<img src="${q.imgUrl}" style="max-width:100%; border-radius:8px; margin-bottom:1rem; box-shadow:0 4px 6px rgba(0,0,0,0.1);">` : '';
    reviewHtml += `
      <div class="exam-question-item" style="border-left: 4px solid ${isCorrect ? 'var(--success)' : 'var(--danger)'}; padding:1rem; background:rgba(255,255,255,0.5); margin-bottom:1rem; border-radius:8px;">
        <h4 class="quiz-q">${idx + 1}. ${q.question}</h4>
        ${imgHtml}
        <p><strong>إجابتك:</strong> <span style="color: ${isCorrect ? 'var(--success)' : 'var(--danger)'}">${selected}</span></p>
        ${!isCorrect ? `<p><strong>الإجابة الصحيحة:</strong> <span style="color: var(--success)">${q.correctAnswer}</span></p>` : ''}
      </div>
    `;
  });

  showLoading();
  try {
    const grades = { ...(currentUserData.grades || {}) };
    grades[currentSolvingExam.title] = gradeObj;
    
    // Save both grades and reviews
    const examReviews = { ...(currentUserData.examReviews || {}) };
    examReviews[currentSolvingExam.title] = reviewHtml;
    
    await Promise.all([
      updateUserGrades(currentUserData.uid, grades),
      updateUserField(currentUserData.uid, 'examReviews', examReviews)
    ]);

    currentUserData.grades = grades;
    currentUserData.examReviews = examReviews;
    
    document.getElementById('btn-submit-exam').style.display = 'none';
    document.getElementById('exam-questions-container').innerHTML = '';
    const res = document.getElementById('exam-result-display');
    res.style.display = 'block';
    res.innerHTML = `تم تسليم الامتحان! <br> النتيجة: <span style="color:var(--success)">${gradeObj.score}</span><br><span style="font-size:1rem;" class="text-muted">الوقت المستغرق: ${timeTakenStr}</span>`;
    
    const btnReview = document.getElementById('btn-review-exam');
    btnReview.style.display = 'block';
    document.getElementById('exam-review-container').innerHTML = reviewHtml;

    toast('تم حفظ النتيجة', 'success');
    renderStudentExams();
    renderStudentProfile();
  } catch (err) {
    console.error('Exam save error:', err);
    toast('حدث خطأ أثناء الحفظ', 'error');
  } finally {
    hideLoading();
  }
});


// -- Course Player & YT Custom API --
let ytPlayer = null;
let ytInterval = null;

// Global callback for YT Iframe API
window.onYouTubeIframeAPIReady = function() {
  console.log('YT API Ready');
};

function extractYtId(url) {
  let videoId = null;
  const ytRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(ytRegex);
  if(match && match[1]) videoId = match[1];
  return videoId;
}

window.openCoursePlayer = (courseId) => {
  currentViewingCourse = allCourses.find(c => c.id === courseId);
  if (!currentViewingCourse) return;

  switchView('course-player');
  document.getElementById('player-course-title').textContent = currentViewingCourse.title;
  
  // Reset tabs to default (Explanations active)
  document.querySelectorAll('.player-sidebar .lesson-list').forEach(l => l.classList.add('hidden-section'));
  document.querySelectorAll('.player-sidebar .section-tab').forEach(t => {
    t.style.opacity = '0.6';
    t.style.border = 'none';
  });
  const firstTab = document.querySelector('.player-sidebar .section-tab');
  if(firstTab) {
    firstTab.style.opacity = '1';
    firstTab.style.border = '2px solid var(--primary)';
  }
  document.getElementById('player-lessons-list').classList.remove('hidden-section');
  
  const lessonsList = document.getElementById('player-lessons-list');
  const exercisesList = document.getElementById('player-exercises-list');
  const examsList = document.getElementById('player-exams-list');
  const pdfsList = document.getElementById('player-pdfs-list');
  
  lessonsList.innerHTML = '';
  exercisesList.innerHTML = '';
  examsList.innerHTML = '';
  pdfsList.innerHTML = '';
  
  let hasAnyLesson = false;
  
  let lessonsHtml = '';
  let exercisesHtml = '';
  let pdfsHtml = '';

  if (currentViewingCourse.lessons && currentViewingCourse.lessons.length > 0) {
    hasAnyLesson = true;
    currentViewingCourse.lessons.forEach((l, idx) => {
      let iconClass = 'fa-play';
      let iconColor = 'var(--primary)';
      if(l.type === 'حل تدريبات') iconClass = 'fa-file-signature';
      if(l.type === 'ملف PDF') { iconClass = 'fa-file-pdf'; iconColor = '#ec4899'; }
      
      const htmlItem = `
        <li class="lesson-item" onclick="loadLesson(${idx})">
          <i class="fa-solid ${iconClass}" style="color: ${iconColor};"></i>
          <span>${l.title}</span>
        </li>
      `;
      if (l.type === 'حل تدريبات') exercisesHtml += htmlItem;
      else if (l.type === 'ملف PDF') pdfsHtml += htmlItem;
      else lessonsHtml += htmlItem;
    });
    
    lessonsList.innerHTML = lessonsHtml || '<p class="text-muted p-1" style="font-size:0.8rem;">لا توجد فيديوهات شرح</p>';
    exercisesList.innerHTML = exercisesHtml || '<p class="text-muted p-1" style="font-size:0.8rem;">لا توجد فيديوهات حل تدريبات</p>';
    pdfsList.innerHTML = pdfsHtml || '<p class="text-muted p-1" style="font-size:0.8rem;">لا توجد ملفات</p>';
    
    loadLesson(0);
  } else {
    document.getElementById('custom-video-wrapper').style.display = 'none';
    document.getElementById('video-placeholder').style.display = 'flex';
  }
  
  // Load Course Exams
  const courseExams = allExams.filter(e => e.grade === currentViewingCourse.grade && e.month === currentViewingCourse.month);
  if (courseExams.length > 0) {
    examsList.innerHTML = courseExams.map(e => `
        <li class="lesson-item" onclick="openStandaloneExam('${e.id}')" style="background:rgba(245,158,11,0.1);">
          <i class="fa-solid fa-star" style="color:var(--warning);"></i>
          <span>${e.title}</span>
        </li>
    `).join('');
  } else {
    examsList.innerHTML = '<p class="text-muted p-1" style="font-size:0.8rem;">لا توجد امتحانات شاملة لهذا الكورس</p>';
  }
};

// Course player back button handled by event delegation above

let currentActiveLessonQuiz = null;

window.loadLesson = (idx) => {
  const lessons = document.querySelectorAll('.lesson-item');
  lessons.forEach(l => l.classList.remove('active'));
  if (lessons[idx]) lessons[idx].classList.add('active');

  const lesson = currentViewingCourse.lessons[idx];
  document.getElementById('current-lesson-title').textContent = lesson.title;
  
  const customWrapper = document.getElementById('custom-video-wrapper');
  const placeholder = document.getElementById('video-placeholder');
  const quizArea = document.getElementById('quiz-area');
  const filesContainer = document.getElementById('lesson-files-container');
  
  // Render Files
  filesContainer.innerHTML = '';
  if(lesson.fileUrl) {
    filesContainer.innerHTML = `<a href="${lesson.fileUrl}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:0.8rem;"><i class="fa-solid fa-download"></i> تحميل المرفق (${lesson.fileName})</a>`;
  }
  
  const quizKey = `${currentViewingCourse.title} - ${lesson.title}`;
  const hasTakenQuiz = currentUserData.grades && currentUserData.grades[quizKey] !== undefined;

  if(ytPlayer && ytPlayer.destroy) {
    ytPlayer.destroy();
    ytPlayer = null;
  }
  clearInterval(ytInterval);

  if (lesson.type === 'ملف PDF') {
    customWrapper.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.innerHTML = '<div class="placeholder-video"><i class="fa-solid fa-file-pdf" style="font-size:3rem; color:#ec4899; margin-bottom:1rem; display:block;"></i> هذا المحتوى عبارة عن ملف مرفق. يرجى تحميله من الزر أدناه.</div>';
    quizArea.style.display = 'none';
    return;
  }

  if (lesson.quiz && !hasTakenQuiz) {
    customWrapper.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.innerHTML = '<div class="placeholder-video">يجب حل الكويز أولاً لفتح الفيديو</div>';
    quizArea.style.display = 'block';
    
    currentActiveLessonQuiz = { ...lesson.quiz, key: quizKey, videoUrl: lesson.url };
    window.isPreQuizTimeOut = false;
    const shuffledOptions = [...lesson.quiz.options].sort(() => Math.random() - 0.5);
    
    const imgHtml = lesson.quiz.imgUrl ? `<img src="${lesson.quiz.imgUrl}" style="max-width:100%; border-radius:8px; margin-bottom:1rem; box-shadow:0 4px 6px rgba(0,0,0,0.1);">` : '';
    let timerHtml = '';
    if(lesson.quiz.timeLimit) {
      timerHtml = `<div id="pre-quiz-timer" style="color:var(--danger); font-weight:bold; margin-bottom:0.5rem;"><i class="fa-regular fa-clock"></i> الوقت المتبقي: <span id="pre-quiz-timer-text">${lesson.quiz.timeLimit}:00</span></div>`;
    }

    document.getElementById('quiz-content').innerHTML = `
      ${timerHtml}
      ${imgHtml}
      <h4 class="quiz-q">${lesson.quiz.question}</h4>
      <div class="quiz-options">
        ${shuffledOptions.map((opt) => `
          <label class="quiz-option">
            <input type="radio" name="activeQuiz" value="${opt}">
            ${opt}
          </label>
        `).join('')}
      </div>
    `;

    if(lesson.quiz.timeLimit) {
      let tr = lesson.quiz.timeLimit * 60;
      window.preQuizTimerInterval = setInterval(() => {
        tr--;
        if(tr <= 0) {
          clearInterval(window.preQuizTimerInterval);
          window.isPreQuizTimeOut = true;
          document.getElementById('submit-quiz-btn').click();
        } else {
          const m = Math.floor(tr/60).toString().padStart(2,'0');
          const s = (tr%60).toString().padStart(2,'0');
          const el = document.getElementById('pre-quiz-timer-text');
          if(el) el.textContent = `${m}:${s}`;
        }
      }, 1000);
    }
  } else {
    quizArea.style.display = 'none';
    playYtVideo(lesson.url);
  }
};

const btnFullscreen = document.getElementById('btn-fullscreen');
btnFullscreen.onclick = () => {
  const wrapper = document.getElementById('custom-video-wrapper');
  if (!document.fullscreenElement) {
    wrapper.requestFullscreen().catch(err => console.log(err));
  } else {
    document.exitFullscreen();
  }
};

function playYtVideo(url) {
  const ytId = extractYtId(url);
  const customWrapper = document.getElementById('custom-video-wrapper');
  const placeholder = document.getElementById('video-placeholder');
  
  if(!ytId) {
    customWrapper.style.display = 'none';
    placeholder.style.display = 'flex';
    placeholder.innerHTML = '<div class="placeholder-video">رابط الفيديو غير صالح</div>';
    return;
  }

  placeholder.style.display = 'none';
  customWrapper.style.display = 'block';

  // Re-create container div for YT securely to avoid ghost iframes
  const holder = document.getElementById('yt-container-holder');
  if(holder) {
    holder.innerHTML = '<div id="yt-player-container"></div>';
  }

  ytPlayer = new YT.Player('yt-player-container', {
    videoId: ytId,
    playerVars: {
      controls: 0,
      disablekb: 1,
      rel: 0,
      modestbranding: 1,
      iv_load_policy: 3,
      showinfo: 0,
      fs: 0
    },
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
}

// YT Controls setup
const btnPlayPause = document.getElementById('btn-play-pause');
const btnMute = document.getElementById('btn-mute');
const btnSpeed = document.getElementById('btn-speed');
const progressBar = document.getElementById('progress-bar-container');
const progressFill = document.getElementById('progress-bar-fill');
const timeDisplay = document.getElementById('time-display');

function onPlayerReady(event) {
  updateTimeDisplay();
  ytInterval = setInterval(updateProgress, 500);
}

function onPlayerStateChange(event) {
  if(event.data === YT.PlayerState.PLAYING) {
    btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
  } else {
    btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
  }
}

btnPlayPause.onclick = () => {
  if(!ytPlayer) return;
  const state = ytPlayer.getPlayerState();
  if(state === YT.PlayerState.PLAYING) {
    ytPlayer.pauseVideo();
  } else {
    ytPlayer.playVideo();
    const wrapper = document.getElementById('custom-video-wrapper');
    if (!document.fullscreenElement) {
      wrapper.requestFullscreen().catch(err => console.log(err));
    }
  }
};

btnMute.onclick = () => {
  if(!ytPlayer) return;
  if(ytPlayer.isMuted()) {
    ytPlayer.unMute();
    btnMute.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
  } else {
    ytPlayer.mute();
    btnMute.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
  }
};

let currentPlaybackSpeed = 1;
btnSpeed.onclick = () => {
  if(!ytPlayer || !ytPlayer.setPlaybackRate) return;
  if(currentPlaybackSpeed === 1) currentPlaybackSpeed = 1.25;
  else if(currentPlaybackSpeed === 1.25) currentPlaybackSpeed = 1.5;
  else if(currentPlaybackSpeed === 1.5) currentPlaybackSpeed = 2;
  else currentPlaybackSpeed = 1;
  
  ytPlayer.setPlaybackRate(currentPlaybackSpeed);
  btnSpeed.textContent = currentPlaybackSpeed + 'x';
};

progressBar.onclick = (e) => {
  if(!ytPlayer) return;
  const rect = progressBar.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const percentage = clickX / rect.width;
  const duration = ytPlayer.getDuration();
  ytPlayer.seekTo(duration * percentage, true);
};

function updateProgress() {
  if(!ytPlayer || !ytPlayer.getCurrentTime) return;
  const current = ytPlayer.getCurrentTime() || 0;
  const duration = ytPlayer.getDuration() || 0;
  if(duration > 0) {
    const p = (current / duration) * 100;
    progressFill.style.width = p + '%';
    updateTimeDisplay(current, duration);
  }
}

function updateTimeDisplay(current = 0, duration = 0) {
  timeDisplay.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
}

function formatTime(sec) {
  sec = Math.floor(sec);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

document.getElementById('submit-quiz-btn').addEventListener('click', async () => {
  if (!currentActiveLessonQuiz) return;
  
  const selected = document.querySelector('input[name="activeQuiz"]:checked');
  if (!selected && !window.isPreQuizTimeOut) {
    toast('يرجى اختيار إجابة', 'warning');
    return;
  }

  if (window.preQuizTimerInterval) clearInterval(window.preQuizTimerInterval);

  const isCorrect = selected && selected.value === currentActiveLessonQuiz.correctAnswer;
  const score = isCorrect ? '100% (صحيح)' : '0% (خاطئ)';
  
  showLoading();
  try {
    const grades = { ...(currentUserData.grades || {}) };
    grades[currentActiveLessonQuiz.key] = score;
    await updateUserGrades(currentUserData.uid, grades);
    currentUserData.grades = grades;
    
    toast(isCorrect ? 'إجابة صحيحة! تم فتح الفيديو.' : 'إجابة خاطئة! تم تسجيل النتيجة وفتح الفيديو.', isCorrect ? 'success' : 'error');
    
    document.getElementById('quiz-area').style.display = 'none';
    playYtVideo(currentActiveLessonQuiz.videoUrl);
    renderStudentProfile();
  } catch (err) {
    toast('حدث خطأ أثناء حفظ النتيجة', 'error');
  } finally {
    hideLoading();
  }
});

// Custom video overlay block context menu to prevent download
document.getElementById('video-overlay').addEventListener('contextmenu', e => e.preventDefault());

window.switchCourseTab = (tabId, element) => {
  document.querySelectorAll('.player-sidebar .lesson-list').forEach(l => l.classList.add('hidden-section'));
  document.querySelectorAll('.player-sidebar .section-tab').forEach(t => {
    t.style.opacity = '0.6';
    t.style.border = 'none';
  });
  
  document.getElementById(tabId).classList.remove('hidden-section');
  element.style.opacity = '1';
  element.style.border = '2px solid var(--primary)';
};
