const http = require('http');
http.get('http://localhost:3000/api/orders', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const orders = JSON.parse(data);
    console.log(JSON.stringify(orders[0], null, 2));
  });
});
