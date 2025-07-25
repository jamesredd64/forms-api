// /api/index.js
module.exports = async (req, res) => {
    res.status(200).send('Forms API is running');
};
  
app.post('/simulate-form', async (req, res) => {
  const simulatedPayload = {
    token: 'test-token',
    payload: {
      name: 'Mock Form',
      submittedAt: new Date().toISOString(),
      data: {
        'First Name': 'James',
        'Last Name': 'Redd',
        'E-Mail': 'jredd2013@gmail.com',
        'Event Time': '2025-07-30T15:00',
        eventName: 'Kilmer Branch Library',
        eventLocation: '101 Melody Ln, Fort Pierce, Florida 34950'
      }
    }
  };

  try {
    const response = await fetch('http://localhost:5001/api/submit-form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(simulatedPayload)
    });

    const result = await response.json();
    res.json(result);
  } catch (err) {
    console.error('Simulate failed:', err.message);
    res.status(500).json({ error: err.message });
  }
});

  