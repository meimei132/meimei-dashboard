// 智能数据解析器
// 根据数据类型和内容自动推断字段，不依赖硬编码列名

/**
 * 判断字符串是否是中文字符（2-4 个汉字）
 */
function isChineseName(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  // 匹配 2-4 个汉字，可能包含·（用于外国名字）
  return /^[\u4e00-\u9fa5·]{2,6}$/.test(trimmed);
}

/**
 * 判断是否是时间段格式（如 08:00-09:00, 14:00-15:00）
 */
function isTimeSlot(str) {
  if (typeof str !== 'string') return false;
  const trimmed = str.trim();
  // 匹配 HH:MM-HH:MM 或 HH:MM~HH:MM 格式
  return /^\d{1,2}:\d{2}[-~]\d{1,2}:\d{2}$/.test(trimmed);
}

/**
 * 判断是否是日期格式
 */
function isDate(str) {
  if (typeof str !== 'string' && typeof str !== 'number') return false;
  
  // Excel 序列号（数字）
  if (typeof str === 'number') {
    return str > 30000 && str < 60000; // 2000-2060 年的 Excel 序列号范围
  }
  
  const strVal = String(str).trim();
  
  // 2026-08-27
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(strVal)) return true;
  // 2026/08/27
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(strVal)) return true;
  // 20260827
  if (/^\d{8}$/.test(strVal)) return true;
  // 2026.8.27
  if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(strVal)) return true;
  
  return false;
}

/**
 * 判断是否是数值
 */
function isNumber(val) {
  if (val === null || val === undefined || val === '') return false;
  const num = parseFloat(val);
  return !isNaN(num);
}

/**
 * 智能推断列类型
 * @param {Array} columnValues - 该列的所有值（前 20 行）
 * @returns {string} 列类型：'date', 'streamer', 'timeSlot', 'consume', 'premium', 'policies', 'roi', 'avgPolicy', 'ctr', 'unknown'
 */
function inferColumnType(columnValues) {
  // 过滤空值
  const nonEmpty = columnValues.filter(v => v !== null && v !== undefined && v !== '');
  if (nonEmpty.length === 0) return 'unknown';
  
  // 统计各种类型的匹配数
  let dateCount = 0;
  let chineseNameCount = 0;
  let timeSlotCount = 0;
  let numberCount = 0;
  let smallIntCount = 0;  // 0-1000 的整数
  let mediumNumCount = 0;  // 0-10 的小数
  let largeNumCount = 0;   // >1000 的数字
  let veryLargeNumCount = 0; // >100000 的数字
  
  for (const val of nonEmpty.slice(0, 20)) { // 只检查前 20 个非空值
    if (isDate(val)) dateCount++;
    if (isChineseName(val)) chineseNameCount++;
    if (isTimeSlot(val)) timeSlotCount++;
    
    if (isNumber(val)) {
      numberCount++;
      const num = parseFloat(val);
      
      if (Number.isInteger(num) && num >= 0 && num <= 1000) {
        smallIntCount++;
      }
      if (num >= 0 && num <= 10 && !Number.isInteger(num)) {
        mediumNumCount++;
      }
      if (num > 1000) {
        largeNumCount++;
      }
      if (num > 100000) {
        veryLargeNumCount++;
      }
    }
  }
  
  const total = nonEmpty.slice(0, 20).length;
  const threshold = total * 0.6; // 60% 阈值
  
  // 按优先级判断
  if (dateCount >= threshold) return 'date';
  if (chineseNameCount >= threshold) return 'streamer';
  if (timeSlotCount >= threshold) return 'timeSlot';
  
  // 数字类型根据数值范围判断
  if (numberCount >= threshold) {
    if (veryLargeNumCount >= threshold * 0.7) return 'premium';  // 大部分是超大数字 → 保费
    if (largeNumCount >= threshold * 0.7) return 'consume';  // 大部分是大数字 → 消耗
    if (smallIntCount >= threshold * 0.7) return 'policies';  // 大部分是小整数 → 保单数
    if (mediumNumCount >= threshold * 0.7) return 'roi';  // 大部分是 0-10 的小数 → ROI
    
    // 如果混合了大数字和中等数字，可能是件均
    if (largeNumCount > 0 && mediumNumCount > 0) return 'avgPolicy';
    
    return 'consume';  // 默认是消耗
  }
  
  return 'unknown';
}

/**
 * 智能解析表格数据
 * @param {Array} rows - 表格的所有行
 * @returns {Object} 列映射 { date: 0, streamer: 1, timeSlot: 2, ... }
 */
function inferColumnMapping(rows) {
  if (rows.length < 2) return null;
  
  // 获取列数（取第一行的长度）
  const numCols = rows[0].length;
  
  // 收集每列的前 20 个值
  const columnSamples = [];
  for (let col = 0; col < numCols; col++) {
    const samples = [];
    for (let row = 1; row < Math.min(rows.length, 21); row++) {
      samples.push(rows[row][col]);
    }
    columnSamples.push(samples);
  }
  
  // 推断每列的类型
  const columnTypes = columnSamples.map(samples => inferColumnType(samples));
  
  // 构建列映射
  const mapping = {};
  columnTypes.forEach((type, index) => {
    if (type !== 'unknown') {
      if (mapping[type] === undefined) {
        mapping[type] = index;
      } else {
        // 如果同一类型有多列，保留第一列
        console.log(`  警告：类型 "${type}" 有多列（列${mapping[type]}和列${index}），保留列${mapping[type]}`);
      }
    }
  });
  
  return mapping;
}

/**
 * Excel 序列号转日期字符串
 */
function excelSerialToDate(serial) {
  const utcDays = serial - 25569;
  const utcMs = utcDays * 86400 * 1000;
  const d = new Date(utcMs);
  return `${d.getUTCFullYear()}.${d.getUTCMonth()+1}.${d.getUTCDate()}`;
}

/**
 * 标准化日期格式
 */
function normalizeDate(dateVal) {
  if (typeof dateVal === 'number') {
    return excelSerialToDate(dateVal);
  }
  
  const str = String(dateVal).trim();
  
  // 2026-08-27 → 2026.8.27
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    const parts = str.split('-');
    return `${parts[0]}.${parseInt(parts[1])}.${parseInt(parts[2])}`;
  }
  
  // 2026/08/27 → 2026.8.27
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str)) {
    const parts = str.split('/');
    return `${parts[0]}.${parseInt(parts[1])}.${parseInt(parts[2])}`;
  }
  
  // 20260827 → 2026.8.27
  if (/^\d{8}$/.test(str)) {
    const year = str.substring(0, 4);
    const month = parseInt(str.substring(4, 6));
    const day = parseInt(str.substring(6, 8));
    return `${year}.${month}.${day}`;
  }
  
  // 已经是 2026.8.27 格式
  if (/^\d{4}\.\d{1,2}\.\d{1,2}$/.test(str)) {
    return str;
  }
  
  return str;
}

module.exports = {
  inferColumnMapping,
  normalizeDate,
  isChineseName,
  isTimeSlot,
  isDate,
};
