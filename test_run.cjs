const { getCountdownInfo } = require('./src/lib/timeUtils.cjs');

const order = {
  status: 'pending',
  delivery_date: '2026-09-07',
  delivery_time_expected: '18:00'
};

const nowTime = new Date('2026-09-07T17:40:00Z').getTime();
const cInfo = getCountdownInfo(order, nowTime);
console.log('cInfo', cInfo);
