// simulate-webflow.mjs

const payload = {
    name: 'Test User',
    email: 'test@example.com',
    message: 'Simulated Webflow form data'
  };
  
  const response = await fetch('http://localhost:3000/api/submit-form', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    
    body: JSON.stringify(payload)
  });
  console.log('Status:', response.status);
console.log('Headers:', response.headers.get('content-type'));
 
const rawText = await response.text();
console.log('Raw response:', rawText);

  const result = await response.json();
  console.log('Server responded with:', result);
  