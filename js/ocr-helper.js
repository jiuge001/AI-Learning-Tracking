/**
 * OCR辅助模块 - 腾讯云手写识别
 * 支持中文手写体、印刷体识别
 */
window.OCRHelper = (function() {
  'use strict';

  var SECRET_ID = 'AKIDwmSwCGdvDNVSDnBNVVJvLYYPbgZHoALQ';
  var SECRET_KEY = 'yjIdmiT2PZdWCvhNtENNBoFWdqxsQH5i';
  var ENDPOINT = 'ocr.tencentcloudapi.com';
  var SERVICE = 'ocr';
  var VERSION = '2018-11-19';
  var REGION = 'ap-guangzhou';

  function sha256Hex(msg) {
    var encoder = new TextEncoder();
    return crypto.subtle.digest('SHA-256', encoder.encode(msg)).then(function(hash) {
      return Array.from(new Uint8Array(hash)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  function hmacSha256(key, msg) {
    return crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function(k) { return crypto.subtle.sign('HMAC', k, typeof msg === 'string' ? new TextEncoder().encode(msg) : msg); })
      .then(function(sig) { return new Uint8Array(sig); });
  }

  function byteToHex(arr) {
    return Array.from(arr).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
  }

  function buildAuth(payload, timestamp) {
    var encoder = new TextEncoder();
    var date = new Date(timestamp * 1000).toISOString().split('T')[0];
    var service = SERVICE;
    var httpRequest = 'POST\n/\n\ncontent-type:application/json\nhost:' + ENDPOINT + '\n';
    var hashedRequest = httpRequest + '\ncontent-type;host\n' + '';
    var algorithm = 'TC3-HMAC-SHA256';

    return sha256Hex(payload).then(function(hashedPayload) {
      var stringToSign = algorithm + '\n' + timestamp + '\n' + date + '/' + service + '/tc3_request\n';
      var crService = date + '/' + service + '/tc3_request';
      var crBody = algorithm + '\n' + timestamp + '\n' + crService + '\n' + hashedRequest;

      return sha256Hex(crBody).then(function(hashedCanonicalRequest) {
        var ctPayload = algorithm + '\n' + timestamp + '\n' + crService + '\n' + hashedCanonicalRequest;
        return sha256Hex(ctPayload).then(function(hashedCtPayload) {
          return sha256Hex(hashedPayload).then(function(hashedPayloadHex) {
            stringToSign = algorithm + '\n' + timestamp + '\n' + crService + '\n' + hashedCtPayload;

            var kDate = encoder.encode('TC3' + SECRET_KEY);
            return hmacSha256(kDate, date).then(function(kDateSig) {
              return hmacSha256(kDateSig, service).then(function(kService) {
                return hmacSha256(kService, 'tc3_request').then(function(kSigning) {
                  return hmacSha256(kSigning, stringToSign).then(function(signature) {
                    var sigHex = byteToHex(signature);
                    var auth = algorithm + ' Credential=' + SECRET_ID + '/' + crService +
                      ', SignedHeaders=content-type;host, Signature=' + sigHex;
                    return auth;
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  /**
   * 腾讯云通用手写体识别
   */
  function recognizeImage(base64Image, callback) {
    var base64data = base64Image;
    if (base64data.indexOf('base64,') > -1) {
      base64data = base64data.split('base64,')[1];
    }

    var timestamp = Math.floor(Date.now() / 1000);
    var payload = JSON.stringify({
      ImageBase64: base64data,
      EnableDetectText: true
    });

    buildAuth(payload, timestamp).then(function(auth) {
      var headers = {
        'Content-Type': 'application/json',
        'Host': ENDPOINT,
        'X-TC-Action': 'GeneralHandwritingOCR',
        'X-TC-Version': VERSION,
        'X-TC-Timestamp': '' + timestamp,
        'X-TC-Region': REGION,
        'Authorization': auth
      };

      fetch('https://' + ENDPOINT, {
        method: 'POST',
        headers: headers,
        body: payload
      })
      .then(function(resp) { return resp.json(); })
      .then(function(data) {
        if (data.Response && data.Response.Error) {
          callback({ success: false, error: data.Response.Error.Message || '识别失败', text: '' });
          return;
        }

        var text = '';
        var items = data.Response && data.Response.TextDetections;
        if (items) {
          text = items.map(function(item) { return item.DetectedText || ''; }).join('\n');
        }

        if (!text || text.trim().length < 2) {
          callback({ success: false, error: '未检测到文字', text: '' });
          return;
        }

        callback({ success: true, text: text, raw: data });
      })
      .catch(function(err) {
        callback({ success: false, error: '网络错误：' + (err.message || ''), text: '' });
      });
    }).catch(function(err) {
      callback({ success: false, error: '签名错误：' + (err.message || ''), text: '' });
    });
  }

  /**
   * 解析OCR文本为结构化题目数据
   */
  function parseToQuestions(ocrText) {
    var questions = [];
    if (!ocrText || !ocrText.trim()) return questions;

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

      var aMatch = trimmed.match(/^[答案答][：:]\s*(.+)/);
      if (aMatch && currentQ) { currentQ.correctAnswer = aMatch[1].trim(); return; }

      var wrongMatch = trimmed.match(/^[错误][答案答][：:]\s*(.+)/);
      if (wrongMatch && currentQ) { currentQ.wrongAnswer = wrongMatch[1].trim(); return; }

      var kMatch = trimmed.match(/^[知识点考点][：:]\s*(.+)/);
      if (kMatch && currentQ) { currentQ.topic = kMatch[1].trim(); return; }

      if (currentQ && trimmed.length > 2) {
        currentQ.questionText += ' ' + trimmed;
      }
    });

    if (currentQ) questions.push(currentQ);

    if (questions.length === 0) {
      questions.push({
        questionNo: '',
        questionText: ocrText.substring(0, 200),
        topic: '',
        errorType: '计算错误'
      });
    }

    questions.forEach(function(q) {
      if (!q.topic) q.topic = guessTopic(q.questionText);
      if (!q.wrongAnswer) q.wrongAnswer = '';
      if (!q.correctAnswer) q.correctAnswer = '';
    });

    return questions;
  }

  function guessTopic(text) {
    if (!text) return '未分类';
    if (/[+\-×÷*＋－＋－]/.test(text) || /计算|算式|等于|得数/.test(text)) {
      if (/分数|几分之|分母|分子/.test(text)) return '分数运算';
      if (/小数|\./.test(text)) return '小数运算';
      if (/乘|×/.test(text)) return '乘法运算';
      if (/除|÷/.test(text)) return '除法运算';
      if (/面积|周长|体积/.test(text)) return '几何计算';
      if (/应用|问题|多少|一共|还剩/.test(text)) return '应用题';
      return '数学计算';
    }
    if (/阅读|理解|概括|主旨/.test(text)) return '阅读理解';
    if (/默写|古诗|诗词/.test(text)) return '古诗默写';
    if (/拼音|汉字|部首/.test(text)) return '字词基础';
    if (/修辞|比喻|拟人/.test(text)) return '修辞手法';
    if (/[a-z]+/i.test(text) && /translate|翻译/.test(text)) return '翻译';
    if (/grammar|语法|tense/.test(text)) return '语法';
    if (/spell|拼写|vocabulary/.test(text)) return '词汇';
    return '未分类';
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

  /**
   * 分析试卷元数据：学科、标题、类型、总分、得分
   */
  function analyzeExamMetadata(ocrText) {
    var meta = {
      subject: '',
      title: '',
      examType: '单元测试',
      totalScore: 100,
      actualScore: null
    };

    if (!ocrText) return meta;
    var text = ocrText;

    // 检测学科
    if (/数学|分数|小数|乘|除|加|减|方程|几何|面积|周长|计算|算式/.test(text)) {
      meta.subject = '数学';
    } else if (/语文|阅读|默写|古诗|作文|拼音|汉字|成语|修辞|课文/.test(text)) {
      meta.subject = '语文';
    } else if (/英语|English|vocabulary|grammar|spell|translate/.test(text)) {
      meta.subject = '英语';
    }

    // 检测标题（取前两行中较长的作为标题候选）
    var lines = text.split('\n').filter(function(l) { return l.trim(); });
    for (var i = 0; i < Math.min(5, lines.length); i++) {
      var line = lines[i].trim();
      // 匹配 "XXX测验"、"XXX考试"、"第X单元" 等
      if (/(第[一二三四五六七八九十\d]+[单元课章]|[期末中].*考试|.*测验|.*测试|.*练习)/.test(line)) {
        meta.title = line.substring(0, 30);
        break;
      }
    }
    if (!meta.title && lines.length > 0) {
      // 用第一行作为标题
      meta.title = lines[0].trim().substring(0, 30);
    }

    // 检测测验类型
    if (/期中/.test(text)) meta.examType = '期中考试';
    else if (/期末/.test(text)) meta.examType = '期末考试';
    else if (/模拟/.test(text)) meta.examType = '模拟考试';
    else if (/随堂|课堂/.test(text)) meta.examType = '随堂测验';
    else if (/单元/.test(text)) meta.examType = '单元测试';

    // 检测总分
    var totalMatch = text.match(/(?:总分|满分)[：:\s]*(\d{2,3})/);
    if (totalMatch) meta.totalScore = parseInt(totalMatch[1]);
    else {
      var score100 = text.match(/(\d{2,3})\s*分\s*(?:总分|满分|试卷)/);
      if (score100) meta.totalScore = parseInt(score100[1]);
    }

    // 检测实际得分
    var scoreMatches = text.match(/(?:得分|成绩|分数|实得)[：:\s]*(\d{1,3})/g);
    if (scoreMatches) {
      var lastMatch = scoreMatches[scoreMatches.length - 1];
      var scoreNum = lastMatch.match(/(\d+)/);
      if (scoreNum) meta.actualScore = parseInt(scoreNum[1]);
    }
    if (!meta.actualScore) {
      var redScore = text.match(/(\d{1,3})\s*(?:分|$)/m);
      if (redScore && parseInt(redScore[1]) <= meta.totalScore) {
        meta.actualScore = parseInt(redScore[1]);
      }
    }

    // 检测错题标记（✗、×、❌等标记后的内容可能是错误答案）
    var errorMark = text.match(/[✗×❌Xx]\s*([^\n]+)/g);
    if (errorMark) {
      meta.hasErrorMarks = true;
    }

    return meta;
  }

  return {
    recognizeImage: recognizeImage,
    parseToQuestions: parseToQuestions,
    compressImage: compressImage,
    analyzeExamMetadata: analyzeExamMetadata
  };
})();
