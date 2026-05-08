/**
 * 学习跟踪系统 - 主应用逻辑
 * SPA路由 + 9页面渲染 + 事件处理
 */
(function() {
  'use strict';

  // ===== 状态 =====
  let currentPage = 'dashboard';
  let currentStudentId = null;
  let currentSubject = '数学';

  // ===== Toast通知 =====
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  // ===== 路由系统 =====
  function navigateTo(page, params) {
    currentPage = page;

    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    // 更新底部导航
    document.querySelectorAll('.nav-item').forEach(n => {
      n.classList.toggle('active', n.dataset.page === page);
    });

    // 更新标题
    const titles = {
      dashboard: '📚 学习跟踪',
      student: '👤 学生详情',
      exam: '📝 测验录入',
      errors: '📋 错题库',
      weakpoints: '🎯 薄弱点',
      exercises: '✏️ 练习题',
      reports: '📊 学习报告',
      parents: '👨‍👩‍👧 家长共管',
      compare: '⚖️ 对比分析'
    };
    document.getElementById('headerTitle').textContent = titles[page] || '学习跟踪';

    // 渲染页面
    renderPage(page, params);

    // 滚动到顶部
    window.scrollTo(0, 0);
  }

  // ===== 页面渲染分发 =====
  function renderPage(page, params) {
    ChartRenderer.destroyAll();
    switch (page) {
      case 'dashboard': renderDashboard(); break;
      case 'student': renderStudent(params); break;
      case 'exam': renderExamEntry(); break;
      case 'errors': renderErrors(); break;
      case 'weakpoints': renderWeakpoints(); break;
      case 'exercises': renderExercises(); break;
      case 'reports': renderReports(); break;
      case 'parents': renderParents(); break;
      case 'compare': renderCompare(); break;
    }
  }

  // ===== 工具函数 =====
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.getMonth() + 1 + '/' + d.getDate();
  }

  function scoreClass(score, target) {
    if (!target) target = 90;
    if (score >= target) return 'score-excellent';
    if (score >= target - 5) return 'score-good';
    if (score >= target - 15) return 'score-warning';
    return 'score-danger';
  }

  function trendEmoji(trend) {
    if (trend === 'up') return ' 📈';
    if (trend === 'down') return ' 📉';
    return ' ➡️';
  }

  function severityClass(s) {
    if (s === 'high') return 'tag-red';
    if (s === 'medium') return 'tag-orange';
    return 'tag-blue';
  }

  function severityLabel(s) {
    if (s === 'high') return '🔴 严重';
    if (s === 'medium') return '🟡 注意';
    return '🟢 轻微';
  }

  // ==========================================
  //  页面1: 首页仪表盘
  // ==========================================
  function renderDashboard() {
    const container = document.getElementById('dashboardContent');
    const students = DataManager.getStudents().students;

    // 快捷操作
    let html = `
      <div class="quick-actions">
        <button class="quick-action" onclick="window._navTo('exam')">
          <span class="qa-icon">📷</span><span class="qa-label">录入测验</span>
        </button>
        <button class="quick-action" onclick="window._navTo('compare')">
          <span class="qa-icon">⚖️</span><span class="qa-label">对比分析</span>
        </button>
        <button class="quick-action" onclick="window._navTo('reports')">
          <span class="qa-icon">📊</span><span class="qa-label">查看报告</span>
        </button>
      </div>`;

    // 学生概览卡片
    html += '<div class="student-cards">';
    students.forEach(s => {
      const stats = DataManager.getStudentStats(s.id);
      const hasData = stats.totalExams > 0;

      html += `
      <div class="student-card ${s.id}" onclick="window._navTo('student', '${s.id}')">
        <div class="student-header">
          <div class="student-avatar">${s.emoji}</div>
          <div class="student-info">
            <div class="student-name">${s.name}</div>
            <div class="student-grade">${s.grade}年级 · ${s.semester}</div>
          </div>
        </div>
        <div class="student-stats">
          <div class="stat-item">
            <div class="stat-value">${stats.totalExams}</div>
            <div class="stat-label">测验次数</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.totalErrors}</div>
            <div class="stat-label">待攻克错题</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">${stats.completedExercises}</div>
            <div class="stat-label">完成练习</div>
          </div>
        </div>`;

      // 各科平均
      if (hasData) {
        html += '<div class="mt-12" style="display:flex;gap:8px;flex-wrap:wrap">';
        s.subjects.forEach(subj => {
          const avg = stats.subjectAvgs[subj];
          const trend = stats.subjectTrends[subj];
          if (avg) {
            html += `<span class="score-badge ${scoreClass(avg, s.targets[subj])}">${subj}: ${avg}分${trendEmoji(trend)}</span>`;
          }
        });
        html += '</div>';
      }

      if (!hasData) {
        html += '<div class="mt-8 text-muted" style="font-size:12px">📝 还没有测验记录，点击录入</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    // 最近动态
    html += '<div class="card"><div class="card-title">📌 最近动态</div>';
    const allExams = [];
    students.forEach(s => {
      DataManager.getExams(s.id).forEach(e => allExams.push({ ...e, studentName: s.name, studentId: s.id }));
    });
    allExams.sort((a, b) => b.date.localeCompare(a.date));
    const recent = allExams.slice(0, 5);

    if (recent.length === 0) {
      html += '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">暂无动态，开始录入第一次测验吧！</div></div>';
    } else {
      recent.forEach(e => {
        html += `
        <div class="list-item" onclick="window._navTo('student','${e.studentId}')">
          <div class="list-item-icon" style="background:${e.studentId==='qiyuan'?'#EBF2FA':'#EDF9E8'};color:${e.studentId==='qiyuan'?'#4A90D9':'#52C41A'}">${e.subject==='语文'?'📖':e.subject==='数学'?'🔢':'🌍'}</div>
          <div class="list-item-content">
            <div class="list-item-title">${e.studentName} - ${e.title || e.subject + '测验'}</div>
            <div class="list-item-subtitle">${e.date}</div>
          </div>
          <div class="list-item-right">
            <span class="score-badge ${scoreClass(e.actualScore, 90)}">${e.actualScore}分</span>
          </div>
        </div>`;
      });
    }
    html += '</div>';

    // 提醒
    const parents = DataManager.getParents();
    const activeTasks = parents.tasks.filter(t => t.status === 'pending');
    if (activeTasks.length > 0) {
      html += '<div class="alert alert-warning">📋 有' + activeTasks.length + '项待处理的学习任务</div>';
    }

    container.innerHTML = html;
  }

  // ==========================================
  //  页面2: 学生详情
  // ==========================================
  function renderStudent(params) {
    currentStudentId = params;
    const container = document.getElementById('studentContent');
    const s = DataManager.getStudent(currentStudentId);
    const stats = DataManager.getStudentStats(currentStudentId);
    const profile = DataManager.getProfile(currentStudentId);
    const exams = DataManager.getExams(currentStudentId);
    const errors = DataManager.getErrors(currentStudentId);
    const weakpoints = DataManager.getWeakpoints(currentStudentId);

    if (!s) {
      container.innerHTML = '<div class="empty-state">学生信息未找到</div>';
      return;
    }

    let html = '';

    // 学生头部
    html += `
    <div class="card" style="border-top:4px solid ${s.color}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div class="student-avatar ${s.id}" style="width:56px;height:56px;font-size:28px">${s.emoji}</div>
        <div>
          <div style="font-size:20px;font-weight:700">${s.name}</div>
          <div style="font-size:13px;color:var(--text-secondary)">${s.grade}年级 · ${s.semester}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center">
        <div><div style="font-size:22px;font-weight:700">${stats.totalExams}</div><div style="font-size:11px;color:var(--text-secondary)">测验</div></div>
        <div><div style="font-size:22px;font-weight:700;color:var(--danger)">${stats.totalErrors}</div><div style="font-size:11px;color:var(--text-secondary)">待攻克</div></div>
        <div><div style="font-size:22px;font-weight:700;color:var(--success)">${stats.masteredErrors}</div><div style="font-size:11px;color:var(--text-secondary)">已掌握</div></div>
        <div><div style="font-size:22px;font-weight:700">${stats.completedExercises}</div><div style="font-size:11px;color:var(--text-secondary)">练习</div></div>
      </div>
    </div>`;

    // 学科标签切换
    html += '<div class="tabs">';
    s.subjects.forEach(subj => {
      html += `<button class="tab ${subj === currentSubject ? 'active' : ''}" onclick="window._switchSubject('${subj}')">${subj}</button>`;
    });
    html += '</div>';

    // 该科成绩概览
    const subjExams = exams.filter(e => e.subject === currentSubject);
    const subjErrors = errors.filter(e => e.subject === currentSubject && !e.mastered);
    const subjWeakpoints = (weakpoints.subjects[currentSubject] || []);

    if (subjExams.length > 0) {
      html += `<div class="card"><div class="card-title">📈 ${currentSubject}成绩趋势</div>`;
      html += `<div class="chart-container" style="height:200px"><canvas id="chartScoreTrend"></canvas></div></div>`;
    }

    // 薄弱点
    if (subjWeakpoints.length > 0) {
      html += '<div class="card"><div class="card-title">🎯 薄弱知识点</div>';
      subjWeakpoints.forEach(wp => {
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light)">
          <div>
            <span style="font-weight:600">${wp.topic}</span>
            <span class="tag ${severityClass(wp.severity)} ml-8">${severityLabel(wp.severity)}</span>
          </div>
          <span style="font-size:12px;color:var(--text-secondary)">${wp.count}次</span>
        </div>`;
      });
      html += '</div>';
    } else {
      html += '<div class="card"><div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-text">暂无薄弱点，继续保持！</div></div></div>';
    }

    // 最近测验
    if (subjExams.length > 0) {
      html += '<div class="card"><div class="card-title">📝 最近' + currentSubject + '测验</div>';
      subjExams.slice(-5).reverse().forEach(e => {
        html += `
        <div class="list-item">
          <div class="list-item-icon" style="background:var(--primary-light);color:var(--primary)">📝</div>
          <div class="list-item-content">
            <div class="list-item-title">${e.title || e.subject + '测验'}</div>
            <div class="list-item-subtitle">${e.date} · ${e.examType || '单元测试'} · 错${e.errors ? e.errors.length : 0}题</div>
          </div>
          <div class="list-item-right">
            <span class="score-badge ${scoreClass(e.actualScore, s.targets[currentSubject])}">${e.actualScore}分</span>
          </div>
        </div>`;
      });
      html += '</div>';
    }

    // 操作按钮
    html += `
    <div class="btn-group mt-12">
      <button class="btn btn-primary" onclick="window._navTo('exam','${currentStudentId}')">📷 录入测验</button>
      <button class="btn btn-outline" onclick="window._navTo('errors','${currentStudentId}')">📋 查看错题</button>
      <button class="btn btn-outline" onclick="window._navTo('exercises','${currentStudentId}')">✏️ 生成练习</button>
    </div>`;

    container.innerHTML = html;

    // 渲染图表（延迟以确保canvas存在）
    if (subjExams.length > 0) {
      setTimeout(() => {
        ChartRenderer.renderScoreTrend('chartScoreTrend', subjExams, currentStudentId);
      }, 100);
    }
  }

  // ==========================================
  //  页面3: 测验录入
  // ==========================================
  function renderExamEntry() {
    const container = document.getElementById('examContent');
    const students = DataManager.getStudents().students;

    let html = '<div class="section-title">📝 录入新测验</div>';

    if (!currentStudentId) currentStudentId = 'qiyuan';

    // 学生选择
    html += '<div class="card">';
    html += '<div class="form-group"><label class="form-label">选择孩子</label><div class="btn-group">';
    students.forEach(s => {
      html += `<button class="btn ${currentStudentId === s.id ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="window._selectExamStudent('${s.id}')">${s.emoji} ${s.name}</button>`;
    });
    html += '</div></div>';

    const s = DataManager.getStudent(currentStudentId);

    html += `
      <div class="form-group"><label class="form-label">学科</label>
        <select class="form-select" id="examSubject">`;
    s.subjects.forEach(subj => {
      html += `<option value="${subj}">${subj}</option>`;
    });
    html += `</select></div>

      <div class="form-group"><label class="form-label">测验标题</label>
        <input class="form-input" id="examTitle" placeholder="如：第五单元分数运算测验" value=""></div>

      <div class="form-group"><label class="form-label">测验类型</label>
        <select class="form-select" id="examType">
          <option value="单元测试">单元测试</option>
          <option value="期中考试">期中考试</option>
          <option value="期末考试">期末考试</option>
          <option value="随堂测验">随堂测验</option>
          <option value="模拟考试">模拟考试</option>
        </select></div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">满分</label>
          <input class="form-input" id="examTotal" type="number" value="100"></div>
        <div class="form-group"><label class="form-label">实际得分</label>
          <input class="form-input" id="examScore" type="number" placeholder="孩子得分" value=""></div>
      </div>

      <div class="form-group"><label class="form-label">测验日期</label>
        <input class="form-input" id="examDate" type="date" value="${new Date().toISOString().split('T')[0]}"></div>
    </div>`;

    // 错题录入区
    html += `
    <div class="card">
      <div class="card-header">
        <span class="card-title">❌ 错题详情</span>
        <button class="btn btn-sm btn-outline" onclick="window._addErrorRow()">+ 添加错题</button>
      </div>
      <div id="errorRows"></div>
    </div>

    <div class="card">
      <div class="form-group"><label class="form-label">📷 试卷照片</label>
        <div class="photo-upload" onclick="document.getElementById('photoInput').click()" id="photoUploadArea">
          <div class="upload-icon">📸</div>
          <div class="upload-text">点击拍照或上传试卷图片</div>
        </div>
        <input type="file" id="photoInput" accept="image/*" capture="environment" style="display:none" onchange="window._handlePhotoUpload(event)">
        <div id="photoPreviews" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px"></div>
        <div id="ocrStatus" style="display:none;margin-top:8px"></div>
        <div id="ocrReview" style="display:none;margin-top:8px"></div>
      </div>
    </div>

    <!-- OCR识别按钮区 -->
    <div class="card" style="text-align:center">
      <button class="btn btn-primary btn-block" id="btnOCR" onclick="window._runOCR()" disabled style="margin-bottom:8px">
        🔍 智能识别试卷内容
      </button>
      <div style="font-size:11px;color:var(--text-light)">拍照后点击识别，自动提取题目和答案</div>
    </div>

    <button class="btn btn-primary btn-block btn-lg" onclick="window._submitExam()">✅ 保存测验记录</button>`;

    container.innerHTML = html;

    // 添加默认错题行
    setTimeout(() => window._addErrorRow(), 50);
  }

  // 添加错题行
  window._addErrorRow = function() {
    const container = document.getElementById('errorRows');
    const idx = container.children.length;
    const div = document.createElement('div');
    div.className = 'error-item';
    div.style.cssText = 'border-left-color:var(--primary);padding:12px';
    div.innerHTML = `
      <div style="display:grid;grid-template-columns:60px 1fr;gap:8px;margin-bottom:8px">
        <div><label style="font-size:12px;font-weight:600">题号</label>
          <input class="form-input" name="errQno" placeholder="3" style="padding:6px 8px;font-size:13px"></div>
        <div><label style="font-size:12px;font-weight:600">题目简述</label>
          <input class="form-input" name="errText" placeholder="如：计算3/4+1/6" style="padding:6px 8px;font-size:13px"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div><label style="font-size:12px;font-weight:600">错误答案</label>
          <input class="form-input" name="errWrong" placeholder="学生的错误答案" style="padding:6px 8px;font-size:13px"></div>
        <div><label style="font-size:12px;font-weight:600">正确答案</label>
          <input class="form-input" name="errCorrect" placeholder="正确答案" style="padding:6px 8px;font-size:13px"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div><label style="font-size:12px;font-weight:600">知识点</label>
          <input class="form-input" name="errTopic" placeholder="如：分数加减法" style="padding:6px 8px;font-size:13px"></div>
        <div><label style="font-size:12px;font-weight:600">错误类型</label>
          <select class="form-select" name="errType" style="padding:6px 8px;font-size:13px">
            <option value="计算错误">计算错误</option>
            <option value="概念不清">概念不清</option>
            <option value="审题失误">审题失误</option>
            <option value="方法错误">方法错误</option>
            <option value="粗心大意">粗心大意</option>
            <option value="其他">其他</option>
          </select></div>
      </div>
      <button style="margin-top:8px;background:none;border:none;color:var(--danger);font-size:12px;cursor:pointer" onclick="this.parentElement.remove()">删除此行</button>`;
    container.appendChild(div);
  };

  // 选择录入学生
  window._selectExamStudent = function(id) {
    currentStudentId = id;
    renderExamEntry();
  };

  // 照片上传
  window._handlePhotoUpload = function(event) {
    const files = event.target.files;
    const previews = document.getElementById('photoPreviews');
    const btnOCR = document.getElementById('btnOCR');

    for (var i = 0; i < files.length; i++) {
      (function(f) {
        var reader = new FileReader();
        reader.onload = function(e) {
          var div = document.createElement('div');
          div.className = 'photo-preview';
          div.innerHTML = '<img src="' + e.target.result + '" alt="试卷"><button class="remove-btn" onclick="this.parentElement.remove();window._checkOCRButton()">×</button>';
          previews.appendChild(div);
          // 启用OCR按钮
          if (btnOCR) btnOCR.disabled = false;
        };
        reader.readAsDataURL(f);
      })(files[i]);
    }
  };

  // 检查照片状态
  window._checkOCRButton = function() {
    var previews = document.getElementById('photoPreviews');
    var btnOCR = document.getElementById('btnOCR');
    if (btnOCR) btnOCR.disabled = !previews || previews.children.length === 0;
  };

  // 运行OCR识别
  window._runOCR = function() {
    var previews = document.getElementById('photoPreviews');
    var imgs = previews.querySelectorAll('img');
    var statusEl = document.getElementById('ocrStatus');
    var btnOCR = document.getElementById('btnOCR');

    if (imgs.length === 0) {
      showToast('请先拍照上传试卷', 'error');
      return;
    }

    // 显示处理中
    btnOCR.disabled = true;
    btnOCR.textContent = '⏳ 正在识别中...';
    statusEl.style.display = 'block';
    statusEl.innerHTML = '<div class="alert alert-info">🔍 正在识别试卷内容，请稍候...（免费API约3-5秒）</div>';

    var base64 = imgs[0].src;
    var maxWidth = 1200;

    // 压缩图片
    OCRHelper.compressImage(base64, maxWidth, 0.7, function(compressed) {
      // 调用OCR API
      OCRHelper.recognizeImage(compressed, function(result) {
        btnOCR.disabled = false;
        btnOCR.textContent = '🔍 智能识别试卷内容';

        if (!result.success) {
          statusEl.innerHTML = '<div class="alert alert-warning">⚠️ 自动识别失败：' + (result.error || '') + '<br><small>请手动录入或稍后重试</small></div>';
          showToast('OCR识别失败，请手动录入', 'error');
          return;
        }

        var ocrText = result.text;
        if (!ocrText || ocrText.trim().length < 5) {
          statusEl.innerHTML = '<div class="alert alert-warning">⚠️ 未识别到足够文字<br><small>请确认照片清晰、光线充足，或手动录入</small></div>';
          return;
        }

        // 解析为题目
        var questions = OCRHelper.parseToQuestions(ocrText);

        // 显示识别结果
        statusEl.innerHTML = '<div class="alert alert-success">✅ 识别成功！检测到 ' + questions.length + ' 道题目</div>';

        // 显示预览和确认区
        var reviewEl = document.getElementById('ocrReview');
        reviewEl.style.display = 'block';
        var reviewHtml = '<div class="card"><div class="card-title">📋 识别结果预览</div>';
        reviewHtml += '<div style="max-height:300px;overflow-y:auto;font-size:12px;color:var(--text-secondary);background:var(--bg);padding:12px;border-radius:8px;margin-bottom:12px;white-space:pre-wrap">' + escapeHtml(ocrText.substring(0, 1000)) + (ocrText.length > 1000 ? '...' : '') + '</div>';
        reviewHtml += '<div style="font-size:12px;margin-bottom:12px">检测到 <b>' + questions.length + '</b> 道题目，将自动填入错题表单</div>';
        reviewHtml += '<div class="btn-group">';
        reviewHtml += '<button class="btn btn-primary btn-sm" onclick="window._fillOCRResults()">✅ 填入错题表单</button>';
        reviewHtml += '<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'ocrReview\').style.display=\'none\'">取消</button>';
        reviewHtml += '</div></div>';
        reviewEl.innerHTML = reviewHtml;

        // 暂存识别结果
        window._ocrQuestions = questions;

        showToast('识别成功！请确认后填入表单', 'success');
      });
    });
  };

  // 填入OCR结果到错题表单
  window._fillOCRResults = function() {
    var questions = window._ocrQuestions;
    if (!questions || questions.length === 0) return;

    var errorRows = document.getElementById('errorRows');
    // 清空已有错题行
    errorRows.innerHTML = '';

    // 逐题添加
    questions.forEach(function(q, i) {
      window._addErrorRow();
      var row = errorRows.lastElementChild;
      if (!row) return;

      var qnoEl = row.querySelector('[name="errQno"]');
      var textEl = row.querySelector('[name="errText"]');
      var wrongEl = row.querySelector('[name="errWrong"]');
      var correctEl = row.querySelector('[name="errCorrect"]');
      var topicEl = row.querySelector('[name="errTopic"]');
      var typeEl = row.querySelector('[name="errType"]');

      if (qnoEl) qnoEl.value = q.questionNo || (i + 1);
      if (textEl) textEl.value = q.questionText || '';
      if (wrongEl) wrongEl.value = q.wrongAnswer || '';
      if (correctEl) correctEl.value = q.correctAnswer || '';
      if (topicEl) topicEl.value = q.topic || '';
      if (typeEl) typeEl.value = q.errorType || '计算错误';
    });

    // 自动尝试分析总分（如果OCR文本中有分数信息）
    tryAutoFillScore();

    document.getElementById('ocrReview').style.display = 'none';
    showToast('已填入 ' + questions.length + ' 道错题，请核对修改后保存', 'success');

    // 滚动到错题区
    document.getElementById('errorRows').scrollIntoView({ behavior: 'smooth' });
  };

  // 自动分析OCR文本中的分数
  function tryAutoFillScore() {
    if (!window._ocrQuestions) return;
    var allText = window._ocrQuestions.map(function(q) { return q.questionText; }).join('\n');

    // 查找 "得分：X" 或 "总分 X分" 等模式
    var scoreMatch = allText.match(/(?:得分|成绩|分数|总分)[：:]\s*(\d+)/);
    if (!scoreMatch) scoreMatch = allText.match(/(\d{2,3})\s*分/);
    if (scoreMatch) {
      var score = parseInt(scoreMatch[1]);
      var scoreEl = document.getElementById('examScore');
      if (scoreEl && !scoreEl.value) {
        scoreEl.value = score;
      }
    }
  }

  function escapeHtml(text) {
    var div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  };

  // 提交测验
  window._submitExam = function() {
    const subject = document.getElementById('examSubject').value;
    const title = document.getElementById('examTitle').value || subject + '测验';
    const examType = document.getElementById('examType').value;
    const total = parseInt(document.getElementById('examTotal').value) || 100;
    const score = parseInt(document.getElementById('examScore').value);
    const date = document.getElementById('examDate').value;

    if (isNaN(score)) {
      showToast('请输入实际得分', 'error');
      return;
    }
    if (!date) {
      showToast('请选择测验日期', 'error');
      return;
    }

    // 收集错题
    const errors = [];
    const rows = document.getElementById('errorRows').children;
    for (let row of rows) {
      const qno = row.querySelector('[name="errQno"]').value;
      const text = row.querySelector('[name="errText"]').value;
      const wrong = row.querySelector('[name="errWrong"]').value;
      const correct = row.querySelector('[name="errCorrect"]').value;
      const topic = row.querySelector('[name="errTopic"]').value;
      const type = row.querySelector('[name="errType"]').value;
      if (topic || text) {
        errors.push({
          questionNo: qno || '',
          questionText: text || '',
          topic: topic || '未分类',
          subTopic: topic || '未分类',
          errorType: type,
          wrongAnswer: wrong,
          correctAnswer: correct,
          analysis: '',
          difficulty: '中等'
        });
      }
    }

    // 收集照片
    const images = [];
    document.querySelectorAll('#photoPreviews img').forEach(img => {
      images.push(img.src);
    });

    const exam = { subject, title, examType, totalScore: total, actualScore: score, date, errors, weakPoints: errors.map(e => e.topic), images };
    DataManager.addExam(currentStudentId, exam);

    showToast('测验录入成功！✅', 'success');
    navigateTo('dashboard');
  };

  // ==========================================
  //  页面4: 错题库
  // ==========================================
  function renderErrors() {
    const container = document.getElementById('errorsContent');
    const students = DataManager.getStudents().students;

    let html = '<div class="section-title">📋 错题库</div>';

    // 筛选栏
    html += '<div class="card" style="display:flex;gap:8px;flex-wrap:wrap">';
    html += '<select class="form-select" id="errorStudentFilter" onchange="window._filterErrors()" style="flex:1;min-width:80px">';
    html += '<option value="all">全部孩子</option>';
    students.forEach(s => html += `<option value="${s.id}">${s.emoji} ${s.name}</option>`);
    html += '</select>';
    html += '<select class="form-select" id="errorSubjectFilter" onchange="window._filterErrors()" style="flex:1;min-width:80px">';
    html += '<option value="all">全部学科</option><option value="语文">语文</option><option value="数学">数学</option><option value="英语">英语</option></select>';
    html += '<select class="form-select" id="errorStatusFilter" onchange="window._filterErrors()" style="flex:1;min-width:80px">';
    html += '<option value="active">未掌握</option><option value="all">全部</option><option value="mastered">已掌握</option></select>';
    html += '</div>';

    html += '<div id="errorList"></div>';

    container.innerHTML = html;
    window._filterErrors();
  }

  window._filterErrors = function() {
    const studentFilter = document.getElementById('errorStudentFilter')?.value || 'all';
    const subjectFilter = document.getElementById('errorSubjectFilter')?.value || 'all';
    const statusFilter = document.getElementById('errorStatusFilter')?.value || 'active';

    const allErrors = [];
    const students = DataManager.getStudents().students;

    students.forEach(s => {
      if (studentFilter !== 'all' && s.id !== studentFilter) return;
      DataManager.getErrors(s.id).forEach(e => {
        if (subjectFilter !== 'all' && e.subject !== subjectFilter) return;
        if (statusFilter === 'active' && e.mastered) return;
        if (statusFilter === 'mastered' && !e.mastered) return;
        allErrors.push({ ...e, studentName: s.name, studentId: s.id, studentColor: s.color });
      });
    });

    allErrors.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const list = document.getElementById('errorList');
    if (!list) return;

    if (allErrors.length === 0) {
      list.innerHTML = '<div class="card"><div class="empty-state"><div class="empty-icon">🎉</div><div class="empty-text">没有符合条件的错题</div></div></div>';
      return;
    }

    let html = `<div class="card"><div class="card-title">共 ${allErrors.length} 道错题</div>`;

    allErrors.forEach(e => {
      const subjIcon = e.subject === '语文' ? '📖' : e.subject === '数学' ? '🔢' : '🌍';
      const errorTypes = (e.errorTypes || []).join('、');

      html += `
      <div class="error-item ${e.mastered ? 'mastered' : ''}" style="border-left-color:${e.studentColor}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="font-weight:600;font-size:14px">${subjIcon} ${e.topic}${e.subTopic !== e.topic ? ' · ' + e.subTopic : ''}</div>
          <div style="display:flex;gap:4px;flex-shrink:0">
            ${e.mastered ? '<span class="tag tag-green">已掌握</span>' : '<span class="tag tag-red">待攻克</span>'}
            <span class="tag tag-gray">${e.frequency}次</span>
          </div>
        </div>
        ${e.questionText ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:4px">📝 ${e.questionText}</div>` : ''}
        <div class="error-meta">
          <span class="tag tag-red">✗ ${e.wrongAnswer || '?'}</span>
          <span class="tag tag-green">✓ ${e.correctAnswer || '?'}</span>
          <span class="tag tag-gray">${errorTypes}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn btn-sm btn-outline" onclick="window._toggleMastered('${e.studentId}','${e.id}',${!e.mastered})">${e.mastered ? '🔓 标记未掌握' : '✅ 标记已掌握'}</button>
          <button class="btn btn-sm btn-outline" onclick="window._navTo('exercises','${e.studentId}:${e.subject}:${encodeURIComponent(e.topic)}')">✏️ 同类练习</button>
        </div>
      </div>`;
    });

    html += '</div>';
    list.innerHTML = html;
  };

  window._toggleMastered = function(studentId, errorId, mastered) {
    const errors = DataManager.getErrors(studentId);
    const e = errors.find(x => x.id === errorId);
    if (e) {
      e.mastered = mastered;
      e.updatedAt = new Date().toISOString();
      DataManager.saveErrors(studentId, errors);
      DataManager.updateWeakpointsFromExams(studentId);
      showToast(mastered ? '已标记为掌握 ✅' : '已标记为未掌握', 'success');
      window._filterErrors();
    }
  };

  // ==========================================
  //  页面5: 薄弱点
  // ==========================================
  function renderWeakpoints() {
    const container = document.getElementById('weakpointsContent');
    if (!currentStudentId) currentStudentId = 'qiyuan';
    const students = DataManager.getStudents().students;
    const weakpoints = DataManager.getWeakpoints(currentStudentId);
    const s = DataManager.getStudent(currentStudentId);

    let html = '<div class="section-title">🎯 薄弱点分析</div>';

    // 学生选择
    html += '<div class="btn-group mb-12">';
    students.forEach(st => {
      html += `<button class="btn ${currentStudentId === st.id ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="window._selectWeakStudent('${st.id}')">${st.emoji} ${st.name}</button>`;
    });
    html += '</div>';

    // 雷达图
    html += '<div class="card"><div class="card-title">📊 知识点掌握度</div>';
    html += '<div class="chart-container" style="height:280px"><canvas id="chartRadar"></canvas></div></div>';

    // 薄弱点列表
    const subjects = s.subjects;
    subjects.forEach(subj => {
      const wps = weakpoints.subjects[subj] || [];
      if (wps.length === 0) return;
      html += `<div class="card"><div class="card-title">${subj === '语文' ? '📖' : subj === '数学' ? '🔢' : '🌍'} ${subj}</div>`;
      wps.forEach(wp => {
        html += `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light)">
          <div>
            <span style="font-weight:600">${wp.topic}</span>
            <span class="tag ${severityClass(wp.severity)}">${severityLabel(wp.severity)}</span>
          </div>
          <div style="text-align:right">
            <span style="font-size:13px;font-weight:600">${wp.count}次</span>
            <div style="font-size:11px;color:var(--text-secondary)">${wp.recentTrend === 'up' ? '📈改善中' : wp.recentTrend === 'down' ? '📉需关注' : '➡️持平'}</div>
          </div>
        </div>`;
      });
      html += '</div>';
    });

    // 历史趋势
    if (weakpoints.history && weakpoints.history.length >= 2) {
      html += '<div class="card"><div class="card-title">📈 薄弱点数量趋势</div>';
      html += '<div class="chart-container" style="height:200px"><canvas id="chartWeakHistory"></canvas></div></div>';
    }

    html += `<button class="btn btn-primary btn-block mt-12" onclick="window._navTo('exercises','${currentStudentId}')">✏️ 基于薄弱点生成练习题</button>`;

    container.innerHTML = html;

    setTimeout(() => {
      ChartRenderer.renderRadar('chartRadar', weakpoints, currentStudentId);
      if (weakpoints.history && weakpoints.history.length >= 2) {
        ChartRenderer.renderWeakpointHistory('chartWeakHistory', weakpoints.history);
      }
    }, 100);
  }

  window._selectWeakStudent = function(id) {
    currentStudentId = id;
    renderWeakpoints();
  };

  // ==========================================
  //  页面6: 练习题
  // ==========================================
  function renderExercises(params) {
    const container = document.getElementById('exercisesContent');
    if (!currentStudentId) currentStudentId = 'qiyuan';

    // 解析参数
    let presetSubject = null, presetTopic = null;
    if (params && params.includes(':')) {
      const parts = params.split(':');
      currentStudentId = parts[0];
      presetSubject = parts[1];
      presetTopic = parts[2] ? decodeURIComponent(parts[2]) : null;
    }

    const students = DataManager.getStudents().students;
    const s = DataManager.getStudent(currentStudentId);
    const exercises = DataManager.getExercises(currentStudentId);

    let html = '<div class="section-title">✏️ 练习题</div>';

    // 学生选择
    html += '<div class="btn-group mb-12">';
    students.forEach(st => {
      html += `<button class="btn ${currentStudentId === st.id ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="window._selectExStudent('${st.id}')">${st.emoji} ${st.name}</button>`;
    });
    html += '</div>';

    // 生成新练习
    html += `
    <div class="card">
      <div class="card-title">🆕 生成针对性练习</div>
      <div class="form-group"><label class="form-label">学科</label>
        <select class="form-select" id="exSubject">`;
    s.subjects.forEach(subj => {
      const sel = subj === presetSubject ? ' selected' : '';
      html += `<option value="${subj}"${sel}>${subj}</option>`;
    });
    html += `</select></div>

      <div class="form-group"><label class="form-label">目标知识点</label>
        <input class="form-input" id="exTopic" placeholder="如：分数加减法（留空则自动选择薄弱点）" value="${presetTopic || ''}"></div>

      <div class="form-group"><label class="form-label">难度</label>
        <select class="form-select" id="exDifficulty">
          <option value="basic">🟢 基础巩固</option>
          <option value="medium" selected>🟡 能力提升</option>
          <option value="hard">🔴 拓展挑战</option>
        </select></div>

      <div class="form-group"><label class="form-label">题目数量</label>
        <select class="form-select" id="exCount">
          <option value="5">5题</option>
          <option value="10" selected>10题</option>
          <option value="15">15题</option>
          <option value="20">20题</option>
        </select></div>

      <button class="btn btn-primary btn-block" onclick="window._generateExercise()">🎲 生成练习题</button>
    </div>`;

    // 已生成的练习
    html += '<div class="card"><div class="card-title">📋 练习记录</div>';
    if (exercises.length === 0) {
      html += '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-text">还没有生成过练习题</div></div>';
    } else {
      exercises.slice().reverse().forEach(ex => {
        html += `
        <div class="list-item" onclick="window._viewExercise('${currentStudentId}','${ex.id}')">
          <div class="list-item-icon" style="background:var(--primary-light);color:var(--primary)">✏️</div>
          <div class="list-item-content">
            <div class="list-item-title">${ex.subject} · ${ex.topic}</div>
            <div class="list-item-subtitle">${ex.difficultyLabel} · ${ex.questions.length}题 · ${ex.date}</div>
          </div>
          <div class="list-item-right">
            ${ex.completed ? '<span class="tag tag-green">已完成</span>' : '<span class="tag tag-orange">待完成</span>'}
          </div>
        </div>`;
      });
    }
    html += '</div>';

    container.innerHTML = html;

    // 练习详情弹窗（默认隐藏）
    container.innerHTML += '<div class="modal-overlay" id="exerciseModal"></div>';
  }

  window._selectExStudent = function(id) {
    currentStudentId = id;
    renderExercises();
  };

  window._generateExercise = function() {
    const subject = document.getElementById('exSubject').value;
    let topic = document.getElementById('exTopic').value;
    const difficulty = document.getElementById('exDifficulty').value;
    const count = parseInt(document.getElementById('exCount').value);

    // 如果没填知识点，从薄弱点自动选
    if (!topic) {
      const weakpoints = DataManager.getWeakpoints(currentStudentId);
      const wps = weakpoints.subjects[subject] || [];
      if (wps.length > 0) {
        topic = wps.sort((a, b) => b.count - a.count)[0].topic;
        showToast('自动选择薄弱点：' + topic, 'info');
      } else {
        topic = subject + '综合练习';
      }
    }

    const difficultyLabels = { basic: '基础巩固', medium: '能力提升', hard: '拓展挑战' };

    // 生成题目
    const questions = generateQuestions(subject, topic, difficulty, count);

    const exercise = {
      id: 'ex_' + Date.now(),
      studentId: currentStudentId,
      subject,
      topic,
      difficulty,
      difficultyLabel: difficultyLabels[difficulty],
      questions,
      completed: false,
      score: null,
      completedDate: null,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString()
    };

    const exercises = DataManager.getExercises(currentStudentId);
    exercises.push(exercise);
    DataManager.saveExercises(currentStudentId, exercises);

    showToast('已生成' + count + '道练习题！📝', 'success');
    renderExercises();
    setTimeout(() => window._viewExercise(currentStudentId, exercise.id), 300);
  };

  window._viewExercise = function(studentId, exerciseId) {
    const exercises = DataManager.getExercises(studentId);
    const ex = exercises.find(e => e.id === exerciseId);
    if (!ex) return;

    const modal = document.getElementById('exerciseModal');
    let html = '<div class="modal">';
    html += '<div class="modal-header"><div class="modal-title">✏️ 练习题</div><button class="modal-close" onclick="document.getElementById(\'exerciseModal\').classList.remove(\'active\')">✕</button></div>';
    html += `<div style="margin-bottom:12px"><span class="tag tag-blue">${ex.subject}</span> <span class="tag tag-green">${ex.topic}</span> <span class="tag tag-orange">${ex.difficultyLabel}</span> <span class="tag tag-gray">${ex.questions.length}题</span></div>`;

    ex.questions.forEach((q, i) => {
      html += `
      <div style="padding:12px;background:var(--bg);border-radius:8px;margin-bottom:8px">
        <div style="font-weight:700;margin-bottom:4px">${i + 1}. ${q.question}</div>
        <div style="font-size:13px;color:var(--text-secondary)">答案：${q.answer}</div>
      </div>`;
    });

    html += `<button class="btn btn-success btn-block mt-12" onclick="window._completeExercise('${studentId}','${exerciseId}')">✅ 标记已完成</button>`;
    html += '</div>';

    modal.innerHTML = html;
    modal.classList.add('active');
  };

  window._completeExercise = function(studentId, exerciseId) {
    const exercises = DataManager.getExercises(studentId);
    const ex = exercises.find(e => e.id === exerciseId);
    if (ex) {
      ex.completed = true;
      ex.completedDate = new Date().toISOString().split('T')[0];
      DataManager.saveExercises(studentId, exercises);
    }
    document.getElementById('exerciseModal').classList.remove('active');
    showToast('练习已完成！👍', 'success');
    renderExercises();
  };

  // 练习题生成引擎
  function generateQuestions(subject, topic, difficulty, count) {
    const questions = [];
    const templates = getQuestionTemplates(subject, topic);

    for (let i = 0; i < count; i++) {
      const t = templates[i % templates.length];
      const q = generateFromTemplate(t, difficulty, i);
      questions.push(q);
    }
    return questions;
  }

  function getQuestionTemplates(subject, topic) {
    const all = {
      '数学': {
        '分数运算': [
          { q: (a, b, c, d) => `计算 ${a}/${b} + ${c}/${d} = ?`, a: (a, b, c, d) => `${(a*d + c*b) / gcd(a*d + c*b, b*d)}/${(b*d) / gcd(a*d + c*b, b*d)}` },
          { q: (a, b, c, d) => `计算 ${a}/${b} - ${c}/${d} = ?`, a: (a, b, c, d) => `${(a*d - c*b) / gcd(Math.abs(a*d - c*b), b*d)}/${(b*d) / gcd(Math.abs(a*d - c*b), b*d)}` },
          { q: (a, b, c, d) => `比较大小：${a}/${b} ○ ${c}/${d}（填 > < =）`, a: (a, b, c, d) => a/b > c/d ? '>' : a/b < c/d ? '<' : '=' },
          { q: (a, b, c) => `把 ${a}/${b} 化成最简分数`, a: (a, b) => `${a/gcd(a,b)}/${b/gcd(a,b)}` },
          { q: (n) => `小明有 ${n} 块糖，吃了 1/${n%3+2}，还剩几分之几？`, a: (n) => `${(n%3+2-1)}/${n%3+2}` }
        ]
      },
      '语文': {
        '阅读理解': [
          { q: () => '请用简洁的语言概括这段话的主要内容（不超过20字）', a: () => '（主观题，请家长批改）' },
          { q: () => '文中的"XX"一词表达了作者怎样的思想感情？', a: () => '（主观题，请家长批改）' },
          { q: () => '请用波浪线画出文中的比喻句，并说说这样写的好处', a: () => '（主观题，请家长批改）' }
        ],
        '默写': [
          { q: () => '请默写一首描写春天的古诗', a: () => '（请对照课本检查）' },
          { q: () => '请写出3个含有"月"字的成语', a: () => '示例：花好月圆、日积月累、披星戴月' }
        ]
      },
      '英语': {
        '词汇': [
          { q: () => 'Write the English word for "书包"', a: () => 'schoolbag' },
          { q: () => 'Complete: I ___ (be) a student.', a: () => 'am' },
          { q: () => 'What is the plural form of "child"?', a: () => 'children' },
          { q: () => 'Translate: 她每天早上7点起床。', a: () => 'She gets up at 7 o\'clock every morning.' }
        ]
      }
    };

    // 先找精确匹配topic
    if (all[subject] && all[subject][topic]) return all[subject][topic];

    // 模糊匹配
    if (all[subject]) {
      for (let key in all[subject]) {
        if (topic.includes(key) || key.includes(topic)) return all[subject][key];
      }
    }

    // 默认兜底
    if (all[subject]) return Object.values(all[subject])[0] || [{ q: () => `关于${topic}的练习题`, a: () => '（请家长批改）' }];
    return [{ q: () => `关于${topic}的练习题`, a: () => '（请家长批改）' }];
  }

  function generateFromTemplate(t, difficulty, seed) {
    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
    let a, b, c, d, n;

    if (difficulty === 'basic') {
      a = rand(1, 5); b = rand(2, 6); c = rand(1, 5); d = rand(2, 6);
      n = rand(10, 30);
    } else if (difficulty === 'hard') {
      a = rand(7, 15); b = rand(8, 20); c = rand(5, 12); d = rand(6, 18);
      n = rand(50, 100);
    } else {
      a = rand(3, 8); b = rand(4, 12); c = rand(2, 7); d = rand(3, 10);
      n = rand(20, 60);
    }

    let questionText, answerText;
    try {
      questionText = t.q(a, b, c, d, n);
      answerText = t.a(a, b, c, d, n);
    } catch (e) {
      questionText = t.q();
      answerText = t.a();
    }

    return { question: questionText, answer: answerText };
  }

  function gcd(a, b) {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) { [a, b] = [b, a % b]; }
    return a || 1;
  }

  // ==========================================
  //  页面7: 报告
  // ==========================================
  function renderReports() {
    const container = document.getElementById('reportsContent');
    const students = DataManager.getStudents().students;

    let html = '<div class="section-title">📊 学习报告</div>';

    // 报告类型选择
    html += '<div class="card"><div class="card-title">📋 生成报告</div>';
    html += '<div class="btn-group" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
    [
      { id: 'weekly', icon: '📅', label: '周报' },
      { id: 'monthly', icon: '📆', label: '月报' },
      { id: 'termly', icon: '📚', label: '学期报' },
      { id: 'yearly', icon: '🎓', label: '学年报' }
    ].forEach(r => {
      html += `<button class="btn btn-outline" onclick="window._generateReport('${r.id}')">${r.icon} ${r.label}</button>`;
    });
    html += '</div></div>';

    // 报告预览区
    html += '<div id="reportPreview"></div>';

    // 导出按钮
    html += `
    <div class="card" style="display:none" id="exportCard">
      <div class="card-title">💾 导出报告</div>
      <div class="btn-group">
        <button class="btn btn-outline" onclick="window._printReport()">🖨️ 打印</button>
      </div>
    </div>`;

    container.innerHTML = html;
  }

  window._generateReport = function(type) {
    const students = DataManager.getStudents().students;
    const preview = document.getElementById('reportPreview');
    const exportCard = document.getElementById('exportCard');

    const typeLabels = { weekly: '周报', monthly: '月报', termly: '学期报', yearly: '学年报' };
    const now = new Date();
    const dateStr = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';

    let html = `<div class="card" id="reportCard" style="border-top:4px solid var(--primary)">`;
    html += `<div style="text-align:center;margin-bottom:16px"><div style="font-size:20px;font-weight:700">${typeLabels[type]}学习报告</div><div style="font-size:12px;color:var(--text-secondary)">${dateStr}</div></div>`;

    students.forEach(s => {
      const stats = DataManager.getStudentStats(s.id);
      const errors = DataManager.getErrors(s.id);
      const weakpoints = DataManager.getWeakpoints(s.id);

      html += `<div style="margin-bottom:16px;padding:12px;background:${s.id === 'qiyuan' ? 'var(--qiyuan-light)' : 'var(--qipeng-light)'};border-radius:8px">`;
      html += `<div style="font-size:16px;font-weight:700;margin-bottom:8px">${s.emoji} ${s.name}（${s.grade}年级）</div>`;

      html += `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">`;
      s.subjects.forEach(subj => {
        const avg = stats.subjectAvgs[subj];
        const target = s.targets[subj];
        html += `
        <div style="text-align:center;padding:8px;background:#fff;border-radius:8px">
          <div style="font-size:12px;color:var(--text-secondary)">${subj}</div>
          <div style="font-size:20px;font-weight:700;color:${avg && avg >= target ? 'var(--success)' : 'var(--danger)'}">${avg || '--'}分</div>
          <div style="font-size:11px;color:var(--text-light)">目标${target}分</div>
        </div>`;
      });
      html += '</div>';

      // 关键数据
      html += `<div style="font-size:13px">📝 共${stats.totalExams}次测验 | ❌ ${stats.totalErrors}道待攻克错题 | ✅ ${stats.masteredErrors}道已掌握</div>`;

      // 建议
      const allWeak = [];
      ['语文', '数学', '英语'].forEach(subj => {
        (weakpoints.subjects[subj] || []).filter(w => w.severity === 'high').forEach(w => allWeak.push(w.topic));
      });

      if (allWeak.length > 0) {
        html += `<div class="alert alert-warning mt-8">⚠️ 建议重点关注：${allWeak.join('、')}</div>`;
      }

      html += '</div>';
    });

    html += '</div>';
    preview.innerHTML = html;
    exportCard.style.display = 'block';
    preview.scrollIntoView({ behavior: 'smooth' });
  };

  window._printReport = function() {
    window.print();
  };

  // ==========================================
  //  页面8: 家长共管
  // ==========================================
  function renderParents() {
    const container = document.getElementById('parentsContent');
    const parents = DataManager.getParents();

    let html = '<div class="section-title">👨‍👩‍👧 家长共管</div>';

    // 家长列表
    html += '<div class="card"><div class="card-title">👥 共管成员</div>';
    parents.parents.forEach(p => {
      html += `
      <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-light)">
        <div style="font-size:32px">${p.avatar}</div>
        <div style="flex:1">
          <div style="font-weight:600">${p.name}</div>
          <div style="font-size:12px;color:var(--text-secondary)">负责：${p.responsibilities.join('、')}</div>
        </div>
        <span class="tag tag-blue">管理员</span>
      </div>`;
    });
    html += '</div>';

    // 任务列表
    html += '<div class="card"><div class="card-header"><span class="card-title">📋 学习任务</span>';
    html += '<button class="btn btn-sm btn-primary" onclick="window._showAddTask()">+ 新建任务</button></div>';

    if (parents.tasks.length === 0) {
      html += '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-text">暂无任务，点击上方按钮创建</div></div>';
    } else {
      parents.tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).forEach(t => {
        const s = DataManager.getStudent(t.studentId);
        const statusLabels = { pending: '⏳ 待处理', in_progress: '🔄 进行中', completed: '✅ 已完成' };
        html += `
        <div class="list-item" style="cursor:default">
          <div class="list-item-icon" style="background:var(--primary-light);color:var(--primary)">📋</div>
          <div class="list-item-content">
            <div class="list-item-title">${t.title}</div>
            <div class="list-item-subtitle">${s ? s.name : ''} · ${t.subject} · 截止${t.dueDate} · 分配给${t.assignedTo}</div>
          </div>
          <div class="list-item-right">
            <select class="form-select" style="font-size:11px;padding:4px 8px;min-width:80px" onchange="window._updateTaskStatus('${t.id}','${t.studentId}',this.value)">
              <option value="pending" ${t.status === 'pending' ? 'selected' : ''}>⏳ 待处理</option>
              <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>🔄 进行中</option>
              <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>✅ 已完成</option>
            </select>
          </div>
        </div>`;
      });
    }
    html += '</div>';

    // 讨论区
    html += '<div class="card"><div class="card-header"><span class="card-title">💬 讨论区</span></div>';
    html += '<div id="discussionList">';
    if (parents.discussions.length === 0) {
      html += '<div class="empty-state"><div class="empty-icon">💬</div><div class="empty-text">开始讨论孩子的学习吧</div></div>';
    } else {
      parents.discussions.slice(-10).reverse().forEach(d => {
        html += `
        <div class="discussion-item">
          <div class="discussion-header">
            <span>${parents.parents.find(p => p.id === d.authorId)?.avatar || '👤'}</span>
            <span class="discussion-author">${d.authorName}</span>
            <span class="discussion-time">${d.time}</span>
          </div>
          <div class="discussion-body">${d.content}</div>
        </div>`;
      });
    }
    html += `</div>
      <div style="display:flex;gap:8px;margin-top:12px">
        <input class="form-input" id="discussionInput" placeholder="输入讨论内容..." style="flex:1">
        <button class="btn btn-primary btn-sm" onclick="window._sendDiscussion()">发送</button>
      </div>
    </div>`;

    // 通知中心
    if (parents.notifications.length > 0) {
      html += '<div class="card"><div class="card-title">🔔 通知</div>';
      parents.notifications.slice(-5).reverse().forEach(n => {
        html += `<div class="alert alert-info" style="margin-bottom:6px">${n.message}</div>`;
      });
      html += '</div>';
    }

    container.innerHTML = html;
  }

  window._showAddTask = function() {
    const students = DataManager.getStudents().students;
    const parents = DataManager.getParents();

    const html = `
    <div class="modal-overlay active" id="addTaskModal">
      <div class="modal">
        <div class="modal-header"><div class="modal-title">📋 新建任务</div><button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button></div>
        <div class="form-group"><label class="form-label">任务标题</label><input class="form-input" id="newTaskTitle" placeholder="如：齐芛本周数学分数练习"></div>
        <div class="form-group"><label class="form-label">孩子</label>
          <select class="form-select" id="newTaskStudent">${students.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">学科</label>
          <select class="form-select" id="newTaskSubject"><option>语文</option><option>数学</option><option>英语</option></select></div>
        <div class="form-group"><label class="form-label">分配给</label>
          <select class="form-select" id="newTaskAssignee">${parents.parents.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label">截止日期</label><input class="form-input" id="newTaskDue" type="date" value="${new Date(Date.now()+7*86400000).toISOString().split('T')[0]}"></div>
        <button class="btn btn-primary btn-block" onclick="window._addTask()">✅ 创建任务</button>
      </div>
    </div>`;

    document.getElementById('parentsContent').insertAdjacentHTML('beforeend', html);
  };

  window._addTask = function() {
    const title = document.getElementById('newTaskTitle').value;
    const studentId = document.getElementById('newTaskStudent').value;
    const subject = document.getElementById('newTaskSubject').value;
    const assignedTo = document.getElementById('newTaskAssignee').value;
    const dueDate = document.getElementById('newTaskDue').value;

    if (!title) { showToast('请输入任务标题', 'error'); return; }

    const parents = DataManager.getParents();
    parents.tasks.push({
      id: 'task_' + Date.now(),
      title, studentId, subject, assignedTo,
      status: 'pending',
      dueDate,
      createdAt: new Date().toISOString()
    });
    DataManager.saveParents(parents);
    document.getElementById('addTaskModal')?.remove();
    showToast('任务已创建！📋', 'success');
    renderParents();
  };

  window._updateTaskStatus = function(taskId, studentId, status) {
    const parents = DataManager.getParents();
    const task = parents.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = status;
      DataManager.saveParents(parents);
      showToast('任务状态已更新', 'success');
    }
  };

  window._sendDiscussion = function() {
    const input = document.getElementById('discussionInput');
    const content = input.value.trim();
    if (!content) return;

    const parents = DataManager.getParents();
    const author = parents.parents[0];
    parents.discussions.push({
      id: 'disc_' + Date.now(),
      authorId: author.id,
      authorName: author.name,
      content,
      time: new Date().toLocaleString('zh-CN')
    });
    DataManager.saveParents(parents);
    input.value = '';
    renderParents();
  };

  // ==========================================
  //  页面9: 对比分析
  // ==========================================
  function renderCompare() {
    const container = document.getElementById('compareContent');
    const students = DataManager.getStudents().students;

    let html = '<div class="section-title">⚖️ 两孩对比分析</div>';

    const stats1 = DataManager.getStudentStats('qiyuan');
    const stats2 = DataManager.getStudentStats('qipeng');
    const s1 = DataManager.getStudent('qiyuan');
    const s2 = DataManager.getStudent('qipeng');

    // 成绩对比图
    html += '<div class="card"><div class="card-title">📊 各科平均成绩对比</div>';
    html += '<div class="chart-container" style="height:250px"><canvas id="chartCompare"></canvas></div></div>';

    // 数据对比表
    html += `
    <div class="card"><div class="card-title">📋 综合数据对比</div>
    <div class="table-container">
    <table>
      <tr><th>指标</th><th style="color:var(--qiyuan-color)">${s1.emoji} ${s1.name}</th><th style="color:var(--qipeng-color)">${s2.emoji} ${s2.name}</th></tr>
      <tr><td>测验总数</td><td style="font-weight:700">${stats1.totalExams}</td><td style="font-weight:700">${stats2.totalExams}</td></tr>
      <tr><td>待攻克错题</td><td style="color:var(--danger);font-weight:700">${stats1.totalErrors}</td><td style="color:var(--danger);font-weight:700">${stats2.totalErrors}</td></tr>
      <tr><td>已掌握错题</td><td style="color:var(--success);font-weight:700">${stats1.masteredErrors}</td><td style="color:var(--success);font-weight:700">${stats2.masteredErrors}</td></tr>
      <tr><td>完成练习</td><td style="font-weight:700">${stats1.completedExercises}</td><td style="font-weight:700">${stats2.completedExercises}</td></tr>`;

    ['语文', '数学', '英语'].forEach(subj => {
      const avg1 = stats1.subjectAvgs[subj] || '--';
      const avg2 = stats2.subjectAvgs[subj] || '--';
      html += `<tr><td>${subj}平均分</td><td style="font-weight:700">${typeof avg1 === 'number' ? avg1 + '分' : avg1}</td><td style="font-weight:700">${typeof avg2 === 'number' ? avg2 + '分' : avg2}</td></tr>`;
    });

    html += '</table></div></div>';

    container.innerHTML = html;

    setTimeout(() => {
      ChartRenderer.renderComparison('chartCompare', stats1, stats2, s1.name, s2.name);
    }, 100);
  }

  // ===== 全局导航函数 =====
  window._navTo = function(page, params) {
    navigateTo(page, params);
  };

  window._switchSubject = function(subj) {
    currentSubject = subj;
    renderStudent(currentStudentId);
  };

  // ===== 事件绑定 =====
  function bindEvents() {
    // 底部导航
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', function() {
        const page = this.dataset.page;
        if (page === 'student') {
          navigateTo('student', currentStudentId || 'qiyuan');
        } else if (page === 'weakpoints') {
          navigateTo('weakpoints');
        } else if (page === 'compare') {
          navigateTo('compare');
        } else if (page === 'exercises') {
          navigateTo('exercises', currentStudentId || 'qiyuan');
        } else {
          navigateTo(page);
        }
      });
    });

    // 数据导出
    document.getElementById('btnExport').addEventListener('click', () => {
      DataManager.downloadBackup();
      showToast('数据备份已下载 💾', 'success');
    });

    // 云端同步
    document.getElementById('btnSync').addEventListener('click', () => {
      showToast('正在从云端同步数据... ☁️', 'info');
      DataManager.syncFromCloud(function(result) {
        showToast(result.message, result.success ? 'success' : 'error');
        if (result.updated) navigateTo('dashboard');
      });
    });

    // 数据导入
    document.getElementById('btnImport').addEventListener('click', () => {
      document.getElementById('importFileInput').click();
    });

    document.getElementById('importFileInput').addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function(ev) {
        const result = DataManager.importAllData(ev.target.result);
        showToast(result.message, result.success ? 'success' : 'error');
        if (result.success) navigateTo('dashboard');
      };
      reader.readAsText(file);
      this.value = '';
    });

    // Toast点击关闭
    document.getElementById('toastContainer').addEventListener('click', function(e) {
      if (e.target.classList.contains('toast')) e.target.remove();
    });

    // Modal点击外部关闭
    document.addEventListener('click', function(e) {
      if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
      }
    });
  }

  // ===== 初始化 =====
  function init() {
    DataManager.init();
    bindEvents();
    navigateTo('dashboard');

    // 自动从云端同步（仅在线时）
    DataManager.setToastFn(showToast);
    DataManager.syncFromCloud(function(result) {
      if (result.updated) {
        showToast('已同步最新数据 ☁️✅', 'success');
        navigateTo('dashboard');
      }
    });

    // 注册PWA安装事件
    window.addEventListener('beforeinstallprompt', (e) => {
      // 可以在合适时机触发安装提示
    });
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
