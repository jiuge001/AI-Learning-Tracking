/**
 * 数据管理引擎 - localStorage持久化 + JSON导入导出
 * 学习跟踪系统核心数据层
 */
const DataManager = (() => {
  'use strict';

  const STORAGE_PREFIX = 'lt_';

  // 默认数据结构
  const DEFAULTS = {
    students: {
      students: [
        {
          id: 'qiyuan', name: '齐芛', grade: 5,
          subjects: ['语文', '数学', '英语'],
          targets: { '语文': 95, '数学': 98, '英语': 95 },
          color: '#4A90D9', emoji: '🌿',
          semester: '2026春季', createdAt: '2026-05-08'
        },
        {
          id: 'qipeng', name: '齐芃', grade: 3,
          subjects: ['语文', '数学', '英语'],
          targets: { '语文': 95, '数学': 98, '英语': 95 },
          color: '#52C41A', emoji: '🌱',
          semester: '2026春季', createdAt: '2026-05-08'
        }
      ]
    },
    parents: {
      parents: [
        { id: 'dad', name: '爸爸', role: 'admin', responsibilities: ['数学'], avatar: '👨', joinedAt: '2026-05-08' },
        { id: 'mom', name: '妈妈', role: 'admin', responsibilities: ['语文', '英语'], avatar: '👩', joinedAt: '2026-05-08' }
      ],
      tasks: [],
      discussions: [],
      notifications: [],
      plans: []
    },
    exams: (id) => [],
    errors: (id) => [],
    weakpoints: (id) => ({ subjects: { '语文': [], '数学': [], '英语': [] }, history: [] }),
    exercises: (id) => [],
    progress: (id) => ({ checkpoints: [] }),
    profile: (id) => ({
      id,
      name: id === 'qiyuan' ? '齐芛' : '齐芃',
      grade: id === 'qiyuan' ? 5 : 3,
      subjects: {
        '语文': { target: 95, currentAvg: null, weakPoints: [], strengthPoints: [] },
        '数学': { target: 98, currentAvg: null, weakPoints: [], strengthPoints: [] },
        '英语': { target: 95, currentAvg: null, weakPoints: [], strengthPoints: [] }
      },
      milestones: [],
      notes: ''
    })
  };

  function _key(namespace, id) {
    return STORAGE_PREFIX + namespace + (id ? '_' + id : '');
  }

  // ===== 读取 =====
  function getStudents() {
    const raw = localStorage.getItem(_key('students'));
    return raw ? JSON.parse(raw) : DEFAULTS.students;
  }

  function getStudent(id) {
    const all = getStudents();
    return all.students.find(s => s.id === id) || null;
  }

  function getProfile(id) {
    const raw = localStorage.getItem(_key('profile', id));
    return raw ? JSON.parse(raw) : DEFAULTS.profile(id);
  }

  function getExams(id) {
    const raw = localStorage.getItem(_key('exams', id));
    return raw ? JSON.parse(raw) : DEFAULTS.exams(id);
  }

  function getErrors(id) {
    const raw = localStorage.getItem(_key('errors', id));
    return raw ? JSON.parse(raw) : DEFAULTS.errors(id);
  }

  function getWeakpoints(id) {
    const raw = localStorage.getItem(_key('weakpoints', id));
    return raw ? JSON.parse(raw) : DEFAULTS.weakpoints(id);
  }

  function getExercises(id) {
    const raw = localStorage.getItem(_key('exercises', id));
    return raw ? JSON.parse(raw) : DEFAULTS.exercises(id);
  }

  function getProgress(id) {
    const raw = localStorage.getItem(_key('progress', id));
    return raw ? JSON.parse(raw) : DEFAULTS.progress(id);
  }

  function getParents() {
    const raw = localStorage.getItem(_key('parents'));
    return raw ? JSON.parse(raw) : DEFAULTS.parents;
  }

  // ===== 写入 =====
  function saveStudents(data) {
    localStorage.setItem(_key('students'), JSON.stringify(data));
  }

  function saveStudent(student) {
    const all = getStudents();
    const idx = all.students.findIndex(s => s.id === student.id);
    if (idx >= 0) all.students[idx] = student;
    else all.students.push(student);
    saveStudents(all);
  }

  function saveProfile(id, data) {
    localStorage.setItem(_key('profile', id), JSON.stringify(data));
  }

  function saveExams(id, data) {
    localStorage.setItem(_key('exams', id), JSON.stringify(data));
  }

  function addExam(id, exam) {
    const exams = getExams(id);
    exam.id = exam.id || ('exam_' + Date.now());
    exam.createdAt = exam.createdAt || new Date().toISOString();
    exam.studentId = id;
    exams.push(exam);
    saveExams(id, exams);
    // 自动处理错题
    _processErrorsFromExam(id, exam);
    // 更新薄弱点
    updateWeakpointsFromExams(id);
    return exam;
  }

  function saveErrors(id, data) {
    localStorage.setItem(_key('errors', id), JSON.stringify(data));
  }

  function saveWeakpoints(id, data) {
    localStorage.setItem(_key('weakpoints', id), JSON.stringify(data));
  }

  function saveExercises(id, data) {
    localStorage.setItem(_key('exercises', id), JSON.stringify(data));
  }

  function saveProgress(id, data) {
    localStorage.setItem(_key('progress', id), JSON.stringify(data));
  }

  function saveParents(data) {
    localStorage.setItem(_key('parents'), JSON.stringify(data));
  }

  // ===== 错题处理 =====
  function _processErrorsFromExam(id, exam) {
    if (!exam.errors || exam.errors.length === 0) return;
    const errors = getErrors(id);
    exam.errors.forEach(err => {
      const existing = errors.find(e =>
        e.topic === err.topic && e.subTopic === err.subTopic
      );
      if (existing) {
        existing.occurrences.push({ date: exam.date, examId: exam.id });
        existing.frequency = existing.occurrences.length;
        existing.updatedAt = new Date().toISOString();
        if (!existing.errorTypes.includes(err.errorType)) {
          existing.errorTypes.push(err.errorType);
        }
      } else {
        errors.push({
          id: 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          studentId: id,
          subject: exam.subject,
          topic: err.topic,
          subTopic: err.subTopic || err.topic,
          questionText: err.questionText || '',
          wrongAnswer: err.wrongAnswer || '',
          correctAnswer: err.correctAnswer || '',
          errorTypes: [err.errorType || '其他'],
          occurrences: [{ date: exam.date, examId: exam.id }],
          frequency: 1,
          mastered: false,
          masteryScore: 0,
          relatedExercises: [],
          tags: [err.topic, exam.subject],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    });
    saveErrors(id, errors);
  }

  // ===== 薄弱点更新 =====
  function updateWeakpointsFromExams(id) {
    const errors = getErrors(id);
    const exams = getExams(id);
    const weakpoints = getWeakpoints(id);
    const subjects = ['语文', '数学', '英语'];

    subjects.forEach(subj => {
      const subjErrors = errors.filter(e => e.subject === subj && !e.mastered);
      const topicMap = {};
      subjErrors.forEach(e => {
        if (!topicMap[e.topic]) topicMap[e.topic] = { topic: e.topic, count: 0, lastSeen: '' };
        topicMap[e.topic].count += e.frequency;
        if (e.updatedAt > topicMap[e.topic].lastSeen) topicMap[e.topic].lastSeen = e.updatedAt;
      });

      const subjExams = exams.filter(e => e.subject === subj);
      weakpoints.subjects[subj] = Object.values(topicMap).map(t => ({
        ...t,
        severity: t.count >= 3 ? 'high' : t.count >= 2 ? 'medium' : 'low',
        recentTrend: _calcTrend(subjExams, t.topic)
      }));
    });

    // 更新历史
    const today = new Date().toISOString().split('T')[0];
    if (!weakpoints.history.find(h => h.date === today)) {
      weakpoints.history.push({
        date: today,
        totalErrors: errors.filter(e => !e.mastered).length,
        bySubject: {
          '语文': errors.filter(e => e.subject === '语文' && !e.mastered).length,
          '数学': errors.filter(e => e.subject === '数学' && !e.mastered).length,
          '英语': errors.filter(e => e.subject === '英语' && !e.mastered).length
        }
      });
      // 只保留90天
      if (weakpoints.history.length > 90) weakpoints.history.shift();
    }
    saveWeakpoints(id, weakpoints);
  }

  function _calcTrend(exams, topic) {
    if (exams.length < 2) return 'flat';
    const recent = exams.slice(-3);
    const topicErrors = recent.filter(e =>
      e.errors && e.errors.some(err => err.topic === topic)
    );
    if (topicErrors.length === 0 && recent.length >= 2) return 'up';
    if (topicErrors.length >= 2) return 'down';
    return 'flat';
  }

  // ===== 统计计算 =====
  function getStudentStats(id) {
    const exams = getExams(id);
    const errors = getErrors(id);
    const exercises = getExercises(id);
    const student = getStudent(id);

    const subjectAvgs = {};
    const subjectTrends = {};
    ['语文', '数学', '英语'].forEach(s => {
      const subjExams = exams.filter(e => e.subject === s);
      if (subjExams.length > 0) {
        subjectAvgs[s] = Math.round(subjExams.reduce((a, e) => a + e.actualScore, 0) / subjExams.length);
        // 趋势：比较最近两次
        if (subjExams.length >= 2) {
          const last2 = subjExams.slice(-2);
          const diff = last2[1].actualScore - last2[0].actualScore;
          subjectTrends[s] = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
        }
      }
    });

    return {
      totalExams: exams.length,
      totalErrors: errors.filter(e => !e.mastered).length,
      masteredErrors: errors.filter(e => e.mastered).length,
      totalExercises: exercises.length,
      completedExercises: exercises.filter(e => e.completed).length,
      subjectAvgs,
      subjectTrends,
      lastExamDate: exams.length > 0 ? exams[exams.length - 1].date : null
    };
  }

  // ===== 导出/导入 =====
  function exportAllData() {
    const data = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      students: getStudents(),
      parents: getParents(),
      qiyuan: {
        profile: getProfile('qiyuan'),
        exams: getExams('qiyuan'),
        errors: getErrors('qiyuan'),
        weakpoints: getWeakpoints('qiyuan'),
        exercises: getExercises('qiyuan'),
        progress: getProgress('qiyuan')
      },
      qipeng: {
        profile: getProfile('qipeng'),
        exams: getExams('qipeng'),
        errors: getErrors('qipeng'),
        weakpoints: getWeakpoints('qipeng'),
        exercises: getExercises('qipeng'),
        progress: getProgress('qipeng')
      }
    };
    return JSON.stringify(data, null, 2);
  }

  function importAllData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.version) throw new Error('无效的数据格式');

      if (data.students) saveStudents(data.students);
      if (data.parents) saveParents(data.parents);
      ['qiyuan', 'qipeng'].forEach(id => {
        if (data[id]) {
          const d = data[id];
          if (d.profile) saveProfile(id, d.profile);
          if (d.exams) saveExams(id, d.exams);
          if (d.errors) saveErrors(id, d.errors);
          if (d.weakpoints) saveWeakpoints(id, d.weakpoints);
          if (d.exercises) saveExercises(id, d.exercises);
          if (d.progress) saveProgress(id, d.progress);
        }
      });
      return { success: true, message: '数据导入成功！' };
    } catch (e) {
      return { success: false, message: '数据导入失败：' + e.message };
    }
  }

  function downloadBackup() {
    const json = exportAllData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '学习跟踪备份_' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ===== 云端同步 =====
  var CLOUD_URL = null; // 动态计算

  function _getCloudUrl() {
    if (CLOUD_URL) return CLOUD_URL;
    // 自动从当前页面URL推导
    var loc = window.location;
    if (loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.protocol === 'file:') {
      return null; // 本地模式不同步
    }
    CLOUD_URL = loc.protocol + '//' + loc.host + loc.pathname.replace(/\/[^\/]*$/, '') + '/data/shared-backup.json';
    return CLOUD_URL;
  }

  function syncFromCloud(callback) {
    var url = _getCloudUrl();

    // 检查是否在线且有云端URL
    if (!navigator.onLine) {
      if (callback) callback({ success: false, message: '离线状态，无法同步' });
      return;
    }
    if (!url) {
      if (callback) callback({ success: false, message: '本地模式，云端同步不可用' });
      return;
    }

    fetch(url + '?t=' + Date.now())
      .then(function(resp) {
        if (!resp.ok) throw new Error('云端暂无数据');
        return resp.json();
      })
      .then(function(cloudData) {
        if (!cloudData.version || !cloudData.exportedAt) throw new Error('数据格式无效');

        // 检查云端数据是否比本地新
        var lastSync = localStorage.getItem(_key('lastSync'));
        if (lastSync && lastSync >= cloudData.exportedAt) {
          if (callback) callback({ success: true, message: '已是最新数据，无需同步', updated: false });
          return;
        }

        // 导入云端数据
        var result = importAllData(JSON.stringify(cloudData));
        if (result.success) {
          localStorage.setItem(_key('lastSync'), cloudData.exportedAt);
        }
        if (callback) callback({ success: result.success, message: result.message, updated: result.success });
      })
      .catch(function(err) {
        if (callback) callback({ success: false, message: '同步失败：' + err.message });
      });
  }

  function getSyncStatus() {
    var lastSync = localStorage.getItem(_key('lastSync'));
    return lastSync || null;
  }

  // 复制数据到剪贴板（用于分享）
  function copyDataToClipboard() {
    var json = exportAllData();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json).then(function() {
        showToastMsg('数据已复制，可粘贴到微信分享', 'success');
      }).catch(function() {
        downloadBackup();
        showToastMsg('已下载备份文件', 'info');
      });
    } else {
      downloadBackup();
      showToastMsg('已下载备份文件', 'info');
    }
  }

  var showToastMsg = null;
  function setToastFn(fn) { showToastMsg = fn; }

  // ===== 初始化 =====
  function init() {
    var isNew = false;
    // 如果localStorage为空，从种子数据初始化
    if (!localStorage.getItem(_key('students'))) {
      saveStudents(DEFAULTS.students);
      isNew = true;
    }
    if (!localStorage.getItem(_key('parents'))) {
      saveParents(DEFAULTS.parents);
    }
    ['qiyuan', 'qipeng'].forEach(id => {
      if (!localStorage.getItem(_key('exams', id))) { saveExams(id, []); isNew = true; }
      if (!localStorage.getItem(_key('errors', id))) saveErrors(id, []);
      if (!localStorage.getItem(_key('weakpoints', id))) saveWeakpoints(id, DEFAULTS.weakpoints(id));
      if (!localStorage.getItem(_key('exercises', id))) saveExercises(id, []);
      if (!localStorage.getItem(_key('progress', id))) saveProgress(id, { checkpoints: [] });
      if (!localStorage.getItem(_key('profile', id))) saveProfile(id, DEFAULTS.profile(id));
    });

    // 首次使用或数据为空：注入示例数据
    var qiyuanExams = getExams('qiyuan');
    var qipengExams = getExams('qipeng');
    if (isNew || (qiyuanExams.length === 0 && qipengExams.length === 0)) {
      // 清除旧key重新来（避免之前打开过页面导致空数组）
      localStorage.removeItem(_key('exams', 'qiyuan'));
      localStorage.removeItem(_key('exams', 'qipeng'));
      localStorage.removeItem(_key('errors', 'qiyuan'));
      localStorage.removeItem(_key('errors', 'qipeng'));
      localStorage.removeItem(_key('weakpoints', 'qiyuan'));
      localStorage.removeItem(_key('weakpoints', 'qipeng'));
      seedSampleData();
    }
  }

  function seedSampleData() {
    // === 齐芛（五年级）示例数据 ===
    addExam('qiyuan', {
      id: 'demo_exam_1',
      subject: '数学', title: '第五单元 分数运算测验', examType: '单元测试',
      date: '2026-04-20', totalScore: 100, actualScore: 85,
      errors: [
        { questionNo: '3', questionText: '计算 3/4 + 1/6 = ?', topic: '分数加减法', subTopic: '异分母通分', errorType: '计算错误', wrongAnswer: '5/12', correctAnswer: '11/12', analysis: '通分后分子加算错误', difficulty: '中等' },
        { questionNo: '7', questionText: '小明喝了1/3瓶水，又喝了1/4瓶，一共喝了几分之几？', topic: '分数应用题', subTopic: '分数加减应用', errorType: '审题失误', wrongAnswer: '1/6', correctAnswer: '7/12', analysis: '误将加法当减法', difficulty: '中等' }
      ],
      images: [], reviewedBy: '爸爸'
    });
    addExam('qiyuan', {
      id: 'demo_exam_2',
      subject: '数学', title: '第四单元 小数乘除法', examType: '单元测试',
      date: '2026-04-05', totalScore: 100, actualScore: 92,
      errors: [
        { questionNo: '5', questionText: '3.14 × 0.25 = ?', topic: '小数乘法', subTopic: '小数点定位', errorType: '计算错误', wrongAnswer: '7.85', correctAnswer: '0.785', analysis: '小数点位数计算错误', difficulty: '基础' }
      ],
      images: [], reviewedBy: '妈妈'
    });
    addExam('qiyuan', {
      id: 'demo_exam_3',
      subject: '语文', title: '第三单元测验', examType: '单元测试',
      date: '2026-04-15', totalScore: 100, actualScore: 91,
      errors: [
        { questionNo: '2', questionText: '阅读理解《秋天的怀念》', topic: '阅读理解', subTopic: '主旨概括', errorType: '概念不清', wrongAnswer: '写秋天的景色', correctAnswer: '表达对母亲的怀念', analysis: '未能理解文章深层含义', difficulty: '中等' },
        { questionNo: '8', questionText: '仿写比喻句', topic: '修辞手法', subTopic: '比喻', errorType: '方法错误', wrongAnswer: '—', correctAnswer: '—', analysis: '本体和喻体搭配不当', difficulty: '基础' }
      ],
      images: [], reviewedBy: '妈妈'
    });
    addExam('qiyuan', {
      id: 'demo_exam_4',
      subject: '英语', title: 'Module 3 单元测验', examType: '单元测试',
      date: '2026-04-10', totalScore: 100, actualScore: 88,
      errors: [
        { questionNo: '4', questionText: 'What ___ your father do?', topic: '一般现在时', subTopic: '助动词', errorType: '方法错误', wrongAnswer: 'is', correctAnswer: 'does', analysis: '混淆be动词与助动词', difficulty: '基础' },
        { questionNo: '6', questionText: '写出"图书馆"的英文', topic: '词汇拼写', subTopic: '场所词汇', errorType: '粗心大意', wrongAnswer: 'libary', correctAnswer: 'library', analysis: '漏写字母r', difficulty: '基础' }
      ],
      images: [], reviewedBy: '妈妈'
    });

    // === 齐芃（三年级）示例数据 ===
    addExam('qipeng', {
      id: 'demo_exam_5',
      subject: '数学', title: '第四单元 两位数乘法', examType: '单元测试',
      date: '2026-04-18', totalScore: 100, actualScore: 80,
      errors: [
        { questionNo: '3', questionText: '23 × 15 = ?', topic: '两位数乘法', subTopic: '进位', errorType: '计算错误', wrongAnswer: '315', correctAnswer: '345', analysis: '进位加算遗漏', difficulty: '中等' },
        { questionNo: '6', questionText: '48 × 32 = ?', topic: '两位数乘法', subTopic: '竖式计算', errorType: '方法错误', wrongAnswer: '1436', correctAnswer: '1536', analysis: '数位对齐错误', difficulty: '中等' }
      ],
      images: [], reviewedBy: '爸爸'
    });
    addExam('qipeng', {
      id: 'demo_exam_6',
      subject: '语文', title: '古诗默写与阅读理解', examType: '随堂测验',
      date: '2026-04-22', totalScore: 100, actualScore: 90,
      errors: [
        { questionNo: '1', questionText: '默写《绝句》', topic: '古诗默写', subTopic: '杜甫绝句', errorType: '粗心大意', wrongAnswer: '迟日江山丽', correctAnswer: '迟日江山丽，春风花草香', analysis: '漏写后半句', difficulty: '基础' }
      ],
      images: [], reviewedBy: '妈妈'
    });
    addExam('qipeng', {
      id: 'demo_exam_7',
      subject: '英语', title: 'Unit 4 词汇测验', examType: '随堂测验',
      date: '2026-04-25', totalScore: 100, actualScore: 95,
      errors: [
        { questionNo: '5', questionText: 'What color is the sky?', topic: '颜色词汇', subTopic: '问答句型', errorType: '粗心大意', wrongAnswer: 'It blue', correctAnswer: 'It is blue', analysis: '漏写be动词', difficulty: '基础' }
      ],
      images: [], reviewedBy: '爸爸'
    });

    // 标记齐芛一道错题为已掌握
    var qiyuanErrors = getErrors('qiyuan');
    if (qiyuanErrors.length > 0) {
      qiyuanErrors[0].mastered = true;
      qiyuanErrors[0].masteryScore = 80;
      saveErrors('qiyuan', qiyuanErrors);
    }

    // 更新薄弱点
    updateWeakpointsFromExams('qiyuan');
    updateWeakpointsFromExams('qipeng');
  }

  // 公开API
  return {
    init,
    getStudents, getStudent, saveStudent,
    getProfile, saveProfile,
    getExams, addExam, saveExams,
    getErrors, saveErrors,
    getWeakpoints, saveWeakpoints, updateWeakpointsFromExams,
    getExercises, saveExercises,
    getProgress, saveProgress,
    getParents, saveParents,
    getStudentStats,
    exportAllData, importAllData, downloadBackup,
    syncFromCloud, getSyncStatus, copyDataToClipboard, setToastFn
  };
})();
