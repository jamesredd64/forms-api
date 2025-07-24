const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
};

let client;
let db;

async function getDb() {
  // Reuse connection across function invocations
  if (!client || !client.topology || !client.topology.isConnected()) {
    client = new MongoClient(uri, options);
    await client.connect();
  }

  if (!db) {
    const dbName = process.env.MONGODB_DB_NAME || 'mongo_users-react-dev';
    db = client.db(dbName);
  }

  return db;
}

module.exports = { getDb };

