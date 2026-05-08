/**
 * 自动批改引擎 - 错题详解生成
 * 数学题：自动计算+比对 / 语文英语：关键点分析
 */
window.Grader = (function() {
  'use strict';

  /**
   * 自动批改一组题目
   * @param {Array} questions - [{questionText, wrongAnswer, topic, subject}]
   * @param {string} subject - 学科
   * @param {string} grade - 年级 (3或5)
   * @returns {Array} 增强后的题目，含correctAnswer、analysis、errorType、suggestion
   */
  function autoGrade(questions, subject, grade) {
    return questions.map(function(q) {
      // 数学题：自动计算正确答案
      if (subject === '数学') {
        return gradeMathQuestion(q, grade);
      }
      // 语文题：关键词分析
      if (subject === '语文') {
        return analyzeChineseQuestion(q, grade);
      }
      // 英语题：语法拼写分析
      if (subject === '英语') {
        return analyzeEnglishQuestion(q, grade);
      }
      return q;
    });
  }

  // ===== 数学批改 =====
  function gradeMathQuestion(q, grade) {
    var text = (q.questionText || '').trim();
    var wrongAns = (q.wrongAnswer || '').trim();
    var correctAns = '';
    var analysis = '';
    var errorType = q.errorType || '计算错误';
    var suggestion = '';

    // 1. 尝试从题目中提取算式并计算
    var calcResult = extractAndCalculate(text);

    if (calcResult) {
      correctAns = calcResult.answer;

      // 比对答案
      if (wrongAns) {
        var normalizedWrong = normalizeNumber(wrongAns);
        var normalizedCorrect = normalizeNumber(correctAns);

        if (normalizedWrong === normalizedCorrect) {
          analysis = '答案正确！' + calcResult.steps;
          errorType = '—';
          suggestion = '继续保持，注意检查计算过程。';
        } else {
          // 分析错误原因
          var errAnalysis = analyzeMathError(text, wrongAns, correctAns, calcResult);
          analysis = errAnalysis.analysis;
          errorType = errAnalysis.errorType;
          suggestion = errAnalysis.suggestion;
        }
      } else {
        analysis = calcResult.steps;
        suggestion = '请核对学生的实际作答。';
      }
    } else {
      // 无法自动计算，给出通用建议
      correctAns = '需手动批改';
      analysis = '此题需手动计算并比对。';

      // 根据题目关键词给出解题思路
      var hint = getMathHint(text, grade);
      if (hint) {
        analysis += '\n解题思路：' + hint;
        suggestion = hint;
      }
    }

    return {
      questionNo: q.questionNo,
      questionText: text,
      topic: q.topic || guessMathTopic(text),
      wrongAnswer: wrongAns,
      correctAnswer: correctAns,
      errorType: errorType,
      analysis: analysis,
      suggestion: suggestion || '建议同类题目再练3-5道。',
      difficulty: grade >= 5 ? '中等' : '基础'
    };
  }

  // 提取算式并计算
  function extractAndCalculate(text) {
    // 清理文本
    var clean = text.replace(/[？?。！!，,、\s]+/g, ' ').trim();

    // 模式1: 直接算式 "3/4 + 1/6"、"3.14 × 0.25"
    var exprMatch = clean.match(/([\d.]+\s*\/\s*\d+)\s*([+\-×÷])\s*([\d.]+\s*\/\s*\d+)/);
    if (!exprMatch) exprMatch = clean.match(/(\d+\.?\d*)\s*([+\-×÷])\s*(\d+\.?\d*)/);
    if (!exprMatch) exprMatch = clean.match(/(\d+)\s*([+\-×÷])\s*(\d+)/);

    if (exprMatch) {
      var left = parseExpression(exprMatch[1]);
      var op = exprMatch[2];
      var right = parseExpression(exprMatch[3]);

      if (left !== null && right !== null) {
        var result = null;
        var steps = '';

        if (op === '+' || op === '＋') {
          result = left + right;
          steps = left + ' + ' + right + ' = ' + formatResult(result);
        } else if (op === '-' || op === '－' || op === '—') {
          result = left - right;
          steps = left + ' - ' + right + ' = ' + formatResult(result);
        } else if (op === '×' || op === '*' || op === 'x' || op === 'X') {
          result = left * right;
          steps = left + ' × ' + right + ' = ' + formatResult(result);
        } else if (op === '÷' || op === '/') {
          if (right === 0) return null;
          result = left / right;
          steps = left + ' ÷ ' + right + ' = ' + formatResult(result);
        }

        if (result !== null) {
          return { answer: formatResult(result), steps: steps, expression: clean };
        }
      }
    }

    // 模式2: 比较大小
    var cmpMatch = clean.match(/(\d+\.?\d*)\s*[○◯〇]\s*(\d+\.?\d*)/);
    if (cmpMatch) {
      var a = parseFloat(cmpMatch[1]);
      var b = parseFloat(cmpMatch[2]);
      var cmpResult = a > b ? '>' : a < b ? '<' : '=';
      return {
        answer: cmpResult,
        steps: '比较 ' + a + ' 和 ' + b + '：' + a + ' ' + cmpResult + ' ' + b,
        expression: clean
      };
    }

    // 模式3: 分数化简
    var fracMatch = clean.match(/(\d+)\s*\/\s*(\d+)/);
    if (fracMatch) {
      var num = parseInt(fracMatch[1]);
      var den = parseInt(fracMatch[2]);
      var g = gcd(num, den);
      if (g > 1) {
        return {
          answer: (num/g) + '/' + (den/g),
          steps: num + '/' + den + ' = ' + (num/g) + '/' + (den/g) + '（分子分母同除以' + g + '）',
          expression: clean
        };
      }
    }

    return null;
  }

  function parseExpression(expr) {
    expr = expr.trim();
    // 分数：a/b
    var frac = expr.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) {
      return parseInt(frac[1]) / parseInt(frac[2]);
    }
    // 小数或整数
    var num = parseFloat(expr);
    return isNaN(num) ? null : num;
  }

  function formatResult(val) {
    if (val === Math.floor(val)) return '' + val;
    // 保留4位小数
    var rounded = Math.round(val * 10000) / 10000;
    return '' + rounded;
  }

  function normalizeNumber(str) {
    str = (str || '').trim();
    // 处理分数
    var frac = str.match(/^(\d+)\s*\/\s*(\d+)$/);
    if (frac) {
      var v = parseInt(frac[1]) / parseInt(frac[2]);
      return '' + Math.round(v * 10000) / 10000;
    }
    var n = parseFloat(str);
    if (!isNaN(n)) return '' + Math.round(n * 10000) / 10000;
    return str;
  }

  // 分析数学错误原因
  function analyzeMathError(question, wrongAns, correctAns, calcResult) {
    var wrongNum = parseFloat(wrongAns);
    var correctNum = parseFloat(correctAns);

    // 1. 检查是否小数点位错
    if (!isNaN(wrongNum) && !isNaN(correctNum)) {
      var diff = Math.abs(wrongNum - correctNum);
      var ratio = correctNum !== 0 ? wrongNum / correctNum : 0;

      if (Math.abs(ratio - 10) < 0.001 || Math.abs(ratio - 0.1) < 0.001) {
        return {
          errorType: '计算错误',
          analysis: '小数点位置错误。正确答案是 ' + correctAns + '，学生写了 ' + wrongAns + '。相差正好10倍，可能是小数点向左或向右多移了一位。',
          suggestion: '重点练习：小数乘法中的小数点定位规则。口诀：因数共有几位小数，积就有几位小数。'
        };
      }
    }

    // 2. 检查分数运算错误
    if (wrongAns.indexOf('/') > -1 || correctAns.indexOf('/') > -1) {
      return {
        errorType: '计算错误',
        analysis: '分数运算错误。' + calcResult.steps + '。学生答案 ' + wrongAns + ' 与正确答案不符，可能是通分或约分环节出错。',
        suggestion: '建议练习：异分母分数通分的步骤——找最小公倍数→分子分母同乘→分子相加减→约分。'
      };
    }

    // 3. 进位/借位错误
    if (!isNaN(wrongNum) && !isNaN(correctNum) && diff > 1 && diff < 100) {
      return {
        errorType: '计算错误',
        analysis: '答案偏差为 ' + Math.abs(diff) + '，可能是进位或借位遗漏。正确答案 ' + correctAns + '，学生写 ' + wrongAns + '。',
        suggestion: '建议竖式计算时在进位位置做小标记，例如在需要进位的数字上方打点。'
      };
    }

    // 4. 运算符号混淆
    if (/[+\-×÷]/.test(question) && !isNaN(wrongNum) && !isNaN(correctNum)) {
      var addResult = null, subResult = null;
      var nums = question.match(/\d+\.?\d*/g);
      if (nums && nums.length >= 2) {
        addResult = parseFloat(nums[0]) + parseFloat(nums[1]);
        subResult = parseFloat(nums[0]) - parseFloat(nums[1]);
        if (Math.abs(wrongNum - addResult) < 0.001 && Math.abs(correctNum - subResult) < 0.001) {
          return {
            errorType: '审题失误',
            analysis: '学生可能把题目看成了加法而不是减法。正确答案（减法）是 ' + correctAns + '，学生算成了加法 ' + wrongAns + '。',
            suggestion: '建议养成圈出运算符号的习惯，做题前先确认是加减乘除哪一种。'
          };
        }
      }
    }

    // 5. 默认：计算错误
    return {
      errorType: '计算错误',
      analysis: calcResult.steps + '。学生答案 ' + wrongAns + ' 与正确答案不符。',
      suggestion: '建议重新一步一步计算，检查每一步是否正确。养成验算习惯：做完后用逆运算验证（加用减验，乘用除验）。'
    };
  }

  function getMathHint(text, grade) {
    if (/分数/.test(text) || /\//.test(text)) {
      return '分数运算步骤：①通分（找分母最小公倍数）→②分子相加减→③约分到最简';
    }
    if (/小数/.test(text) || /\./.test(text)) {
      return '小数运算注意：小数点对齐，计算结果的小数位数=因数小数位数之和';
    }
    if (/面积/.test(text)) return '面积=长×宽（长方形）或 边长×边长（正方形），注意单位统一';
    if (/周长/.test(text)) return '周长=各边之和，长方形周长=(长+宽)×2';
    return '仔细审题，找出已知条件和所求，选择正确的运算方法。';
  }

  function guessMathTopic(text) {
    if (/分数|几分之/.test(text)) return '分数运算';
    if (/小数|\./.test(text)) return '小数运算';
    if (/面积/.test(text)) return '面积计算';
    if (/周长/.test(text)) return '周长计算';
    if (/方程|[xX]/.test(text)) return '方程';
    if (/多少|一共|还剩|比.*多|比.*少/.test(text)) return '应用题';
    return '数学计算';
  }

  // ===== 语文分析 =====
  function analyzeChineseQuestion(q, grade) {
    var text = (q.questionText || '').trim();
    var wrongAns = (q.wrongAnswer || '').trim();
    var analysis = '';
    var errorType = q.errorType || '其他';
    var suggestion = '';

    if (/阅读理解|概括|主旨|中心/.test(text)) {
      errorType = '概念不清';
      analysis = '阅读理解题考查对文章主旨和深层含义的理解。' + (wrongAns ? '学生的回答"' + wrongAns + '"可能停留在表面理解，未能抓住文章的核心思想。' : '');
      suggestion = '阅读三步法：①通读全文找主题 ②关注首尾段和反复出现的词 ③用自己的话概括。多读多练，积累常见文章的答题套路。';
    } else if (/默写|古诗|诗词/.test(text)) {
      errorType = '粗心大意';
      analysis = '默写题考查记忆和书写准确度。常见错误：漏字、错字、句序颠倒。' + (wrongAns ? '学生答案"' + wrongAns + '"可能缺漏或写错了关键字。' : '');
      suggestion = '建议采用"看→遮→写→对"四步法：先看原文→遮住默写→对照检查→批改订正。每天坚持10分钟。';
    } else if (/修辞|比喻|拟人|排比/.test(text)) {
      errorType = '概念不清';
      analysis = '修辞手法题需要准确判断修辞类型并分析其表达效果。本体和喻体的搭配要恰当、常见。';
      suggestion = '牢记常见修辞口诀：比喻"像什么"、拟人"会怎样"、排比"三个或以上"。多积累课文中的例句。';
    } else if (/拼音|汉字|部首|笔画/.test(text)) {
      errorType = '粗心大意';
      analysis = '字词基础题考查汉字书写规范。常见错误：形近字混淆、笔画顺序错误、部首判断不准。';
      suggestion = '每天练习5-10个易错字，制作"错字本"反复练习。利用部首归类法记忆形近字。';
    } else if (/作文|写作/.test(text)) {
      errorType = '方法错误';
      analysis = '写作题需要清晰的思路和丰富的素材。问题可能在于：结构不清晰、细节不够具体、中心不突出。';
      suggestion = '写作框架：开头（引入）→中间（事例+细节）→结尾（点题）。多用五感描写（看、听、闻、触、尝）让文章生动。';
    } else {
      analysis = '语文题需结合具体内容分析。注意审题要点，答题要完整、准确。';
      suggestion = '语文答题要点：①审清题意 ②分点作答 ③语句通顺 ④书写工整。';
    }

    return {
      questionNo: q.questionNo,
      questionText: text,
      topic: q.topic || '语文综合',
      wrongAnswer: wrongAns,
      correctAnswer: '需手动批改',
      errorType: errorType,
      analysis: analysis,
      suggestion: suggestion,
      difficulty: grade >= 5 ? '中等' : '基础'
    };
  }

  // ===== 英语分析 =====
  function analyzeEnglishQuestion(q, grade) {
    var text = (q.questionText || '').trim();
    var wrongAns = (q.wrongAnswer || '').trim();
    var analysis = '';
    var errorType = q.errorType || '其他';
    var suggestion = '';
    var correctAns = '需手动批改';

    // 尝试自动检测常见题型
    if (/[Ww]hat|Where|When|Who|How|Do|Does|Is|Are|Can|Will/.test(text)) {
      errorType = '方法错误';
      // 检查助动词
      if (/Do.*do|Does.*does/.test(text) && /your father|he|she|it/.test(text)) {
        correctAns = 'does';
        analysis = '第三人称单数（he/she/it/your father）问句要用does，不能用do。学生写了"' + wrongAns + '"。';
        suggestion = '口诀：三单主语配does，其他用do。注意does后面动词用原形！';
      } else if (/I.*am|you.*are|he.*is|she.*is|it.*is/.test(text)) {
        if (wrongAns.toLowerCase().indexOf('be') > -1 || wrongAns === 'is' && !/he|she|it/.test(text)) {
          analysis = 'be动词使用错误。I用am，you用are，he/she/it用is。学生写了"' + wrongAns + '"。';
          suggestion = 'be动词口诀：I用am，you用are，is跟着他她它，复数全部都用are。';
          correctAns = /he|she|it/i.test(text) ? 'is' : /you/i.test(text) ? 'are' : 'am';
        }
      }
    }

    if (/spell|拼写|单词|write|vocabulary/.test(text) || /写出.*英文/.test(text)) {
      errorType = '粗心大意';
      if (wrongAns && wrongAns.length > 1) {
        // 拼写分析
        analysis = '词汇拼写错误。"' + wrongAns + '"与正确拼写不符。' + analyzeSpelling(wrongAns);
      } else {
        analysis = '词汇题需掌握单词的正确拼写。';
      }
      suggestion = '记单词技巧：①按音节拆分 ②联想记忆 ③制作单词卡片 ④每天听写5个易错词。';
    }

    if (/translate|翻译|英译|汉译/.test(text)) {
      errorType = '方法错误';
      analysis = '翻译题需要注意语序和时态。中文和英文的语序不同，逐词翻译会导致错误。';
      suggestion = '翻译步骤：①确定时态 ②找出主谓宾 ③翻译核心结构 ④添加修饰成分。';
    }

    if (!analysis) {
      analysis = '需要结合具体题目和答案进行批改。' + (wrongAns ? '学生答案"' + wrongAns + '"请核对是否正确。' : '');
      suggestion = grade >= 5 ? '建议每天朗读课文10分钟，培养语感。每周背5个新句型。' : '建议每天跟读课文，模仿语音语调。玩英语拼词游戏加强记忆。';
    }

    return {
      questionNo: q.questionNo,
      questionText: text,
      topic: q.topic || '英语综合',
      wrongAnswer: wrongAns,
      correctAnswer: correctAns,
      errorType: errorType,
      analysis: analysis,
      suggestion: suggestion,
      difficulty: grade >= 5 ? '中等' : '基础'
    };
  }

  function analyzeSpelling(word) {
    var analysis = '';
    var len = (word || '').length;

    if (len < 4) {
      analysis = '短单词要注意字母顺序。';
    } else if (len < 7) {
      analysis = '中等长度单词，可能是某个音节拼错。';
    } else {
      analysis = '长单词建议按音节拆分记忆。';
    }

    // 常见拼写错误模式
    if (/ie|ei/.test(word)) analysis += ' 注意ie/ei规则：除了c后面跟ei，其他都是ie。';
    if (/([a-z])\1/.test(word)) analysis += ' 注意双写辅音字母。';
    if (/tion|sion/.test(word)) analysis += ' 注意tion/sion结尾的拼写。';

    return analysis;
  }

  function gcd(a, b) {
    a = Math.abs(a); b = Math.abs(b);
    while (b) { var t = b; b = a % b; a = t; }
    return a || 1;
  }

  return {
    autoGrade: autoGrade
  };
})();
