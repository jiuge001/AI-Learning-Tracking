/**
 * 图表渲染引擎 - Chart.js封装
 * 学习跟踪系统可视化层
 */
const ChartRenderer = (() => {
  'use strict';

  const CHART_COLORS = {
    qiyuan: { main: '#4A90D9', light: 'rgba(74,144,217,0.2)' },
    qipeng: { main: '#52C41A', light: 'rgba(82,196,26,0.2)' },
    subjects: {
      '语文': '#FF6B6B',
      '数学': '#4A90D9',
      '英语': '#52C41A'
    }
  };

  let chartInstances = {};

  function destroyChart(canvasId) {
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
  }

  function destroyAll() {
    Object.keys(chartInstances).forEach(id => {
      chartInstances[id].destroy();
    });
    chartInstances = {};
  }

  // ===== 成绩趋势折线图 =====
  function renderScoreTrend(canvasId, exams, studentId) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const color = studentId === 'qiyuan' ? CHART_COLORS.qiyuan : CHART_COLORS.qipeng;
    const subjects = ['语文', '数学', '英语'];

    // 按日期排序
    const sorted = [...exams].sort((a, b) => a.date.localeCompare(b.date));

    const datasets = subjects.map(subj => {
      const subjExams = sorted.filter(e => e.subject === subj);
      const allDates = sorted.map(e => e.date);
      const data = allDates.map(date => {
        const exam = subjExams.find(e => e.date === date);
        return exam ? exam.actualScore : null;
      });
      return {
        label: subj,
        data,
        borderColor: CHART_COLORS.subjects[subj],
        backgroundColor: CHART_COLORS.subjects[subj] + '20',
        tension: 0.3,
        fill: false,
        spanGaps: true
      };
    });

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sorted.map(e => e.date),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, padding: 16, font: { size: 12 } }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20, font: { size: 11 } }
          },
          x: {
            ticks: { font: { size: 10 }, maxRotation: 45 }
          }
        }
      }
    });
  }

  // ===== 雷达图（知识点掌握度） =====
  function renderRadar(canvasId, weakpointsData, studentId) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const color = studentId === 'qiyuan' ? CHART_COLORS.qiyuan : CHART_COLORS.qipeng;
    const subjects = ['语文', '数学', '英语'];

    // 合并所有主题
    const allTopics = [];
    subjects.forEach(subj => {
      (weakpointsData.subjects[subj] || []).forEach(wp => {
        if (!allTopics.find(t => t.topic === wp.topic)) {
          allTopics.push(wp);
        }
      });
    });

    if (allTopics.length === 0) {
      canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-text">还没有薄弱点数据</div></div>';
      return;
    }

    const labels = allTopics.map(t => t.topic);
    const qiScore = allTopics.map(t => {
      const sev = { high: 30, medium: 60, low: 90 };
      return sev[t.severity] || 50;
    });

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'radar',
      data: {
        labels,
        datasets: [{
          label: '掌握度',
          data: qiScore,
          backgroundColor: color.light,
          borderColor: color.main,
          borderWidth: 2,
          pointBackgroundColor: color.main
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 0,
            max: 100,
            ticks: { display: false, stepSize: 20 }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // ===== 错题分布饼图 =====
  function renderErrorDist(canvasId, errors) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (errors.length === 0) return;

    // 按主题统计
    const topicMap = {};
    errors.forEach(e => {
      if (!topicMap[e.topic]) topicMap[e.topic] = 0;
      topicMap[e.topic] += e.frequency;
    });

    const labels = Object.keys(topicMap);
    const data = Object.values(topicMap);
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ];

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, labels.length),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, padding: 12, font: { size: 11 } }
          }
        }
      }
    });
  }

  // ===== 两孩对比柱状图 =====
  function renderComparison(canvasId, stats1, stats2, name1, name2) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const subjects = ['语文', '数学', '英语'];
    const labels = subjects;

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: name1,
            data: subjects.map(s => stats1.subjectAvgs[s] || 0),
            backgroundColor: CHART_COLORS.qiyuan.main + '80',
            borderColor: CHART_COLORS.qiyuan.main,
            borderWidth: 2,
            borderRadius: 6
          },
          {
            label: name2,
            data: subjects.map(s => stats2.subjectAvgs[s] || 0),
            backgroundColor: CHART_COLORS.qipeng.main + '80',
            borderColor: CHART_COLORS.qipeng.main,
            borderWidth: 2,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, padding: 16 }
          }
        },
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 20 }
          }
        }
      }
    });
  }

  // ===== 薄弱点历史趋势 =====
  function renderWeakpointHistory(canvasId, history) {
    destroyChart(canvasId);
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (!history || history.length === 0) return;

    const labels = history.map(h => h.date);
    const subjects = ['语文', '数学', '英语'];

    const datasets = subjects.map(subj => ({
      label: subj,
      data: history.map(h => h.bySubject ? h.bySubject[subj] || 0 : 0),
      borderColor: CHART_COLORS.subjects[subj],
      backgroundColor: CHART_COLORS.subjects[subj] + '20',
      tension: 0.3,
      fill: false
    }));

    chartInstances[canvasId] = new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { usePointStyle: true, font: { size: 11 } }
          }
        },
        scales: {
          y: {
            min: 0,
            ticks: { stepSize: 1, font: { size: 10 } }
          },
          x: {
            ticks: { font: { size: 9 }, maxRotation: 45 }
          }
        }
      }
    });
  }

  return {
    renderScoreTrend,
    renderRadar,
    renderErrorDist,
    renderComparison,
    renderWeakpointHistory,
    destroyAll,
    destroyChart
  };
})();
