const state = {
    invNo: "INV-123",
    date: new Date().toISOString(),
    buyer: "",
    form: { "someField": "someValue" },
    products: [
        { desc: "Test item", qty: 1, rate: 100 }
    ]
};

fetch('http://localhost:5000/api/invoices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
})
.then(res => res.json())
.then(data => console.log("Response:", data))
.catch(err => console.error("Error:", err));
