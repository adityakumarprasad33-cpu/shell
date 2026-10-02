/**
 * Runix Core — Proprietary Rate Limit Engine
 * Token Bucket & Sliding Window concurrency algorithm.
 * No external SaaS dependencies. Runix Core owns all security boundaries.
 */

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRatePerSec: number;
}

export interface RateLimitOptions {
  key: string;
  limitType?: 'ip' | 'account' | 'endpoint' | 'action' | 'session';
  capacity?: number;
  refillRatePerSec?: number;
  cost?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  retryAfterSec?: number;
  limitType: string;
}

export class RunixRateLimitEngine {
  private static instance: RunixRateLimitEngine;
  private buckets: Map<string, TokenBucket> = new Map();
  private activeExecutions: Map<string, number> = new Map(); // Concurrency tracker
  private maxConcurrentPerAccount = 3;

  private constructor() {
    // Periodic garbage collection of stale buckets every 5 minutes
    if (typeof setInterval !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000).unref?.();
    }
  }

  public static getInstance(): RunixRateLimitEngine {
    if (!RunixRateLimitEngine.instance) {
      RunixRateLimitEngine.instance = new RunixRateLimitEngine();
    }
    return RunixRateLimitEngine.instance;
  }

  /**
   * Acquire execution slot under strict concurrency limits
   */
  public acquireExecutionSlot(accountId: string): boolean {
    const current = this.activeExecutions.get(accountId) || 0;
    if (current >= this.maxConcurrentPerAccount) {
      return false;
    }
    this.activeExecutions.set(accountId, current + 1);
    return true;
  }

  /**
   * Release execution slot when process terminates
   */
  public releaseExecutionSlot(accountId: string): void {
    const current = this.activeExecutions.get(accountId) || 0;
    if (current <= 1) {
      this.activeExecutions.delete(accountId);
    } else {
      this.activeExecutions.set(accountId, current - 1);
    }
  }

  /**
   * Consume tokens from a named token bucket
   */
  public consume(options: RateLimitOptions): RateLimitResult {
    const {
      key,
      limitType = 'action',
      capacity = 30, // default burst capacity
      refillRatePerSec = 5, // default replenish rate
      cost = 1,
    } = options;

    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefill: now,
        capacity,
        refillRatePerSec,
      };
      this.buckets.set(key, bucket);
    } else {
      // Calculate token refill since last check
      const elapsedSec = (now - bucket.lastRefill) / 1000;
      bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsedSec * bucket.refillRatePerSec);
      bucket.lastRefill = now;
    }

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      return {
        allowed: true,
        remainingTokens: Math.floor(bucket.tokens),
        limitType,
      };
    } else {
      const missingTokens = cost - bucket.tokens;
      const retryAfterSec = Math.ceil(missingTokens / bucket.refillRatePerSec);
      return {
        allowed: false,
        remainingTokens: 0,
        retryAfterSec,
        limitType,
      };
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      // Remove buckets idle for over 15 minutes
      if (now - bucket.lastRefill > 15 * 60 * 1000) {
        this.buckets.delete(key);
      }
    }
  }
}

export const rateLimitEngine = RunixRateLimitEngine.getInstance();
