class TokenStore {
  constructor() {
    this.tokens = new Map();
  }

  addToken(token, expiresInMs = 5 * 60 * 1000) {
    const expiresAt = Date.now() + expiresInMs;
    this.tokens.set(token, expiresAt);
    // Schedule token removal after expiration
    setTimeout(() => {
      this.tokens.delete(token);
    }, expiresInMs);
  }
  

  isValid(token) {
    if (!this.tokens.has(token)) {
      return false;
    }
    const expiresAt = this.tokens.get(token);
    if (Date.now() > expiresAt) {
      this.tokens.delete(token);
      return false;
    }
    return true;
  }
}

const tokenStore = new TokenStore();

module.exports = tokenStore;
