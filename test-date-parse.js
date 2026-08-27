// 测试日期解析
const testDates = ["2026.8.24", "2026.8.3", "2026.8.10"];

testDates.forEach(d => {
  const date = new Date(d);
  console.log(`${d} -> ${date} -> ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
});

// 正确的解析方式
function parseDate(dateStr) {
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts;
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}

console.log('\n正确的解析方式:');
testDates.forEach(d => {
  const date = parseDate(d);
  if (date) {
    console.log(`${d} -> ${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  } else {
    console.log(`${d} -> 无效日期`);
  }
});
