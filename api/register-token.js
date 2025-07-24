const { v4: uuidv4 } = require('uuid');
const tokenStore = require('../utils/tokenStore.js'); // adjust path if needed

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const token = uuidv4();
  tokenStore.addToken(token);
  return res.status(200).json({ token });
};
