// Request deduplicator to prevent duplicate API calls
class RequestDeduplicator {
  constructor() {
    this.pending = new Map();
  }

  async dedupe(key, requestFn) {
    // If there's already a pending request with this key, return it
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // Create new request promise
    const promise = requestFn()
      .then(result => {
        this.pending.delete(key);
        return result;
      })
      .catch(error => {
        this.pending.delete(key);
        throw error;
      });

    // Store the promise
    this.pending.set(key, promise);
    
    return promise;
  }

  clear(key) {
    if (key) {
      this.pending.delete(key);
    } else {
      this.pending.clear();
    }
  }
}

export const requestDeduplicator = new RequestDeduplicator();