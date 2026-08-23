fetch("http://localhost:3000/api/orders/test-1", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    id: "test-1",
    customer_name: "Test Entry",
    quantity: "2 kg",
    total_amount: 1500
  })
}).then(res => res.json()).then(console.log).catch(console.error);
