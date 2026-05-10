/**
 * OCR辅助模块 - 通义千问多模态识别
 * 发送试卷图片给千问qwen-vl-max，直接返回结构化数据
 */
window.OCRHelper = (function() {
  'use strict';

  var API_KEY = 'sk-9a5f8c41690e4ac5b04b44f73849fe52';
  var API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

  /**
   * 识别试卷——发送图片给千问，获取结构化结果
   */
  function recognizeImage(base64Image, callback) {
    var prompt = [
      '你是一个K12教育助手。请仔细分析这张试卷图片，提取以下信息并以JSON格式返回。',
      '注意：这是小学生的试卷，可能有手写批改痕迹。请识别试卷上所有可见文字，包括印刷和手写内容。',
      '',
      '返回格式（必须严格按此JSON）：',
      '{',
      '  "subject": "数学/语文/英语",',
      '  "title": "测验标题，如第五单元分数运算测验",',
      '  "examType": "单元测试/期中考试/期末考试/随堂测验",',
      '  "totalScore": 总分数字,',
      '  "actualScore": 实际得分数字,',
      '  "errors": [',
      '    {',
      '      "questionNo": "题号",',
      '      "questionText": "题目内容",',
      '      "wrongAnswer": "学生的错误答案（试卷上×或圈出的部分）",',
      '      "correctAnswer": "正确答案",',
      '      "topic": "知识点，如分数加减法",',
      '      "errorType": "错误类型：计算错误/概念不清/审题失误/方法错误/粗心大意",',
      '      "analysis": "错误原因分析（一句话）",',
      '      "suggestion": "学习建议（一句话）"',
      '    }',
      '  ]',
      '}',
      '',
      '如果没有看到错题，errors数组为空。',
      '只返回JSON，不要任何其他文字。'
    ].join('\n');

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        model: 'qwen-vl-max',
        messages: [
          { role: 'system', content: '你是一个专业的K12教育助手，擅长分析小学生试卷。只返回JSON，不要解释。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: base64Image } }
            ]
          }
        ],
        max_tokens: 2000,
        temperature: 0.1
      })
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      if (data.error) {
        callback({ success: false, error: data.error.message || 'API错误', text: '' });
        return;
      }

      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) {
        callback({ success: false, error: '未获取到识别结果', text: '' });
        return;
      }

      // 尝试提取JSON（可能被markdown包裹）
      var jsonStr = content;
      var jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1].trim();
      else {
        var braceStart = content.indexOf('{');
        var braceEnd = content.lastIndexOf('}');
        if (braceStart >= 0 && braceEnd > braceStart) {
          jsonStr = content.substring(braceStart, braceEnd + 1);
        }
      }

      try {
        var result = JSON.parse(jsonStr);
        callback({ success: true, text: content, structured: result });
      } catch(e) {
        // JSON解析失败，把原文当文本返回
        callback({ success: true, text: content, raw_text: true });
      }
    })
    .catch(function(err) {
      callback({ success: false, error: '网络错误：' + (err.message || ''), text: '' });
    });
  }

  /**
   * AI生成检测卷——根据知识点和参数生成完整试卷
   */
  function generateTestPaper(params, callback) {
    var subject = params.subject || '数学';
    var grade = params.grade || 3;
    var topics = params.topics || [];
    var questionCount = params.questionCount || 10;
    var difficulty = params.difficulty || 'medium';
    var totalScore = params.totalScore || 100;
    var timeMinutes = params.timeMinutes || 45;

    var subjNames = { '数学': '数学', '语文': '语文', '英语': '英语' };
    var diffNames = { basic: '基础', medium: '中等', hard: '较难' };
    var gradeNames = { 1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级' };

    var prompt = [
      '你是K12教育出卷专家。请为' + gradeNames[grade] + '学生生成一份' + subjNames[subject] + '检测卷。',
      '',
      '要求：',
      '- 试卷标题自拟',
      '- 覆盖知识点：' + (topics.length > 0 ? topics.join('、') : subject + '综合'),
      '- 共 ' + questionCount + ' 道题，总分 ' + totalScore + ' 分，时间 ' + timeMinutes + ' 分钟',
      '- 难度：' + diffNames[difficulty] + '（基础40%/中等40%/拔高20%）',
      '- 题目应贴近生活、有趣味性',
      '- 题目分2-3个部分：基础巩固、能力提升（可选拓展挑战）',
      '',
      '返回JSON格式（严格按此格式，只返回JSON）：',
      '{',
      '  "title": "试卷标题",',
      '  "sections": [',
      '    { "name": "一、基础巩固", "questions": [',
      '      {"question": "题目内容", "answer": "答案及简要步骤", "points": 5}',
      '    ]}',
      '  ],',
      '  "totalPoints": ' + totalScore + ',',
      '  "time": ' + timeMinutes,
      '}',
      '',
      '注意：',
      '- 题目必须适合' + gradeNames[grade] + '学生的认知水平',
      '- 语文题可包含阅读理解、默写、造句等题型',
      '- 数学题包含计算、应用、思维等题型',
      '- 英语题包含词汇、语法、阅读等题型',
      '- 每题必须提供正确答案',
      '- 只返回JSON，不要任何解释'
    ].join('\n');

    fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + API_KEY
      },
      body: JSON.stringify({
        model: 'qwen-plus',
        messages: [
          { role: 'system', content: '你是K12教育出卷专家，只返回JSON，不解释。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 3000,
        temperature: 0.3
      })
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      if (data.error) {
        callback({ success: false, error: data.error.message || 'API错误' });
        return;
      }
      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      if (!content) {
        callback({ success: false, error: '未获取到试题' });
        return;
      }
      // 提取JSON
      var jsonStr = content;
      var m = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (m) jsonStr = m[1].trim();
      else {
        var s = content.indexOf('{'), e = content.lastIndexOf('}');
        if (s >= 0 && e > s) jsonStr = content.substring(s, e + 1);
      }
      try {
        var paper = JSON.parse(jsonStr);
        callback({ success: true, paper: paper });
      } catch(err) {
        callback({ success: false, error: 'AI返回格式异常，请重试' });
      }
    })
    .catch(function(err) {
      callback({ success: false, error: '网络错误：' + (err.message || '') });
    });
  }

  /**
   * 解析为题目数组（兼容旧接口）
   */
  function parseToQuestions(ocrText) {
    var questions = [];
    if (!ocrText) return questions;
    var lines = ocrText.split('\n').filter(function(l) { return l.trim(); });
    var currentQ = null;

    lines.forEach(function(line) {
      var trimmed = line.trim();
      var qMatch = trimmed.match(/^(\d+)[\.、．)）]\s*(.+)/);
      if (qMatch) {
        if (currentQ) questions.push(currentQ);
        currentQ = { questionNo: qMatch[1], questionText: qMatch[2].trim(), topic: '', errorType: '计算错误' };
        return;
      }
      if (currentQ && trimmed.length > 2) {
        currentQ.questionText += ' ' + trimmed;
      }
    });
    if (currentQ) questions.push(currentQ);
    return questions;
  }

  function compressImage(base64, maxWidth, quality, callback) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var width = img.width, height = img.height;
      if (width > maxWidth) { height = Math.round(height * maxWidth / width); width = maxWidth; }
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', quality || 0.7));
    };
    img.src = base64;
  }

  function analyzeExamMetadata(ocrText) {
    return { subject: '', title: '', examType: '单元测试', totalScore: 100, actualScore: null };
  }

  return {
    recognizeImage: recognizeImage,
    generateTestPaper: generateTestPaper,
    parseToQuestions: parseToQuestions,
    compressImage: compressImage,
    analyzeExamMetadata: analyzeExamMetadata
  };
})();
