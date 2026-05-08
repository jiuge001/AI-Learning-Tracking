/**
 * OCR辅助模块 - 试卷拍照识别
 * 支持两种模式：OCR.space API自动识别 / 手动粘贴结构化结果
 */
window.OCRHelper = (function() {
  'use strict';

  // OCR.space 免费API（无需key，500次/天限制）
  var OCR_API = 'https://api.ocr.space/parse/image';

  /**
   * 通过OCR.space API识别图片中的文字
   * @param {string} base64Image - base64编码的图片
   * @param {function} callback - 回调(result)
   */
  function recognizeImage(base64Image, callback) {
    // 去掉data:image前缀
    var base64data = base64Image;
    if (base64data.indexOf('base64,') > -1) {
      base64data = base64data.split('base64,')[1];
    }

    var formData = new FormData();
    formData.append('base64Image', 'data:image/jpeg;base64,' + base64data);
    formData.append('language', 'chs'); // 简体中文
    formData.append('isOverlayRequired', 'false');
    formData.append('filetype', 'JPG');
    formData.append('OCREngine', '2'); // 更准确的引擎
    formData.append('scale', 'true');
    formData.append('detectOrientation', 'true');

    fetch(OCR_API, {
      method: 'POST',
      body: formData
    })
    .then(function(resp) { return resp.json(); })
    .then(function(data) {
      if (data.IsErroredOnProcessing) {
        callback({ success: false, error: data.ErrorMessage || 'OCR处理失败', text: '' });
        return;
      }
      var text = '';
      if (data.ParsedResults && data.ParsedResults.length > 0) {
        text = data.ParsedResults[0].ParsedText || '';
      }
      callback({ success: true, text: text, raw: data });
    })
    .catch(function(err) {
      callback({ success: false, error: '网络错误：' + err.message, text: '' });
    });
  }

  /**
   * 解析OCR文本为结构化题目数据
   * 支持多种常见试卷格式
   */
  function parseToQuestions(ocrText) {
    var questions = [];
    if (!ocrText || !ocrText.trim()) return questions;

    var lines = ocrText.split('\n').filter(function(l) { return l.trim(); });

    // 模式1: "题号. 题目内容" 或 "1、题目内容"
    var currentQ = null;
    lines.forEach(function(line) {
      var trimmed = line.trim();

      // 匹配题号模式
      var qMatch = trimmed.match(/^(\d+)[\.、．)）]\s*(.+)/);
      if (qMatch) {
        if (currentQ) questions.push(currentQ);
        currentQ = { questionNo: qMatch[1], questionText: qMatch[2].trim(), topic: '', errorType: '计算错误' };
        return;
      }

      // 匹配答案模式
      var aMatch = trimmed.match(/^[答案答][：:]\s*(.+)/);
      if (aMatch && currentQ) {
        currentQ.correctAnswer = aMatch[1].trim();
        return;
      }

      // 匹配知识点模式
      var kMatch = trimmed.match(/^[知识点考点][：:]\s*(.+)/);
      if (kMatch && currentQ) {
        currentQ.topic = kMatch[1].trim();
        return;
      }

      // 续行（题目内容跨行）
      if (currentQ && !currentQ.questionText.endsWith('？') && !currentQ.questionText.endsWith('?') && trimmed.length > 2) {
        currentQ.questionText += ' ' + trimmed;
      }
    });

    if (currentQ) questions.push(currentQ);

    // 如果没解析出题目，返回原始文本
    if (questions.length === 0) {
      questions.push({
        questionNo: '',
        questionText: ocrText.substring(0, 200),
        topic: '',
        errorType: '计算错误'
      });
    }

    // 尝试智能分类知识点
    questions.forEach(function(q) {
      if (!q.topic) {
        q.topic = guessTopic(q.questionText);
      }
      if (!q.wrongAnswer) q.wrongAnswer = '';
      if (!q.correctAnswer) q.correctAnswer = '';
    });

    return questions;
  }

  /**
   * 智能猜测知识点
   */
  function guessTopic(text) {
    if (!text) return '未分类';

    text = text.toLowerCase();

    // 数学关键词
    if (/[+\-×÷*/]/.test(text) || /计算|算式|等于|得数/.test(text)) {
      if (/分数|几分之|分母|分子/.test(text)) return '分数运算';
      if (/小数|\./.test(text)) return '小数运算';
      if (/乘|×/.test(text)) return '乘法运算';
      if (/除|÷/.test(text)) return '除法运算';
      if (/面积|周长|体积/.test(text)) return '几何计算';
      if (/方程/.test(text) || /[xX]=/.test(text)) return '方程';
      if (/应用|问题|多少|一共|还剩/.test(text)) return '应用题';
      return '数学计算';
    }

    // 语文关键词
    if (/阅读|理解|概括|主旨|中心思想|作者/.test(text)) return '阅读理解';
    if (/默写|古诗|诗词|背诵/.test(text)) return '古诗默写';
    if (/成语|词语|拼音|汉字|部首/.test(text)) return '字词基础';
    if (/作文|写作|描写|叙述/.test(text)) return '写作';
    if (/修辞|比喻|拟人|排比|夸张/.test(text)) return '修辞手法';
    if (/修改|病句|语病/.test(text)) return '病句修改';
    return '语文综合';

    // 英语关键词
    if (/english|[a-z]+/.test(text) && /translate|翻译|英译|汉译/.test(text)) return '翻译';
    if (/grammar|语法|tense|时态/.test(text)) return '语法';
    if (/spell|拼写|vocabulary|单词/.test(text)) return '词汇';
    if (/read|reading|passage/.test(text)) return '阅读理解';
    if (/fill|blank|complete/.test(text)) return '完形填空';
    if (/[a-z]+/.test(text)) return '英语综合';
    return '未分类';
  }

  /**
   * 压缩图片（减小上传体积）
   */
  function compressImage(base64, maxWidth, quality, callback) {
    var img = new Image();
    img.onload = function() {
      var canvas = document.createElement('canvas');
      var width = img.width;
      var height = img.height;

      if (width > maxWidth) {
        height = Math.round(height * maxWidth / width);
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      var compressed = canvas.toDataURL('image/jpeg', quality || 0.7);
      callback(compressed);
    };
    img.src = base64;
  }

  return {
    recognizeImage: recognizeImage,
    parseToQuestions: parseToQuestions,
    compressImage: compressImage
  };
})();
